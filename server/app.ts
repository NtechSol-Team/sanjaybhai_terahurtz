import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { createServer } from "http";

const app = express();

// When running behind a proxy (e.g. Vercel, Render, Heroku), enable trust proxy
if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
}

// Security: HTTP headers
app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === "production" ? undefined : false,
}));

// Security: Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
});
app.use("/api/", limiter);

// Enable gzip compression
app.use(compression());

declare module "http" {
    interface IncomingMessage {
        rawBody: unknown;
    }
}

app.use(
    express.json({
        verify: (req, _res, buf) => {
            req.rawBody = buf;
        },
    }),
);

app.use(express.urlencoded({ extended: false }));

// Configure CORS
const clientOrigin =
    process.env.CLIENT_ORIGIN ||
    (process.env.NODE_ENV === "production" ? "*" : "http://localhost:5173");
app.use(cors({ origin: clientOrigin }));

export function log(message: string, source = "express") {
    const formattedTime = new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
    });
    console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
        capturedJsonResponse = bodyJson;
        return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
        const duration = Date.now() - start;
        if (path.startsWith("/api")) {
            const status = res.statusCode;
            const statusIcon = status >= 200 && status < 300 ? "✓" : status >= 400 ? "✗" : "";
            log(`${req.method} ${path} ${status} ${statusIcon} in ${duration}ms`);
        }
    });

    next();
});

// Lazy-initialized promise so we only boot once per serverless cold start
let initPromise: Promise<void> | null = null;

export async function initializeApp(): Promise<void> {
    if (initPromise) return initPromise;

    initPromise = (async () => {
        await storage.initialize();
        setupAuth(app);
        const httpServer = createServer(app);
        await registerRoutes(httpServer, app);

        app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
            if (!res.headersSent) {
                const status = err.status || err.statusCode || 500;
                const message = err.message || "Internal Server Error";
                res.status(status).json({ message });
            }
            console.error("Unhandled error:", err);
        });
    })();

    return initPromise;
}

export default app;

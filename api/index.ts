import { VercelRequest, VercelResponse } from "@vercel/node";
import app, { initializeApp } from "../server/app.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Ensure the database, storage, and routes are fully initialized 
    // before handling the request on a cold start
    await initializeApp();

    // Vercel serverless functions inject req and res, 
    // we just pass them directly to the Express app instance
    return app(req as any, res as any);
}

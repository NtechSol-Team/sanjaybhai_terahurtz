import "dotenv/config";
import { createServer } from "http";
import app, { initializeApp, log } from "./app.js";
import { serveStatic } from "./static.js";

(async () => {
  try {
    await initializeApp();

    // Serve static files (built client) or Vite dev server
    if (process.env.NODE_ENV === "production") {
      serveStatic(app);
    } else {
      const { setupVite } = await import("./vite.js");
      const httpServer = createServer(app);
      await setupVite(httpServer, app);
      const port = parseInt(process.env.PORT || "5050", 10);
      httpServer.listen(port, "0.0.0.0", () => {
        log(`serving on port ${port}`);
      });
      return;
    }

    const port = parseInt(process.env.PORT || "5050", 10);
    const httpServer = createServer(app);
    httpServer.listen(port, "0.0.0.0", () => {
      log(`serving on port ${port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();

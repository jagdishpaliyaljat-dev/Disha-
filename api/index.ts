import type { IncomingMessage, ServerResponse } from "http";
import app from "../server";

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  return new Promise<void>((resolve) => {
    res.on("finish", () => resolve());
    res.on("close", () => resolve());

    try {
      let targetUrl = req.url || "/";
      const xVercelOriginalUrl = req.headers["x-vercel-original-url"] as string;
      const xForwardedUrl = req.headers["x-forwarded-url"] as string;
      const xOriginalUrl = req.headers["x-original-url"] as string;
      const xMatchedPath = (req.headers["x-matched-path"] || req.headers["x-vercel-matched-path"]) as string;

      let originalPath = "";
      if (xVercelOriginalUrl && !xVercelOriginalUrl.startsWith("/api")) {
        originalPath = xVercelOriginalUrl;
      } else if (xForwardedUrl && !xForwardedUrl.startsWith("/api")) {
        originalPath = xForwardedUrl;
      } else if (xOriginalUrl && !xOriginalUrl.startsWith("/api")) {
        originalPath = xOriginalUrl;
      } else if (xMatchedPath && !xMatchedPath.startsWith("/api")) {
        originalPath = xMatchedPath;
      } else if (targetUrl && !targetUrl.startsWith("/api")) {
        originalPath = targetUrl;
      }

      if (originalPath) {
        req.url = originalPath;
      }

      (app as any)(req, res);
    } catch (err: any) {
      console.error("[Vercel Serverless Handler Error]", err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({
          error: "Internal Server Error",
          message: err?.message || "An unexpected error occurred on the server.",
        }));
      }
      resolve();
    }
  });
}

import type { IncomingMessage, ServerResponse } from "http";
// @ts-ignore - generated at build time
import serverModule from "../dist/server.cjs";

function getHandler(): ((req: any, res: any) => Promise<any>) | null {
  const mod: any = serverModule;
  if (typeof mod === "function") return mod;
  if (typeof mod?.default === "function") return mod.default;
  if (typeof mod?.default?.default === "function") return mod.default.default;
  return null;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  return new Promise<void>(async (resolve) => {
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

      const serverHandler = getHandler();
      if (!serverHandler) {
        throw new Error("Could not resolve serverHandler function from serverModule");
      }
      console.log(`[Vercel Serverless] ${req.method} ${req.url} (original: ${originalPath || "none"})`);
      await serverHandler(req as any, res as any);
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

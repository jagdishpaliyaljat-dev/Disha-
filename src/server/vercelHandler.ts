import type { IncomingMessage, ServerResponse } from "http";
import app from "../../server";

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  return new Promise<void>((resolve) => {
    res.on("finish", () => resolve());
    res.on("close", () => resolve());

    try {
      const originalPath = (req.headers["x-vercel-original-url"] as string)
        || (req.headers["x-forwarded-url"] as string)
        || (req.headers["x-original-url"] as string)
        || req.url
        || "/";

      req.url = originalPath;

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

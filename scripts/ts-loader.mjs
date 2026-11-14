import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") || specifier.startsWith("/")) {
    const parentPath = context.parentURL ? fileURLToPath(context.parentURL) : process.cwd();
    const parentDir = path.dirname(parentPath);
    const resolvedPath = path.resolve(parentDir, specifier);

    // Try extensions: .ts, .tsx, /index.ts
    const extensions = [".ts", ".tsx", "/index.ts", "/index.tsx"];
    for (const ext of extensions) {
      const candidate = resolvedPath + ext;
      if (fs.existsSync(candidate)) {
        return {
          url: pathToFileURL(candidate).href,
          shortCircuit: true,
        };
      }
    }
  }

  // Intercept mock packages if missing from node_modules
  if (specifier === "firebase" || specifier.startsWith("firebase/") || specifier === "localforage" || specifier === "canvas-confetti") {
    const mockPath = path.resolve(process.cwd(), "scripts/mock-firebase-node.mjs");
    return {
      url: pathToFileURL(mockPath).href,
      shortCircuit: true,
    };
  }

  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".json")) {
    const filePath = fileURLToPath(url);
    const content = fs.readFileSync(filePath, "utf8");
    return {
      format: "json",
      shortCircuit: true,
      source: content,
    };
  }
  return nextLoad(url, context);
}

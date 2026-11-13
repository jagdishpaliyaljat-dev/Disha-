import { loadSettingsFromStorage } from "./storage";
import { auth } from "../lib/firebase";

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let finalUrl = url;
  if (typeof window === "undefined" && url.startsWith("/")) {
    finalUrl = `http://localhost:3000${url}`;
  }

  let settings: any = {};
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    try {
      settings = loadSettingsFromStorage();
    } catch (_) {}
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };

  // Attach verified Firebase Auth ID token for backend Authorization
  if (!headers["Authorization"] && !headers["authorization"]) {
    try {
      if (auth?.currentUser) {
        const idToken = await auth.currentUser.getIdToken();
        if (idToken) {
          headers["Authorization"] = `Bearer ${idToken}`;
        }
      }
    } catch (_) {}
  }

  // Attach user-specific AI key if available in settings
  const keys = Array.isArray(settings.personalAiKeys) ? settings.personalAiKeys : [];
  let activeKey = keys.find((k: any) => k.id === settings.activePersonalKeyId && k.enabled && k.apiKey?.trim())
    || keys.find((k: any) => k.enabled && k.apiKey?.trim());
  
  if (!activeKey && settings.geminiApiKey?.trim()) {
    activeKey = {
      id: "legacy",
      provider: "gemini",
      apiKey: settings.geminiApiKey.trim(),
      model: "gemini-1.5-flash",
      enabled: true,
    };
  }

  if (activeKey && activeKey.apiKey && activeKey.apiKey.trim()) {
    const cleanKey = activeKey.apiKey.trim();
    if (!headers["X-AI-Api-Key"]) headers["X-AI-Api-Key"] = cleanKey;
    if (!headers["X-Gemini-Api-Key"]) headers["X-Gemini-Api-Key"] = cleanKey;
    if (!headers["X-AI-Provider"]) headers["X-AI-Provider"] = activeKey.provider || "gemini";
    if (activeKey.model && !headers["X-AI-Model"]) {
      headers["X-AI-Model"] = activeKey.model;
    }
  }

  return fetch(finalUrl, {
    ...options,
    headers,
  });
}

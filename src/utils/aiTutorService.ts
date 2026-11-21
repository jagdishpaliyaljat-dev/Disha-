import { loadSettingsFromStorage } from "./storage";
import { executeAICompletion, PROVIDER_RECOMMENDED_MODELS } from "./aiProviderService";
import { AIProvider, Question } from "../types";
import { recordAIUsage } from "./aiUsageTracker";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  suggestedAction?: {
    label: string;
    tab?: string;
    action?: string;
  };
}

const AI_TUTOR_CACHE_KEY = "disha2020_ai_tutor_cache_v1";

function getCachedAnswer(cacheKey: string): string | null {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(AI_TUTOR_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed[cacheKey] || null;
  } catch {
    return null;
  }
}

function setCachedAnswer(cacheKey: string, answer: string): void {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return;
    const raw = localStorage.getItem(AI_TUTOR_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    parsed[cacheKey] = answer;
    // Keep cache size bounded to last 100 queries
    const keys = Object.keys(parsed);
    if (keys.length > 100) {
      delete parsed[keys[0]];
    }
    localStorage.setItem(AI_TUTOR_CACHE_KEY, JSON.stringify(parsed));
  } catch {}
}

export function getActiveAICredentials(): {
  configured: boolean;
  provider: AIProvider;
  apiKey: string;
  model: string;
} {
  const settings = loadSettingsFromStorage();
  const envGemini = (typeof import.meta !== "undefined" && import.meta.env?.VITE_GEMINI_API_KEY) || "";

  // 1. If user explicitly enabled personal keys mode, use their personal key
  if (settings.aiMode === "personal_keys" || settings.useCustomApiKey) {
    const keys = Array.isArray(settings.personalAiKeys) ? settings.personalAiKeys : [];
    let activeKey = keys.find((k: any) => k.id === settings.activePersonalKeyId && k.enabled && k.apiKey?.trim())
      || keys.find((k: any) => k.enabled && k.apiKey?.trim());

    if (activeKey && activeKey.apiKey?.trim()) {
      const provider = activeKey.provider || "gemini";
      const defaultModel = PROVIDER_RECOMMENDED_MODELS[provider]?.[0]?.id || "gemini-flash-lite-latest";
      let chosenModel = activeKey.model || defaultModel;
      if (provider === "gemini" && (!chosenModel || chosenModel.includes("2.0") || chosenModel.includes("1.5") || chosenModel.includes("2.5") || chosenModel === "default" || chosenModel === "gemini-flash-latest")) {
        chosenModel = "gemini-flash-lite-latest";
      }
      return {
        configured: true,
        provider,
        apiKey: activeKey.apiKey.trim(),
        model: chosenModel,
      };
    }

    if (settings.geminiApiKey?.trim()) {
      return {
        configured: true,
        provider: "gemini",
        apiKey: settings.geminiApiKey.trim(),
        model: "gemini-flash-lite-latest",
      };
    }
  }

  // 2. Global / Platform default fallback (built-in Vercel/Vite environment key)
  if (envGemini.trim()) {
    return {
      configured: true,
      provider: "gemini",
      apiKey: envGemini.trim(),
      model: "gemini-flash-lite-latest",
    };
  }

  // 3. Secondary fallback: check if user has custom keys even if aiMode was not explicitly switched
  const keys = Array.isArray(settings.personalAiKeys) ? settings.personalAiKeys : [];
  let activeKey = keys.find((k: any) => k.id === settings.activePersonalKeyId && k.enabled && k.apiKey?.trim())
    || keys.find((k: any) => k.enabled && k.apiKey?.trim());

  if (activeKey && activeKey.apiKey?.trim()) {
    const provider = activeKey.provider || "gemini";
    const defaultModel = PROVIDER_RECOMMENDED_MODELS[provider]?.[0]?.id || "gemini-flash-lite-latest";
    let chosenModel = activeKey.model || defaultModel;
    if (provider === "gemini" && (!chosenModel || chosenModel.includes("2.0") || chosenModel.includes("1.5") || chosenModel.includes("2.5") || chosenModel === "default" || chosenModel === "gemini-flash-latest")) {
      chosenModel = "gemini-flash-lite-latest";
    }
    return {
      configured: true,
      provider,
      apiKey: activeKey.apiKey.trim(),
      model: chosenModel,
    };
  }

  if (settings.geminiApiKey?.trim()) {
    return {
      configured: true,
      provider: "gemini",
      apiKey: settings.geminiApiKey.trim(),
      model: "gemini-flash-lite-latest",
    };
  }

  const envOpenRouter = (typeof import.meta !== "undefined" && import.meta.env?.VITE_OPENROUTER_API_KEY) || "";
  if (envOpenRouter.trim()) {
    return {
      configured: true,
      provider: "openrouter",
      apiKey: envOpenRouter.trim(),
      model: "deepseek/deepseek-chat",
    };
  }

  // Antigravity Pro Local Proxy auto-detection (if actively configured)
  const envProxyUrl = (typeof import.meta !== "undefined" && import.meta.env?.VITE_AI_PROXY_URL) || "";
  const envProxyKey = (typeof import.meta !== "undefined" && import.meta.env?.VITE_AI_PROXY_KEY) || "";
  if (envProxyUrl && envProxyKey && envProxyKey !== "cliproxy-local") {
    return {
      configured: true,
      provider: "cliproxy",
      apiKey: envProxyKey,
      model: "gemini-flash-latest",
    };
  }

  return {
    configured: false,
    provider: "gemini",
    apiKey: "",
    model: "gemini-flash-latest",
  };
}

const SYSTEM_PROMPT_STUDY_TUTOR = `You are "Disha AI Tutor"—the expert, motivating, and friendly digital mentor of the DISHA 20-20 Competitive Exam Preparation App.
Your Role:
1. Provide clear, authoritative, and engaging academic guidance for competitive examinations (UPSC, State PSC, REET, Police, CET, SSC, etc.) in English.
2. Always deliver structured, bullet-point answers that are easy to retain and memorize.
3. Highlight high-yield exam facts and helpful memory mnemonics.
4. Maintain a positive, inspiring, and encouraging tone.
5. Format answers neatly in clean Markdown (headings, bold keywords, numbered and bulleted lists).`;

/**
 * Ask a general study, syllabus, or doubt question to Disha AI Tutor
 */
export async function askDishaAITutor(
  userPrompt: string,
  chatHistory: { role: string; content: string }[] = [],
  onChunk?: (chunk: string, fullText: string) => void
): Promise<string> {
  const credentials = getActiveAICredentials();
  if (!credentials.configured) {
    throw new Error("NO_API_KEY");
  }

  const cacheKey = `prompt_${userPrompt.trim().toLowerCase().slice(0, 80)}`;
  const cached = getCachedAnswer(cacheKey);
  if (cached && chatHistory.length === 0) {
    if (onChunk) onChunk(cached, cached);
    return cached;
  }

  // Format context with recent history
  let fullPrompt = userPrompt;
  if (chatHistory.length > 0) {
    const recent = chatHistory.slice(-4).map(m => `${m.role === 'user' ? 'Student' : 'Disha AI'}: ${m.content}`).join("\n");
    fullPrompt = `Previous Conversation:\n${recent}\n\nStudent's New Question:\n${userPrompt}`;
  }

  const startTime = Date.now();
  try {
    const response = await executeAICompletion({
      provider: credentials.provider,
      apiKey: credentials.apiKey,
      model: credentials.model,
      prompt: fullPrompt,
      systemPrompt: SYSTEM_PROMPT_STUDY_TUTOR,
      temperature: 0.3,
      onChunk,
    });

    const latencyMs = Date.now() - startTime;
    recordAIUsage({
      provider: credentials.provider,
      model: credentials.model,
      queryType: "doubt",
      prompt: userPrompt,
      response,
      latencyMs,
      status: "success",
    });

    if (response && chatHistory.length === 0) {
      setCachedAnswer(cacheKey, response);
    }

    return response;
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    recordAIUsage({
      provider: credentials.provider,
      model: credentials.model,
      queryType: "doubt",
      prompt: userPrompt,
      latencyMs,
      status: "error",
      errorMessage: err?.message || String(err),
    });
    throw err;
  }
}

/**
 * Generate a comprehensive 4-part explanation for any MCQ Question
 */
export async function explainQuestionWithAI(
  question: Question,
  onChunk?: (chunk: string, fullText: string) => void
): Promise<string> {
  const qText = question.text || question.question || "";
  const cacheKey = `q_explain_${question.id || qText.slice(0, 40)}`;
  const cached = getCachedAnswer(cacheKey);
  if (cached) {
    if (onChunk) onChunk(cached, cached);
    return cached;
  }

  const credentials = getActiveAICredentials();
  if (!credentials.configured) {
    throw new Error("NO_API_KEY");
  }

  const correctIdx = typeof question.correctIndex === "number" ? question.correctIndex : (question.correct_answer ?? 0);
  const correctOptionText = question.options[correctIdx] || "Option " + (correctIdx + 1);
  const optionsList = question.options.map((opt, idx) => `(${String.fromCharCode(65 + idx)}) ${opt}`).join("\n");

  const prompt = `Please provide an in-depth academic breakdown of this competitive examination question:

Question: ${qText}
Options:
${optionsList}

Official Correct Answer: Option ${String.fromCharCode(65 + correctIdx)} (${correctOptionText})
${question.explanation ? `Existing Explanation: ${question.explanation}` : ""}

Structure your response into these 4 essential sections:
1. 🎯 **Core Concept & Answer Rationale**: Explain the fundamental concept and background in 2-3 clear lines.
2. ❌ **Option Elimination (Why others are incorrect)**: Detail the exact factual or historical reason why each other option (A, B, C, D) is wrong.
3. 💡 **High-Yield Exam Facts**: Provide 2-3 high-frequency facts related to this topic that are likely to appear in upcoming exams.
4. 🧠 **Memory Tip & Mnemonic**: Share a simple memory trick or mnemonic formula to remember this fact easily.`;

  const startTime = Date.now();
  try {
    const response = await executeAICompletion({
      provider: credentials.provider,
      apiKey: credentials.apiKey,
      model: credentials.model,
      prompt,
      systemPrompt: SYSTEM_PROMPT_STUDY_TUTOR,
      temperature: 0.2,
      onChunk,
    });

    const latencyMs = Date.now() - startTime;
    recordAIUsage({
      provider: credentials.provider,
      model: credentials.model,
      queryType: "question_explain",
      prompt: qText,
      response,
      latencyMs,
      status: "success",
    });

    if (response) {
      setCachedAnswer(cacheKey, response);
    }

    return response;
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    recordAIUsage({
      provider: credentials.provider,
      model: credentials.model,
      queryType: "question_explain",
      prompt: qText,
      latencyMs,
      status: "error",
      errorMessage: err?.message || String(err),
    });
    throw err;
  }
}

/**
 * Parses technical API errors into human-readable Hindi explanations
 * and detects whether the user needs to inspect or update their API key.
 */
export function formatFriendlyAIError(err: any): { message: string; isApiKeyIssue: boolean } {
  const rawMsg = err?.message || String(err || "");
  
  if (rawMsg === "NO_API_KEY") {
    return {
      message: "Hello! To consult Disha AI Tutor, please add your Google Gemini or OpenRouter API Key in Settings. It is 100% free and takes less than a minute to configure.",
      isApiKeyIssue: true,
    };
  }

  let parsedMessage = rawMsg;
  try {
    if (rawMsg.includes("{") && rawMsg.includes("}")) {
      const jsonStart = rawMsg.indexOf("{");
      const jsonEnd = rawMsg.lastIndexOf("}");
      const parsed = JSON.parse(rawMsg.slice(jsonStart, jsonEnd + 1));
      if (parsed?.error?.message) {
        parsedMessage = parsed.error.message;
      }
    }
  } catch {}

  const lower = parsedMessage.toLowerCase();

  if (
    lower.includes("api_key_invalid") ||
    lower.includes("api key not valid") ||
    lower.includes("permission_denied") ||
    lower.includes("unauthorized") ||
    lower.includes("401") ||
    lower.includes("403")
  ) {
    return {
      message: "The entered API Key is invalid or lacks permission. Please navigate to Settings to verify your Google Gemini or OpenRouter key.",
      isApiKeyIssue: true,
    };
  }

  if (
    lower.includes("resource_exhausted") ||
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("429")
  ) {
    return {
      message: "Your API Key rate limit or daily quota has been reached. Please try again later or add an alternative API Key in Settings.",
      isApiKeyIssue: true,
    };
  }

  if (
    lower.includes("timed out") ||
    lower.includes("timeout") ||
    lower.includes("network") ||
    lower.includes("failed to fetch")
  ) {
    return {
      message: "Network request timed out. Please check your internet connection and try again.",
      isApiKeyIssue: false,
    };
  }

  if (
    lower.includes("not found") ||
    lower.includes("404") ||
    lower.includes("not supported") ||
    lower.includes("no longer available") ||
    lower.includes("update your code") ||
    lower.includes("high demand") ||
    lower.includes("1.5-flash") ||
    lower.includes("1.5") ||
    lower.includes("2.0-flash") ||
    lower.includes("2.5-flash") ||
    lower.includes("2.5")
  ) {
    return {
      message: "The selected AI model was upgraded for ultra-fast response times. Disha App has automatically switched to the high-speed 'gemini-flash-lite-latest' model. Please ask your question again.",
      isApiKeyIssue: false,
    };
  }

  // Sanitize any remaining technical or JSON remnants
  const cleanDisplay = parsedMessage
    .replace(/\{"error":\{.*\}\}/gs, "")
    .replace(/models\/[a-zA-Z0-9_.-]+/g, "AI model")
    .replace(/for API version [a-zA-Z0-9_.-]+/g, "")
    .replace(/Call ModelService\.[a-zA-Z0-9_.-]+ [^.]+\./g, "")
    .trim();

  return {
    message: cleanDisplay
      ? `Sorry, could not generate response: ${cleanDisplay.slice(0, 160)}. Please try again.`
      : "Sorry, could not generate response. Please try again.",
    isApiKeyIssue: false,
  };
}


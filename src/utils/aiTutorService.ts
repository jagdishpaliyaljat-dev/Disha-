import { loadSettingsFromStorage } from "./storage";
import { executeAICompletion, PROVIDER_RECOMMENDED_MODELS } from "./aiProviderService";
import { AIProvider, Question } from "../types";

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
  const keys = Array.isArray(settings.personalAiKeys) ? settings.personalAiKeys : [];
  
  let activeKey = keys.find((k: any) => k.id === settings.activePersonalKeyId && k.enabled && k.apiKey?.trim())
    || keys.find((k: any) => k.enabled && k.apiKey?.trim());

  if (activeKey && activeKey.apiKey?.trim()) {
    const provider = activeKey.provider || "gemini";
    const defaultModel = PROVIDER_RECOMMENDED_MODELS[provider]?.[0]?.id || "gemini-2.5-flash";
    let chosenModel = activeKey.model || defaultModel;
    if (provider === "gemini" && (!chosenModel || chosenModel.includes("1.5") || chosenModel.includes("1.0") || chosenModel === "default" || chosenModel === "gemini-flash-latest")) {
      chosenModel = "gemini-2.5-flash";
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
      model: "gemini-2.5-flash",
    };
  }

  // Check Vite Environment Fallback
  const envGemini = (typeof import.meta !== "undefined" && import.meta.env?.VITE_GEMINI_API_KEY) || "";
  if (envGemini.trim()) {
    return {
      configured: true,
      provider: "gemini",
      apiKey: envGemini.trim(),
      model: "gemini-2.5-flash",
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

  // Antigravity Pro 5-Account Local Proxy auto-detection
  const envProxyUrl = (typeof import.meta !== "undefined" && import.meta.env?.VITE_AI_PROXY_URL) || "http://127.0.0.1:8317/v1";
  const envProxyKey = (typeof import.meta !== "undefined" && import.meta.env?.VITE_AI_PROXY_KEY) || "cliproxy-local";
  return {
    configured: true,
    provider: "cliproxy",
    apiKey: envProxyKey,
    model: "gemini-2.5-flash",
  };
}

const SYSTEM_PROMPT_STUDY_TUTOR = `आप "दिशा AI साथी (Disha AI Tutor)" हैं—DISHA 20-20 प्रतियोगी परीक्षा तैयारी ऐप के विशेषज्ञ, प्रेरक और मित्रवत डिजिटल शिक्षक (Expert Mentor)।
आपकी भूमिका:
1. छात्रों को राजस्थान व भारत की प्रतियोगी परीक्षाओं (UPSC, RPSC RAS, REET, Patwar, Police, CET, SSC) के लिए सरल, प्रामाणिक और रोचक हिंदी में मार्गदर्शन देना।
2. हमेशा स्पष्ट, बिंदुवार (Bullet Points) और आसानी से याद रहने वाले उत्तर देना।
3. परीक्षा उपयोगी महत्वपूर्ण तथ्य (High-Yield Facts) और याद रखने की शॉर्ट ट्रिक्स (Memory Mnemonics) साझा करना।
4. छात्र का मनोबल बढ़ाना (Positive & Encouraging Tone)।
5. उत्तर साफ सुथरे Markdown फॉर्मेट में दें (जैसे हेडिंग्स, बोल्ड शब्द, और बुलेट पॉइंट्स)।`;

/**
 * Ask a general study, syllabus, or doubt question to Disha AI Tutor
 */
export async function askDishaAITutor(
  userPrompt: string,
  chatHistory: { role: string; content: string }[] = []
): Promise<string> {
  const credentials = getActiveAICredentials();
  if (!credentials.configured) {
    throw new Error("NO_API_KEY");
  }

  const cacheKey = `prompt_${userPrompt.trim().toLowerCase().slice(0, 80)}`;
  const cached = getCachedAnswer(cacheKey);
  if (cached && chatHistory.length === 0) {
    return cached;
  }

  // Format context with recent history
  let fullPrompt = userPrompt;
  if (chatHistory.length > 0) {
    const recent = chatHistory.slice(-4).map(m => `${m.role === 'user' ? 'छात्र' : 'दिशा AI'}: ${m.content}`).join("\n");
    fullPrompt = `पिछले संवाद:\n${recent}\n\nछात्र का नया सवाल:\n${userPrompt}`;
  }

  const response = await executeAICompletion({
    provider: credentials.provider,
    apiKey: credentials.apiKey,
    model: credentials.model,
    prompt: fullPrompt,
    systemPrompt: SYSTEM_PROMPT_STUDY_TUTOR,
    temperature: 0.3,
  });

  if (response && chatHistory.length === 0) {
    setCachedAnswer(cacheKey, response);
  }

  return response;
}

/**
 * Generate a comprehensive 4-part explanation for any MCQ Question
 */
export async function explainQuestionWithAI(question: Question): Promise<string> {
  const qText = question.text || question.question || "";
  const cacheKey = `q_explain_${question.id || qText.slice(0, 40)}`;
  const cached = getCachedAnswer(cacheKey);
  if (cached) {
    return cached;
  }

  const credentials = getActiveAICredentials();
  if (!credentials.configured) {
    throw new Error("NO_API_KEY");
  }

  const correctIdx = typeof question.correctIndex === "number" ? question.correctIndex : (question.correct_answer ?? 0);
  const correctOptionText = question.options[correctIdx] || "विकल्प " + (correctIdx + 1);
  const optionsList = question.options.map((opt, idx) => `(${String.fromCharCode(65 + idx)}) ${opt}`).join("\n");

  const prompt = `कृपया इस प्रतियोगी परीक्षा प्रश्न का विस्तृत और शैक्षणिक विश्लेषण (In-depth Academic Breakdown) करें:

प्रश्न: ${qText}
विकल्प:
${optionsList}

आधिकारिक सही उत्तर: विकल्प ${String.fromCharCode(65 + correctIdx)} (${correctOptionText})
${question.explanation ? `मौजूदा व्याख्या: ${question.explanation}` : ""}

कृपया उत्तर को अनिवार्य रूप से इन 4 भागों में संरचित करें:
1. 🎯 **सही उत्तर का कारण**: अवधारणा और ऐतिहासिक/वैज्ञानिक पृष्ठभूमि सहित 2-3 पंक्तियों में सरल हिंदी में समझाएं।
2. ❌ **बाकी विकल्प क्यों गलत हैं (Elimination)**: प्रत्येक गलत विकल्प (A, B, C, D) के गलत होने का विशिष्ट ऐतिहासिक/तथ्यात्मक कारण बताएं।
3. 💡 **परीक्षा उपयोगी महत्वपूर्ण तथ्य (Key Facts)**: इस विषय से संबंधित 2-3 ऐसे बिंदु बताएं जो आगामी परीक्षाओं में पूछे जा सकते हैं।
4. 🧠 **याद रखने की ट्रिक (Memory Tip)**: इस तथ्य को लंबे समय तक याद रखने का आसान सूत्र या ट्रिक।`;

  const response = await executeAICompletion({
    provider: credentials.provider,
    apiKey: credentials.apiKey,
    model: credentials.model,
    prompt,
    systemPrompt: SYSTEM_PROMPT_STUDY_TUTOR,
    temperature: 0.2,
  });

  if (response) {
    setCachedAnswer(cacheKey, response);
  }

  return response;
}

/**
 * Parses technical API errors into human-readable Hindi explanations
 * and detects whether the user needs to inspect or update their API key.
 */
export function formatFriendlyAIError(err: any): { message: string; isApiKeyIssue: boolean } {
  const rawMsg = err?.message || String(err || "");
  
  if (rawMsg === "NO_API_KEY") {
    return {
      message: "नमस्ते! दिशा AI साथी से बात करने के लिए कृपया अपनी Google Gemini या OpenRouter API Key जोड़ें। यह 100% नि:शुल्क है और 1 मिनट में सेट हो जाती है।",
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
      message: "दर्ज की गई API Key अमान्य (Invalid) है या उसमें इस सेवा की अनुमति नहीं है। कृपया Settings में जाकर अपनी सही Google Gemini या OpenRouter Key दर्ज करें।",
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
      message: "आपकी API Key की दैनिक मुफ़्त सीमा (Rate Limit / Quota) पूरी हो चुकी है। कृपया कुछ समय बाद पुनः प्रयास करें या Settings में दूसरी API Key जोड़ें।",
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
      message: "नेटवर्क या सर्वर से जुड़ने में अधिक समय लगा। कृपया अपना इंटरनेट कनेक्शन जांचें और पुनः प्रयास करें।",
      isApiKeyIssue: false,
    };
  }

  if (
    lower.includes("not found") ||
    lower.includes("404") ||
    lower.includes("not supported") ||
    lower.includes("1.5-flash") ||
    lower.includes("1.5")
  ) {
    return {
      message: "गूगल ने पुराने मॉडल (gemini-1.5-flash) को बंद कर दिया है। दिशा ऐप ने स्वतः नए व तीव्र 'gemini-2.5-flash' मॉडल पर अपडेट कर दिया है। कृपया पुनः प्रश्न पूछें।",
      isApiKeyIssue: false,
    };
  }

  // Sanitize any remaining technical or JSON remnants
  const cleanDisplay = parsedMessage
    .replace(/\{"error":\{.*\}\}/gs, "")
    .replace(/models\/[a-zA-Z0-9_.-]+/g, "AI मॉडल")
    .replace(/for API version [a-zA-Z0-9_.-]+/g, "")
    .replace(/Call ModelService\.[a-zA-Z0-9_.-]+ [^.]+\./g, "")
    .trim();

  return {
    message: cleanDisplay
      ? `माफ़ कीजिए, उत्तर प्राप्त करने में समस्या आई: ${cleanDisplay.slice(0, 160)}। कृपया पुनः प्रयास करें।`
      : "माफ़ कीजिए, उत्तर प्राप्त करने में समस्या आई। कृपया पुनः प्रयास करें।",
    isApiKeyIssue: false,
  };
}


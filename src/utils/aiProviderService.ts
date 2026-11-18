import { GoogleGenAI } from "@google/genai";
import { AIProvider } from "../types";

export interface AIModelDefinition {
  id: string;
  name: string;
  displayName: string;
  provider: AIProvider;
  description: string;
  recommended?: boolean;
}

export const PROVIDER_RECOMMENDED_MODELS: Record<AIProvider, AIModelDefinition[]> = {
  gemini: [
    {
      id: "gemini-3.8-flash",
      name: "gemini-3.8-flash",
      displayName: "Gemini 3.8 Flash (Recommended - Flagship)",
      provider: "gemini",
      description: "Primary general-purpose model for summarization, Q&A, and fast reasoning",
      recommended: true,
    },
    {
      id: "gemini-3.1-flash-lite",
      name: "gemini-3.1-flash-lite",
      displayName: "Gemini 3.1 Flash Lite (Ultra Fast)",
      provider: "gemini",
      description: "Ultra-fast, lightweight multimodal reasoning for high-throughput tasks",
    },
    {
      id: "gemini-flash-latest",
      name: "gemini-flash-latest",
      displayName: "Gemini Flash Latest",
      provider: "gemini",
      description: "Always points to the latest Gemini Flash release",
    },
    {
      id: "gemini-2.5-pro",
      name: "gemini-2.5-pro",
      displayName: "Gemini 2.5 Pro (Deep Context & STEM)",
      provider: "gemini",
      description: "Advanced reasoning model for complex STEM and mathematical exams",
    },
  ],
  openai: [
    {
      id: "gpt-4o",
      name: "gpt-4o",
      displayName: "GPT-4o (Omni Flagship)",
      provider: "openai",
      description: "OpenAI's most capable intelligent multimodal model",
      recommended: true,
    },
    {
      id: "gpt-4o-mini",
      name: "gpt-4o-mini",
      displayName: "GPT-4o Mini (Fast & Cost Efficient)",
      provider: "openai",
      description: "Ultra-fast and cost-effective for batch MCQ parsing",
    },
    {
      id: "o3-mini",
      name: "o3-mini",
      displayName: "o3-mini (Reasoning)",
      provider: "openai",
      description: "OpenAI reasoning model for complex logical inferences",
    },
  ],
  claude: [
    {
      id: "claude-3-7-sonnet-20250219",
      name: "claude-3-7-sonnet-20250219",
      displayName: "Claude 3.7 Sonnet (Hybrid Reasoning)",
      provider: "claude",
      description: "Anthropic's latest hybrid reasoning and high-precision model",
      recommended: true,
    },
    {
      id: "claude-3-5-sonnet-20241022",
      name: "claude-3-5-sonnet-20241022",
      displayName: "Claude 3.5 Sonnet",
      provider: "claude",
      description: "Industry leading comprehension, nuanced formatting",
    },
    {
      id: "claude-3-5-haiku-20241022",
      name: "claude-3-5-haiku-20241022",
      displayName: "Claude 3.5 Haiku (Ultra Fast)",
      provider: "claude",
      description: "High speed, lightweight Anthropic model",
    },
  ],
  groq: [
    {
      id: "llama-3.3-70b-versatile",
      name: "llama-3.3-70b-versatile",
      displayName: "Llama 3.3 70B Versatile (Recommended)",
      provider: "groq",
      description: "Highly capable open-weights model on Groq LPUs",
      recommended: true,
    },
    {
      id: "llama-3.1-8b-instant",
      name: "llama-3.1-8b-instant",
      displayName: "Llama 3.1 8B Instant (500+ tok/s)",
      provider: "groq",
      description: "Sub-100ms response time for rapid parsing and verification",
    },
    {
      id: "mixtral-8x7b-32768",
      name: "mixtral-8x7b-32768",
      displayName: "Mixtral 8x7B (High Speed)",
      provider: "groq",
      description: "Fast high-throughput open mixture-of-experts model",
    },
    {
      id: "gemma2-9b-it",
      name: "gemma2-9b-it",
      displayName: "Gemma 2 9B IT",
      provider: "groq",
      description: "Compact efficient model on Groq LPUs",
    },
  ],
  openrouter: [
    {
      id: "deepseek/deepseek-chat",
      name: "deepseek/deepseek-chat",
      displayName: "DeepSeek V3 (Recommended - Affordable & Fast)",
      provider: "openrouter",
      description: "Exceptional cost-efficiency and intelligence via OpenRouter",
      recommended: true,
    },
    {
      id: "deepseek/deepseek-r1",
      name: "deepseek/deepseek-r1",
      displayName: "DeepSeek R1 (Reasoning Master)",
      provider: "openrouter",
      description: "State-of-the-art chain-of-thought reasoning for difficult STEM/Exam questions",
    },
    {
      id: "meta-llama/llama-3.3-70b-instruct",
      name: "meta-llama/llama-3.3-70b-instruct",
      displayName: "Llama 3.3 70B Instruct",
      provider: "openrouter",
      description: "Fast open weights model with strong bilingual capabilities",
    },
    {
      id: "anthropic/claude-3.5-sonnet",
      name: "anthropic/claude-3.5-sonnet",
      displayName: "Claude 3.5 Sonnet",
      provider: "openrouter",
      description: "Nuanced Devanagari Hindi translation and MCQ generation",
    },
    {
      id: "google/gemini-2.0-flash-001",
      name: "google/gemini-2.0-flash-001",
      displayName: "Gemini 2.0 Flash",
      provider: "openrouter",
      description: "Low-latency multimodal model via OpenRouter API",
    },
  ],
};

export interface TestKeyParams {
  provider: AIProvider;
  apiKey: string;
  model?: string;
}

export interface TestKeyResult {
  success: boolean;
  provider: AIProvider;
  model: string;
  latencyMs: number;
  message: string;
  response?: string;
  error?: string;
  quota?: {
    requestsLimit?: number;
    requestsRemaining?: number;
    requestsReset?: string;
    tokensLimit?: number;
    tokensRemaining?: number;
    tokensReset?: string;
  };
}

export interface ExecuteAICallParams {
  provider: AIProvider;
  apiKey: string;
  model?: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  jsonMode?: boolean;
  onRetry?: (failingKey: string) => Promise<{ apiKey: string; model?: string } | null>;
}

function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(errorMsg)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

function extractQuotaHeaders(headers: Headers) {
  const quota: any = {};
  
  // Try various common header names for requests
  const reqLimit = headers.get("x-ratelimit-limit-requests") || headers.get("ratelimit-limit") || headers.get("x-goog-ratelimit-limit");
  if (reqLimit) quota.requestsLimit = parseInt(reqLimit, 10);
  
  const reqRem = headers.get("x-ratelimit-remaining-requests") || headers.get("ratelimit-remaining") || headers.get("x-goog-ratelimit-remaining");
  if (reqRem) quota.requestsRemaining = parseInt(reqRem, 10);
  
  const reqReset = headers.get("x-ratelimit-reset-requests") || headers.get("ratelimit-reset") || headers.get("x-goog-ratelimit-reset");
  if (reqReset) quota.requestsReset = reqReset;

  // Try various common header names for tokens
  const tokLimit = headers.get("x-ratelimit-limit-tokens") || headers.get("x-goog-ratelimit-limit-tokens");
  if (tokLimit) quota.tokensLimit = parseInt(tokLimit, 10);
  
  const tokRem = headers.get("x-ratelimit-remaining-tokens") || headers.get("x-goog-ratelimit-remaining-tokens");
  if (tokRem) quota.tokensRemaining = parseInt(tokRem, 10);
  
  const tokReset = headers.get("x-ratelimit-reset-tokens") || headers.get("x-goog-ratelimit-reset-tokens");
  if (tokReset) quota.tokensReset = tokReset;

  return Object.keys(quota).length > 0 ? quota : undefined;
}

/**
 * Universal Test Key function supporting Gemini, OpenAI, Claude, and Groq
 */
export async function testAIKeyConnection({
  provider,
  apiKey,
  model,
}: TestKeyParams): Promise<TestKeyResult> {
  const cleanKey = apiKey.trim();
  const startTime = Date.now();

  const selectedModel =
    model?.trim() ||
    PROVIDER_RECOMMENDED_MODELS[provider]?.[0]?.id ||
    "default";

  const CONNECTIVITY_TIMEOUT = 10000; // 10-second timeout

  const fetchWithAbort = async (url: string, options: RequestInit, timeoutMs: number = CONNECTIVITY_TIMEOUT): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      try {
        controller.abort(new Error("Request timed out"));
      } catch {
        controller.abort();
      }
    }, timeoutMs);
    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    switch (provider) {
      case "gemini": {
        const initialCandidate = (!selectedModel || selectedModel === "default" || selectedModel === "gemini-2.5-flash" || selectedModel === "gemini-1.5-flash") ? "gemini-3.8-flash" : selectedModel;
        
        const runTestFetch = async (modelName: string, timeoutMs: number = CONNECTIVITY_TIMEOUT) => {
          return fetchWithAbort(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${cleanKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: "Respond with 'OK' only." }] }],
                generationConfig: { maxOutputTokens: 5, temperature: 0 }
              })
            },
            timeoutMs
          );
        };

        const candidatesToTry = Array.from(new Set([initialCandidate, "gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-2.5-pro"]));

        let response: Response | null = null;
        let activeModel = initialCandidate;
        for (const candidate of candidatesToTry) {
          activeModel = candidate;
          try {
            response = await runTestFetch(candidate);
            if (response && response.ok) break;
          } catch (_) {
            response = null;
          }
        }

        if (!response || !response.ok) {
          const errData = response ? await response.json().catch(() => ({})) : {};
          const errMsg = errData?.error?.message || (response ? `HTTP ${response.status}: ${response.statusText}` : "Request timed out. Please check network.");
          return {
            success: false,
            provider: "gemini",
            model: activeModel,
            latencyMs: Date.now() - startTime,
            message: `Gemini verification failed: ${errMsg}`,
            error: errMsg,
            quota: response ? extractQuotaHeaders(response.headers) : undefined
          };
        }

        const data = await response.json();
        const latencyMs = Date.now() - startTime;
        const quota = extractQuotaHeaders(response.headers);

        return {
          success: true,
          provider: "gemini",
          model: activeModel,
          latencyMs,
          message: `Google Gemini verified! Model ${activeModel} responded in ${latencyMs}ms.`,
          response: data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "OK",
          quota
        };
      }

      case "openai": {
        let activeModel = selectedModel === "default" ? "gpt-4o-mini" : selectedModel;
        const runOpenAIFetch = async (modelName: string) => {
          return fetchWithAbort(
            "https://api.openai.com/v1/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${cleanKey}`,
              },
              body: JSON.stringify({
                model: modelName,
                messages: [{ role: "user", content: "Respond with 'OK' only." }],
                max_tokens: 10,
                temperature: 0,
              }),
            },
            CONNECTIVITY_TIMEOUT
          );
        };

        let response: Response | null = null;
        try {
          response = await runOpenAIFetch(activeModel);
        } catch (_) {
          if (activeModel !== "gpt-4o-mini") {
            activeModel = "gpt-4o-mini";
            try {
              response = await runOpenAIFetch(activeModel);
            } catch (_) {
              response = null;
            }
          }
        }

        if (!response || !response.ok) {
          if (activeModel !== "gpt-4o-mini") {
            activeModel = "gpt-4o-mini";
            try {
              response = await runOpenAIFetch(activeModel);
            } catch (_) {
              response = null;
            }
          }
        }

        const latencyMs = Date.now() - startTime;
        const quota = response ? extractQuotaHeaders(response.headers) : undefined;
        if (!response || !response.ok) {
          const errData = response ? await response.json().catch(() => ({})) : {};
          const errMsg = errData?.error?.message || (response ? `HTTP ${response.status}: ${response.statusText}` : "Request timed out after 7s");
          return {
            success: false,
            provider: "openai",
            model: activeModel,
            latencyMs,
            message: `OpenAI verification failed: ${errMsg}`,
            error: errMsg,
            quota
          };
        }

        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content || "OK";
        return {
          success: true,
          provider: "openai",
          model: activeModel,
          latencyMs,
          message: `OpenAI verified! Model ${activeModel} responded in ${latencyMs}ms.`,
          response: text.trim(),
          quota
        };
      }

      case "claude": {
        let activeModel = selectedModel === "default" ? "claude-3-5-haiku-20241022" : selectedModel;
        const runClaudeFetch = async (modelName: string) => {
          return fetchWithAbort(
            "https://api.anthropic.com/v1/messages",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": cleanKey,
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify({
                model: modelName,
                max_tokens: 10,
                messages: [{ role: "user", content: "Respond with 'OK' only." }],
              }),
            },
            CONNECTIVITY_TIMEOUT
          );
        };

        let response: Response | null = null;
        try {
          response = await runClaudeFetch(activeModel);
        } catch (_) {
          if (activeModel !== "claude-3-5-haiku-20241022") {
            activeModel = "claude-3-5-haiku-20241022";
            try {
              response = await runClaudeFetch(activeModel);
            } catch (_) {
              response = null;
            }
          }
        }

        const latencyMs = Date.now() - startTime;
        const quota = response ? extractQuotaHeaders(response.headers) : undefined;
        if (!response || !response.ok) {
          const errData = response ? await response.json().catch(() => ({})) : {};
          const errMsg = errData?.error?.message || (response ? `HTTP ${response.status}: ${response.statusText}` : "Request timed out after 7s");
          return {
            success: false,
            provider: "claude",
            model: activeModel,
            latencyMs,
            message: `Anthropic Claude verification failed: ${errMsg}`,
            error: errMsg,
            quota
          };
        }

        const data = await response.json();
        const text = data?.content?.[0]?.text || "OK";
        return {
          success: true,
          provider: "claude",
          model: activeModel,
          latencyMs,
          message: `Anthropic Claude verified! Model ${activeModel} responded in ${latencyMs}ms.`,
          response: text.trim(),
          quota
        };
      }

      case "groq": {
        let activeModel = (!selectedModel || selectedModel === "default" || selectedModel === "qwen/qwen3.8-27b" || selectedModel === "llama-3.3-70b-specdec")
          ? "llama-3.3-70b-versatile"
          : selectedModel;

        const runGroqFetch = async (modelToUse: string) => {
          return fetchWithAbort(
            "https://api.groq.com/openai/v1/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${cleanKey}`,
              },
              body: JSON.stringify({
                model: modelToUse,
                messages: [{ role: "user", content: "Respond with 'OK' only." }],
                max_tokens: 15,
                temperature: 0,
              }),
            },
            CONNECTIVITY_TIMEOUT
          );
        };

        let response: Response | null = null;
        try {
          response = await runGroqFetch(activeModel);
        } catch (_) {
          if (activeModel !== "llama-3.1-8b-instant") {
            activeModel = "llama-3.1-8b-instant";
            try {
              response = await runGroqFetch(activeModel);
            } catch (_) {
              response = null;
            }
          }
        }

        if (!response || !response.ok) {
          const errData = response ? await response.clone().json().catch(() => ({})) : {};
          const errMsg = errData?.error?.message || "";
          if (!response || errMsg.includes("decommissioned") || errMsg.includes("does not exist") || errMsg.includes("do not have access") || response?.status === 404) {
            if (activeModel !== "llama-3.1-8b-instant") {
              activeModel = "llama-3.1-8b-instant";
              try {
                response = await runGroqFetch(activeModel);
              } catch (_) {
                response = null;
              }
            }
          }
        }

        const latencyMs = Date.now() - startTime;
        const quota = response ? extractQuotaHeaders(response.headers) : undefined;
        if (!response || !response.ok) {
          const errData = response ? await response.json().catch(() => ({})) : {};
          const errMsg = errData?.error?.message || (response ? `HTTP ${response.status}: ${response.statusText}` : "Request timed out after 7s");
          return {
            success: false,
            provider: "groq",
            model: activeModel,
            latencyMs,
            message: `Groq verification failed: ${errMsg}`,
            error: errMsg,
            quota
          };
        }

        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.message?.reasoning || "OK";
        return {
          success: true,
          provider: "groq",
          model: activeModel,
          latencyMs,
          message: `Groq LPU verified! Model ${activeModel} responded in ${latencyMs}ms.`,
          response: text.trim() || "OK",
          quota
        };
      }

      case "openrouter": {
        let activeModel = (!selectedModel || selectedModel === "default")
          ? "deepseek/deepseek-chat"
          : selectedModel;

        const runOpenRouterFetch = async (modelToUse: string) => {
          return fetchWithAbort(
            "https://openrouter.ai/api/v1/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${cleanKey}`,
                "HTTP-Referer": "https://disha-2020.vercel.app",
                "X-Title": "DISHA 20-20",
              },
              body: JSON.stringify({
                model: modelToUse,
                messages: [{ role: "user", content: "Respond with 'OK' only." }],
                max_tokens: 10,
                temperature: 0,
              }),
            },
            CONNECTIVITY_TIMEOUT
          );
        };

        let response: Response | null = null;
        try {
          response = await runOpenRouterFetch(activeModel);
        } catch (_) {
          response = null;
        }

        const latencyMs = Date.now() - startTime;
        const quota = response ? extractQuotaHeaders(response.headers) : undefined;
        if (!response || !response.ok) {
          const errData = response ? await response.json().catch(() => ({})) : {};
          const errMsg = errData?.error?.message || (response ? `HTTP ${response.status}: ${response.statusText}` : "Request timed out after 7s");
          return {
            success: false,
            provider: "openrouter",
            model: activeModel,
            latencyMs,
            message: `OpenRouter verification failed: ${errMsg}`,
            error: errMsg,
            quota
          };
        }

        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content || "OK";
        return {
          success: true,
          provider: "openrouter",
          model: activeModel,
          latencyMs,
          message: `OpenRouter verified! Model ${activeModel} responded in ${latencyMs}ms.`,
          response: text.trim(),
          quota
        };
      }

      default:
        return {
          success: false,
          provider,
          model: selectedModel,
          latencyMs: 0,
          message: `Unsupported AI Provider: ${provider}`,
          error: `Provider '${provider}' is not supported.`,
        };
    }
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    let errMsg = error?.message || "Failed to reach provider";
    
    // Better categorization of errors
    if (errMsg.includes("401") || errMsg.includes("unauthorized") || errMsg.includes("invalid api key")) {
      errMsg = "Invalid or unauthorized API key (401).";
    } else if (errMsg.includes("403") || errMsg.includes("permission denied")) {
      errMsg = "Permission or access denied (403).";
    } else if (errMsg.includes("404") || errMsg.includes("not found")) {
      errMsg = "Model or endpoint not found (404).";
    } else if (errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("rate limit")) {
      errMsg = "Rate limit or quota exceeded (429).";
    } else if (errMsg.includes("500") || errMsg.includes("502") || errMsg.includes("503") || errMsg.includes("504")) {
      errMsg = "Provider server error (5xx).";
    } else if (errMsg.includes("timed out") || errMsg.includes("aborted") || errMsg.includes("AbortError")) {
      errMsg = "Connection timed out. Provider took too long to respond.";
    }

    return {
      success: false,
      provider,
      model: selectedModel,
      latencyMs,
      message: `Connection error: ${errMsg}`,
      error: errMsg,
    };
  }
}

/**
 * Universal text/completion generation across Gemini, OpenAI, Claude, and Groq
 */
export async function executeAICompletion({
  provider,
  apiKey,
  model,
  prompt,
  systemPrompt,
  temperature = 0.2,
  jsonMode = false,
  onRetry,
}: ExecuteAICallParams): Promise<string> {
    let currentKey = apiKey.trim();
  let currentModel = model?.trim() || PROVIDER_RECOMMENDED_MODELS[provider]?.[0]?.id || "default";
  
  const DEFAULT_TIMEOUT = 60000;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      switch (provider) {
        case "gemini": {
          const client = new GoogleGenAI({
            apiKey: currentKey,
            httpOptions: {
              headers: {
                "User-Agent": "aistudio-build",
              },
            },
          });

          const config: any = { temperature };
          if (systemPrompt) config.systemInstruction = systemPrompt;
          if (jsonMode) config.responseMimeType = "application/json";

          const targetModel = (currentModel && currentModel !== "default" && currentModel !== "gemini-2.5-flash" && currentModel !== "gemini-1.5-flash") ? currentModel : "gemini-3.8-flash";
          const modelsToTry = Array.from(new Set([targetModel, "gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-2.5-pro"]));

          let lastErr: any = null;
          for (const mName of modelsToTry) {
            try {
              const result = await withTimeout(
                client.models.generateContent({
                  model: mName,
                  contents: prompt,
                  config,
                }),
                DEFAULT_TIMEOUT,
                `Gemini timed out with model ${mName}`
              );
              if (result && result.text) {
                return result.text;
              }
            } catch (modelErr: any) {
              lastErr = modelErr;
            }
          }
          throw lastErr || new Error("Gemini AI execution failed across all fallbacks.");
        }

        case "openai": {
          const messages: any[] = [];
          if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
          messages.push({ role: "user", content: prompt });

          const body: any = {
            model: currentModel,
            messages,
            temperature,
          };
          if (jsonMode) body.response_format = { type: "json_object" };

          const response = await withTimeout(
            fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${currentKey}`,
              },
              body: JSON.stringify(body),
            }),
            DEFAULT_TIMEOUT,
            "OpenAI request timed out after 30s."
          );

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData?.error?.message || `OpenAI error status ${response.status}`);
          }

          const data = await response.json();
          return data?.choices?.[0]?.message?.content || "";
        }

        case "claude": {
          const body: any = {
            model: currentModel,
            max_tokens: 4096,
            messages: [{ role: "user", content: prompt }],
            temperature,
          };
          if (systemPrompt) body.system = systemPrompt;

          const response = await withTimeout(
            fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": currentKey,
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify(body),
            }),
            DEFAULT_TIMEOUT,
            "Claude request timed out after 30s."
          );

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData?.error?.message || `Claude error status ${response.status}`);
          }

          const data = await response.json();
          return data?.content?.[0]?.text || "";
        }

        case "groq": {
          const messages: any[] = [];
          if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
          messages.push({ role: "user", content: prompt });

          const body: any = {
            model: currentModel,
            messages,
            temperature,
          };
          if (jsonMode) body.response_format = { type: "json_object" };

          const response = await withTimeout(
            fetch("https://api.groq.com/openai/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${currentKey}`,
              },
              body: JSON.stringify(body),
            }),
            DEFAULT_TIMEOUT,
            "Groq request timed out after 30s."
          );

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData?.error?.message || `Groq error status ${response.status}`);
          }

          const data = await response.json();
          return data?.choices?.[0]?.message?.content || "";
        }

        case "openrouter": {
          const messages: any[] = [];
          if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
          messages.push({ role: "user", content: prompt });

          const body: any = {
            model: currentModel || "deepseek/deepseek-chat",
            messages,
            temperature,
          };
          if (jsonMode) body.response_format = { type: "json_object" };

          const response = await withTimeout(
            fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${currentKey}`,
                "HTTP-Referer": "https://disha-2020.vercel.app",
                "X-Title": "DISHA 20-20",
              },
              body: JSON.stringify(body),
            }),
            DEFAULT_TIMEOUT,
            "OpenRouter request timed out after 60s."
          );

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData?.error?.message || `OpenRouter error status ${response.status}`);
          }

          const data = await response.json();
          return data?.choices?.[0]?.message?.content || "";
        }

        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const isRetryable = (errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("503"));
      if (isRetryable && onRetry && attempt < 2) {
        const next = await onRetry(currentKey);
        if (next) {
          currentKey = next.apiKey;
          if (next.model) currentModel = next.model;
          continue;
        }
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded");
}


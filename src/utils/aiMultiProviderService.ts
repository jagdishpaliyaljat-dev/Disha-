import { AIProvider } from "../types";

export interface ProviderModelInfo {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  badge?: string;
}

export const PROVIDER_METADATA: Record<AIProvider, {
  name: string;
  tagline: string;
  defaultModel: string;
  docsUrl: string;
  keyPlaceholder: string;
  color: string;
  bgBadge: string;
}> = {
  gemini: {
    name: "Google Gemini",
    tagline: "Ultra-fast multimodal reasoning with long context",
    defaultModel: "gemini-3.8-flash",
    docsUrl: "https://aistudio.google.com/app/apikey",
    keyPlaceholder: "AIzaSy...",
    color: "text-blue-600 dark:text-blue-400",
    bgBadge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
  },
  openai: {
    name: "OpenAI / ChatGPT",
    tagline: "Industry standard GPT-4o and reasoning models",
    defaultModel: "gpt-4o-mini",
    docsUrl: "https://platform.openai.com/api-keys",
    keyPlaceholder: "sk-proj-...",
    color: "text-emerald-600 dark:text-emerald-400",
    bgBadge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
  },
  claude: {
    name: "Anthropic Claude",
    tagline: "Nuanced language comprehension and precise formatting",
    defaultModel: "claude-3-5-haiku-20241022",
    docsUrl: "https://console.anthropic.com/settings/keys",
    keyPlaceholder: "sk-ant-api03-...",
    color: "text-amber-600 dark:text-amber-400",
    bgBadge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
  },
  groq: {
    name: "Groq (LPU Inference)",
    tagline: "World's fastest LPU inference for Llama 3.3 and Mixtral",
    defaultModel: "llama-3.3-70b-versatile",
    docsUrl: "https://console.groq.com/keys",
    keyPlaceholder: "gsk_...",
    color: "text-orange-600 dark:text-orange-400",
    bgBadge: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20"
  }
};

export const DEFAULT_PROVIDER_MODELS: Record<AIProvider, ProviderModelInfo[]> = {
  gemini: [
    { id: "gemini-3.8-flash", name: "gemini-3.8-flash", displayName: "Gemini 3.8 Flash (Recommended - Ultra Fast)", badge: "Recommended" },
    { id: "gemini-3.1-flash-lite", name: "gemini-3.1-flash-lite", displayName: "Gemini 3.1 Flash Lite (High Speed)", badge: "Fast" },
    { id: "gemini-flash-latest", name: "gemini-flash-latest", displayName: "Gemini Flash Latest", badge: "Latest" },
    { id: "gemini-2.5-pro", name: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro (Deep Context)", badge: "Pro" },
  ],
  openai: [
    { id: "gpt-4o-mini", name: "gpt-4o-mini", displayName: "GPT-4o Mini (Fast & Cost Efficient)", badge: "Recommended" },
    { id: "gpt-4o", name: "gpt-4o", displayName: "GPT-4o (Omni Flagship)", badge: "Flagship" },
    { id: "o3-mini", name: "o3-mini", displayName: "o3-mini (High Speed Reasoning)", badge: "Reasoning" },
    { id: "o1-mini", name: "o1-mini", displayName: "o1-mini (STEM & Math Reasoning)", badge: "Reasoning" },
  ],
  claude: [
    { id: "claude-3-5-haiku-20241022", name: "claude-3-5-haiku-20241022", displayName: "Claude 3.5 Haiku (Lightning Fast)", badge: "Recommended" },
    { id: "claude-3-5-sonnet-20241022", name: "claude-3-5-sonnet-20241022", displayName: "Claude 3.5 Sonnet (State-of-the-art)", badge: "Flagship" },
    { id: "claude-3-7-sonnet-20250219", name: "claude-3-7-sonnet-20250219", displayName: "Claude 3.7 Sonnet (Hybrid Reasoning)", badge: "Pro" },
  ],
  groq: [
    { id: "llama-3.3-70b-versatile", name: "llama-3.3-70b-versatile", displayName: "Llama 3.3 70B Versatile", badge: "Recommended" },
    { id: "llama-3.1-8b-instant", name: "llama-3.1-8b-instant", displayName: "Llama 3.1 8B Instant (500+ tokens/sec)", badge: "Ultra Fast" },
    { id: "mixtral-8x7b-32768", name: "mixtral-8x7b-32768", displayName: "Mixtral 8x7B (High Throughput)", badge: "Fast" },
    { id: "gemma2-9b-it", name: "gemma2-9b-it", displayName: "Gemma 2 9B IT", badge: "Compact" },
  ]
};

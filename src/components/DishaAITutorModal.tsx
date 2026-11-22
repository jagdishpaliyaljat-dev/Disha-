import React, { useState, useEffect, useRef } from "react";
import { 
  Bot, 
  Sparkles, 
  Send, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  X, 
  RotateCcw, 
  Settings2, 
  ArrowRight, 
  Key, 
  Loader2, 
  Crown,
} from "lucide-react";
import { Question } from "../types";
import { 
  ChatMessage, 
  askDishaAITutor, 
  explainQuestionWithAI, 
  getActiveAICredentials,
  formatFriendlyAIError 
} from "../utils/aiTutorService";
import { AIMessageRenderer } from "./AIMessageRenderer";
import { triggerHaptic } from "../utils/audioFeedback";
import { InlineSpinner } from "./ui/LoadingScreen";
import { isFeatureVipLocked } from "../services/payment/premiumConfigService";
import { loadUserProfile } from "../utils/userProfileStorage";

interface DishaAITutorModalProps {
  isOpen: boolean;
  onClose: () => void;
  contextQuestion?: Question | null;
  onClearContextQuestion?: () => void;
  onOpenApiSettings: () => void;
  onNavigateTab?: (tab: string) => void;
}

const QUICK_SUGGESTIONS = [
  { label: "📅 30-Day Ideal Study Plan", prompt: "My Rajasthan competitive exam is in 30 days. Please create an ideal daily study schedule and timetable for me." },
  { label: "🔍 Trick to Memorize UNESCO 6 Hill Forts", prompt: "Explain the memory trick and key details for Rajasthan's 6 UNESCO World Heritage hill forts." },
  { label: "⚡ How to Avoid Negative Marking?", prompt: "What is the scientific strategy to avoid 1/3 negative marking and eliminate random guessing in RPSC and RSMSSB exams?" },
  { label: "🎯 What is the RPSC 5th Option (Option E)?", prompt: "Explain RPSC's 5th option (Option E) rule and the disqualification threshold for leaving more than 10% questions blank." },
  { label: "📝 6 Military Cantonments in 1857 Mutiny", prompt: "Which were the 6 military cantonments in Rajasthan during the 1857 revolt, and where did no mutiny occur?" }
];

export const DishaAITutorModal: React.FC<DishaAITutorModalProps> = ({
  isOpen,
  onClose,
  contextQuestion,
  onClearContextQuestion,
  onOpenApiSettings,
  onNavigateTab,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [credentials, setCredentials] = useState(getActiveAICredentials());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Refresh credentials when opened
  useEffect(() => {
    if (isOpen) {
      setCredentials(getActiveAICredentials());
    }
  }, [isOpen]);

  // Handle Question Context explanation automatically
  useEffect(() => {
    if (isOpen && contextQuestion) {
      const qText = contextQuestion.text || contextQuestion.question || "";
      const initialUserMsg: ChatMessage = {
        id: `user_${Date.now()}`,
        role: "user",
        content: `Please analyze and explain this question in detail:\n\n"${qText}"`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages([initialUserMsg]);
      setIsLoading(true);

      const aiMsgId = `ai_${Date.now()}`;
      let isAppended = false;

      explainQuestionWithAI(contextQuestion, (_chunk, accumulated) => {
        if (!isAppended) {
          isAppended = true;
          setMessages((prev) => [
            ...prev,
            {
              id: aiMsgId,
              role: "assistant",
              content: accumulated,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }
          ]);
        } else {
          setMessages((prev) =>
            prev.map((m) => (m.id === aiMsgId ? { ...m, content: accumulated } : m))
          );
        }
      })
        .then((explanation) => {
          if (!isAppended) {
            setMessages((prev) => [
              ...prev,
              {
                id: aiMsgId,
                role: "assistant",
                content: explanation,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              }
            ]);
          }
        })
        .catch((err) => {
          const { message, isApiKeyIssue } = formatFriendlyAIError(err);
          const errorMsg: ChatMessage = {
            id: `ai_err_${Date.now()}`,
            role: "assistant",
            content: message,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            suggestedAction: isApiKeyIssue ? { label: "⚙️ Check / Add API Key", action: "open_settings" } : undefined,
          };
          setMessages((prev) => [...prev, errorMsg]);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, contextQuestion]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Speech-to-Text Setup
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = "hi-IN";
        recognition.interimResults = false;

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
          }
          setIsListening(false);
        };

        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        recognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleSpeechRecognition = () => {
    triggerHaptic("light");
    if (!recognitionRef.current) {
      alert("Voice input is not supported in your browser.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch {
        setIsListening(false);
      }
    }
  };

  // Text-to-Speech playback in Hindi with natural, snappy playback rate
  const handleToggleSpeak = (msgId: string, text: string) => {
    triggerHaptic("light");
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (speakingId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    // Clean markdown symbols, bullets, brackets, urls for smooth uninterrupted speech
    const cleanText = text
      .replace(/https?:\/\/\S+/g, "")
      .replace(/[*#_`>~-]/g, " ")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 800);

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "hi-IN";
    // 1.18x speed: Crisp, snappy speech eliminating sluggish mobile TTS lag
    utterance.rate = 1.18;
    utterance.pitch = 1.0;

    try {
      const voices = window.speechSynthesis.getVoices();
      const bestVoice = voices.find((v) => v.lang === "hi-IN" || v.lang === "hi_IN")
        || voices.find((v) => v.lang.startsWith("hi"))
        || voices.find((v) => v.lang === "en-IN" || v.lang.startsWith("en-IN"));
      if (bestVoice) {
        utterance.voice = bestVoice;
      }
    } catch (_) {}

    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    setSpeakingId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || isLoading) return;

    triggerHaptic("light");
    setInputText("");
    if (speakingId) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
    }

    // Increment daily AI counter for non-VIP
    localStorage.setItem(storageKey, String(currentCount + 1));

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    const aiMsgId = `ai_${Date.now()}`;
    let isAppended = false;

    try {
      const history = messages.slice(-4).map((m) => ({ role: m.role, content: m.content }));
      const response = await askDishaAITutor(query, history, (_chunk, accumulated) => {
        if (!isAppended) {
          isAppended = true;
          setMessages((prev) => [
            ...prev,
            {
              id: aiMsgId,
              role: "assistant",
              content: accumulated,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }
          ]);
        } else {
          setMessages((prev) =>
            prev.map((m) => (m.id === aiMsgId ? { ...m, content: accumulated } : m))
          );
        }
      });

      if (!isAppended) {
        const aiMsg: ChatMessage = {
          id: aiMsgId,
          role: "assistant",
          content: response,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, aiMsg]);
      }
    } catch (err: any) {
      const { message, isApiKeyIssue } = formatFriendlyAIError(err);
      const errorMsg: ChatMessage = {
        id: `ai_err_${Date.now()}`,
        role: "assistant",
        content: message,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedAction: isApiKeyIssue ? { label: "⚙️ Check / Add API Key", action: "open_settings" } : undefined,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetChat = () => {
    triggerHaptic("light");
    if (speakingId) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
    }
    setMessages([]);
    onClearContextQuestion?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full sm:w-[480px] h-[92vh] sm:h-[700px] max-h-[94vh] bg-[#FFF9EF] dark:bg-[#171923] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-[#E8D9C0] dark:border-[#C99A45]/30 flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 sm:slide-in-from-right-6 duration-300"
      >
        {/* Header */}
        <div className="px-4 py-3.5 bg-gradient-to-r from-[#800020] via-[#5E0017] to-[#800020] text-white flex items-center justify-between shadow-xs shrink-0 border-b border-[#C99A45]/30 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#C99A45] via-[#F47B20] to-[#C99A45]" />
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-[#C99A45]/40 flex items-center justify-center text-white shadow-xs">
                <Bot className="w-5 h-5 text-[#C99A45]" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-[#800020] rounded-full animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-black text-sm tracking-tight text-white flex items-center gap-1">
                  <span>Disha AI Companion</span>
                  <Sparkles className="w-3.5 h-3.5 text-[#C99A45]" />
                </h3>
              </div>
              <p className="text-[11px] text-[#E8D9C0] font-bold">
                24×7 Rajasthan Exam Digital Mentor
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <div
              title="100% निःशुल्क शिक्षा पहल"
              className="px-2 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 font-black text-[10px] flex items-center gap-1 shadow-xs border border-emerald-400/30 select-none"
            >
              <Sparkles className="w-3 h-3 text-emerald-300" />
              <span>100% Free</span>
            </div>
            <button
              onClick={handleResetChat}
              title="Reset Chat"
              className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                triggerHaptic("light");
                onOpenApiSettings();
              }}
              title="AI Settings & Models"
              className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
            >
              <Settings2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                triggerHaptic("light");
                onClose();
              }}
              title="Close"
              className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* API Key Notice Bar if not configured */}
        {!credentials.configured && (
          <div className="px-3.5 py-2 bg-[#FFF9EF] dark:bg-[#1F2330] border-b border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-[#800020] dark:text-[#C99A45]">
              <Key className="w-3.5 h-3.5 text-[#F47B20] shrink-0" />
              <span className="text-[11px] font-bold">Add Free Gemini / OpenRouter API Key</span>
            </div>
            <button
              onClick={() => {
                triggerHaptic("light");
                onOpenApiSettings();
              }}
              className="px-2.5 py-1 bg-gradient-to-r from-[#C99A45] to-[#B88934] text-slate-950 rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0 transition-opacity hover:opacity-90 cursor-pointer shadow-2xs"
            >
              Configure
            </button>
          </div>
        )}

        {/* Chat Message Area */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-white/70 dark:bg-[#171923]/95">
          {messages.length === 0 ? (
            <div className="py-4 space-y-5 animate-in fade-in duration-300">
              {/* Welcome Card */}
              <div className="p-4 rounded-3xl bg-gradient-to-br from-[#FFF9EF] to-[#F7EFE2] dark:from-[#1F2330] dark:to-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] shadow-2xs space-y-2">
                <div className="flex items-center gap-2 text-[#800020] dark:text-[#C99A45] font-black text-xs">
                  <Sparkles className="w-4 h-4 text-[#F47B20]" />
                  <span>Welcome Aspirant!</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-[#CBD2E1] leading-relaxed font-medium">
                  I am your <strong>Disha AI Digital Mentor</strong>. Ask me anything about Rajasthan competitive exams (RAS, SI, CET, REET, Patwar), GK, history, geography, memory tricks, or exam strategy!
                </p>
              </div>

              {/* Quick Suggestion Chips */}
              <div className="space-y-2">
                <span className="text-[11px] font-black text-slate-500 dark:text-[#E8D9C0] uppercase tracking-wider block px-1">
                  💡 Quick Suggestions:
                </span>
                <div className="flex flex-col gap-2">
                  {QUICK_SUGGESTIONS.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(item.prompt)}
                      className="text-left px-3.5 py-2.5 bg-white dark:bg-[#1F2330] hover:bg-[#FFF9EF] dark:hover:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] rounded-2xl text-[13.5px] font-bold text-slate-800 dark:text-[#FFF9EF] hover:border-[#800020] dark:hover:border-[#C99A45] transition-all flex items-center justify-between group shadow-2xs cursor-pointer"
                    >
                      <span className="pr-2">{item.label}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#800020] dark:group-hover:text-[#C99A45] group-hover:translate-x-0.5 transition-all shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[88%] rounded-3xl p-4 text-[13.5px] sm:text-[15.5px] leading-relaxed shadow-xs ${
                    msg.role === "user"
                      ? "bg-gradient-to-r from-[#800020] via-[#5E0017] to-[#800020] text-white rounded-br-xs border border-[#C99A45]/30"
                      : "bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] text-slate-900 dark:text-[#FFF9EF] rounded-bl-xs shadow-2xs"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="space-y-2.5">
                      <AIMessageRenderer content={msg.content} />

                      {/* Action Button inside Assistant Bubble if needed */}
                      {msg.suggestedAction && (
                        <div className="pt-2 border-t border-[#E8D9C0] dark:border-[#31374A] mt-2">
                          <button
                            onClick={() => {
                              triggerHaptic("light");
                              if (msg.suggestedAction?.action === "open_settings") {
                                onOpenApiSettings();
                              } else if (msg.suggestedAction?.tab && onNavigateTab) {
                                onNavigateTab(msg.suggestedAction.tab);
                                onClose();
                              }
                            }}
                            className="px-3 py-1.5 bg-gradient-to-r from-[#800020] to-[#5E0017] text-white font-bold rounded-xl text-[13px] flex items-center gap-1.5 transition-all cursor-pointer shadow-xs border border-[#C99A45]/30"
                          >
                            <span>{msg.suggestedAction.label}</span>
                            <ArrowRight className="w-3 h-3 text-[#C99A45]" />
                          </button>
                        </div>
                      )}

                      {/* Audio Read-Aloud Button */}
                      <div className="flex items-center justify-between pt-1.5 border-t border-[#E8D9C0]/60 dark:border-[#31374A]/60 text-[11.5px] text-slate-400">
                        <span>{msg.timestamp}</span>
                        <button
                          onClick={() => handleToggleSpeak(msg.id, msg.content)}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-[#FFF9EF] dark:hover:bg-[#252A3A] transition-colors cursor-pointer ${
                            speakingId === msg.id ? "text-[#800020] dark:text-[#C99A45] font-black" : "text-slate-500 dark:text-[#E8D9C0]"
                          }`}
                        >
                          {speakingId === msg.id ? (
                            <>
                              <VolumeX className="w-3.5 h-3.5" />
                              <span>Stop</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5" />
                              <span>🔊 Listen</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="whitespace-pre-wrap text-[13.5px] sm:text-[15.5px] leading-relaxed font-medium">{msg.content}</p>
                      <span className="text-[11px] text-[#E8D9C0] block text-right mt-1.5">
                        {msg.timestamp}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex items-start gap-2.5 animate-in fade-in">
              <div className="w-8 h-8 rounded-xl bg-[#C99A45]/15 border border-[#C99A45]/30 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-[#C99A45] animate-pulse" />
              </div>
              <div className="p-3.5 bg-white dark:bg-[#111622] border border-[#E8D9C0] dark:border-[#263045] rounded-2xl rounded-bl-xs shadow-xs space-y-1">
                <div className="flex items-center gap-2 text-[13.5px] font-black text-[#C99A45]">
                  <InlineSpinner size="xs" />
                  <span>DISHA AI is generating response...</span>
                </div>
                <p className="text-[12px] text-[#6F768A] dark:text-[#9AA2B8]">
                  Analyzing exam concepts and key facts...
                </p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Input Box */}
        <div className="p-3 bg-white dark:bg-[#1F2330] border-t border-[#E8D9C0] dark:border-[#31374A] shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <button
              type="button"
              onClick={toggleSpeechRecognition}
              title={isListening ? "Stop Microphone" : "Voice Input"}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                isListening
                  ? "bg-rose-600 text-white border-rose-700 animate-pulse"
                  : "bg-[#FFF9EF] dark:bg-[#252A3A] text-slate-700 dark:text-[#FFF9EF] border-[#E8D9C0] dark:border-[#31374A] hover:bg-[#F7EFE2] dark:hover:bg-[#31374A]"
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isListening ? "Listening, please speak..." : "Ask your question or doubt..."}
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A] rounded-xl text-xs sm:text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#800020] dark:focus:ring-[#C99A45] transition-all"
            />

            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="p-2.5 bg-gradient-to-r from-[#800020] via-[#5E0017] to-[#800020] hover:opacity-95 text-white rounded-xl shadow-xs disabled:opacity-40 disabled:cursor-not-allowed border border-[#C99A45]/30 transition-all active:scale-95 shrink-0 cursor-pointer"
            >
              <Send className="w-4 h-4 text-[#C99A45]" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

/**
 * Floating Action Button (FAB) on Bottom-Right
 */
interface FloatingAIAssistantProps {
  onOpen: () => void;
  isHidden?: boolean;
}

export const FloatingAIAssistant: React.FC<FloatingAIAssistantProps> = ({ onOpen, isHidden }) => {
  if (isHidden) return null;

  return (
    <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-40 group animate-in zoom-in-75 duration-300">
      <button
        onClick={() => {
          triggerHaptic("light");
          onOpen();
        }}
        title="Disha AI Companion — Ask any question or doubt"
        className="relative flex items-center gap-2 px-3.5 py-2.5 sm:px-4 sm:py-3 bg-gradient-to-r from-[#800020] via-[#5E0017] to-[#800020] hover:opacity-95 text-white font-black rounded-full shadow-lg shadow-[#800020]/30 hover:shadow-[#800020]/50 transition-all duration-300 active:scale-95 cursor-pointer border border-[#C99A45]/50 group"
      >
        <span className="relative flex items-center justify-center">
          <Bot className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
          <Sparkles className="w-3 h-3 text-[#C99A45] absolute -top-1.5 -right-1.5 animate-spin" style={{ animationDuration: '4s' }} />
        </span>
        <span className="text-xs tracking-tight font-black pr-0.5 text-[#FFF9EF]">
          Disha AI
        </span>
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C99A45] opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-[#C99A45] border-2 border-[#800020]" />
        </span>
      </button>
    </div>
  );
};

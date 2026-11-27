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
import { DishaAIIcon } from "./DishaAIIcon";
import { Question, Chapter, Subject, ProgressStore, PerformanceStore, MCQSession } from "../types";
import { 
  ChatMessage, 
  askDishaAITutor, 
  explainQuestionWithAI, 
  getActiveAICredentials,
  formatFriendlyAIError 
} from "../utils/aiTutorService";
import {
  diagnoseStudentWeaknesses,
  generateAIWeaknessPrescription,
  createRemedialTestSession,
} from "../services/aiWeaknessPrescriptionService";
import { AIMessageRenderer } from "./AIMessageRenderer";
import { triggerHaptic } from "../utils/audioFeedback";
import { InlineSpinner } from "./ui/LoadingScreen";
import { isFeatureVipLocked } from "../services/payment/premiumConfigService";
import { loadUserProfile } from "../utils/userProfileStorage";
import { showAppToast } from "../utils/adminToast";

interface DishaAITutorModalProps {
  isOpen: boolean;
  onClose: () => void;
  contextQuestion?: Question | null;
  onClearContextQuestion?: () => void;
  onOpenApiSettings: () => void;
  onNavigateTab?: (tab: string) => void;
  progressStore?: ProgressStore;
  chapters?: Chapter[];
  subjects?: Subject[];
  questions?: Question[];
  onStartSession?: (session: MCQSession) => void;
}

const QUICK_SUGGESTIONS = [
  { label: "AI Weakness Postmortem & Study Plan", prompt: "ACTION_WEAKNESS_POSTMORTEM", isSpecialAction: true },
  { label: "30-Day Ideal Study Plan", prompt: "My Rajasthan competitive exam is in 30 days. Please create an ideal daily study schedule and timetable for me." },
  { label: "Trick to Memorize UNESCO 6 Hill Forts", prompt: "Explain the memory trick and key details for Rajasthan's 6 UNESCO World Heritage hill forts." },
  { label: "How to Avoid Negative Marking?", prompt: "What is the scientific strategy to avoid 1/3 negative marking and eliminate random guessing in RPSC and RSMSSB exams?" },
  { label: "What is the RPSC 5th Option (Option E)?", prompt: "Explain RPSC's 5th option (Option E) rule and the disqualification threshold for leaving more than 10% questions blank." },
  { label: "6 Military Cantonments in 1857 Mutiny", prompt: "Which were the 6 military cantonments in Rajasthan during the 1857 revolt, and where did no mutiny occur?" }
];

export const DishaAITutorModal: React.FC<DishaAITutorModalProps> = ({
  isOpen,
  onClose,
  contextQuestion,
  onClearContextQuestion,
  onOpenApiSettings,
  onNavigateTab,
  progressStore,
  chapters = [],
  subjects = [],
  questions = [],
  onStartSession,
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
      showAppToast("Voice input is not supported in this browser.", "info", "Voice Input");
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
    const rawQuery = (textToSend || inputText).trim();
    if (!rawQuery || isLoading) return;

    // Check if triggering AI Weakness Postmortem Action
    if (rawQuery === "ACTION_WEAKNESS_POSTMORTEM" || rawQuery.includes("पोस्टमॉर्टम") || rawQuery.includes("weakness postmortem")) {
      triggerHaptic("medium");
      setInputText("");
      if (speakingId) {
        window.speechSynthesis.cancel();
        setSpeakingId(null);
      }

      const userMsg: ChatMessage = {
        id: `user_${Date.now()}`,
        role: "user",
        content: "🩺 मेरा AI कमजोरी पोस्टमॉर्टम करो और अध्ययन नुस्खा (Study Prescription) बताओ।",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      const aiMsgId = `ai_${Date.now()}`;

      try {
        const diag = diagnoseStudentWeaknesses(
          questions,
          chapters,
          subjects,
          progressStore || {}
        );

        const prescription = await generateAIWeaknessPrescription(diag);

        const stepsMarkdown = prescription.dailySteps
          .map(
            (s) =>
              `### 📌 कदम ${s.stepNumber}: ${s.title}\n- **कार्रवाई**: ${s.actionItem}\n- 💡 **स्मार्ट टिप/निमोनिक**: *${s.mnemonicOrTip || "सटीक रिवीजन करें"}*`
          )
          .join("\n\n");

        const postmortemContent = `## 📋 Disha AI कमजोरी पोस्टमॉर्टम व अध्ययन नुस्खा
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 🩺 प्राथमिक निदान (Primary Diagnosis)
> **${prescription.diagnosisSummary}**

### 🔍 विफलता का मूल कारण (Root Cause Analysis)
${prescription.rootCauseAnalysis}

### ⚠️ नेगेटिव मार्किंग का प्रभाव (Negative Marking Bleed)
${prescription.negativeMarksImpactAdvice}

---

### 💊 दैनिक 3-चरणीय उपचार (3-Step Daily Treatment)
${stepsMarkdown}

---
🎯 **अनुमानित मेरिट सुधार**: **${prescription.estimatedScoreGain}**
📚 **प्रामाणिक संदर्भ**: ${prescription.officialSourcesCitations.join(" • ")}
`;

        const remedialSession = createRemedialTestSession(diag, 15);

        const aiMsg: ChatMessage = {
          id: aiMsgId,
          role: "assistant",
          content: postmortemContent,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          suggestedAction: onStartSession && remedialSession.questionIds.length > 0 ? {
            label: `🔥 15 प्रश्नों का उपचारात्मक टेस्ट शुरू करें (${remedialSession.questionIds.length} Qs)`,
            action: "start_remedial_session",
          } : {
            label: "📊 एनालिटिक्स में विस्तृत रिपोर्ट देखें",
            tab: "analytics",
          },
        };

        setMessages((prev) => [...prev, aiMsg]);
      } catch (err: any) {
        const { message, isApiKeyIssue } = formatFriendlyAIError(err);
        setMessages((prev) => [
          ...prev,
          {
            id: aiMsgId,
            role: "assistant",
            content: message,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            suggestedAction: isApiKeyIssue ? { label: "⚙️ Check / Add API Key", action: "open_settings" } : undefined,
          },
        ]);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    const query = rawQuery;

    triggerHaptic("light");
    setInputText("");
    if (speakingId) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
    }

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
        className="w-full sm:w-[480px] h-[92vh] sm:h-[700px] max-h-[94vh] bg-[#F8FAFC] dark:bg-[#130E26] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-[#A78BFA]/30 flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 sm:slide-in-from-right-6 duration-300"
      >
        {/* Header */}
        <div className="px-4 py-3.5 bg-gradient-to-r from-[#7045D8] via-[#5B32BF] to-[#7045D8] text-white flex items-center justify-between shadow-xs shrink-0 border-b border-[#A78BFA]/30 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#A78BFA] via-[#7045D8] to-[#A78BFA]" />
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-[#A78BFA]/40 flex items-center justify-center text-white shadow-xs">
                <DishaAIIcon size={22} glow />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-[#7045D8] rounded-full animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-black text-sm tracking-tight text-white flex items-center gap-1">
                  <span>Disha AI Companion</span>
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                </h3>
              </div>
              <p className="text-[11px] text-slate-200 font-bold">
                24×7 Rajasthan Exam Digital Mentor
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
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
          <div className="px-3.5 py-2 bg-[#F8FAFC] dark:bg-[#1B1536] border-b border-slate-200 dark:border-[#31275E] flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-[#7045D8] dark:text-[#A78BFA]">
              <Key className="w-3.5 h-3.5 text-[#7045D8] shrink-0" />
              <span className="text-[11px] font-bold">Add Free Gemini / OpenRouter API Key</span>
            </div>
            <button
              onClick={() => {
                triggerHaptic("light");
                onOpenApiSettings();
              }}
              className="px-2.5 py-1 bg-gradient-to-r from-[#A78BFA] to-[#B88934] text-slate-950 rounded-lg text-[11px] font-black uppercase tracking-wider shrink-0 transition-opacity hover:opacity-90 cursor-pointer shadow-2xs"
            >
              Configure
            </button>
          </div>
        )}

        {/* Chat Message Area */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-white/70 dark:bg-[#130E26]/95">
          {messages.length === 0 ? (
            <div className="py-4 space-y-5 animate-in fade-in duration-300">
              {/* Welcome Card */}
              <div className="p-4 rounded-3xl bg-gradient-to-br from-[#F8FAFC] to-slate-100 dark:from-[#1B1536] dark:to-[#241D48] border border-slate-200 dark:border-[#31275E] shadow-2xs space-y-2">
                <div className="flex items-center gap-2 text-[#7045D8] dark:text-[#A78BFA] font-black text-xs">
                  <Sparkles className="w-4 h-4 text-[#7045D8]" />
                  <span>Welcome Aspirant!</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                  I am your <strong>Disha AI Digital Mentor</strong>. Ask me anything about Rajasthan competitive exams (RAS, SI, CET, REET, Patwar), GK, history, geography, memory tricks, or exam strategy!
                </p>
              </div>

              {/* Quick Suggestion Chips */}
              <div className="space-y-2">
                <span className="text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider block px-1">
                  Quick Suggestions
                </span>
                <div className="flex flex-col gap-2">
                  {QUICK_SUGGESTIONS.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMessage(item.prompt)}
                      className="min-h-[44px] text-left px-3.5 py-2.5 bg-white dark:bg-[#1B1536] hover:bg-slate-50 dark:hover:bg-[#241D48] border border-slate-200 dark:border-[#31275E] rounded-2xl text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-50 hover:border-[#7045D8] dark:hover:border-[#A78BFA] transition-all flex items-center justify-between group shadow-2xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
                    >
                      <span className="pr-2">{item.label}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#7045D8] dark:group-hover:text-[#A78BFA] group-hover:translate-x-0.5 transition-all shrink-0" />
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
                      ? "bg-gradient-to-r from-[#7045D8] via-[#5B32BF] to-[#7045D8] text-white rounded-br-xs border border-[#A78BFA]/30"
                      : "bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] text-slate-900 dark:text-slate-50 rounded-bl-xs shadow-2xs"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="space-y-2.5">
                      <AIMessageRenderer content={msg.content} />

                      {/* Action Button inside Assistant Bubble if needed */}
                      {msg.suggestedAction && (
                        <div className="pt-2 border-t border-slate-200 dark:border-[#31275E] mt-2">
                          <button
                            onClick={() => {
                              triggerHaptic("light");
                              if (msg.suggestedAction?.action === "start_remedial_session" && onStartSession) {
                                const diag = diagnoseStudentWeaknesses(questions, chapters, subjects, progressStore || {});
                                const session = createRemedialTestSession(diag, 15);
                                if (session.questionIds.length > 0) {
                                  onStartSession(session);
                                  onClose();
                                }
                              } else if (msg.suggestedAction?.action === "open_settings") {
                                onOpenApiSettings();
                              } else if (msg.suggestedAction?.tab && onNavigateTab) {
                                onNavigateTab(msg.suggestedAction.tab);
                                onClose();
                              }
                            }}
                            className="px-3 py-1.5 bg-gradient-to-r from-[#7045D8] to-[#5B32BF] text-white font-bold rounded-xl text-[13px] flex items-center gap-1.5 transition-all cursor-pointer shadow-xs border border-[#A78BFA]/30"
                          >
                            <span>{msg.suggestedAction.label}</span>
                            <ArrowRight className="w-3 h-3 text-amber-500" />
                          </button>
                        </div>
                      )}

                      {/* Audio Read-Aloud Button */}
                      <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/60 dark:border-[#31275E]/60 text-[11.5px] text-slate-400">
                        <span>{msg.timestamp}</span>
                        <button
                          onClick={() => handleToggleSpeak(msg.id, msg.content)}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-[#F8FAFC] dark:hover:bg-[#241D48] transition-colors cursor-pointer ${
                            speakingId === msg.id ? "text-[#7045D8] dark:text-[#A78BFA] font-black" : "text-slate-500 dark:text-slate-200"
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
                              <span>Listen</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="whitespace-pre-wrap text-[13.5px] sm:text-[15.5px] leading-relaxed font-medium">{msg.content}</p>
                      <span className="text-[11px] text-slate-200 block text-right mt-1.5">
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
              <div className="w-8 h-8 rounded-xl bg-[#A78BFA]/15 border border-[#A78BFA]/30 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-amber-500 animate-pulse" />
              </div>
              <div className="p-3.5 bg-white dark:bg-[#130E26] border border-slate-200 dark:border-[#31275E] rounded-2xl rounded-bl-xs shadow-xs space-y-1">
                <div className="flex items-center gap-2 text-[13.5px] font-black text-amber-500">
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
        <div className="p-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] bg-white dark:bg-[#1B1536] border-t border-slate-200 dark:border-[#31275E] shrink-0">
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
              aria-label={isListening ? "Stop Microphone" : "Voice Input"}
              title={isListening ? "Stop Microphone" : "Voice Input"}
              className={`w-11 h-11 rounded-xl border flex items-center justify-center transition-all cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8] ${
                isListening
                  ? "bg-rose-600 text-white border-rose-700 animate-pulse"
                  : "bg-slate-100 dark:bg-[#241D48] text-slate-700 dark:text-slate-100 border-slate-200 dark:border-[#31275E] hover:bg-slate-200 dark:hover:bg-[#31275E]"
              }`}
            >
              {isListening ? <MicOff className="w-4.5 h-4.5" /> : <Mic className="w-4.5 h-4.5" />}
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isListening ? "Listening, please speak..." : "Ask your question or doubt..."}
              disabled={isLoading}
              className="flex-1 min-h-[44px] px-4 py-2.5 bg-slate-100 dark:bg-[#130E26] border border-slate-200 dark:border-[#31275E] rounded-xl text-xs sm:text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#7045D8] dark:focus:ring-[#A78BFA] transition-all"
            />

            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              aria-label="Send message"
              className="w-11 h-11 bg-[#7045D8] hover:bg-[#5B32BF] text-white rounded-xl shadow-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all active:scale-95 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
            >
              <Send className="w-4.5 h-4.5" />
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
export { FloatingAIAssistant } from "./FloatingAIAssistant";
export type { FloatingAIAssistantProps } from "./FloatingAIAssistant";
export { DishaAIIcon } from "./DishaAIIcon";
export type { DishaAIIconProps } from "./DishaAIIcon";

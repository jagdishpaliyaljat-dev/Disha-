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
  ChevronDown, 
  HelpCircle, 
  CheckCircle2, 
  ArrowRight, 
  BookOpen, 
  Key, 
  Loader2, 
  Compass,
  AlertCircle
} from "lucide-react";
import { Question } from "../types";
import { 
  ChatMessage, 
  askDishaAITutor, 
  explainQuestionWithAI, 
  getActiveAICredentials 
} from "../utils/aiTutorService";
import { RichText } from "./RichText";
import { AIMessageRenderer } from "./AIMessageRenderer";

interface DishaAITutorModalProps {
  isOpen: boolean;
  onClose: () => void;
  contextQuestion?: Question | null;
  onClearContextQuestion?: () => void;
  onOpenApiSettings: () => void;
  onNavigateTab?: (tab: string) => void;
}

const QUICK_SUGGESTIONS = [
  { label: "📅 30 दिन का स्टडी प्लान बनाओ", prompt: "मेरी प्रतियोगी परीक्षा 30 दिनों में है। कृपया मेरे लिए एक आदर्श दैनिक समय-सारणी (Daily Study Plan) तैयार करें।" },
  { label: "🔍 राजस्थान के प्रमुख दुर्ग याद रखने की ट्रिक", prompt: "राजस्थान के यूनेस्को विश्व धरोहर में शामिल 6 प्रमुख दुर्गों को याद रखने की आसान ट्रिक बताओ।" },
  { label: "📝 PYQ पेपर्स कैसे हल करें?", prompt: "प्रतियोगी परीक्षा में पिछले वर्षों के प्रश्न-पत्र (PYQs) हल करते समय किन बातों का ध्यान रखना चाहिए?", tab: "pyq" },
  { label: "🎯 1857 की क्रांति के मुख्य केंद्र", prompt: "1857 की क्रांति के समय राजस्थान में कौन-सी 6 सैनिक छावनियां थीं और उनका क्या महत्व था?" },
  { label: "⚡ नकारात्मक अंकन (Negative Marking) से कैसे बचें?", prompt: "परीक्षा में नेगेटिव मार्किंग से बचने और तुक्का न लगाने की वैज्ञानिक रणनीति क्या है?" }
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
      const qText = contextQuestion.question;
      const initialUserMsg: ChatMessage = {
        id: `user_${Date.now()}`,
        role: "user",
        content: `कृपया इस प्रश्न का विस्तृत विश्लेषण करें:\n\n"${qText}"`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages([initialUserMsg]);
      setIsLoading(true);

      explainQuestionWithAI(contextQuestion)
        .then((explanation) => {
          const aiMsg: ChatMessage = {
            id: `ai_${Date.now()}`,
            role: "assistant",
            content: explanation,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          setMessages((prev) => [...prev, aiMsg]);
        })
        .catch((err) => {
          const isNoKey = err?.message === "NO_API_KEY";
          const errorMsg: ChatMessage = {
            id: `ai_err_${Date.now()}`,
            role: "assistant",
            content: isNoKey
              ? "नमस्ते! इस प्रश्न की AI व्याख्या के लिए कृपया अपनी Google Gemini या OpenRouter API Key जोड़ें। यह 100% फ्री है और 1 मिनट में सेट हो जाती है।"
              : `माफ़ कीजिए, व्याख्या प्राप्त करने में समस्या आई: ${err?.message || "नेटवर्क त्रुटि"}। कृपया पुनः प्रयास करें।`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            suggestedAction: isNoKey ? { label: "⚙️ API Key जोड़ें", action: "open_settings" } : undefined,
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
    if (!recognitionRef.current) {
      alert("आपके ब्राउज़र में वॉइस इनपुट समर्थित नहीं है।");
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

  // Text-to-Speech playback in Hindi
  const handleToggleSpeak = (msgId: string, text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (speakingId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#_`>-]/g, "").slice(0, 600);
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "hi-IN";
    utterance.rate = 1.0;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    setSpeakingId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || isLoading) return;

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

    try {
      const history = messages.slice(-4).map((m) => ({ role: m.role, content: m.content }));
      const response = await askDishaAITutor(query, history);

      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        role: "assistant",
        content: response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const isNoKey = err?.message === "NO_API_KEY";
      const errorMsg: ChatMessage = {
        id: `ai_err_${Date.now()}`,
        role: "assistant",
        content: isNoKey
          ? "नमस्ते! दिशा AI साथी से बात करने के लिए कृपया अपनी Google Gemini या OpenRouter API Key जोड़ें। यह 100% फ्री है और 1 मिनट में सेट हो जाती है।"
          : `माफ़ कीजिए, उत्तर प्राप्त करने में समस्या आई: ${err?.message || "नेटवर्क त्रुटि"}। कृपया पुनः प्रयास करें।`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedAction: isNoKey ? { label: "⚙️ API Key जोड़ें", action: "open_settings" } : undefined,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetChat = () => {
    if (speakingId) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
    }
    setMessages([]);
    onClearContextQuestion?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end sm:p-6 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full sm:w-[460px] h-[90vh] sm:h-[680px] max-h-[92vh] bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 sm:slide-in-from-right-6 duration-300"
      >
        {/* Header */}
        <div className="px-4 py-3.5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white flex items-center justify-between shadow-xs shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-xs">
                <Bot className="w-5 h-5 text-indigo-100" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-indigo-700 rounded-full animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-sm tracking-tight text-white flex items-center gap-1">
                  <span>दिशा AI साथी</span>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                </h3>
              </div>
              <p className="text-[11px] text-indigo-100/90 font-medium">
                24×7 प्रतियोगी परीक्षा डिजिटल गुरुजी
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleResetChat}
              title="चैट रीसेट करें"
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenApiSettings}
              title="AI सेटिंग्स व मॉडल्स"
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Settings2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              title="बंद करें"
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* API Key Notice Bar if not configured */}
        {!credentials.configured && (
          <div className="px-3.5 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/50 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-amber-800 dark:text-amber-200">
              <Key className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="text-[11px] font-medium">नि:शुल्क Gemini / OpenRouter API Key जोड़ें</span>
            </div>
            <button
              onClick={onOpenApiSettings}
              className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] font-bold uppercase tracking-wider shrink-0 transition-colors"
            >
              सेट करें
            </button>
          </div>
        )}

        {/* Chat Message Area */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/50 dark:bg-slate-950/30">
          {messages.length === 0 ? (
            <div className="py-6 space-y-6 animate-in fade-in duration-300">
              {/* Welcome Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/20 border border-indigo-100 dark:border-indigo-900/50 space-y-2.5">
                <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-bold text-xs">
                  <Sparkles className="w-4 h-4" />
                  <span>नमस्ते अभ्यर्थी! आपका स्वागत है</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  मैं आपका <strong>दिशा AI मार्गदर्शक</strong> हूँ। मुझसे किसी भी विषय का सवाल, इतिहास/भूगोल के तथ्य, परीक्षा रणनीति या याद रखने की शॉर्ट ट्रिक पूछें!
                </p>
              </div>

              {/* Quick Suggestion Chips */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block px-1">
                  💡 त्वरित सवाल (Quick Questions):
                </span>
                <div className="flex flex-col gap-1.5">
                  {QUICK_SUGGESTIONS.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(item.prompt)}
                      className="text-left px-3.5 py-2.5 bg-white dark:bg-slate-800 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all flex items-center justify-between group shadow-2xs"
                    >
                      <span>{item.label}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
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
                  className={`max-w-[88%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed shadow-xs ${
                    msg.role === "user"
                      ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-br-xs"
                      : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-xs"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="space-y-2">
                      <AIMessageRenderer content={msg.content} />

                      {/* Action Button inside Assistant Bubble if needed */}
                      {msg.suggestedAction && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-700 mt-2">
                          <button
                            onClick={() => {
                              if (msg.suggestedAction?.action === "open_settings") {
                                onOpenApiSettings();
                              } else if (msg.suggestedAction?.tab && onNavigateTab) {
                                onNavigateTab(msg.suggestedAction.tab);
                                onClose();
                              }
                            }}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-all"
                          >
                            <span>{msg.suggestedAction.label}</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      {/* Audio Read-Aloud Button */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700/60 text-[10px] text-slate-400">
                        <span>{msg.timestamp}</span>
                        <button
                          onClick={() => handleToggleSpeak(msg.id, msg.content)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${
                            speakingId === msg.id ? "text-indigo-600 dark:text-indigo-400 font-bold" : ""
                          }`}
                        >
                          {speakingId === msg.id ? (
                            <>
                              <VolumeX className="w-3 h-3" />
                              <span>रोकें</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3 h-3" />
                              <span>🔊 सुनें</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      <span className="text-[10px] text-indigo-200 block text-right mt-1">
                        {msg.timestamp}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex items-start gap-2 animate-in fade-in">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-pulse" />
              </div>
              <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-bl-xs shadow-xs space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>उत्तर तैयार किया जा रहा है...</span>
                </div>
                <p className="text-[11px] text-slate-400">अवधारणा और परीक्षा उपयोगी तथ्यों का विश्लेषण जारी है</p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Input Box */}
        <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
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
              title={isListening ? "माइक बंद करें" : "बोलकर पूछें (Voice Input)"}
              className={`p-2.5 rounded-xl border transition-all ${
                isListening
                  ? "bg-rose-500 text-white border-rose-600 animate-pulse"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isListening ? "बोलिए, सुन रहा हूँ..." : "पूछें अपना सवाल या डाउट..."}
              disabled={isLoading}
              className="flex-1 px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/30 focus:bg-white dark:focus:bg-slate-850 transition-all outline-hidden"
            />

            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="p-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl shadow-xs disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 shrink-0"
            >
              <Send className="w-4 h-4" />
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
        onClick={onOpen}
        title="दिशा AI साथी — कोई भी सवाल पूछें"
        className="relative flex items-center gap-2.5 px-3.5 py-2.5 sm:px-4 sm:py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 text-white font-bold rounded-full shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all duration-300 active:scale-95 cursor-pointer border border-white/20"
      >
        <span className="relative flex items-center justify-center">
          <Bot className="w-5 h-5 text-white" />
          <Sparkles className="w-3 h-3 text-amber-300 absolute -top-1.5 -right-1.5 animate-spin" style={{ animationDuration: '4s' }} />
        </span>
        <span className="text-xs tracking-tight font-extrabold pr-0.5">
          दिशा AI
        </span>
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400 border border-white" />
        </span>
      </button>
    </div>
  );
};

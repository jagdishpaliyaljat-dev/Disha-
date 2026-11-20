import { supabase, isSupabaseConfigured } from "../lib/supabase";
import {
  loadUserQuestionsStore,
  getCombinedSubjects,
  getCombinedChapters,
  getCombinedQuestions,
} from "./questionsStorage";
import { ANIME_CHARACTERS } from "../components/battle/BattleAvatar";
import type {
  BattleCategory,
  QuestionSourceType,
  BattlePlayer,
  BattleQuestion,
  BattleRoomConfig,
  BattleEventMessage,
  FloatingEmoji,
} from "../components/battle/types";

// High-Yield Authentic Rajasthan GK Battle Questions Pool (Fallback & Default)
export const FALLBACK_BATTLE_QUESTIONS: BattleQuestion[] = [
  // History
  {
    id: "hist_1",
    text: "तराइन का प्रथम युद्ध (1191 ई.) में पृथ्वीराज चौहान तृतीय ने किसे पराजित किया था?",
    options: ["मुहम्मद गोरी", "कुतुबुद्दीन ऐबक", "महमूद गजनवी", "इल्तुतमिश"],
    correctIndex: 0,
    explanation: "तराइन के प्रथम युद्ध (1191) में पृथ्वीराज चौहान ने मुहम्मद गोरी को बुरी तरह परास्त किया था।",
    category: "history",
    difficulty: "easy",
  },
  {
    id: "hist_2",
    text: "राजस्थान में 1857 की क्रांति का प्रारंभ सर्वप्रथम किस छावनी से हुआ था?",
    options: ["एरिनपुरा", "नसीराबाद", "नीमच", "देवली"],
    correctIndex: 1,
    explanation: "28 मई 1857 को नसीराबाद छावनी की 15वीं बंगाल नेटिव इन्फैंट्री के सैनिकों ने विद्रोह शुरू किया था।",
    category: "history",
    difficulty: "easy",
  },
  {
    id: "hist_3",
    text: "खानवा का ऐतिहासिक युद्ध (1527 ई.) बाबर और किस राजपूत शासक के मध्य हुआ था?",
    options: ["महाराणा कुंभा", "महाराणा सांगा", "महाराणा प्रताप", "राव मालदेव"],
    correctIndex: 1,
    explanation: "17 मार्च 1527 को खानवा (भरतपुर) में बाबर और महाराणा सांगा के मध्य भीषण युद्ध हुआ था।",
    category: "history",
    difficulty: "easy",
  },
  {
    id: "hist_4",
    text: "बिजोलिया किसान आंदोलन के प्रणेता व प्रमुख सूत्रधार कौन थे?",
    options: ["विजय सिंह पथिक", "माणिक्य लाल वर्मा", "केसरी सिंह बारहठ", "गोकुल भाई भट्ट"],
    correctIndex: 0,
    explanation: "विजय सिंह पथिक (भूप सिंह) ने बिजोलिया किसान आंदोलन को राष्ट्रीय स्तर पर संगठित और नेतृत्व प्रदान किया।",
    category: "history",
    difficulty: "medium",
  },
  {
    id: "hist_5",
    text: "कालीबंगा सभ्यता राजस्थान के किस जिले में घग्घर नदी के किनारे स्थित है?",
    options: ["हनुमानगढ़", "गंगानगर", "बीकानेर", "अनूपगढ़"],
    correctIndex: 0,
    explanation: "कालीबंगा हनुमानगढ़ जिले में प्राचीन सरस्वती (घग्घर) नदी के तट पर स्थित हड़प्पाकालीन स्थल है।",
    category: "history",
    difficulty: "easy",
  },
  {
    id: "hist_6",
    text: "मत्स्य संघ का राजस्थान में विलय किस चरण में किया गया था?",
    options: ["प्रथम चरण", "तृतीय चरण", "पंचम चरण", "सप्तम चरण"],
    correctIndex: 2,
    explanation: "15 मई 1949 को डॉ. शंकरराव देव समिति की सिफारिश पर मत्स्य संघ को वृहत् राजस्थान में मिलाया गया (पंचम चरण)।",
    category: "history",
    difficulty: "medium",
  },
  {
    id: "hist_7",
    text: "हल्दीघाटी का प्रसिद्ध युद्ध (1576 ई.) में महाराणा प्रताप के सेनापति हकीम खां सूरी का मकबरा कहां है?",
    options: ["खमनौर", "रक्ततलाई", "गोगुंदा", "चावंड"],
    correctIndex: 0,
    explanation: "महाराणा प्रताप के हरावल सेनापति हकीम खां सूरी का मकबरा खमनौर (राजसमंद) में स्थित है।",
    category: "history",
    difficulty: "hard",
  },

  // Geography
  {
    id: "geo_1",
    text: "अरावली पर्वतमाला की सर्वोच्च चोटी 'गुरुशिखर' (1722 मी.) किस जिले में स्थित है?",
    options: ["सिरोही", "उदयपुर", "राजसमंद", "पाली"],
    correctIndex: 0,
    explanation: "माउंट आबू, सिरोही में स्थित गुरुशिखर अरावली व राजस्थान की सबसे ऊंची पर्वत चोटी है।",
    category: "geography",
    difficulty: "easy",
  },
  {
    id: "geo_2",
    text: "राजस्थान का कल्पवृक्ष एवं राज्य वृक्ष किसे कहा जाता है?",
    options: ["रोहिड़ा", "खेजड़ी", "बबूल", "धोकड़ा"],
    correctIndex: 1,
    explanation: "खेजड़ी (प्रोसोपिस सिनेरेरिया) को 1983 में राजस्थान का राज्य वृक्ष घोषित किया गया था।",
    category: "geography",
    difficulty: "easy",
  },
  {
    id: "geo_3",
    text: "कर्क रेखा (23°30' N) राजस्थान के किन दो दक्षिणी जिलों से होकर गुजरती है?",
    options: ["बांसवाड़ा व डूंगरपुर", "उदयपुर व सिरोही", "झालावाड़ व बारां", "प्रतापगढ़ व चित्तौड़गढ़"],
    correctIndex: 0,
    explanation: "कर्क रेखा बांसवाड़ा के कुशलगढ़ से बीचोंबीच तथा डूंगरपुर की दक्षिणी सीमा को छूती हुई निकलती है।",
    category: "geography",
    difficulty: "easy",
  },
  {
    id: "geo_4",
    text: "राजस्थान में देश के कुल नमक उत्पादन का लगभग कितना प्रतिशत सांभर झील से प्राप्त होता है?",
    options: ["8.7%", "15.2%", "4.5%", "12.8%"],
    correctIndex: 0,
    explanation: "सांभर झील भारत की सबसे बड़ी अंतःस्थलीय खारे पानी की झील है, जहां देश का लगभग 8.7% नमक बनता है।",
    category: "geography",
    difficulty: "medium",
  },
  {
    id: "geo_5",
    text: "राजस्थान की एकमात्र बारहमासी व सर्वाधिक जल सतही प्रवाह वाली नदी कौनसी है?",
    options: ["चम्बल", "बनास", "लूणी", "माही"],
    correctIndex: 0,
    explanation: "चम्बल नदी (चर्मण्वती) राजस्थान की एकमात्र नित्यवाही बारहमासी नदी है जो मध्य प्रदेश के जानापाव से निकलती है।",
    category: "geography",
    difficulty: "easy",
  },
  {
    id: "geo_6",
    text: "राजस्थान के किस जिले में सर्वाधिक वन क्षेत्र (क्षेत्रफल की दृष्टि से) पाया जाता है?",
    options: ["उदयपुर", "अलवर", "प्रतापगढ़", "करौली"],
    correctIndex: 0,
    explanation: "भारतीय वन सर्वेक्षण रिपोर्ट के अनुसार उदयपुर जिले में राजस्थान का सर्वाधिक वन क्षेत्रफल है।",
    category: "geography",
    difficulty: "medium",
  },

  // Culture & Art
  {
    id: "cult_1",
    text: "विश्वप्रसिद्ध 'थेवा कला' (कांच पर सोने की नक्काशी) का संबंध किस जिले से है?",
    options: ["प्रतापगढ़", "बाड़मेर", "बीकानेर", "जयपुर"],
    correctIndex: 0,
    explanation: "थेवा कला बेल्जियम कांच पर सोने की बारीक कारीगरी है जो प्रतापगढ़ के सोनी परिवार का पेटेंट है।",
    category: "culture",
    difficulty: "easy",
  },
  {
    id: "cult_2",
    text: "यूनेस्को की अमूर्त सांस्कृतिक धरोहर सूची में शामिल 'कालबेलिया नृत्य' की प्रसिद्ध नृत्यांगना कौन हैं?",
    options: ["गुलाबो सपेरा", "अल्ला जिलाई बाई", "गवरी देवी", "मांगी बाई"],
    correctIndex: 0,
    explanation: "पद्मश्री गुलाबो सपेरा ने राजस्थान के कालबेलिया नृत्य को अंतर्राष्ट्रीय ख्याति दिलाई है।",
    category: "culture",
    difficulty: "easy",
  },
  {
    id: "cult_3",
    text: "विश्व की दूसरी सबसे लंबी (36 किमी) सुदृढ़ प्राचीर दीवार किस दुर्ग की है?",
    options: ["चित्तौड़गढ़ दुर्ग", "कुंभलगढ़ दुर्ग", "मेहरानगढ़ दुर्ग", "रणथंभौर दुर्ग"],
    correctIndex: 1,
    explanation: "महाराणा कुंभा द्वारा निर्मित कुंभलगढ़ दुर्ग की 36 किमी लंबी दीवार को 'भारत की महान दीवार' कहा जाता है।",
    category: "culture",
    difficulty: "easy",
  },
  {
    id: "cult_4",
    text: "भारतीय डाक विभाग द्वारा 1973 में किस प्रसिद्ध चित्रशैली की 'बणी-ठणी' पर डाक टिकट जारी किया गया?",
    options: ["किशनगढ़ शैली", "मेवाड़ शैली", "बूंदी शैली", "नाथद्वारा शैली"],
    correctIndex: 0,
    explanation: "निहालचंद द्वारा चित्रित बणी-ठणी को एरिक डिक्सन ने 'भारत की मोनालिसा' कहा था।",
    category: "culture",
    difficulty: "easy",
  },
  {
    id: "cult_5",
    text: "पर्यावरण संरक्षण हेतु 29 नियमों का प्रतिपादन करने वाले लोक संत कौन थे?",
    options: ["संत जाम्भोजी", "संत दादू दयाल", "संत जसनाथ जी", "संत पीपा जी"],
    correctIndex: 0,
    explanation: "संत जाम्भोजी ने 1485 ई. में समराथल (बीकानेर) में बिश्नोई संप्रदाय की स्थापना कर 29 नियम दिए।",
    category: "culture",
    difficulty: "easy",
  },
  {
    id: "cult_6",
    text: "ऊंट की खाल पर स्वर्ण मीनाकारी कला को क्या कहा जाता है?",
    options: ["उस्ता कला", "मथेरण कला", "अजरक प्रिंट", "दाबू प्रिंट"],
    correctIndex: 0,
    explanation: "बीकानेर की उस्ता कला ऊंट की खाल पर सोने के बारीक कार्य हेतु प्रसिद्ध है (हिसामुद्दीन उस्ता)।",
    category: "culture",
    difficulty: "medium",
  },

  // Polity
  {
    id: "pol_1",
    text: "राजस्थान में पंचायती राज व्यवस्था का शुभारंभ 2 अक्टूबर 1959 को किस जिले से हुआ था?",
    options: ["नागौर", "सीकर", "जयपुर", "अजमेर"],
    correctIndex: 0,
    explanation: "पं. जवाहरलाल नेहरू ने नागौर के बगदरी गांव में देश की पहली त्रिस्तरीय पंचायती राज व्यवस्था का उद्घाटन किया था।",
    category: "polity",
    difficulty: "easy",
  },
  {
    id: "pol_2",
    text: "राजस्थान राज्य विधानसभा में कुल कितनी निर्वाचित सीटें हैं?",
    options: ["200", "250", "160", "180"],
    correctIndex: 0,
    explanation: "वर्तमान में राजस्थान विधानसभा में कुल 200 सीटें निर्धारित हैं।",
    category: "polity",
    difficulty: "easy",
  },
  {
    id: "pol_3",
    text: "राजस्थान से लोकसभा व राज्यसभा के लिए निर्वाचित कुल सांसद संख्या कितनी है?",
    options: ["35 (25+10)", "30 (20+10)", "40 (25+15)", "25 (15+10)"],
    correctIndex: 0,
    explanation: "राजस्थान से 25 लोकसभा सदस्य तथा 10 राज्यसभा सदस्य कुल मिलाकर 35 सांसद संसद में प्रतिनिधित्व करते हैं।",
    category: "polity",
    difficulty: "easy",
  },
  {
    id: "pol_4",
    text: "राजस्थान के प्रथम राज्यपाल कौन थे?",
    options: ["सरदार गुरुमुख निहाल सिंह", "डॉ. संपूर्णानंद", "हुकुम सिंह", "महाराज मानसिंह द्वितीय"],
    correctIndex: 0,
    explanation: "1 नवंबर 1956 को राज्य पुनर्गठन के बाद सरदार गुरुमुख निहाल सिंह राजस्थान के प्रथम राज्यपाल बने।",
    category: "polity",
    difficulty: "medium",
  },
  {
    id: "pol_5",
    text: "राजस्थान राज्य मानवाधिकार आयोग के अध्यक्ष के रूप में केवल किसे नियुक्त किया जा सकता है?",
    options: [
      "उच्च न्यायालय का पूर्व मुख्य न्यायाधीश या न्यायाधीश",
      "सर्वोच्च न्यायालय का मुख्य न्यायाधीश मात्र",
      "राज्य का मुख्य सचिव",
      "राज्यपाल द्वारा नामित कोई भी नागरिक",
    ],
    correctIndex: 0,
    explanation: "संशोधित मानवाधिकार संरक्षण अधिनियम के तहत उच्च न्यायालय के सेवानिवृत्त मुख्य न्यायाधीश या न्यायाधीश अध्यक्ष बन सकते हैं।",
    category: "polity",
    difficulty: "hard",
  },

  // Economy & Schemes
  {
    id: "econ_1",
    text: "राजस्थान में देश का प्रथम सौर ऊर्जा पार्क (सोलर पार्क) 'भड़ला' किस जिले में स्थित है?",
    options: ["जोधपुर", "जैसलमेर", "बीकानेर", "बाड़मेर"],
    correctIndex: 0,
    explanation: "भड़ला (फलोदी/जोधपुर) विश्व के सबसे बड़े सोलर पार्कों में से एक है जिसकी क्षमता 2245 मेगावाट है।",
    category: "economy",
    difficulty: "easy",
  },
  {
    id: "econ_2",
    text: "राजस्थान की प्रथम पेट्रोलियम रिफाइनरी सह पेट्रोकेमिकल कॉम्प्लेक्स कहां स्थापित की जा रही है?",
    options: ["पचपदरा (बालोतरा)", "गुड़ामालानी (बाड़मेर)", "नागाणा", "बायतु"],
    correctIndex: 0,
    explanation: "एचपीसीएल राजस्थान रिफाइनरी लिमिटेड (HRRL) पचपदरा, बालोतरा जिले में 9 MMTPA क्षमता वाली रिफाइनरी लगा रही है।",
    category: "economy",
    difficulty: "easy",
  },
  {
    id: "econ_3",
    text: "राजस्थान में जरूरतमंदों को मात्र ₹8 में पौष्टिक व शुद्ध भोजन उपलब्ध कराने वाली योजना कौनसी है?",
    options: ["इंदिरा रसोई / अन्नपूर्णा रसोई योजना", "मुख्यमंत्री अन्न जल योजना", "दीनदयाल रसोई योजना", "सांझा चूल्हा योजना"],
    correctIndex: 0,
    explanation: "'कोई भी भूखा न सोए' के संकल्प के साथ संचालित रसोई योजना में ₹8 में सम्मानपूर्वक भोजन मिलता है।",
    category: "economy",
    difficulty: "easy",
  },
  {
    id: "econ_4",
    text: "खनिज उत्पादन मूल्य की दृष्टि से राजस्थान का भारत में कौनसा स्थान है?",
    options: ["दूसरा", "पहला", "तीसरा", "पांचवा"],
    correctIndex: 0,
    explanation: "खनिजों के उत्पादन मूल्य में राजस्थान उड़ीसा के बाद देश में दूसरे स्थान पर है और 'खनिजों का अजायबघर' कहलाता है।",
    category: "economy",
    difficulty: "medium",
  },
];

// Helper: Shuffle Array (Fisher-Yates)
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Generate a random 6-character room code (e.g., "739201" or "841923")
export function generateRoomCode(): string {
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Default Player Avatars (Anime Character Avatars)
export const PLAYER_AVATARS = ANIME_CHARACTERS.map((c) => c.avatarUrl);

// Curated Bot Opponents for instant solo test & practice (Anime Personas)
export const BOT_OPPONENTS: Omit<BattlePlayer, "id">[] = [
  {
    name: "Gojo (AI Sensei)",
    avatar: ANIME_CHARACTERS[0].avatarUrl,
    isHost: false,
    isReady: true,
    isBot: true,
    score: 0,
    streak: 0,
    correctCount: 0,
    wrongCount: 0,
    avgResponseTimeMs: 4200,
  },
  {
    name: "Tanjiro (AI Blade)",
    avatar: ANIME_CHARACTERS[1].avatarUrl,
    isHost: false,
    isReady: true,
    isBot: true,
    score: 0,
    streak: 0,
    correctCount: 0,
    wrongCount: 0,
    avgResponseTimeMs: 3800,
  },
  {
    name: "Zoro (AI Master)",
    avatar: ANIME_CHARACTERS[4].avatarUrl,
    isHost: false,
    isReady: true,
    isBot: true,
    score: 0,
    streak: 0,
    correctCount: 0,
    wrongCount: 0,
    avgResponseTimeMs: 4600,
  },
];

// Helper to get user's custom questions formatted as BattleQuestion
export function getUserCustomQuestionsList(): BattleQuestion[] {
  try {
    const store = loadUserQuestionsStore();
    if (store && Array.isArray(store.customQuestions) && store.customQuestions.length > 0) {
      return store.customQuestions
        .filter((q) => q && q.text && Array.isArray(q.options) && q.options.length >= 2)
        .map((q) => ({
          id: q.id,
          text: q.text,
          options: q.options,
          correctIndex: typeof q.correctIndex === "number" ? q.correctIndex : 0,
          explanation: q.explanation || "",
          category: q.subjectId || "custom",
          difficulty: q.difficulty || "medium",
        }));
    }
  } catch {
    // Ignore hydration error
  }
  return [];
}

// Helper to get available subjects list for live battle selection
export function getAvailableSubjectsList(): { id: string; title: string; count: number }[] {
  try {
    const subjects = getCombinedSubjects();
    const chapters = getCombinedChapters();
    const allQuestions = getCombinedQuestions(chapters);

    if (subjects.length > 0) {
      return subjects.map((sub) => {
        const count = allQuestions.filter((q) => q.subjectId === sub.id).length;
        return {
          id: sub.id,
          title: sub.hindiName || sub.name,
          count,
        };
      });
    }

    // Default Fallback Subjects
    return [
      { id: "history", title: "Rajasthan History", count: 25 },
      { id: "geography", title: "Rajasthan Geography", count: 25 },
      { id: "culture", title: "Art & Culture", count: 20 },
      { id: "polity", title: "Polity & Administration", count: 18 },
      { id: "economy", title: "Economy & Schemes", count: 15 },
    ];
  } catch {
    return [];
  }
}

// Helper to get available chapters list for question selection
export function getAvailableChaptersList(subjectId?: string): { id: string; title: string; count: number; subjectId?: string }[] {
  try {
    const chapters = getCombinedChapters();
    const allQuestions = getCombinedQuestions(chapters);
    const targetChapters = subjectId
      ? chapters.filter((c) => !c.subjectId || c.subjectId === subjectId)
      : chapters;

    if (targetChapters.length > 0) {
      return targetChapters.map((ch) => {
        const count = allQuestions.filter((q) => q.chapterId === ch.id).length;
        return {
          id: ch.id,
          title: ch.hindiTitle || ch.title || `Chapter ${ch.number || ""}`,
          count,
          subjectId: ch.subjectId,
        };
      });
    }

    // Fallback from custom chapters in store
    const store = loadUserQuestionsStore();
    const list: { id: string; title: string; count: number; subjectId?: string }[] = [];
    if (store && Array.isArray(store.customChapters)) {
      store.customChapters.forEach((ch) => {
        if (ch && ch.id) {
          const count = store.customQuestions?.filter((q) => q.chapterId === ch.id)?.length || 0;
          list.push({
            id: ch.id,
            title: ch.hindiTitle || ch.title || `Chapter ${ch.number || ""}`,
            count,
            subjectId: ch.subjectId,
          });
        }
      });
    }
    return list;
  } catch {
    return [];
  }
}

// Helper to get available topics list for topic question selection
export function getAvailableTopicsList(chapterId?: string): { id: string; title: string; count: number; chapterId: string }[] {
  try {
    const chapters = getCombinedChapters();
    const allQuestions = getCombinedQuestions(chapters);
    const targetChapters = chapterId
      ? chapters.filter((c) => c.id === chapterId)
      : chapters;

    const list: { id: string; title: string; count: number; chapterId: string }[] = [];
    targetChapters.forEach((ch) => {
      if (Array.isArray(ch.topics)) {
        ch.topics.forEach((top) => {
          const count = allQuestions.filter((q) => q.topicId === top.id).length;
          list.push({
            id: top.id,
            title: top.hindiTitle || top.title,
            count,
            chapterId: ch.id,
          });
        });
      }
    });
    return list;
  } catch {
    return [];
  }
}

export interface GetBattleQuestionsOptions {
  category?: BattleCategory;
  count?: number;
  questionSource?: QuestionSourceType;
  selectedSubjectId?: string;
  selectedChapterId?: string;
  selectedTopicId?: string;
  selectedQuestionIds?: string[];
}

// Internal helper to convert any app question format to BattleQuestion
function formatToBattleQuestion(raw: any, fallbackIdPrefix = "q"): BattleQuestion {
  return {
    id: raw.id || `${fallbackIdPrefix}_${Math.random().toString(36).substring(2, 7)}`,
    text: raw.text || raw.question || "",
    options: Array.isArray(raw.options) && raw.options.length >= 2 ? raw.options : ["A", "B", "C", "D"],
    correctIndex: typeof raw.correctIndex === "number" ? raw.correctIndex : typeof raw.correct_answer === "number" ? raw.correct_answer : 0,
    explanation: raw.explanation || "",
    category: raw.subjectId || raw.category || "General",
    difficulty: raw.difficulty || "medium",
  };
}

// Get Battle Questions based on Category, Source, Chapter, Topic, or specific selection
export function getBattleQuestions(
  optionsOrCategory: BattleCategory | GetBattleQuestionsOptions = "all",
  legacyCount: number = 10
): BattleQuestion[] {
  let category: BattleCategory = "all";
  let count: number = 10;
  let source: QuestionSourceType = "curated";
  let selectedSubjectId: string | undefined;
  let selectedChapterId: string | undefined;
  let selectedTopicId: string | undefined;
  let selectedQuestionIds: string[] | undefined;

  if (typeof optionsOrCategory === "string") {
    category = optionsOrCategory;
    count = legacyCount;
  } else if (optionsOrCategory && typeof optionsOrCategory === "object") {
    category = optionsOrCategory.category || "all";
    count = optionsOrCategory.count || 10;
    source = optionsOrCategory.questionSource || "curated";
    selectedSubjectId = optionsOrCategory.selectedSubjectId;
    selectedChapterId = optionsOrCategory.selectedChapterId;
    selectedTopicId = optionsOrCategory.selectedTopicId;
    selectedQuestionIds = optionsOrCategory.selectedQuestionIds;
  }

  // Load all app questions once for filtering
  let allCombinedQuestions: BattleQuestion[] = [];
  try {
    const chapters = getCombinedChapters();
    const rawQuestions = getCombinedQuestions(chapters);
    allCombinedQuestions = rawQuestions.map((q) => formatToBattleQuestion(q));
  } catch {
    allCombinedQuestions = [];
  }

  // Mode 1: Hand-picked questions by host
  if (source === "manual_pick" && Array.isArray(selectedQuestionIds) && selectedQuestionIds.length > 0) {
    const allCustom = getUserCustomQuestionsList();
    const combined = [...allCustom, ...allCombinedQuestions, ...FALLBACK_BATTLE_QUESTIONS];
    const picked = combined.filter((q) => selectedQuestionIds!.includes(q.id));
    if (picked.length > 0) {
      if (picked.length >= count) {
        return picked.slice(0, count);
      }
      // If user requested more questions than selected, supplement
      const needed = count - picked.length;
      const supplement = shuffleArray(FALLBACK_BATTLE_QUESTIONS).slice(0, needed);
      return [...picked, ...supplement];
    }
  }

  // Mode 2: Specific Topic questions
  if (source === "topic" && selectedTopicId) {
    try {
      const chapters = getCombinedChapters();
      const rawQuestions = getCombinedQuestions(chapters);
      const matched = rawQuestions
        .filter((q) => q.topicId === selectedTopicId && q.text)
        .map((q) => formatToBattleQuestion(q));

      if (matched.length > 0) {
        const shuffled = shuffleArray(matched);
        if (shuffled.length >= count) {
          return shuffled.slice(0, count);
        }
        const needed = count - shuffled.length;
        const supplement = shuffleArray(FALLBACK_BATTLE_QUESTIONS).slice(0, needed);
        return [...shuffled, ...supplement];
      }
    } catch {
      // Fallback
    }
  }

  // Mode 3: Specific Chapter questions
  if (source === "chapter" && selectedChapterId) {
    try {
      const chapters = getCombinedChapters();
      const rawQuestions = getCombinedQuestions(chapters);
      const matched = rawQuestions
        .filter((q) => q.chapterId === selectedChapterId && q.text)
        .map((q) => formatToBattleQuestion(q));

      if (matched.length > 0) {
        const shuffled = shuffleArray(matched);
        if (shuffled.length >= count) {
          return shuffled.slice(0, count);
        }
        const needed = count - shuffled.length;
        const supplement = shuffleArray(FALLBACK_BATTLE_QUESTIONS).slice(0, needed);
        return [...shuffled, ...supplement];
      }
    } catch {
      // Fallback
    }
  }

  // Mode 4: Specific Subject questions
  if (source === "subject" && selectedSubjectId) {
    try {
      const chapters = getCombinedChapters();
      const rawQuestions = getCombinedQuestions(chapters);
      const matched = rawQuestions
        .filter((q) => q.subjectId === selectedSubjectId && q.text)
        .map((q) => formatToBattleQuestion(q));

      if (matched.length > 0) {
        const shuffled = shuffleArray(matched);
        if (shuffled.length >= count) {
          return shuffled.slice(0, count);
        }
        const needed = count - shuffled.length;
        const supplement = shuffleArray(FALLBACK_BATTLE_QUESTIONS).slice(0, needed);
        return [...shuffled, ...supplement];
      }
    } catch {
      // Fallback
    }
  }

  // Mode 5: Custom Question Bank
  if (source === "custom_bank") {
    const customList = getUserCustomQuestionsList();
    if (customList.length > 0) {
      const shuffledCustom = shuffleArray(customList);
      if (shuffledCustom.length >= count) {
        return shuffledCustom.slice(0, count);
      }
      const needed = count - shuffledCustom.length;
      const fallbackSubset = shuffleArray(FALLBACK_BATTLE_QUESTIONS).slice(0, needed);
      return [...shuffledCustom, ...fallbackSubset];
    }
  }

  // Mode 6: Default Curated Rajasthan GK Bank
  let filteredFallback = FALLBACK_BATTLE_QUESTIONS;
  if (category !== "all") {
    const matched = FALLBACK_BATTLE_QUESTIONS.filter((q) => q.category === category);
    if (matched.length > 0) {
      filteredFallback = matched;
    }
  }

  let pool: BattleQuestion[] = [...filteredFallback];
  if (allCombinedQuestions.length > 0) {
    pool = [...pool, ...allCombinedQuestions];
  }

  // Fallback if pool is empty
  if (pool.length === 0) {
    pool = [...FALLBACK_BATTLE_QUESTIONS];
  }

  // Ensure enough questions in pool
  let cycles = 0;
  while (pool.length < count && pool.length > 0 && cycles < 10) {
    cycles++;
    const cloned = pool.map((q, idx) => ({ ...q, id: `${q.id}_c${cycles}_${idx}` }));
    pool = [...pool, ...cloned];
  }

  const shuffled = shuffleArray(pool);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Speed-Based Scoring Engine:
 * - Base: 100 points
 * - Speed bonus: up to 50 points based on remaining time percentage
 * - Streak bonus: +20 points for 2-streak, +40 points for 3+ streak
 */
export function calculateRoundScore(
  isCorrect: boolean,
  timeTakenMs: number,
  maxTimeSec: number = 10,
  currentStreak: number = 0
): { points: number; newStreak: number } {
  if (!isCorrect) {
    return { points: 0, newStreak: 0 };
  }

  const maxTimeMs = Math.max(5000, maxTimeSec * 1000);
  const clampedTime = Math.max(300, Math.min(timeTakenMs, maxTimeMs));
  const remainingFraction = Math.max(0, (maxTimeMs - clampedTime) / maxTimeMs);

  const basePoints = 100;
  const speedBonus = Math.round(remainingFraction * 50);
  const streakBonus = currentStreak >= 3 ? 40 : currentStreak >= 2 ? 20 : 0;

  const totalPoints = basePoints + speedBonus + streakBonus;
  return {
    points: totalPoints,
    newStreak: currentStreak + 1,
  };
}

/**
 * Generate WhatsApp & Direct Share URL and text for 1v1 and Multi-Friend Room
 * Allows unlimited participants to join directly via link!
 */
export function getBattleShareInfo(roomCode: string, timePerQuestionSec: number = 10): { url: string; text: string; whatsappUrl: string } {
  const origin = typeof window !== "undefined" && window.location.origin
    ? window.location.origin
    : "https://disha-app.web.app";
  
  const battleUrl = `${origin}/?battle=${roomCode}`;
  const text = `⚔️ *Live Quiz Battle Invitation!*

Live GK Battle Arena! 🏆
(Direct Link: Invite friends to join instantly 👥)

🔑 Room Code: *${roomCode}*
⏱️ Timer: *${timePerQuestionSec} seconds per question*

👉 Click the link to enter the battle arena directly:
${battleUrl}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;

  return {
    url: battleUrl,
    text,
    whatsappUrl,
  };
}

/**
 * Realtime Channel Manager for Live Quiz Battle
 */
export class RealtimeBattleManager {
  private channel: any = null;
  private roomCode: string = "";
  private myPlayer: BattlePlayer;
  private onEventCallback: (event: BattleEventMessage) => void;
  private onPresenceCallback?: (players: BattlePlayer[]) => void;
  private isConnected: boolean = false;
  private outgoingQueue: BattleEventMessage[] = [];

  constructor(
    roomCode: string,
    myPlayer: BattlePlayer,
    onEvent: (event: BattleEventMessage) => void,
    onPresence?: (players: BattlePlayer[]) => void
  ) {
    this.roomCode = roomCode.toUpperCase().trim();
    this.myPlayer = myPlayer;
    this.onEventCallback = onEvent;
    this.onPresenceCallback = onPresence;
  }

  public connect(): void {
    const channelName = `battle_room_${this.roomCode}`;
    this.channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
        presence: { key: this.myPlayer.id },
      },
    });

    // Listen to broadcast events
    this.channel.on("broadcast", { event: "battle_event" }, (payload: any) => {
      if (payload && payload.payload) {
        this.onEventCallback(payload.payload as BattleEventMessage);
      }
    });

    // Listen to presence sync if presence callback is provided
    if (this.onPresenceCallback) {
      this.channel.on("presence", { event: "sync" }, () => {
        try {
          const state = this.channel.presenceState();
          const presentPlayers: BattlePlayer[] = [];
          Object.values(state).forEach((presences: any) => {
            if (Array.isArray(presences)) {
              presences.forEach((p) => {
                if (p && p.player) {
                  presentPlayers.push(p.player);
                }
              });
            }
          });
          if (presentPlayers.length > 0 && this.onPresenceCallback) {
            this.onPresenceCallback(presentPlayers);
          }
        } catch {
          // Ignore presence sync parsing error
        }
      });
    }

    // Subscribe and track self + flush queued events
    this.channel.subscribe(async (status: string) => {
      if (status === "SUBSCRIBED") {
        this.isConnected = true;
        // Flush any events that were queued before connection established
        while (this.outgoingQueue.length > 0) {
          const queued = this.outgoingQueue.shift();
          if (queued && this.channel) {
            try {
              await this.channel.send({
                type: "broadcast",
                event: "battle_event",
                payload: queued,
              });
            } catch (e) {
              console.warn("Failed to broadcast queued battle event:", e);
            }
          }
        }
        try {
          await this.channel.track({
            player: this.myPlayer,
            onlineAt: new Date().toISOString(),
          });
        } catch {
          // Track fallback
        }
      }
    });
  }

  // Broadcast an event to all room participants
  public async broadcastEvent(
    type: BattleEventMessage["type"],
    payload: any = {}
  ): Promise<void> {
    const eventMessage: BattleEventMessage = {
      type,
      senderId: this.myPlayer.id,
      senderName: this.myPlayer.name,
      timestamp: Date.now(),
      payload,
    };

    if (this.channel && this.isConnected) {
      try {
        await this.channel.send({
          type: "broadcast",
          event: "battle_event",
          payload: eventMessage,
        });
      } catch (err) {
        console.warn("Failed to broadcast battle event:", err);
      }
    } else {
      // Queue event so it broadcasts as soon as channel is SUBSCRIBED
      this.outgoingQueue.push(eventMessage);
    }
  }

  // Update self player state in presence
  public async updatePresence(updatedPlayer: BattlePlayer): Promise<void> {
    this.myPlayer = updatedPlayer;
    if (this.channel && this.isConnected) {
      try {
        await this.channel.track({
          player: this.myPlayer,
          updatedAt: new Date().toISOString(),
        });
      } catch {
        // Track error
      }
    }
  }

  // Leave room and unsubscribe with full Supabase v2 socket de-allocation
  public disconnect(): void {
    this.outgoingQueue = [];
    if (this.channel) {
      try {
        this.channel.unsubscribe();
      } catch {}
      try {
        if (isSupabaseConfigured()) {
          supabase.removeChannel(this.channel);
        }
      } catch {}
      this.channel = null;
      this.isConnected = false;
    }
  }
}

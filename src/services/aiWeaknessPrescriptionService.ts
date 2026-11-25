import { Question, Chapter, Subject, ProgressStore, PerformanceStore, MCQSession } from "../types";
import { getActiveAICredentials } from "../utils/aiTutorService";
import { executeAICompletion } from "../utils/aiProviderService";
import { recordAIUsage } from "../utils/aiUsageTracker";

export interface WeakTopicDiagnosis {
  id: string;
  name: string;
  chapterName: string;
  subjectName: string;
  attempted: number;
  correct: number;
  wrong: number;
  accuracy: number;
  status: "critical" | "borderline" | "mastered";
  negativeMarksLost: number;
  wrongQuestions: Question[];
  allQuestions: Question[];
  primaryErrorPattern: string;
}

export interface StudentWeaknessDiagnosis {
  totalPracticed: number;
  totalCorrect: number;
  totalWrong: number;
  overallAccuracy: number;
  negativeMarksLost: number;
  impulseMistakesCount: number; // Questions answered < 8s and wrong
  impulseQuestions: Question[];
  criticalWeakTopics: WeakTopicDiagnosis[];
  borderlineTopics: WeakTopicDiagnosis[];
  masteredTopics: WeakTopicDiagnosis[];
  vulnerablePatterns: {
    pattern: string;
    description: string;
    count: number;
  }[];
  primaryDiagnosis: string;
  assessedAt: string;
}

export interface PrescriptionStep {
  stepNumber: number;
  title: string;
  actionItem: string;
  mnemonicOrTip?: string;
  highYieldFact?: string;
}

export interface StudentAIPrescription {
  diagnosisSummary: string;
  rootCauseAnalysis: string;
  negativeMarksImpactAdvice: string;
  dailySteps: PrescriptionStep[];
  targetRemedialQuestionsCount: number;
  estimatedScoreGain: string;
  officialSourcesCitations: string[];
  generatedAt: string;
}

const PRESCRIPTION_CACHE_KEY = "disha2020_ai_weakness_prescription_cache_v1";

/**
 * Diagnoses all student weaknesses, negative marking bleed, and error patterns
 */
export function diagnoseStudentWeaknesses(
  questions: Question[],
  chapters: Chapter[],
  subjects: Subject[],
  progressStore: ProgressStore,
  perfStore?: PerformanceStore
): StudentWeaknessDiagnosis {
  const subjectMap = new Map<string, string>();
  subjects.forEach((s) => {
    if (s && s.id) {
      subjectMap.set(s.id.toLowerCase().replace(/[-_]/g, ""), s.name || (s as any).hindiName || "General");
    }
  });

  const topicBucket = new Map<
    string,
    {
      name: string;
      chapterName: string;
      subjectName: string;
      questions: Question[];
    }
  >();

  chapters.forEach((ch) => {
    if (!ch) return;
    const subNorm = (ch.subjectId || "").toLowerCase().replace(/[-_]/g, "");
    const sName = subjectMap.get(subNorm) || ch.subjectId || "General";
    const chName = ch.title || (ch as any).hindiTitle || "अध्याय";

    if (ch.id && !topicBucket.has(ch.id)) {
      topicBucket.set(ch.id, {
        name: chName,
        chapterName: chName,
        subjectName: sName,
        questions: [],
      });
    }

    (ch.topics || []).forEach((t) => {
      if (t && t.id) {
        topicBucket.set(t.id, {
          name: t.title || (t as any).name || chName,
          chapterName: chName,
          subjectName: sName,
          questions: [],
        });
      }
    });
  });

  // Assign questions to buckets
  questions.forEach((q) => {
    if (!q) return;
    if (q.topicId && topicBucket.has(q.topicId)) {
      topicBucket.get(q.topicId)!.questions.push(q);
    } else if (q.chapterId && topicBucket.has(q.chapterId)) {
      topicBucket.get(q.chapterId)!.questions.push(q);
    }
  });

  let totalPracticed = 0;
  let totalCorrect = 0;
  let totalWrong = 0;
  let impulseMistakesCount = 0;
  const impulseQuestions: Question[] = [];
  const wrongQuestionsAll: Question[] = [];

  const topicDiagnoses: WeakTopicDiagnosis[] = [];

  topicBucket.forEach((val, id) => {
    if (val.questions.length === 0) return;

    let attempted = 0;
    let correct = 0;
    let wrong = 0;
    const wrongQs: Question[] = [];

    val.questions.forEach((q) => {
      const p = progressStore[q.id];
      if (p && p.status !== "unattempted") {
        attempted++;
        totalPracticed++;
        if (p.status === "correct") {
          correct++;
          totalCorrect++;
        } else if (p.status === "wrong") {
          wrong++;
          totalWrong++;
          wrongQs.push(q);
          wrongQuestionsAll.push(q);

          // Check impulse / hasty guess mistake (< 8s)
          const perf = perfStore ? perfStore[q.id] : undefined;
          const timeTaken = perf?.lastTimeTakenSeconds || 0;
          if (timeTaken > 0 && timeTaken < 8) {
            impulseMistakesCount++;
            impulseQuestions.push(q);
          }
        }
      }
    });

    if (attempted === 0) return;

    const totalAttempts = correct + wrong;
    const accuracy = totalAttempts > 0 ? Math.round((correct / totalAttempts) * 100) : 0;
    const negativeMarksLost = Number((wrong * 0.33).toFixed(2));

    let status: "critical" | "borderline" | "mastered" = "mastered";
    let primaryErrorPattern = "मजबूत अवधारणात्मक पकड़ (Strong Concept)";

    if (accuracy < 45 || wrong >= 3) {
      status = "critical";
      if (accuracy < 30) {
        primaryErrorPattern = "गंभीर अवधारणात्मक गैप (Severe Concept Gap • Core Revision Required)";
      } else if (wrong >= 4) {
        primaryErrorPattern = "अत्यधिक नकारात्मक अंकन व भ्रम (High Negative Marking Risk)";
      } else {
        primaryErrorPattern = "निकटवर्ती विकल्पों में भ्रम (Option Elimination Trap)";
      }
    } else if (accuracy < 75) {
      status = "borderline";
      primaryErrorPattern = "मध्यम सटीकता (Uncertainty on deeper PYQ nuances)";
    }

    topicDiagnoses.push({
      id,
      name: val.name,
      chapterName: val.chapterName,
      subjectName: val.subjectName,
      attempted,
      correct,
      wrong,
      accuracy,
      status,
      negativeMarksLost,
      wrongQuestions: wrongQs,
      allQuestions: val.questions,
      primaryErrorPattern,
    });
  });

  // Sort topic diagnoses by urgency
  topicDiagnoses.sort((a, b) => {
    const order = { critical: 0, borderline: 1, mastered: 2 };
    if (order[a.status] !== order[b.status]) {
      return order[a.status] - order[b.status];
    }
    return b.wrong - a.wrong;
  });

  const criticalWeakTopics = topicDiagnoses.filter((t) => t.status === "critical");
  const borderlineTopics = topicDiagnoses.filter((t) => t.status === "borderline");
  const masteredTopics = topicDiagnoses.filter((t) => t.status === "mastered");

  const totalAnswered = totalCorrect + totalWrong;
  const overallAccuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const totalNegativeMarksLost = Number((totalWrong * 0.33).toFixed(2));

  // Detect vulnerable question patterns across all wrong questions
  const patternMatchCount = {
    matchTheColumn: 0,
    negativeWording: 0,
    assertionReason: 0,
    datesAndChronology: 0,
  };

  wrongQuestionsAll.forEach((q) => {
    const text = `${q.text || q.question || ""} ${q.explanation || ""}`;
    if (/(?:सुमेलित कीजिए|सूची-I|सूची-II|match the following)/i.test(text)) {
      patternMatchCount.matchTheColumn++;
    }
    if (/(?:नहीं है|असत्य कथन|not correct|incorrect)/i.test(text)) {
      patternMatchCount.negativeWording++;
    }
    if (/(?:कथन I|कथन II|कथन और कारण|assertion|reason)/i.test(text)) {
      patternMatchCount.assertionReason++;
    }
    if (/\b(1[0-9]{3}|20[0-2][0-9])\b/.test(text) || /(?:वर्ष|ईस्वी|तारीख|कालानुक्रम)/i.test(text)) {
      patternMatchCount.datesAndChronology++;
    }
  });

  const vulnerablePatterns = [
    {
      pattern: "सुमेलित कीजिए (Match Matrix)",
      description: "सूची-I और सूची-II के मिलान वाले प्रश्नों में गलतियाँ",
      count: patternMatchCount.matchTheColumn,
    },
    {
      pattern: "नकारात्मक वाक्य ('नहीं है' / असत्य)",
      description: "प्रश्न में 'नहीं है' या असत्य कथन ध्यान से न पढ़ने के कारण गलतियाँ",
      count: patternMatchCount.negativeWording,
    },
    {
      pattern: "कथन व कारण (Assertion & Statements)",
      description: "मल्टी-स्टेटमेंट विश्लेषण में 50-50 दुविधा में गलत उत्तर",
      count: patternMatchCount.assertionReason,
    },
    {
      pattern: "वर्ष एवं ऐतिहासिक तिथियां (Dates & Chronology)",
      description: "वर्ष, संवत और कालानुक्रमिक क्रम में भ्रम",
      count: patternMatchCount.datesAndChronology,
    },
  ]
    .filter((p) => p.count > 0)
    .sort((a, b) => b.count - a.count);

  let primaryDiagnosis = "समतुल्य प्रदर्शन (Balanced Practice)";
  if (criticalWeakTopics.length > 0) {
    const top = criticalWeakTopics[0];
    primaryDiagnosis = `${top.subjectName}: ${top.name} (${top.wrong} गलतियाँ • ${top.accuracy}% सटीकता)`;
  } else if (borderlineTopics.length > 0) {
    const top = borderlineTopics[0];
    primaryDiagnosis = `${top.subjectName}: ${top.name} (मध्यम पकड़ • ${top.accuracy}% सटीकता)`;
  } else if (totalPracticed === 0) {
    primaryDiagnosis = "नया अभ्यास सत्र (अभी तक कोई प्रश्न हल नहीं किया गया)";
  }

  return {
    totalPracticed,
    totalCorrect,
    totalWrong,
    overallAccuracy,
    negativeMarksLost: totalNegativeMarksLost,
    impulseMistakesCount,
    impulseQuestions,
    criticalWeakTopics,
    borderlineTopics,
    masteredTopics,
    vulnerablePatterns,
    primaryDiagnosis,
    assessedAt: new Date().toISOString(),
  };
}

/**
 * Generates an instant, highly-actionable bilingual AI Study Prescription
 */
export async function generateAIWeaknessPrescription(
  diagnosis: StudentWeaknessDiagnosis,
  options?: { forceHeuristic?: boolean }
): Promise<StudentAIPrescription> {
  const credentials = getActiveAICredentials();

  // If AI configured and not forcing heuristic fallback, query model
  if (!options?.forceHeuristic && credentials.configured && credentials.apiKey) {
    const topWeak = diagnosis.criticalWeakTopics.slice(0, 3).map((t) => 
      `- ${t.subjectName} > ${t.name}: ${t.wrong} wrong out of ${t.attempted} (Accuracy: ${t.accuracy}%)`
    ).join("\n");

    const prompt = `You are "Disha AI Chief Academic Physician"—the expert academic mentor for Rajasthan & Indian Competitive Exams (RPSC RAS, REET, CET, Patwar, Police SI).
Analyze this student's real mock test error record and generate a medical-grade "Study Prescription" (अध्ययन नुस्खा).

STUDENT TEST ERROR RECORD:
- Total Questions Practiced: ${diagnosis.totalPracticed}
- Overall Accuracy: ${diagnosis.overallAccuracy}%
- Total Wrong Answers: ${diagnosis.totalWrong}
- Negative Marking Bleed (1/3 penalty): -${diagnosis.negativeMarksLost} marks
- Hasty / Impulse Mistakes (<8s speed): ${diagnosis.impulseMistakesCount} questions
- Primary Weakest Topics:
${topWeak || "None (General performance)"}
- Vulnerable Question Types:
${diagnosis.vulnerablePatterns.map((p) => `- ${p.pattern}: ${p.count} errors`).join("\n") || "None identified"}

INSTRUCTIONS:
1. Provide a direct, compassionate, yet strict clinical academic diagnosis in bilingual Hindi/English.
2. Formulate exactly 3 concrete, actionable daily steps with memory tips or mnemonics.
3. Calculate estimated score gain if 1/3rd negative marking bleed is stopped.
4. Cite official authentic sources (Rajasthan Hindi Granth Academy, NCERT, Economic Survey 2024-25).

Return strictly valid JSON only:
{
  "diagnosisSummary": "<2-line clinical diagnosis of primary academic weakness in Hindi/English>",
  "rootCauseAnalysis": "<Why the student is failing: e.g. option confusion, rushing without reading 'not true', lack of factual revision>",
  "negativeMarksImpactAdvice": "<Exact warning about negative marks lost and how to avoid guessing on 50-50 questions>",
  "dailySteps": [
    {
      "stepNumber": 1,
      "title": "<Short Step 1 Title>",
      "actionItem": "<Specific revision action>",
      "mnemonicOrTip": "<Memory mnemonic or quick formula to remember this easily>"
    },
    {
      "stepNumber": 2,
      "title": "<Short Step 2 Title>",
      "actionItem": "<Elimination strategy>",
      "mnemonicOrTip": "<Quick tip>"
    },
    {
      "stepNumber": 3,
      "title": "<Short Step 3 Title>",
      "actionItem": "<Practice and testing instruction>",
      "mnemonicOrTip": "<Action advice>"
    }
  ],
  "targetRemedialQuestionsCount": 15,
  "estimatedScoreGain": "+8 to +14 Marks (Negative Marking Eliminator)",
  "officialSourcesCitations": [
    "राजस्थान हिंदी ग्रंथ अकादमी (डॉ. जयसिंह नीरज / हुकमचंद जैन)",
    "राजस्थान आर्थिक समीक्षा एवं बजट 2024-25",
    "NCERT कक्षा 11-12 मानक संदर्भ"
  ]
}`;

    const startTime = Date.now();
    try {
      const completionText = await executeAICompletion({
        provider: credentials.provider,
        apiKey: credentials.apiKey,
        model: credentials.model,
        prompt,
        temperature: 0.2,
        jsonMode: true,
        timeoutMs: 15000,
      });

      const latencyMs = Date.now() - startTime;
      recordAIUsage({
        provider: credentials.provider,
        model: credentials.model,
        queryType: "doubt",
        prompt: "Student AI Weakness Prescription",
        response: completionText,
        latencyMs,
        status: "success",
      });

      const jsonMatch = completionText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const prescription: StudentAIPrescription = {
          diagnosisSummary: parsed.diagnosisSummary || "कमजोरी विश्लेषण संपन्न",
          rootCauseAnalysis: parsed.rootCauseAnalysis || "प्रश्नों में निकटतम विकल्पों और जल्दबाजी में गलतियाँ अधिक पाई गई हैं।",
          negativeMarksImpactAdvice: parsed.negativeMarksImpactAdvice || `नेगेटिव मार्किंग के कारण आपने -${diagnosis.negativeMarksLost} अंक गंवाए हैं।`,
          dailySteps: Array.isArray(parsed.dailySteps) && parsed.dailySteps.length > 0 ? parsed.dailySteps : generateHeuristicSteps(diagnosis),
          targetRemedialQuestionsCount: Number(parsed.targetRemedialQuestionsCount) || 15,
          estimatedScoreGain: parsed.estimatedScoreGain || `+${Math.max(6, Math.round(diagnosis.negativeMarksLost * 1.5))} अंक`,
          officialSourcesCitations: Array.isArray(parsed.officialSourcesCitations) ? parsed.officialSourcesCitations : [
            "राजस्थान हिंदी ग्रंथ अकादमी",
            "राजस्थान आर्थिक समीक्षा 2024-25"
          ],
          generatedAt: new Date().toISOString(),
        };

        saveCachedPrescription(prescription);
        return prescription;
      }
    } catch (err: any) {
      console.warn("AI Prescription query failed or timed out, using heuristic prescription fallback", err);
    }
  }

  // Heuristic rule-based prescription fallback
  const fallback = generateHeuristicPrescription(diagnosis);
  saveCachedPrescription(fallback);
  return fallback;
}

/**
 * Generates an instant heuristic prescription without external network dependencies
 */
function generateHeuristicPrescription(diagnosis: StudentWeaknessDiagnosis): StudentAIPrescription {
  const top = diagnosis.criticalWeakTopics[0] || diagnosis.borderlineTopics[0];
  const weakName = top ? `${top.subjectName}: ${top.name}` : "सामान्य अध्ययन एवं राजस्थान ज्ञान";
  const bleed = diagnosis.negativeMarksLost;

  return {
    diagnosisSummary: `आपकी मुख्य कमजोरी "${weakName}" में पाई गई है। कुल ${diagnosis.totalWrong} गलतियों के कारण आपने -${bleed} अंक 1/3 नेगेटिव मार्किंग में गंवाए हैं।`,
    rootCauseAnalysis: diagnosis.impulseMistakesCount > 0
      ? `आपके परीक्षण में ${diagnosis.impulseMistakesCount} प्रश्न 8 सेकंड से कम में बिना विकल्पों को पूरे पढ़े जल्दबाजी में गलत किए गए हैं। साथ ही 2 विकल्पों में 50-50 की स्थिति में गलत विकल्प चुनने की प्रवृत्ति अधिक है।`
      : `अवधारणात्मक तथ्यों के बारीक अंतरों (खनिज, कालानुक्रम, 'नहीं है' वाले प्रश्न) में पुनरावृत्ति की कमी है।`,
    negativeMarksImpactAdvice: `यदि आप उन प्रश्नों में अंधाधुंध तुक्का लगाना बंद कर दें जहाँ आप 2 विकल्पों में भी आश्वस्त नहीं हैं, तो आपकी नेट मेरिट में तुरंत +${Math.round(bleed + 4)} अंकों का सीधा उछाल आएगा।`,
    dailySteps: generateHeuristicSteps(diagnosis),
    targetRemedialQuestionsCount: Math.min(20, Math.max(10, diagnosis.totalWrong)),
    estimatedScoreGain: `+${Math.max(6, Math.round(bleed + 6))} अंक (सीधा मेरिट बूस्टर)`,
    officialSourcesCitations: [
      "राजस्थान हिंदी ग्रंथ अकादमी (प्रामाणिक संस्करण)",
      "राजस्थान आर्थिक समीक्षा एवं बजट 2024-25",
      "NCERT एवं पूर्व-वर्षीय आधिकारिक परीक्षा आंसर-की"
    ],
    generatedAt: new Date().toISOString(),
  };
}

function generateHeuristicSteps(diagnosis: StudentWeaknessDiagnosis): PrescriptionStep[] {
  const top = diagnosis.criticalWeakTopics[0] || diagnosis.borderlineTopics[0];
  const topicName = top?.name || "प्रमुख कमजोर टॉपिक";

  return [
    {
      stepNumber: 1,
      title: `"${topicName}" का 15 मिनट का गहन री-रीडिंग`,
      actionItem: `आज ही राजस्थान हिंदी ग्रंथ अकादमी या मानक नोट्स से ${topicName} के केवल मुख्य तथ्यों, तालिकाओं और अपवादों को एक बार सरसरी निगाह से दोहराएँ।`,
      mnemonicOrTip: "स्मार्ट ट्रिक: हमेशा पहले 'नहीं है' और 'केवल' शब्दों को पेन से गोला करें।",
    },
    {
      stepNumber: 2,
      title: "50-50 एलिमिनेशन स्ट्राइक रूल",
      actionItem: "जिस प्रश्न में 2 विकल्प कट जाएं, केवल उसी में रिस्क लें। 3 या 4 अनजाने विकल्पों वाले प्रश्नों में अनिवार्य रूप से 5वां विकल्प (E) भरें।",
      mnemonicOrTip: "नियम: परीक्षा में प्रश्न छोड़ना भी मेरिट बनाने का एक सक्रिय हथियार है।",
    },
    {
      stepNumber: 3,
      title: "15 प्रश्नों का उपचारात्मक री-टेस्ट (Remedial Booster)",
      actionItem: "नीचे दिए गए 'उपचारात्मक टेस्ट' बटन पर क्लिक करके ठीक अपनी गलतियों वाले 15 प्रश्नों को दोबारा हल करें और 100% स्कोर हासिल करें।",
      mnemonicOrTip: "जब तक किसी गलत प्रश्न को 2 बार सही न कर लें, आगे न बढ़ें।",
    },
  ];
}

/**
 * Creates an MCQSession object for 1-click remedial testing of the student's weak questions
 */
export function createRemedialTestSession(
  diagnosis: StudentWeaknessDiagnosis,
  maxQuestions: number = 15
): MCQSession {
  const poolMap = new Map<string, Question>();

  // Priority 1: Impulse mistakes
  diagnosis.impulseQuestions.forEach((q) => poolMap.set(q.id, q));

  // Priority 2: Critical weak topic questions
  diagnosis.criticalWeakTopics.forEach((t) => {
    t.wrongQuestions.forEach((q) => poolMap.set(q.id, q));
  });

  // Priority 3: Borderline topic questions if pool underfilled
  if (poolMap.size < maxQuestions) {
    diagnosis.borderlineTopics.forEach((t) => {
      t.wrongQuestions.forEach((q) => poolMap.set(q.id, q));
    });
  }

  const selected = Array.from(poolMap.values()).slice(0, maxQuestions);

  return {
    title: "🩺 Disha AI उपचारात्मक टेस्ट (Remedial Booster)",
    subtitle: `${selected.length} लक्षित कमजोर प्रश्न • 1/3 नेगेटिव मार्किंग निवारक ड्रिल`,
    questionIds: selected.map((q) => q.id),
    extraQuestions: selected,
    source: "custom-smart",
    testType: "custom_smart",
    isExamSimulation: false,
  };
}

/**
 * Cache persistence
 */
export function saveCachedPrescription(prescription: StudentAIPrescription): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(PRESCRIPTION_CACHE_KEY, JSON.stringify(prescription));
    }
  } catch {}
}

export function loadCachedPrescription(): StudentAIPrescription | null {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(PRESCRIPTION_CACHE_KEY);
      if (raw) {
        return JSON.parse(raw) as StudentAIPrescription;
      }
    }
  } catch {}
  return null;
}

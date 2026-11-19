import { formatMathAndChemistryLatex } from "./questionsParser";
import { apiFetch } from "./api";

export interface FormattedQuestionResult {
  questionType?: string;
  text: string;
  statements?: string[];
  assertion?: string;
  reason?: string;
  listI?: string[];
  listII?: string[];
  matchTable?: { leftTitle?: string; rightTitle?: string; rows: { left: string; right: string }[] };
  table?: { caption?: string; headers: string[]; rows: string[][] };
  passage?: string;
  sequenceItems?: string[];
  options: string[];
  correctIndex: number;
  explanation: string;
  importantFact?: string;
}

/**
 * Sends question text to the server-side AI endpoint to parse and normalize
 * single or multiple batch MCQs into structured format.
 */
export async function formatBatchQuestionsWithAI(rawText: string): Promise<FormattedQuestionResult[]> {
  if (!rawText || !rawText.trim()) {
    throw new Error("Please enter or paste question text to format.");
  }

  try {
    const response = await apiFetch("/api/ai/format-mcq", {
      method: "POST",
      body: JSON.stringify({ text: rawText }),
    });

    if (!response.ok) {
      throw new Error(`Server returned error status ${response.status}`);
    }

    const data = await response.json();
    if (data && data.success) {
      const list: any[] = Array.isArray(data.questions) && data.questions.length > 0
        ? data.questions
        : data.formatted
        ? [data.formatted]
        : [];

      if (list.length > 0) {
        return list.map((f: any) => ({
          ...f,
          questionType: f.questionType || f.type || "single_correct",
          text: formatMathAndChemistryLatex(f.text || f.question || ""),
          options: Array.isArray(f.options)
            ? f.options
                .filter((o: any) => String(o ?? "").trim() !== "")
                .map((o: any) => formatMathAndChemistryLatex(String(o)))
            : [],
          correctIndex: typeof f.correctIndex === "number" ? f.correctIndex : -1,
          explanation: formatMathAndChemistryLatex(f.explanation || ""),
          importantFact: f.importantFact ? formatMathAndChemistryLatex(f.importantFact) : "",
          assertion: f.assertion ? formatMathAndChemistryLatex(f.assertion) : undefined,
          reason: f.reason ? formatMathAndChemistryLatex(f.reason) : undefined,
          matchTable: f.matchTable,
          table: f.table || f.tableData,
        }));
      }
    }
    throw new Error("Failed to receive formatted question structure from server.");
  } catch (error: any) {
    console.warn("AI formatting API endpoint unavailable, attempting direct client AI fallback:", error);
    try {
      const { getActiveAICredentials } = await import("./aiTutorService");
      const creds = getActiveAICredentials();
      if (creds.configured && creds.apiKey) {
        const { executeAICompletion } = await import("./aiProviderService");
        const prompt = `Convert the following text into standard structured MCQ JSON format. Return valid JSON array only:
[
  {
    "text": "Question text in Hindi/English",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0,
    "explanation": "Detailed explanation"
  }
]
Text to parse:
${rawText}`;
        const aiResponse = await executeAICompletion({
          messages: [{ role: "user", content: prompt }],
          provider: creds.provider,
          apiKey: creds.apiKey,
          model: creds.provider === "gemini" ? "gemini-2.5-flash-lite" : undefined,
        });

        const jsonMatch = aiResponse.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map((item: any) => ({
              questionType: "single_correct",
              text: formatMathAndChemistryLatex(item.text || ""),
              options: Array.isArray(item.options) ? item.options.map(String).map(formatMathAndChemistryLatex) : [],
              correctIndex: typeof item.correctIndex === "number" ? item.correctIndex : 0,
              explanation: formatMathAndChemistryLatex(item.explanation || ""),
            }));
          }
        }
      }
    } catch (directAiErr) {
      console.warn("Direct client AI parse notice:", directAiErr);
    }
    return [formatQuestionClientLocally(rawText)];
  }
}

/**
 * Sends messy, unstructured question text to the server-side AI endpoint
 * to automatically reorganize it into standard MCQ format (single item).
 */
export async function formatQuestionWithAI(rawText: string): Promise<FormattedQuestionResult & { options: [string, string, string, string] }> {
  const batch = await formatBatchQuestionsWithAI(rawText);
  const first = batch[0] || formatQuestionClientLocally(rawText);
  return {
    ...first,
    options: [
      first.options[0] || "",
      first.options[1] || "",
      first.options[2] || "",
      first.options[3] || "",
    ],
    correctIndex: first.correctIndex >= 0 ? first.correctIndex : 0,
  };
}

/**
 * Smart local fallback formatter in case server connection is unavailable.
 * Never fabricates missing options or missing answers.
 */
function formatQuestionClientLocally(rawText: string): FormattedQuestionResult {
  const cleaned = rawText.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
  const lines = cleaned.split("\n").map(l => l.trim()).filter(Boolean);

  let qText = "";
  const opts: string[] = [];
  let answerIdx = -1;
  let explanation = "";

  const optLines: { idx: number; text: string; letter: string }[] = [];
  let ansLine = "";
  let expLine = "";

  let assertion: string | undefined = undefined;
  let reason: string | undefined = undefined;

  lines.forEach((line, index) => {
    if (/^(?:(?:Correct\s*)?Answer|Right\s*Option|उत्तर(?:माला|म्)?|Ans(?:wer)?|Key|wer)[\:\-\=\)]?/i.test(line)) {
      ansLine = line;
    } else if (/^(?:Explanation|Exp|Solution|व्याख्या|स्पष्टीकरण)[\:\-\=\)]?/i.test(line)) {
      expLine = line;
    } else {
      const assertMatch = line.match(/^(?:(?:Q\d+[\.\:\-\s]*)?अभिकथन|Assertion|कथन\s*\(A\)|Assertion\s*\(A\)|अभिकथन\s*\(A\)|\(A\)[\:\-])[\:\-\s]*(.*)$/i);
      if (assertMatch) {
        assertion = assertMatch[1].trim();
        return;
      }

      const reasonMatch = line.match(/^(?:Reason|कारण|Reason\s*\(R\)|कारण\s*\(R\)|\(R\)[\:\-])[\:\-\s]*(.*)$/i);
      if (reasonMatch) {
        reason = reasonMatch[1].trim();
        return;
      }

      const optMatch = line.match(/^(?:(?:\(?|\[?)(?:Option\s+|Opt\s+|विकल्प\s+)?([A-Da-d])(?:\.?|\)?|\]?|\:|\-)?\s+)(.*)$/i);
      if (optMatch && !/^(?:अभिकथन|Assertion|कथन)\s*\(?A\)?/i.test(line)) {
        optLines.push({ idx: index, text: optMatch[2], letter: optMatch[1].toUpperCase() });
      }
    }
  });

  if (ansLine) {
    const cleanLetter = ansLine.replace(/^(?:(?:Correct\s*)?Answer|Right\s*Option|उत्तर(?:माला|म्)?|Ans(?:wer)?|Key|wer)[\:\-\=\s\)]*/gi, "").trim();
    if (/^[Aक1]/i.test(cleanLetter) || /\bA\b/i.test(cleanLetter)) answerIdx = 0;
    else if (/^[Bख2]/i.test(cleanLetter) || /\bB\b/i.test(cleanLetter)) answerIdx = 1;
    else if (/^[Cग3]/i.test(cleanLetter) || /\bC\b/i.test(cleanLetter)) answerIdx = 2;
    else if (/^[Dघ4]/i.test(cleanLetter) || /\bD\b/i.test(cleanLetter)) answerIdx = 3;
  }

  if (expLine) {
    explanation = expLine.replace(/^(?:Explanation|Exp|Solution|व्याख्या|स्पष्टीकरण)[\:\-\=\)]?\s*/i, "");
  }

  if (optLines.length > 0) {
    qText = lines.slice(0, optLines[0].idx).filter(l => !/^(?:Ans|Answer|Explanation|व्याख्या)/i.test(l)).join("\n");
  } else {
    qText = rawText;
  }

  optLines.forEach(o => opts.push(formatMathAndChemistryLatex(o.text)));

  return {
    text: formatMathAndChemistryLatex(qText.trim() || rawText.trim()),
    options: opts,
    correctIndex: answerIdx,
    explanation: formatMathAndChemistryLatex(explanation.trim()),
    importantFact: "",
    assertion: assertion ? formatMathAndChemistryLatex(assertion) : undefined,
    reason: reason ? formatMathAndChemistryLatex(reason) : undefined
  };
}


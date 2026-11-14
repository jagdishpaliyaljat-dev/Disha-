import * as React from "react";
import {
  FileSpreadsheet,
  Upload,
  Download,
  AlertCircle,
  CheckCircle2,
  Trash2,
  HelpCircle,
  X,
  FileText,
  Sparkles,
  ChevronDown
} from "lucide-react";
import { Subject, Chapter, Question } from "../../types";

interface ExcelCsvQuestionImporterProps {
  subjects: Subject[];
  chapters: Chapter[];
  initialSubjectId?: string;
  initialChapterId?: string;
  onClose: () => void;
  onImportQuestions: (questions: Question[]) => void;
}

interface ParsedRow {
  id: string;
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty?: "easy" | "medium" | "hard";
  status: "valid" | "warning" | "error";
  errorMsg?: string;
  selected: boolean;
}

export const ExcelCsvQuestionImporter: React.FC<ExcelCsvQuestionImporterProps> = ({
  subjects,
  chapters,
  initialSubjectId,
  initialChapterId,
  onClose,
  onImportQuestions,
}) => {
  const [selectedSubjectId, setSelectedSubjectId] = React.useState<string>(initialSubjectId || subjects[0]?.id || "");
  const [selectedChapterId, setSelectedChapterId] = React.useState<string>(initialChapterId || "");
  const [parsedRows, setParsedRows] = React.useState<ParsedRow[]>([]);
  const [fileName, setFileName] = React.useState<string>("");
  const [rawText, setRawText] = React.useState<string>("");
  const [importMode, setImportMode] = React.useState<"file" | "paste">("file");
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);

  // Available chapters for selected subject
  const availableChapters = React.useMemo(() => {
    return chapters.filter(c => !selectedSubjectId || c.subjectId === selectedSubjectId);
  }, [chapters, selectedSubjectId]);

  React.useEffect(() => {
    if (availableChapters.length > 0 && (!selectedChapterId || !availableChapters.some(c => c.id === selectedChapterId))) {
      setSelectedChapterId(availableChapters[0].id);
    }
  }, [availableChapters, selectedChapterId]);

  // Download Sample CSV
  const handleDownloadSample = () => {
    const csvContent = 
`Question,Option A,Option B,Option C,Option D,Option E,Correct Answer,Explanation,Difficulty
"राजस्थान के किस दुर्ग को 'यूनेस्को विश्व धरोहर' में शामिल किया गया है?","आमेर दुर्ग","तारागढ़ दुर्ग","मेहरानगढ़ दुर्ग","लोहागढ़ दुर्ग","अनुत्तरित प्रश्न","A","आमेर, कुंभलगढ़, गागरोन, जैसलमेर, रणथंभौर और चित्तौड़गढ़ दुर्ग को 2013 में यूनेस्को सूची में शामिल किया गया था।","medium"
"राजस्थान की कौन-सी नदी 'अर्जुन की गंगा' कहलाती है?","बाणगंगा","कोठारी","बेड़च","रूपारेल","अनुत्तरित प्रश्न","A","बाणगंगा नदी का उद्गम बैराठ की पहाड़ियों से होता है, इसे अर्जुन की गंगा भी कहा जाता है।","easy"
"1857 की क्रांति के समय कोटा के पॉलिटिकल एजेंट कौन थे?","मेजर बर्टन","कैप्टन हीथकोट","कर्नल होम्स","कैप्टन शॉवर्स","अनुत्तरित प्रश्न","1","कोटा में क्रांति के समय पॉलिटिकल एजेंट मेजर बर्टन थे।","medium"`;

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "disha_2020_sample_mcqs.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Robust CSV/TSV parser supporting quotes and Devnagari Hindi
  const parseDelimitedData = (text: string) => {
    if (!text.trim()) return [];

    // Determine delimiter (comma or tab)
    const firstLine = text.trim().split("\n")[0];
    const delimiter = firstLine.includes("\t") ? "\t" : ",";

    const lines: string[] = [];
    let insideQuotes = false;
    let currentLine = "";

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"' || char === "'") {
        if (insideQuotes && nextChar === char) {
          currentLine += char;
          i++; // skip escaped quote
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if ((char === '\r' || char === '\n') && !insideQuotes) {
        if (char === '\r' && nextChar === '\n') i++;
        if (currentLine.trim()) lines.push(currentLine.trim());
        currentLine = "";
      } else {
        currentLine += char;
      }
    }
    if (currentLine.trim()) lines.push(currentLine.trim());
    if (lines.length < 2) return [];

    // Split fields function
    const splitRow = (rowStr: string): string[] => {
      const fields: string[] = [];
      let inQuote = false;
      let curField = "";
      for (let i = 0; i < rowStr.length; i++) {
        const c = rowStr[i];
        if (c === '"') {
          inQuote = !inQuote;
        } else if (c === delimiter && !inQuote) {
          fields.push(curField.trim());
          curField = "";
        } else {
          curField += c;
        }
      }
      fields.push(curField.trim());
      return fields.map(f => f.replace(/^["']|["']$/g, "").trim());
    };

    const header = splitRow(lines[0]).map(h => h.toLowerCase());
    
    // Find column indexes
    const findIndex = (aliases: string[]) => {
      return header.findIndex(h => aliases.some(a => h.includes(a)));
    };

    const qIdx = findIndex(["question", "text", "प्रश्न", "सवाल"]);
    const optAIdx = findIndex(["option a", "option 1", "opt a", "opt 1", "विकल्प 1", "विकल्प a"]);
    const optBIdx = findIndex(["option b", "option 2", "opt b", "opt 2", "विकल्प 2", "विकल्प b"]);
    const optCIdx = findIndex(["option c", "option 3", "opt c", "opt 3", "विकल्प 3", "विकल्प c"]);
    const optDIdx = findIndex(["option d", "option 4", "opt d", "opt 4", "विकल्प 4", "विकल्प d"]);
    const optEIdx = findIndex(["option e", "option 5", "opt e", "opt 5", "अनुत्तरित"]);
    const ansIdx = findIndex(["answer", "correct", "उत्तर", "सही"]);
    const expIdx = findIndex(["explanation", "solution", "व्याख्या", "हल"]);
    const diffIdx = findIndex(["difficulty", "कठिनाई", "level"]);

    const rows: ParsedRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const rawCells = splitRow(lines[i]);
      if (rawCells.length < 4) continue;

      let qText = "";
      let opts: string[] = [];
      let correct = -1;
      let explanation = "";
      let difficulty: "easy" | "medium" | "hard" = "medium";

      // If recognized headers
      if (qIdx !== -1 && optAIdx !== -1) {
        qText = rawCells[qIdx] || "";
        const a = rawCells[optAIdx] || "";
        const b = rawCells[optBIdx] || "";
        const c = rawCells[optCIdx] || "";
        const d = rawCells[optDIdx] || "";
        const e = optEIdx !== -1 ? rawCells[optEIdx] : "";
        opts = [a, b, c, d];
        if (e) opts.push(e);
        else opts.push("अनुत्तरित प्रश्न");

        const ansRaw = ansIdx !== -1 ? (rawCells[ansIdx] || "").trim().toUpperCase() : "";
        if (ansRaw === "A" || ansRaw === "1") correct = 0;
        else if (ansRaw === "B" || ansRaw === "2") correct = 1;
        else if (ansRaw === "C" || ansRaw === "3") correct = 2;
        else if (ansRaw === "D" || ansRaw === "4") correct = 3;
        else if (ansRaw === "E" || ansRaw === "5") correct = 4;
        else if (!isNaN(Number(ansRaw))) correct = Math.max(0, Math.min(4, Number(ansRaw) - 1));

        if (expIdx !== -1) explanation = rawCells[expIdx] || "";
        if (diffIdx !== -1) {
          const dStr = (rawCells[diffIdx] || "").toLowerCase();
          if (dStr.includes("easy") || dStr.includes("सरल")) difficulty = "easy";
          else if (dStr.includes("hard") || dStr.includes("कठिन")) difficulty = "hard";
        }
      } else {
        // Fallback positional: col0=Q, col1=A, col2=B, col3=C, col4=D, col5=Ans, col6=Exp
        qText = rawCells[0] || "";
        opts = [rawCells[1] || "", rawCells[2] || "", rawCells[3] || "", rawCells[4] || ""];
        if (rawCells[5] && rawCells.length > 6) {
          const ansRaw = rawCells[5].trim().toUpperCase();
          if (ansRaw === "A" || ansRaw === "1") correct = 0;
          else if (ansRaw === "B" || ansRaw === "2") correct = 1;
          else if (ansRaw === "C" || ansRaw === "3") correct = 2;
          else if (ansRaw === "D" || ansRaw === "4") correct = 3;
          else if (ansRaw === "E" || ansRaw === "5") correct = 4;
          explanation = rawCells[6] || "";
        }
        opts.push("अनुत्तरित प्रश्न");
      }

      // Validate
      let status: "valid" | "warning" | "error" = "valid";
      let errorMsg = "";

      if (!qText.trim()) {
        status = "error";
        errorMsg = "Question text missing";
      } else if (opts.slice(0, 4).some(o => !o.trim())) {
        status = "error";
        errorMsg = "Options incomplete (need at least A-D)";
      } else if (correct < 0 || correct > opts.length - 1) {
        status = "error";
        errorMsg = "Invalid or missing correct answer (must be 1-4 or A-D)";
      } else if (!explanation.trim()) {
        status = "warning";
        errorMsg = "No explanation provided";
      }

      rows.push({
        id: `row-${i}-${Date.now()}`,
        questionText: qText,
        options: opts,
        correctIndex: correct >= 0 ? correct : 0,
        explanation: explanation || "व्याख्या उपलब्ध नहीं है।",
        difficulty,
        status,
        errorMsg,
        selected: status !== "error"
      });
    }

    return rows;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);
    setStatusMessage("Reading file...");

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseDelimitedData(text);
        setParsedRows(parsed);
        setIsProcessing(false);
        if (parsed.length === 0) {
          setStatusMessage("No valid questions found. Check columns or download the sample CSV.");
        } else {
          const validCount = parsed.filter(p => p.status !== "error").length;
          setStatusMessage(`Found ${parsed.length} row(s); ${validCount} valid questions ready.`);
        }
      } catch (err: any) {
        setIsProcessing(false);
        setStatusMessage("Parsing error: " + err.message);
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  const handlePasteProcess = () => {
    if (!rawText.trim()) return;
    setIsProcessing(true);
    const parsed = parseDelimitedData(rawText);
    setParsedRows(parsed);
    setIsProcessing(false);
    const validCount = parsed.filter(p => p.status !== "error").length;
    setStatusMessage(`Processed ${parsed.length} rows; ${validCount} valid questions detected.`);
  };

  const handleToggleRow = (id: string) => {
    setParsedRows(prev => prev.map(r => r.id === id ? { ...r, selected: !r.selected } : r));
  };

  const handleSelectAll = (select: boolean) => {
    setParsedRows(prev => prev.map(r => r.status === "error" ? r : { ...r, selected: select }));
  };

  const handleCommitImport = () => {
    const toImport = parsedRows.filter(r => r.selected && r.status !== "error");
    if (toImport.length === 0) {
      alert("No valid questions selected for import.");
      return;
    }
    if (!selectedChapterId) {
      alert("Please select a target Chapter before importing.");
      return;
    }

    const targetChapter = chapters.find(c => c.id === selectedChapterId);
    const targetTopicId = targetChapter?.topics?.[0]?.id || `topic-${Date.now()}`;

    const newQuestions: Question[] = toImport.map((row, idx) => ({
      id: `q-csv-${Date.now()}-${idx}`,
      subjectId: selectedSubjectId || undefined,
      chapterId: selectedChapterId,
      topicId: targetTopicId,
      text: row.questionText,
      options: row.options,
      correctIndex: row.correctIndex,
      explanation: row.explanation,
      difficulty: row.difficulty || "medium",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isUserAdded: true,
      importBatchId: `csv-import-${Date.now()}`
    }));

    onImportQuestions(newQuestions);
    onClose();
  };

  const validCount = parsedRows.filter(r => r.status !== "error").length;
  const selectedCount = parsedRows.filter(r => r.selected && r.status !== "error").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0B1220] w-full max-w-4xl max-h-[92vh] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>Excel & CSV Question Importer</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold">Fast Bulk MCQ</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Bulk upload MCQs from Excel (.csv, .tsv) with Hindi Devnagari & RPSC 5-option support
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target Destination & Mode Selectors */}
        <div className="p-4 sm:p-6 space-y-4 shrink-0 border-b border-slate-100 dark:border-slate-800">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                Target Subject (विषय)
              </label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.hindiName || s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                Target Chapter (अध्याय)
              </label>
              <select
                value={selectedChapterId}
                onChange={(e) => setSelectedChapterId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                {availableChapters.map(c => (
                  <option key={c.id} value={c.id}>{c.hindiTitle || c.title}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setImportMode("file")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  importMode === "file" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                Upload File (.csv / .tsv)
              </button>
              <button
                onClick={() => setImportMode("paste")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  importMode === "paste" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                Paste Table Text
              </button>
            </div>

            <button
              onClick={handleDownloadSample}
              className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:underline cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Sample CSV Template</span>
            </button>
          </div>
        </div>

        {/* Input Area */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {importMode === "file" ? (
            <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-2xl p-6 text-center transition-all bg-slate-50/50 dark:bg-slate-900/20">
              <input
                type="file"
                id="excel-csv-file-input"
                accept=".csv,.tsv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <label htmlFor="excel-csv-file-input" className="cursor-pointer flex flex-col items-center">
                <Upload className="w-10 h-10 text-emerald-500 mb-2" />
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {fileName ? fileName : "Click to select or drag CSV file"}
                </span>
                <span className="text-xs text-slate-400 mt-1">
                  Supports UTF-8 CSV, Tab-separated TSV, or plain exported tables
                </span>
              </label>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste CSV or Tab-separated table data here (including header row: Question, Option A, Option B, Option C, Option D, Answer, Explanation)..."
                rows={5}
                className="w-full p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
              <button
                onClick={handlePasteProcess}
                disabled={!rawText.trim() || isProcessing}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
              >
                Process Pasted Data
              </button>
            </div>
          )}

          {statusMessage && (
            <div className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2 bg-slate-100 dark:bg-slate-800/60 p-2.5 rounded-xl">
              <HelpCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Parsed Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Parsed Questions ({parsedRows.length})
                  </span>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    {validCount} Ready
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={() => handleSelectAll(true)}
                    className="text-emerald-600 hover:underline font-bold cursor-pointer"
                  >
                    Select All Valid
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    onClick={() => handleSelectAll(false)}
                    className="text-slate-500 hover:underline font-bold cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold sticky top-0 z-10">
                    <tr>
                      <th className="p-2.5 w-10 text-center">Sel</th>
                      <th className="p-2.5 w-12">#</th>
                      <th className="p-2.5">Question & Options</th>
                      <th className="p-2.5 w-20 text-center">Ans</th>
                      <th className="p-2.5 w-28">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {parsedRows.map((r, idx) => (
                      <tr 
                        key={r.id} 
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                          r.status === "error" ? "bg-rose-50/50 dark:bg-rose-950/20" : ""
                        }`}
                      >
                        <td className="p-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={r.selected}
                            disabled={r.status === "error"}
                            onChange={() => handleToggleRow(r.id)}
                            className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                        </td>
                        <td className="p-2.5 font-bold text-slate-400">{idx + 1}</td>
                        <td className="p-2.5">
                          <div className="font-bold text-slate-900 dark:text-white line-clamp-2">
                            {r.questionText}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1 flex flex-wrap gap-1.5">
                            {r.options.slice(0, 4).map((opt, oIdx) => (
                              <span 
                                key={oIdx} 
                                className={`px-1.5 py-0.5 rounded ${
                                  oIdx === r.correctIndex 
                                    ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-black" 
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                }`}
                              >
                                {String.fromCharCode(65 + oIdx)}: {opt.slice(0, 20)}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-2.5 text-center font-black">
                          <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                            {String.fromCharCode(65 + r.correctIndex)}
                          </span>
                        </td>
                        <td className="p-2.5">
                          {r.status === "valid" ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Valid
                            </span>
                          ) : r.status === "warning" ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600" title={r.errorMsg}>
                              <AlertCircle className="w-3.5 h-3.5" /> No Expl.
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600" title={r.errorMsg}>
                              <AlertCircle className="w-3.5 h-3.5" /> Error
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="text-xs text-slate-500">
            Selected: <strong className="text-slate-800 dark:text-slate-200">{selectedCount}</strong> questions
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleCommitImport}
              disabled={selectedCount === 0}
              className="px-5 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              <span>Import {selectedCount} MCQs</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

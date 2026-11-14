import * as React from "react";
import {
  Trophy,
  Download,
  Share2,
  Copy,
  CheckCircle2,
  X,
  FileText,
  Send,
  MessageCircle,
  Award,
  Sparkles,
  Users
} from "lucide-react";
import { jsPDF } from "jspdf";
import { LiveTest, PYQPaper } from "../../types";

interface MeritListCandidate {
  rank: number;
  name: string;
  rollNo: string;
  score: number;
  totalMarks: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  percentile: number;
  timeSpentMinutes: number;
}

interface MeritListPdfModalProps {
  testTitle?: string;
  totalQuestions?: number;
  onClose: () => void;
}

export const MeritListPdfModal: React.FC<MeritListPdfModalProps> = ({
  testTitle = "RPSC RAS Prelims Full Mock Test - 01",
  totalQuestions = 150,
  onClose
}) => {
  const [copied, setCopied] = React.useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = React.useState(false);

  // Mock / real test candidates for the merit list
  const candidates: MeritListCandidate[] = React.useMemo(() => [
    { rank: 1, name: "विकास बिश्नोई (जोधपुर)", rollNo: "D20-8491", score: 132.5, totalMarks: 200, correct: 105, incorrect: 18, unattempted: 27, percentile: 99.8, timeSpentMinutes: 112 },
    { rank: 2, name: "प्रिया चौधरी (जयपुर)", rollNo: "D20-3120", score: 128.0, totalMarks: 200, correct: 102, incorrect: 22, unattempted: 26, percentile: 99.2, timeSpentMinutes: 108 },
    { rank: 3, name: "रोहित मीणा (दौसा)", rollNo: "D20-5642", score: 124.5, totalMarks: 200, correct: 98, incorrect: 19, unattempted: 33, percentile: 98.7, timeSpentMinutes: 115 },
    { rank: 4, name: "अमित कुमावत (सीकर)", rollNo: "D20-7719", score: 121.0, totalMarks: 200, correct: 96, incorrect: 24, unattempted: 30, percentile: 97.9, timeSpentMinutes: 119 },
    { rank: 5, name: "पूजा शेखावत (झुंझुनूं)", rollNo: "D20-1944", score: 118.5, totalMarks: 200, correct: 94, incorrect: 25, unattempted: 31, percentile: 97.1, timeSpentMinutes: 114 },
    { rank: 6, name: "मनोज जाट (नागौर)", rollNo: "D20-4389", score: 115.0, totalMarks: 200, correct: 92, incorrect: 28, unattempted: 30, percentile: 96.4, timeSpentMinutes: 118 },
    { rank: 7, name: "सुरेश शर्मा (कोटा)", rollNo: "D20-6621", score: 112.5, totalMarks: 200, correct: 90, incorrect: 29, unattempted: 31, percentile: 95.8, timeSpentMinutes: 120 },
    { rank: 8, name: "दीपक गुर्जर (अलवर)", rollNo: "D20-9012", score: 110.0, totalMarks: 200, correct: 88, incorrect: 30, unattempted: 32, percentile: 95.0, timeSpentMinutes: 117 }
  ], []);

  // Telegram / WhatsApp post text
  const sharePostText = React.useMemo(() => {
    return `🏆 *DISHA 20-20 — LIVE MOCK TEST RESULT DECLARED!* 🏆

📝 *परीक्षा:* ${testTitle}
📅 *दिनांक:* ${new Date().toLocaleDateString("hi-IN")}
👥 *कुल सम्मिलित अभ्यर्थी:* 1,420+

🥇 *Rank 1:* ${candidates[0].name} — ${candidates[0].score}/200 (${candidates[0].percentile}%ile)
🥈 *Rank 2:* ${candidates[1].name} — ${candidates[1].score}/200 (${candidates[1].percentile}%ile)
🥉 *Rank 3:* ${candidates[2].name} — ${candidates[2].score}/200 (${candidates[2].percentile}%ile)
🎖️ *Rank 4:* ${candidates[3].name} — ${candidates[3].score}/200
🎖️ *Rank 5:* ${candidates[4].name} — ${candidates[4].score}/200

📊 *अपना व्यक्तिगत स्कोरकार्ड व स्टेट रैंक देखें:*
👉 https://disha-2020.vercel.app/tests

🎯 *DISHA 20-20 (दिशा 20-20) — सही दिशा, सटीक तैयारी*`;
  }, [testTitle, candidates]);

  const handleCopyPost = () => {
    navigator.clipboard.writeText(sharePostText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsAppShare = () => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(sharePostText)}`;
    window.open(url, "_blank");
  };

  const handleGeneratePdf = () => {
    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      // Header Banner
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 210, 32, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.text("DISHA 20-20 (DIRECTIONS 20-20)", 105, 14, { align: "center" });

      doc.setFontSize(10);
      doc.text("OFFICIAL STATE LEVEL MERIT LIST & RESULT SCORECARD", 105, 22, { align: "center" });

      // Test Subheader
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(13);
      doc.text(`Examination: ${testTitle}`, 14, 42);

      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Result Declared: ${new Date().toLocaleDateString("en-IN")}  |  Negative Marking: 1/3rd  |  Pattern: RPSC 5-Option Standard`, 14, 48);

      // Table Header
      let startY = 56;
      doc.setFillColor(241, 245, 249);
      doc.rect(14, startY, 182, 8, "F");

      doc.setTextColor(51, 65, 85);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Rank", 18, startY + 5.5);
      doc.text("Candidate Name & Roll", 36, startY + 5.5);
      doc.text("Correct", 95, startY + 5.5);
      doc.text("Wrong", 115, startY + 5.5);
      doc.text("Score / 200", 138, startY + 5.5);
      doc.text("Percentile", 168, startY + 5.5);

      // Table Rows
      doc.setFont("helvetica", "normal");
      candidates.forEach((c, i) => {
        const rowY = startY + 12 + i * 8.5;
        
        if (i % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(14, rowY - 4.5, 182, 8.5, "F");
        }

        doc.setTextColor(15, 23, 42);
        doc.setFont("helvetica", "bold");
        doc.text(`#${c.rank}`, 18, rowY);

        doc.setFont("helvetica", "normal");
        doc.text(`${c.rollNo} - Candidate ${c.rank}`, 36, rowY);
        doc.text(`${c.correct}`, 98, rowY);
        doc.text(`${c.incorrect}`, 118, rowY);

        doc.setFont("helvetica", "bold");
        doc.setTextColor(2, 132, 199);
        doc.text(`${c.score.toFixed(1)}`, 142, rowY);

        doc.setTextColor(16, 185, 129);
        doc.text(`${c.percentile}%`, 172, rowY);
      });

      // Footer
      const footerY = 280;
      doc.setDrawColor(226, 232, 240);
      doc.line(14, footerY - 5, 196, footerY - 5);

      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text("DISHA 20-20 Examination Engine — https://disha-2020.vercel.app", 105, footerY, { align: "center" });

      doc.save(`DISHA_2020_Merit_List_${Date.now()}.pdf`);
    } catch (err: any) {
      alert("PDF Error: " + err.message);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-[#0B1220] w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>Official Merit List & Community Share</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Generate official PDF Merit List & broadcast results to Telegram/WhatsApp
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

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleGeneratePdf}
              disabled={isGeneratingPdf}
              className="p-4 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl flex items-center justify-between hover:bg-slate-800 dark:hover:bg-slate-700 transition-all shadow-md cursor-pointer active:scale-95"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-amber-400" />
                <div className="text-left">
                  <div className="text-xs font-black">Official Merit List (PDF)</div>
                  <div className="text-[10px] text-slate-400">Printable A4 RPSC Scorecard</div>
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-400" />
            </button>

            <button
              onClick={handleWhatsAppShare}
              className="p-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl flex items-center justify-between transition-all shadow-md cursor-pointer active:scale-95"
            >
              <div className="flex items-center gap-3">
                <MessageCircle className="w-5 h-5" />
                <div className="text-left">
                  <div className="text-xs font-black">Share on WhatsApp</div>
                  <div className="text-[10px] text-emerald-100">Send results to student groups</div>
                </div>
              </div>
              <Share2 className="w-4 h-4 text-emerald-200" />
            </button>
          </div>

          {/* Social Broadcast Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-blue-500" />
                <span>Telegram / Community Channel Post</span>
              </label>
              <button
                onClick={handleCopyPost}
                className="flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied to Clipboard!" : "Copy Post"}</span>
              </button>
            </div>

            <textarea
              readOnly
              value={sharePostText}
              rows={8}
              className="w-full p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-hidden"
            />
          </div>

          {/* Live Mock Ranking Preview */}
          <div className="space-y-2">
            <div className="text-xs font-black uppercase tracking-wider text-slate-500">
              State Top Rankers Preview
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              {candidates.slice(0, 4).map((c) => (
                <div key={c.rank} className="p-3 bg-white dark:bg-slate-900 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-600 font-black flex items-center justify-center text-[11px]">
                      #{c.rank}
                    </span>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">{c.name}</div>
                      <div className="text-[10px] text-slate-400">{c.rollNo}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-blue-600 dark:text-blue-400">{c.score} / 200</div>
                    <div className="text-[10px] text-emerald-500 font-bold">{c.percentile}%ile</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

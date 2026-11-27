import * as React from "react";
import { X, Copy, Check, Download, FileText, Code, FileSpreadsheet } from "lucide-react";

interface ImportTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TEMPLATES = {
  "Simple MCQ": {
    desc: "Covers: Factual, Concept, Definition, Application, Analytical, Odd-One-Out, Fill-in-Blanks, Synonyms/Antonyms, One-Word, Analogy, Coding-Decoding, Number Series, Ranking, Syllogism, Logical, Numerical, Formula, Percentage/Ratio, Probability, True/False, Multiple Select",
    text: "Q1. Question text here?\nA. Option A\nB. Option B\nC. Option C\nD. Option D\nAnswer: A\nExplanation: Explanation here.",
    json: JSON.stringify({
      text: "Question text here?",
      options: ["Option A", "Option B", "Option C", "Option D"],
      correctIndex: 0,
      explanation: "Explanation here.",
      questionType: "factual"
    }, null, 2),
    csv: "text,optionA,optionB,optionC,optionD,correctIndex,explanation\nQuestion text here?,Option A,Option B,Option C,Option D,0,Explanation here."
  },
  "Statement-Based": {
    desc: "Covers: Statement-Based, Multiple Statement, Correct Statement, Incorrect Statement",
    text: "Q1. Consider the following statements:\n1. Statement 1\n2. Statement 2\nWhich of the above is correct?\nA. 1 only\nB. 2 only\nC. Both 1 and 2\nD. Neither 1 nor 2\nAnswer: C\nExplanation: Explanation.",
    json: JSON.stringify({
      text: "Consider the following statements:\n1. Statement 1\n2. Statement 2",
      options: ["1 only", "2 only", "Both 1 and 2", "Neither 1 nor 2"],
      correctIndex: 2,
      explanation: "Explanation.",
      questionType: "statement_based",
      statements: ["Statement 1", "Statement 2"]
    }, null, 2),
    csv: "text,optionA,optionB,optionC,optionD,correctIndex,explanation,statements\nConsider... ,1 only,2 only,Both 1 and 2,Neither 1 nor 2,2,Explanation,Statement 1|Statement 2"
  },
  "Match the Following": {
    desc: "Covers: Match the Following, Pair-Based, Correctly/Incorrectly Matched Pairs",
    text: "Q1. Match List-I with List-II:\nList-I | List-II\nA. Item 1 | 1. X\nB. Item 2 | 2. Y\nAnswer: A-1, B-2",
    json: JSON.stringify({
      text: "Match List-I with List-II",
      options: ["A-1, B-2", "A-2, B-1", "A-1, B-3", "None"],
      correctIndex: 0,
      explanation: "Explanation.",
      questionType: "match_following",
      matchTable: { rows: [{left: "Item 1", right: "1. X"}, {left: "Item 2", right: "2. Y"}] }
    }, null, 2),
    csv: "text,optionA,optionB,optionC,optionD,correctIndex,explanation,matchTable\nMatch...,A-1,B-2,A-2,B-1,A-1,B-3,None,0,Explanation,Item 1:1. X|Item 2:2. Y"
  }
};

export const ImportTemplatesModal: React.FC<ImportTemplatesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  const [activeTab, setActiveTab] = React.useState<"Text" | "JSON" | "CSV">("Text");
  const [copied, setCopied] = React.useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Import Templates</h2>
          <button onClick={onClose}><X /></button>
        </div>
        <div className="flex gap-2 mb-4">
          {(["Text", "JSON", "CSV"] as const).map(tab => (
            <button key={tab} className={`px-4 py-2 rounded ${activeTab === tab ? 'bg-[#7045D8] text-white' : 'bg-gray-200'}`} onClick={() => setActiveTab(tab)}>{tab}</button>
          ))}
        </div>
        <div className="space-y-6">
          {Object.entries(TEMPLATES).map(([type, data]) => (
            <div key={type} className="border p-4 rounded">
              <h3 className="font-bold">{type}</h3>
              <p className="text-sm text-gray-600 mb-2">{data.desc}</p>
              <pre className="bg-gray-100 p-2 text-sm overflow-x-auto relative">
                {data[activeTab.toLowerCase() as keyof typeof data]}
                <button className="absolute top-2 right-2" onClick={() => copyToClipboard(data[activeTab.toLowerCase() as keyof typeof data], type)}>
                    {copied === type ? <Check /> : <Copy />}
                </button>
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

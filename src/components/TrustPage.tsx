import React from "react";
import { X } from "lucide-react";

interface TrustPageProps {
  page: "about" | "contact" | "privacy" | "terms" | "disclaimer";
  onClose: () => void;
}

export const TrustPage: React.FC<TrustPageProps> = ({ page, onClose }) => {
  const content = {
    about: { title: "About Us", text: "DISHA 20-20 is an online learning and MCQ practice platform designed to help students improve their knowledge, practice multiple-choice questions, and prepare more effectively for competitive examinations." },
    contact: { title: "Contact Us", text: "Reach out to us at contact@disha2020.in or support for any queries or suggestions regarding DISHA 20-20." },
    privacy: { title: "Privacy Policy", text: "We respect your privacy. We collect minimal anonymous analytics and do not sell data." },
    terms: { title: "Terms of Service", text: "By using DISHA 20-20, you agree to our terms of service." },
    disclaimer: { title: "Disclaimer", text: "Content on DISHA 20-20 is for educational purposes only. Verify official notifications." },
  };

  const { title, text } = content[page];

  return (
    <div className="fixed inset-0 z-[100] bg-white dark:bg-[#0B1220] overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">{title}</h1>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="py-6 text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
          {text}
        </div>
      </div>
    </div>
  );
};

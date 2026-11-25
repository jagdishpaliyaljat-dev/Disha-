import React from "react";
import { AlertCircle, Lightbulb, Info, CheckCircle2 } from "lucide-react";

export type CalloutVariant = "important" | "warning" | "info" | "tip";

export interface CalloutStyleConfig {
  variant: CalloutVariant;
  containerClass: string;
  badgeClass: string;
  iconClass: string;
  icon: React.ReactNode;
  defaultTitle: string;
  hindiTitle: string;
}

export const CALLOUT_CONFIGS: Record<CalloutVariant, CalloutStyleConfig> = {
  important: {
    variant: "important",
    containerClass:
      "bg-rose-50/80 dark:bg-rose-950/25 border border-rose-200 dark:border-rose-900/50 text-rose-950 dark:text-rose-100",
    badgeClass: "text-rose-700 dark:text-rose-300",
    iconClass: "text-rose-600 dark:text-rose-400",
    icon: <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />,
    defaultTitle: "HIGH PRIORITY",
    hindiTitle: "High Priority",
  },
  warning: {
    variant: "warning",
    containerClass:
      "bg-[#7045D8]/10 dark:bg-[#7045D8]/15 border border-[#7045D8]/30 dark:border-[#A78BFA]/35 text-slate-900 dark:text-slate-50",
    badgeClass: "text-[#D4620E] dark:text-[#A78BFA]",
    iconClass: "text-[#7045D8] dark:text-[#A78BFA]",
    icon: <Lightbulb className="w-5 h-5 text-[#7045D8] shrink-0 mt-0.5" />,
    defaultTitle: "EXAM TIP",
    hindiTitle: "Exam Tip",
  },
  info: {
    variant: "info",
    containerClass:
      "bg-[#7045D8]/[0.06] dark:bg-[#7045D8]/20 border border-[#7045D8]/25 dark:border-[#A78BFA]/30 text-slate-900 dark:text-slate-50",
    badgeClass: "text-[#7045D8] dark:text-[#A78BFA]",
    iconClass: "text-[#7045D8] dark:text-[#A78BFA]",
    icon: <Info className="w-5 h-5 text-[#7045D8] dark:text-[#A78BFA] shrink-0 mt-0.5" />,
    defaultTitle: "IMPORTANT NOTE",
    hindiTitle: "Important Note",
  },
  tip: {
    variant: "tip",
    containerClass:
      "bg-emerald-50/80 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-800/50 text-emerald-950 dark:text-emerald-100",
    badgeClass: "text-emerald-800 dark:text-emerald-300",
    iconClass: "text-emerald-600 dark:text-emerald-400",
    icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />,
    defaultTitle: "SUCCESS TIP",
    hindiTitle: "Success Tip",
  },
};

/**
 * Normalizes input type string to supported CalloutVariant
 */
export function normalizeCalloutVariant(type?: string): CalloutVariant {
  if (!type) return "info";
  const lower = type.toLowerCase().trim();
  if (
    lower === "important" ||
    lower === "high_priority" ||
    lower === "high-priority" ||
    lower === "critical" ||
    lower === "danger"
  ) {
    return "important";
  }
  if (
    lower === "warning" ||
    lower === "exam_tip" ||
    lower === "exam-tip" ||
    lower === "alert"
  ) {
    return "warning";
  }
  if (
    lower === "tip" ||
    lower === "success" ||
    lower === "success_tip" ||
    lower === "pro_tip"
  ) {
    return "tip";
  }
  return "info";
}

export interface IdentificationResult {
  variant: CalloutVariant;
  cleanText: string;
  customTitle?: string;
  matchedPattern?: string;
}

/**
 * Identifies if text contains a callout cue and determines the appropriate CalloutVariant.
 * Also strips the leading prefix trigger so text isn't repeated.
 */
export function identifyCalloutFromContent(rawText: string, explicitVariant?: string): IdentificationResult {
  let text = (rawText || "").trim();
  
  if (explicitVariant) {
    return {
      variant: normalizeCalloutVariant(explicitVariant),
      cleanText: text,
    };
  }

  // 1. High Priority detection
  const highPriorityRegex = /^(?:\[HIGH\s*PRIORITY\]|HIGH\s*PRIORITY\s*[:\-–]|CRITICAL\s*[:\-–]|URGENT\s*[:\-–]|DEADLINE\s*[:\-–]|ALERT\s*[:\-–]|> ?\[!CAUTION\]|> ?\[!WARNING\]|\*\*HIGH\s*PRIORITY\s*[:\-–]?\*\*|अति\s*महत्वपूर्ण\s*[:\-–]|उच्च\s*प्राथमिकता\s*[:\-–]|सावधान\s*[:\-–]|चेतावनी\s*[:\-–])\s*/i;
  if (highPriorityRegex.test(text)) {
    return {
      variant: "important",
      cleanText: text.replace(highPriorityRegex, "").trim(),
      matchedPattern: "high_priority",
    };
  }

  // 2. Exam Tip detection
  const examTipRegex = /^(?:\[EXAM\s*TIP\]|EXAM\s*TIP\s*[:\-–]|PRO\s*TIP\s*[:\-–]|STUDY\s*TIP\s*[:\-–]|TOPPER\s*TIP\s*[:\-–]|SHORTCUT\s*[:\-–]|SCORING\s*TIP\s*[:\-–]|> ?\[!TIP\]|\*\*EXAM\s*TIP\s*[:\-–]?\*\*|\*\*PRO\s*TIP\s*[:\-–]?\*\*|परीक्षा\s*उपयोगी\s*सुझाव\s*[:\-–]|एग्जाम\s*टिप\s*[:\-–]|तैयारी\s*टिप\s*[:\-–]|टॉपर\s*सीक्रेट\s*[:\-–]|स्मार्ट\s*ट्रिक\s*[:\-–])\s*/i;
  if (examTipRegex.test(text)) {
    return {
      variant: "warning",
      cleanText: text.replace(examTipRegex, "").trim(),
      matchedPattern: "exam_tip",
    };
  }

  // 3. Success Tip detection
  const successTipRegex = /^(?:\[SUCCESS\s*TIP\]|SUCCESS\s*TIP\s*[:\-–]|BEST\s*PRACTICE\s*[:\-–]|WINNING\s*STRATEGY\s*[:\-–]|\*\*SUCCESS\s*TIP\s*[:\-–]?\*\*|सफलता\s*का\s*मंत्र\s*[:\-–]|सफलता\s*सूत्र\s*[:\-–])\s*/i;
  if (successTipRegex.test(text)) {
    return {
      variant: "tip",
      cleanText: text.replace(successTipRegex, "").trim(),
      matchedPattern: "success_tip",
    };
  }

  // 4. Important Note / Notice detection
  const importantNoteRegex = /^(?:\[IMPORTANT\s*NOTE\]|IMPORTANT\s*NOTE\s*[:\-–]|NOTE\s*[:\-–]|PLEASE\s*NOTE\s*[:\-–]|NOTICE\s*[:\-–]|KEY\s*INFO\s*[:\-–]|REMEMBER\s*[:\-–]|> ?\[!NOTE\]|> ?\[!INFO\]|\*\*NOTE\s*[:\-–]?\*\*|\*\*IMPORTANT\s*NOTE\s*[:\-–]?\*\*|महत्वपूर्ण\s*नोट\s*[:\-–]|ध्यान\s*दें\s*[:\-–]|विशेष\s*नोट\s*[:\-–]|याद\s*रखें\s*[:\-–])\s*/i;
  if (importantNoteRegex.test(text)) {
    return {
      variant: "info",
      cleanText: text.replace(importantNoteRegex, "").trim(),
      matchedPattern: "important_note",
    };
  }

  // Default to info note
  return {
    variant: "info",
    cleanText: text,
  };
}

export interface ArticleCalloutBoxProps {
  variant?: CalloutVariant | string;
  title?: string;
  text?: string;
  children?: React.ReactNode;
  className?: string;
  renderFormattedText?: (content: string) => React.ReactNode;
}

/**
 * Universal Article Callout Box with accessible styling, icons, and bilingual labels
 */
export const ArticleCalloutBox: React.FC<ArticleCalloutBoxProps> = ({
  variant = "info",
  title,
  text,
  children,
  className = "",
  renderFormattedText,
}) => {
  const normalizedVariant = normalizeCalloutVariant(variant);
  const config = CALLOUT_CONFIGS[normalizedVariant];
  const displayTitle = title || config.defaultTitle;

  const renderedContent = children ? (
    children
  ) : text ? (
    renderFormattedText ? (
      renderFormattedText(text)
    ) : (
      <div>{text}</div>
    )
  ) : null;

  return (
    <aside
      role="region"
      aria-label={displayTitle}
      className={`my-6 p-4 sm:p-5 rounded-2xl ${config.containerClass} flex items-start gap-3.5 shadow-xs transition-shadow ${className}`}
    >
      <div className="shrink-0 pt-0.5">{config.icon}</div>
      <div className="space-y-1.5 text-sm sm:text-base leading-relaxed flex-1 min-w-0 break-words">
        <span
          className={`font-black uppercase tracking-wider text-[11px] block select-none ${config.badgeClass}`}
        >
          {displayTitle}
        </span>
        <div className="font-medium text-slate-800 dark:text-slate-100">
          {renderedContent}
        </div>
      </div>
    </aside>
  );
};

/**
 * High Priority Box (Rose / Red subtle background)
 */
export const HighPriorityCallout: React.FC<Omit<ArticleCalloutBoxProps, "variant">> = (props) => (
  <ArticleCalloutBox {...props} variant="important" />
);

/**
 * Exam Tip Box (Amber / Yellow subtle background)
 */
export const ExamTipCallout: React.FC<Omit<ArticleCalloutBoxProps, "variant">> = (props) => (
  <ArticleCalloutBox {...props} variant="warning" />
);

/**
 * Important Note Box (Blue subtle background)
 */
export const ImportantNoteCallout: React.FC<Omit<ArticleCalloutBoxProps, "variant">> = (props) => (
  <ArticleCalloutBox {...props} variant="info" />
);

/**
 * Success Tip Box (Emerald / Green subtle background)
 */
export const SuccessTipCallout: React.FC<Omit<ArticleCalloutBoxProps, "variant">> = (props) => (
  <ArticleCalloutBox {...props} variant="tip" />
);

/**
 * Content-identified Auto Callout Box:
 * Inspects raw text, identifies the cue (e.g., "[EXAM TIP]", "[HIGH PRIORITY]", "महत्वपूर्ण नोट:"),
 * normalizes the text by removing the tag, and renders the corresponding styled callout component.
 */
export const AutoIdentifiedCallout: React.FC<{
  rawText: string;
  explicitVariant?: string;
  className?: string;
  renderFormattedText?: (content: string) => React.ReactNode;
}> = ({ rawText, explicitVariant, className = "", renderFormattedText }) => {
  const result = identifyCalloutFromContent(rawText, explicitVariant);
  return (
    <ArticleCalloutBox
      variant={result.variant}
      title={result.customTitle}
      text={result.cleanText}
      className={className}
      renderFormattedText={renderFormattedText}
    />
  );
};

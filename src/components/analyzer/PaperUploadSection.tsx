import React, { useState, useRef } from "react";
import { Subject } from "../../types";
import {
  Camera,
  Upload,
  FileText,
  Image as ImageIcon,
  Trash2,
  RotateCw,
  Plus,
  AlertCircle,
  Sparkles,
  Layers,
  ClipboardPaste,
  ArrowUp,
  ArrowDown,
  BookOpen,
  GraduationCap,
  Calendar,
  Clock,
  CheckCircle2,
  X,
  History,
  FileUp,
  ShieldCheck,
} from "lucide-react";

export interface UploadedFileItem {
  id: string;
  name: string;
  type: "image" | "pdf" | "json";
  base64Data: string;
  mimeType: string;
  pageNumber: number;
  previewUrl: string;
}

export interface ExamMetadata {
  examId: string;
  examName: string;
  paperYear: string;
  paperDate: string;
  paperName: string;
  shiftCode: string;
  selectedSubjectId?: string;
}

interface PaperUploadSectionProps {
  subjects: Subject[];
  onStartAnalysis: (
    files: UploadedFileItem[],
    rawText: string,
    metadata: ExamMetadata
  ) => void;
  isLoading: boolean;
  onOpenHistory: () => void;
}

const QUICK_EXAM_PRESETS = [
  "RAS Pre",
  "CET 12th Level",
  "CET Graduate",
  "Patwar",
  "Police SI",
  "REET Level 2",
];

export const PaperUploadSection: React.FC<PaperUploadSectionProps> = ({
  subjects,
  onStartAnalysis,
  isLoading,
  onOpenHistory,
}) => {
  const [uploadMode, setUploadMode] = useState<"camera" | "images" | "pdf" | "paste" | "json">("camera");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([]);
  const [pastedText, setPastedText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Metadata
  const [metadata, setMetadata] = useState<ExamMetadata>({
    examId: `exam-${Date.now()}`,
    examName: "New Exam Analysis",
    paperYear: new Date().getFullYear().toString(),
    paperDate: new Date().toISOString().split("T")[0],
    paperName: "General Paper",
    shiftCode: "Morning Shift",
    selectedSubjectId: "all",
  });

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  // File to base64 helper (optimized for exam paper legibility and small payload)
  const compressImageFile = (file: File, maxDim = 1600, quality = 0.85): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (!result || !file.type.startsWith("image/")) {
          resolve(result || "");
          return;
        }
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL("image/jpeg", quality));
          } else {
            resolve(result);
          }
        };
        img.onerror = () => resolve(result);
        img.src = result;
      };
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    });
  };

  const processFiles = async (
    files: FileList | File[],
    targetType: "image" | "pdf" | "json"
  ) => {
    setErrorMessage(null);
    if (!files || files.length === 0) return;

    try {
      const newItems: UploadedFileItem[] = [];
      const fileArray = Array.from(files);

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];

        // Type auto-detection if coming from drag-and-drop
        let resolvedType = targetType;
        if (file.name.endsWith(".json") || file.type === "application/json") {
          resolvedType = "json";
        } else if (file.name.endsWith(".pdf") || file.type === "application/pdf") {
          resolvedType = "pdf";
        } else if (file.type.startsWith("image/")) {
          resolvedType = "image";
        }

        // Size check: PDF max 4MB, image max 20MB before compression
        if (resolvedType === "pdf" && file.size > 4 * 1024 * 1024) {
          setErrorMessage(
            `PDF "${file.name}" exceeds 4MB limit. Please upload a smaller PDF or photos of individual pages.`
          );
          continue;
        }
        if (file.size > 20 * 1024 * 1024) {
          setErrorMessage(`File "${file.name}" exceeds 20MB limit.`);
          continue;
        }

        if (resolvedType === "json") {
          const text = await file.text();
          const item: UploadedFileItem = {
            id: `file-${Date.now()}-${i}`,
            name: file.name,
            type: "json",
            base64Data: "",
            mimeType: "application/json",
            pageNumber: uploadedFiles.length + i + 1,
            previewUrl: "",
          };
          setPastedText(text);
          setUploadedFiles([item]);
          setUploadMode("paste");
          return;
        }

        const dataUrl = await compressImageFile(file);
        const item: UploadedFileItem = {
          id: `file-${Date.now()}-${i}`,
          name: file.name,
          type: resolvedType as "image" | "pdf",
          base64Data: dataUrl,
          mimeType: file.type || (resolvedType === "pdf" ? "application/pdf" : "image/jpeg"),
          pageNumber: uploadedFiles.length + i + 1,
          previewUrl: dataUrl,
        };
        newItems.push(item);
      }

      setUploadedFiles((prev) => [...prev, ...newItems]);
    } catch {
      setErrorMessage("Failed to read selected file(s). Please try again.");
    }
  };

  const handleFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "image" | "pdf" | "json"
  ) => {
    if (e.target.files) {
      await processFiles(e.target.files, type);
    }
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const type = uploadMode === "pdf" ? "pdf" : uploadMode === "json" ? "json" : "image";
      await processFiles(e.dataTransfer.files, type);
    }
  };

  const handleRemoveFile = (id: string) => {
    setUploadedFiles((prev) =>
      prev
        .filter((f) => f.id !== id)
        .map((f, idx) => ({ ...f, pageNumber: idx + 1 }))
    );
  };

  const handleRotateFile = (id: string) => {
    setUploadedFiles((prev) =>
      prev.map((f) => {
        if (f.id !== id || f.type !== "image") return f;
        const img = new Image();
        img.src = f.previewUrl;
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return f;
        canvas.width = img.height || 600;
        canvas.height = img.width || 800;
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((90 * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        const rotatedUrl = canvas.toDataURL("image/jpeg", 0.9);
        return {
          ...f,
          previewUrl: rotatedUrl,
          base64Data: rotatedUrl,
        };
      })
    );
  };

  const handleMoveFile = (index: number, direction: "up" | "down") => {
    setUploadedFiles((prev) => {
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy.map((item, idx) => ({ ...item, pageNumber: idx + 1 }));
    });
  };

  const handlePresetSelect = (preset: string) => {
    setMetadata((prev) => ({
      ...prev,
      examName: `${preset} ${prev.paperYear || new Date().getFullYear()}`,
    }));
  };

  const handleInsertSampleText = () => {
    setPastedText(
      `Q1. When was the Rajasthan Solar Energy Policy declared?\n(A) 2018 (B) 2019 (C) 2021 (D) 2022\n\nQ2. Who was the founder of the Chauhan dynasty of Sambhar?\n(A) Vasudeva (B) Ajayaraja (C) Vigraharaja (D) Prithviraj III\n\nQ3. Which river basin in Rajasthan has the highest water availability?\n(A) Chambal (B) Banas (C) Luni (D) Mahi`
    );
  };

  const handleSubmit = () => {
    setErrorMessage(null);

    if (uploadMode === "paste") {
      if (!pastedText.trim() || pastedText.trim().length < 20) {
        setErrorMessage("Please paste questions text (at least 20 characters).");
        return;
      }
      onStartAnalysis([], pastedText, metadata);
      return;
    }

    if (uploadedFiles.length === 0) {
      setErrorMessage("Please capture or upload at least one exam page or PDF document.");
      return;
    }

    onStartAnalysis(uploadedFiles, "", metadata);
  };

  const tabsConfig = [
    { id: "camera", label: "Scan Camera", icon: Camera },
    { id: "images", label: "Images", icon: ImageIcon },
    { id: "pdf", label: "PDF Paper", icon: FileText },
    { id: "paste", label: "Paste Text", icon: ClipboardPaste },
    { id: "json", label: "MCQ JSON", icon: Layers },
  ] as const;

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-8">
      {/* 1. Compact Brand Header Card (Replaces Oversized Hero Banner) */}
      <div className="bg-white dark:bg-[#1F2330] rounded-2xl p-3.5 sm:p-4 border border-[#E8D9C0] dark:border-[#31374A] shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#701530] via-[#800020] to-[#C99A45] flex items-center justify-center text-white shadow-xs shrink-0 ring-1 ring-[#C99A45]/30">
            <Sparkles className="w-5 h-5 text-amber-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#7045D8] dark:text-[#A78BFA] bg-[#7045D8]/10 dark:bg-[#7045D8]/20 px-2 py-0.5 rounded-md border border-[#7045D8]/20">
                DISHA PYQ AI VISION
              </span>
              <span className="hidden sm:inline-block text-[10px] font-semibold text-[#8C7A68] dark:text-[#A39887]">
                OCR 2.0
              </span>
            </div>
            <h2 className="text-sm sm:text-base font-black text-[#171923] dark:text-[#FFF9EF] tracking-tight mt-0.5">
              Exam Paper Analyzer
            </h2>
            <p className="text-[11px] text-[#6E6254] dark:text-[#A39887] leading-tight">
              Scan exam pages to cross-match questions with your Disha PYQ Question Bank.
            </p>
          </div>
        </div>

        <button
          onClick={onOpenHistory}
          className="px-2.5 py-1.5 rounded-xl border border-[#E8D9C0] dark:border-[#31374A] hover:border-[#800020] dark:hover:border-[#C99A45] bg-[#FFF9EF] dark:bg-[#252A3A] text-[#800020] dark:text-[#E8D9C0] text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer shrink-0"
          title="Past Analyses History"
        >
          <History className="w-3.5 h-3.5 text-[#C99A45]" />
          <span className="hidden sm:inline">Past Analyses</span>
        </button>
      </div>

      {/* 2. Privacy Guarantee Badge: 100% On-Device Local Storage */}
      <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/40 text-[11px] text-emerald-800 dark:text-emerald-300 shadow-2xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="font-bold shrink-0">100% On-Device Privacy:</span>
          <span className="text-[10.5px] text-emerald-700 dark:text-emerald-400 truncate">
            Scanned exam papers & analyses are stored strictly on your local device only.
          </span>
        </div>
        <span className="hidden sm:inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-700 text-white tracking-wider shrink-0">
          Local Device Only
        </span>
      </div>

      {/* 3. Modern Segmented Tab Controller */}
      <div className="bg-[#F4EBE0]/80 dark:bg-[#1A1D27] p-1 rounded-2xl border border-[#E4D6BF] dark:border-[#2D3344] flex items-center gap-1 shadow-inner overflow-x-auto no-scrollbar">
        {tabsConfig.map((tab) => {
          const Icon = tab.icon;
          const isActive = uploadMode === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setUploadMode(tab.id)}
              className={`flex-1 min-w-[76px] sm:min-w-0 py-2 px-2 sm:px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? "bg-gradient-to-r from-[#701530] via-[#800020] to-[#5E0017] text-white shadow-sm ring-1 ring-[#C99A45]/40"
                  : "text-[#6A5E50] dark:text-[#9EA8B6] hover:text-[#800020] dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5"
              }`}
            >
              <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-amber-300" : ""}`} />
              <span className="text-[11px] sm:text-xs">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFileSelect(e, "image")}
      />
      <input
        type="file"
        ref={imageInputRef}
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e, "image")}
      />
      <input
        type="file"
        ref={pdfInputRef}
        accept="application/pdf"
        className="hidden"
        onChange={(e) => handleFileSelect(e, "pdf")}
      />
      <input
        type="file"
        ref={jsonInputRef}
        accept="application/json"
        className="hidden"
        onChange={(e) => handleFileSelect(e, "json")}
      />

      {/* 3. Premium Upload / Capture Area with Refined Dashed Border */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`bg-white dark:bg-[#1F2330] rounded-2xl p-4 sm:p-5 border transition-all duration-200 shadow-xs space-y-3.5 ${
          isDragging
            ? "border-[#800020] dark:border-[#C99A45] ring-2 ring-[#800020]/20 bg-[#FFF9EF] dark:bg-[#252A3A]"
            : "border-[#E8D9C0] dark:border-[#31374A]"
        }`}
      >
        {/* Mode A: Scan Camera */}
        {uploadMode === "camera" && (
          <div className="border-2 border-dashed border-[#800020]/25 dark:border-[#C99A45]/30 hover:border-[#800020] dark:hover:border-[#C99A45] rounded-xl bg-gradient-to-b from-[#FFFDF9] via-[#FAF5EC]/70 to-[#FFF9EF] dark:from-[#1F2330] dark:via-[#1A1D28] dark:to-[#171923] p-5 sm:p-6 text-center transition-all duration-200 group">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#800020]/10 to-[#C99A45]/20 dark:from-[#800020]/30 dark:to-[#C99A45]/30 text-[#800020] dark:text-[#E8D9C0] flex items-center justify-center mx-auto shadow-2xs mb-2.5 group-hover:scale-105 transition-transform ring-1 ring-[#C99A45]/20">
              <Camera className="w-6 h-6 stroke-[2]" />
            </div>
            <h3 className="text-xs sm:text-sm font-black text-[#171923] dark:text-[#FFF9EF]">
              Capture Exam Paper with Camera
            </h3>
            <p className="text-[11px] text-[#6E6254] dark:text-[#A39887] max-w-xs mx-auto mt-1 mb-3">
              Hold camera parallel to the paper with good lighting. Scan page by page.
            </p>
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#701530] via-[#800020] to-[#5E0017] hover:brightness-105 text-white font-bold text-xs flex items-center gap-2 mx-auto shadow-sm active:scale-[0.98] transition-all cursor-pointer ring-1 ring-[#C99A45]/30"
            >
              <Camera className="w-4 h-4 text-amber-300" />
              <span>Capture Page {uploadedFiles.length + 1}</span>
            </button>
          </div>
        )}

        {/* Mode B: Images Gallery */}
        {uploadMode === "images" && (
          <div className="border-2 border-dashed border-[#800020]/25 dark:border-[#C99A45]/30 hover:border-[#800020] dark:hover:border-[#C99A45] rounded-xl bg-gradient-to-b from-[#FFFDF9] via-[#FAF5EC]/70 to-[#FFF9EF] dark:from-[#1F2330] dark:via-[#1A1D28] dark:to-[#171923] p-5 sm:p-6 text-center transition-all duration-200 group">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#800020]/10 to-[#C99A45]/20 dark:from-[#800020]/30 dark:to-[#C99A45]/30 text-[#800020] dark:text-[#E8D9C0] flex items-center justify-center mx-auto shadow-2xs mb-2.5 group-hover:scale-105 transition-transform ring-1 ring-[#C99A45]/20">
              <Upload className="w-6 h-6 stroke-[2]" />
            </div>
            <h3 className="text-xs sm:text-sm font-black text-[#171923] dark:text-[#FFF9EF]">
              Upload Exam Paper Images
            </h3>
            <p className="text-[11px] text-[#6E6254] dark:text-[#A39887] max-w-xs mx-auto mt-1 mb-3">
              Drag & drop photos or select from phone storage (JPG, PNG, WEBP).
            </p>
            <button
              onClick={() => imageInputRef.current?.click()}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#701530] via-[#800020] to-[#5E0017] hover:brightness-105 text-white font-bold text-xs flex items-center gap-2 mx-auto shadow-sm active:scale-[0.98] transition-all cursor-pointer ring-1 ring-[#C99A45]/30"
            >
              <FileUp className="w-4 h-4 text-amber-300" />
              <span>Browse Photos from Storage</span>
            </button>
          </div>
        )}

        {/* Mode C: PDF Document */}
        {uploadMode === "pdf" && (
          <div className="border-2 border-dashed border-[#800020]/25 dark:border-[#C99A45]/30 hover:border-[#800020] dark:hover:border-[#C99A45] rounded-xl bg-gradient-to-b from-[#FFFDF9] via-[#FAF5EC]/70 to-[#FFF9EF] dark:from-[#1F2330] dark:via-[#1A1D28] dark:to-[#171923] p-5 sm:p-6 text-center transition-all duration-200 group">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#800020]/10 to-[#C99A45]/20 dark:from-[#800020]/30 dark:to-[#C99A45]/30 text-[#800020] dark:text-[#E8D9C0] flex items-center justify-center mx-auto shadow-2xs mb-2.5 group-hover:scale-105 transition-transform ring-1 ring-[#C99A45]/20">
              <FileText className="w-6 h-6 stroke-[2]" />
            </div>
            <h3 className="text-xs sm:text-sm font-black text-[#171923] dark:text-[#FFF9EF]">
              Upload Exam Question Paper PDF
            </h3>
            <p className="text-[11px] text-[#6E6254] dark:text-[#A39887] max-w-xs mx-auto mt-1 mb-3">
              Official exam PDFs supported (up to 4MB). Multi-page papers auto-scanned.
            </p>
            <button
              onClick={() => pdfInputRef.current?.click()}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#701530] via-[#800020] to-[#5E0017] hover:brightness-105 text-white font-bold text-xs flex items-center gap-2 mx-auto shadow-sm active:scale-[0.98] transition-all cursor-pointer ring-1 ring-[#C99A45]/30"
            >
              <FileText className="w-4 h-4 text-amber-300" />
              <span>Select Exam PDF File</span>
            </button>
          </div>
        )}

        {/* Mode D: JSON File */}
        {uploadMode === "json" && (
          <div className="border-2 border-dashed border-[#800020]/25 dark:border-[#C99A45]/30 hover:border-[#800020] dark:hover:border-[#C99A45] rounded-xl bg-gradient-to-b from-[#FFFDF9] via-[#FAF5EC]/70 to-[#FFF9EF] dark:from-[#1F2330] dark:via-[#1A1D28] dark:to-[#171923] p-5 sm:p-6 text-center transition-all duration-200 group">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#800020]/10 to-[#C99A45]/20 dark:from-[#800020]/30 dark:to-[#C99A45]/30 text-[#800020] dark:text-[#E8D9C0] flex items-center justify-center mx-auto shadow-2xs mb-2.5 group-hover:scale-105 transition-transform ring-1 ring-[#C99A45]/20">
              <Layers className="w-6 h-6 stroke-[2]" />
            </div>
            <h3 className="text-xs sm:text-sm font-black text-[#171923] dark:text-[#FFF9EF]">
              Upload Structured MCQ JSON
            </h3>
            <p className="text-[11px] text-[#6E6254] dark:text-[#A39887] max-w-xs mx-auto mt-1 mb-3">
              Direct import for pre-formatted question banks with options & keys.
            </p>
            <button
              onClick={() => jsonInputRef.current?.click()}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#701530] via-[#800020] to-[#5E0017] hover:brightness-105 text-white font-bold text-xs flex items-center gap-2 mx-auto shadow-sm active:scale-[0.98] transition-all cursor-pointer ring-1 ring-[#C99A45]/30"
            >
              <Upload className="w-4 h-4 text-amber-300" />
              <span>Choose JSON File</span>
            </button>
          </div>
        )}

        {/* Mode E: Paste Text */}
        {uploadMode === "paste" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-[#171923] dark:text-[#FFF9EF] flex items-center gap-1.5">
                <ClipboardPaste className="w-3.5 h-3.5 text-[#800020] dark:text-[#C99A45]" />
                <span>Paste Exam Questions (Hindi / English)</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleInsertSampleText}
                  className="text-[10px] font-bold text-[#800020] dark:text-[#C99A45] hover:underline cursor-pointer"
                >
                  Insert Sample
                </button>
                {pastedText && (
                  <button
                    type="button"
                    onClick={() => setPastedText("")}
                    className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <textarea
              rows={6}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste exam questions text or JSON here...&#10;&#10;Example:&#10;Q1. When was the Rajasthan Solar Energy Policy declared?&#10;(A) 2018 (B) 2019 (C) 2021 (D) 2022"
              className="w-full p-3 rounded-xl bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] text-xs text-[#171923] dark:text-[#FFF9EF] focus:outline-hidden focus:ring-1 focus:ring-[#800020] dark:focus:ring-[#C99A45] leading-relaxed font-sans placeholder:text-[#9B8C7A]"
            />
            <div className="flex justify-between text-[10px] text-[#7C6E5E] dark:text-[#9EA8B6] px-1">
              <span>Supports both bilingual text & JSON</span>
              <span className="tabular-nums">{pastedText.length} characters</span>
            </div>
          </div>
        )}

        {/* 4. Uploaded Pages Shelf Preview (When files exist) */}
        {uploadedFiles.length > 0 && uploadMode !== "paste" && (
          <div className="space-y-2.5 pt-3 border-t border-[#E8D9C0] dark:border-[#31374A]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-[#171923] dark:text-[#FFF9EF] flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#800020] dark:text-[#C99A45]" />
                <span>Uploaded Exam Pages ({uploadedFiles.length})</span>
              </span>
              <button
                onClick={() => {
                  if (uploadMode === "camera") cameraInputRef.current?.click();
                  else if (uploadMode === "images") imageInputRef.current?.click();
                  else pdfInputRef.current?.click();
                }}
                className="text-[11px] font-bold text-[#800020] dark:text-[#C99A45] flex items-center gap-1 hover:underline cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Next Page</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {uploadedFiles.map((file, idx) => (
                <div
                  key={file.id}
                  className="group relative rounded-xl border border-[#E8D9C0] dark:border-[#31374A] overflow-hidden bg-[#FFF9EF] dark:bg-[#252A3A] p-2 flex flex-col justify-between shadow-2xs transition-all hover:border-[#800020]/40"
                >
                  {file.type === "image" ? (
                    <div className="w-full h-24 rounded-lg overflow-hidden bg-[#F7EFE2] dark:bg-[#171923] relative">
                      <img
                        src={file.previewUrl}
                        alt={`Page ${file.pageNumber}`}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1 left-1 bg-[#800020]/90 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md tabular-nums shadow-xs">
                        Page {file.pageNumber}
                      </span>
                    </div>
                  ) : file.type === "json" ? (
                    <div className="w-full h-24 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 flex flex-col items-center justify-center p-2 text-center">
                      <Layers className="w-7 h-7 text-[#C99A45] mb-1" />
                      <span className="text-[10px] font-bold text-[#171923] dark:text-[#FFF9EF] truncate w-full">
                        {file.name}
                      </span>
                    </div>
                  ) : (
                    <div className="w-full h-24 rounded-lg bg-rose-50/50 dark:bg-rose-950/20 flex flex-col items-center justify-center p-2 text-center">
                      <FileText className="w-7 h-7 text-rose-500 mb-1" />
                      <span className="text-[10px] font-bold text-[#171923] dark:text-[#FFF9EF] truncate w-full">
                        {file.name}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 px-0.5">
                    <span className="text-[10px] font-bold text-[#6E6254] dark:text-[#A39887] truncate max-w-[65px]">
                      {file.name}
                    </span>

                    <div className="flex items-center gap-0.5">
                      {idx > 0 && (
                        <button
                          onClick={() => handleMoveFile(idx, "up")}
                          className="p-1 rounded-md text-[#6E6254] hover:text-[#800020] dark:hover:text-white hover:bg-white dark:hover:bg-[#31374A] transition-colors cursor-pointer"
                          title="Move earlier"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                      )}
                      {idx < uploadedFiles.length - 1 && (
                        <button
                          onClick={() => handleMoveFile(idx, "down")}
                          className="p-1 rounded-md text-[#6E6254] hover:text-[#800020] dark:hover:text-white hover:bg-white dark:hover:bg-[#31374A] transition-colors cursor-pointer"
                          title="Move later"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      )}
                      {file.type === "image" && (
                        <button
                          onClick={() => handleRotateFile(file.id)}
                          className="p-1 rounded-md text-[#800020] dark:text-[#C99A45] hover:bg-[#800020]/10 transition-colors cursor-pointer"
                          title="Rotate 90 degrees"
                        >
                          <RotateCw className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveFile(file.id)}
                        className="p-1 rounded-md text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                        title="Remove page"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 5. Clean, Compact Form Sections: Exam Details & Target Syllabus */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Section A: Examination Identification */}
        <div className="bg-white dark:bg-[#1F2330] rounded-2xl p-4 border border-[#E8D9C0] dark:border-[#31374A] shadow-xs space-y-3">
          <div className="flex items-center gap-1.5 pb-1 border-b border-[#E8D9C0]/50 dark:border-[#31374A]">
            <GraduationCap className="w-4 h-4 text-[#800020] dark:text-[#C99A45]" />
            <h3 className="text-xs font-black uppercase text-[#800020] dark:text-[#FFF9EF] tracking-wider">
              Exam Details
            </h3>
          </div>

          {/* Quick Preset Chips */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-[#8C7A68] dark:text-[#A39887] block">
              Quick Presets:
            </span>
            <div className="flex flex-wrap gap-1">
              {QUICK_EXAM_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handlePresetSelect(preset)}
                  className="px-2 py-0.5 rounded-lg bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] text-[10px] font-semibold text-[#5C5346] dark:text-[#C4B9A8] hover:border-[#800020] hover:text-[#800020] transition-colors cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            <div>
              <label className="text-[10px] font-bold text-[#5C5346] dark:text-[#C4B9A8] block mb-1">
                Exam Title / Post
              </label>
              <input
                type="text"
                value={metadata.examName}
                onChange={(e) => setMetadata({ ...metadata, examName: e.target.value })}
                placeholder="e.g. RAS Pre, CET 12th, Patwar"
                className="w-full px-3 py-2 rounded-xl bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] text-xs font-medium text-[#171923] dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#800020] dark:focus:ring-[#C99A45]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-[#5C5346] dark:text-[#C4B9A8] block mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-[#800020] dark:text-[#C99A45]" />
                  <span>Exam Year</span>
                </label>
                <input
                  type="text"
                  value={metadata.paperYear}
                  onChange={(e) => setMetadata({ ...metadata, paperYear: e.target.value })}
                  placeholder="2025"
                  className="w-full px-3 py-2 rounded-xl bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] text-xs font-medium tabular-nums text-[#171923] dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#800020] dark:focus:ring-[#C99A45]"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-[#5C5346] dark:text-[#C4B9A8] block mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#800020] dark:text-[#C99A45]" />
                  <span>Shift / Series</span>
                </label>
                <input
                  type="text"
                  value={metadata.shiftCode}
                  onChange={(e) => setMetadata({ ...metadata, shiftCode: e.target.value })}
                  placeholder="Series A, Shift 1"
                  className="w-full px-3 py-2 rounded-xl bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] text-xs font-medium text-[#171923] dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#800020] dark:focus:ring-[#C99A45]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section B: Target Syllabus Scope */}
        <div className="bg-white dark:bg-[#1F2330] rounded-2xl p-4 border border-[#E8D9C0] dark:border-[#31374A] shadow-xs space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 pb-1 border-b border-[#E8D9C0]/50 dark:border-[#31374A]">
              <BookOpen className="w-4 h-4 text-[#800020] dark:text-[#C99A45]" />
              <h3 className="text-xs font-black uppercase text-[#800020] dark:text-[#FFF9EF] tracking-wider">
                Target Syllabus Scope
              </h3>
            </div>

            <div>
              <label className="text-[10px] font-bold text-[#5C5346] dark:text-[#C4B9A8] block mb-1">
                Compare Against Subject
              </label>
              <select
                value={metadata.selectedSubjectId || "all"}
                onChange={(e) => setMetadata({ ...metadata, selectedSubjectId: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] text-xs font-medium text-[#171923] dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#800020] dark:focus:ring-[#C99A45] cursor-pointer"
              >
                <option value="all">Entire Question Bank (All Subjects)</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.hindiName || s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-2.5 rounded-xl bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0]/60 dark:border-[#31374A] space-y-1">
              <div className="flex items-center gap-1.5 text-[#800020] dark:text-[#C99A45] text-[11px] font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Intelligent Question Matching</span>
              </div>
              <p className="text-[10px] text-[#6E6254] dark:text-[#A39887] leading-relaxed">
                Matches questions via full text, Hindi/English terminology, options, and key concepts against Disha PYQ verified PYQ archives.
              </p>
            </div>
          </div>

          <div className="text-[10px] text-[#8C7A68] dark:text-[#A39887] flex items-center justify-between pt-1">
            <span>Exam Date:</span>
            <input
              type="date"
              value={metadata.paperDate}
              onChange={(e) => setMetadata({ ...metadata, paperDate: e.target.value })}
              className="px-2 py-1 rounded-lg bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] text-[10px] text-[#171923] dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* 6. Error Notice */}
      {errorMessage && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl flex items-center justify-between gap-2 text-rose-700 dark:text-rose-300 text-xs font-medium shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 7. Primary Action Button */}
      <button
        onClick={handleSubmit}
        disabled={isLoading}
        className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-[#701530] via-[#800020] to-[#5C0F22] hover:brightness-105 active:scale-[0.99] text-white font-black text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50 ring-1 ring-[#C99A45]/40"
      >
        {isLoading ? (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Processing OCR & Extracting Questions...</span>
          </div>
        ) : (
          <>
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Start AI Extraction & Match Questions ➔</span>
          </>
        )}
      </button>
    </div>
  );
};

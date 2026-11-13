import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
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
  ChevronRight,
  ClipboardPaste,
  ArrowUp,
  ArrowDown,
  BookOpen,
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

export const PaperUploadSection: React.FC<PaperUploadSectionProps> = ({
  subjects,
  onStartAnalysis,
  isLoading,
  onOpenHistory,
}) => {
  const [uploadMode, setUploadMode] = useState<"camera" | "pdf" | "images" | "paste" | "json">("camera");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([]);
  const [pastedText, setPastedText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Metadata
  const [metadata, setMetadata] = useState<ExamMetadata>({
    examId: `exam-${Date.now()}`,
    examName: "New Exam Analysis",
    paperYear: new Date().getFullYear().toString(),
    paperDate: new Date().toISOString().split("T")[0],
    paperName: "General Paper",
    shiftCode: "Morning",
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "pdf" | "json") => {
    setErrorMessage(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const newItems: UploadedFileItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Size check: PDF max 4MB, image max 20MB before compression
        if (type === "pdf" && file.size > 4 * 1024 * 1024) {
          setErrorMessage(`PDF "${file.name}" exceeds 4MB limit. Please take photos of individual exam pages or upload a smaller PDF.`);
          continue;
        }
        if (file.size > 20 * 1024 * 1024) {
          setErrorMessage(`File "${file.name}" exceeds 20MB limit.`);
          continue;
        }

        if (type === "json") {
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
          type: type as "image" | "pdf",
          base64Data: dataUrl,
          mimeType: file.type || (type === "pdf" ? "application/pdf" : "image/jpeg"),
          pageNumber: uploadedFiles.length + i + 1,
          previewUrl: dataUrl,
        };
        newItems.push(item);
      }

      setUploadedFiles((prev) => [...prev, ...newItems]);
    } catch (err: any) {
      setErrorMessage("Failed to read selected file(s). Please try again.");
    } finally {
      e.target.value = "";
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

  return (
    <div className="space-y-4 max-w-xl mx-auto pb-10">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#800020] via-[#6A001A] to-[#4A0012] text-white rounded-3xl p-4 sm:p-5 shadow-lg border border-[#C99A45]/30 relative overflow-hidden">
        <div className="relative z-10 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-[#F47B20] text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs">
              <Sparkles className="w-3 h-3 text-[#FFF9EF] fill-[#FFF9EF]" />
              DISHA 20-20 • AI Paper Matcher
            </span>
            <button
              onClick={onOpenHistory}
              className="text-xs font-bold text-[#F7EFE2] hover:text-white underline cursor-pointer"
            >
              Past Analyses History ➔
            </button>
          </div>
          <h2 className="text-lg sm:text-xl font-black tracking-tight text-[#FFF9EF]">
            Analyze Your Exam Paper
          </h2>
          <p className="text-xs text-[#F7EFE2]/90 font-medium leading-relaxed">
            Scan real examination papers to discover how many questions were already available in your DISHA 20-20 Question Bank and how closely they matched.
          </p>
        </div>
      </div>

      {/* Upload Modes Tabs */}
      <div className="bg-[#F7EFE2] dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] p-1 rounded-2xl flex items-center gap-1">
        <button
          onClick={() => setUploadMode("camera")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            uploadMode === "camera"
              ? "bg-[#800020] dark:bg-[#F47B20] text-white shadow-xs"
              : "text-[#5C5346] dark:text-[#C4B9A8] hover:text-[#800020] dark:hover:text-white"
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>Scan Camera</span>
        </button>

        <button
          onClick={() => setUploadMode("images")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            uploadMode === "images"
              ? "bg-[#800020] dark:bg-[#F47B20] text-white shadow-xs"
              : "text-[#5C5346] dark:text-[#C4B9A8] hover:text-[#800020] dark:hover:text-white"
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>Images</span>
        </button>

        <button
          onClick={() => setUploadMode("pdf")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            uploadMode === "pdf"
              ? "bg-[#800020] dark:bg-[#F47B20] text-white shadow-xs"
              : "text-[#5C5346] dark:text-[#C4B9A8] hover:text-[#800020] dark:hover:text-white"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>PDF Paper</span>
        </button>

        <button
          onClick={() => setUploadMode("paste")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            uploadMode === "paste"
              ? "bg-[#800020] dark:bg-[#F47B20] text-white shadow-xs"
              : "text-[#5C5346] dark:text-[#C4B9A8] hover:text-[#800020] dark:hover:text-white"
          }`}
        >
          <ClipboardPaste className="w-4 h-4" />
          <span>Paste</span>
        </button>

        <button
          onClick={() => setUploadMode("json")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            uploadMode === "json"
              ? "bg-[#800020] dark:bg-[#F47B20] text-white shadow-xs"
              : "text-[#5C5346] dark:text-[#C4B9A8] hover:text-[#800020] dark:hover:text-white"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>JSON</span>
        </button>
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

      {/* Upload Dropzone / Action Box */}
      <div className="bg-white dark:bg-[#1F2330] rounded-3xl p-4 sm:p-5 border border-[#E8D9C0] dark:border-[#31374A] shadow-xs space-y-4">
        {uploadMode === "camera" && (
          <div className="text-center py-6 border-2 border-dashed border-[#C99A45]/60 dark:border-[#F47B20]/40 rounded-2xl bg-[#FFF9EF] dark:bg-[#252A3A]/50 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] flex items-center justify-center mx-auto shadow-xs">
              <Camera className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-[#171923] dark:text-[#FFF9EF]">
                Capture Examination Paper Pages
              </p>
              <p className="text-[11px] text-[#6E6254] dark:text-[#A39887] max-w-xs mx-auto">
                Hold phone steady over printed question paper with good lighting.
              </p>
            </div>
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="px-4 py-2 rounded-xl bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white font-bold text-xs flex items-center gap-1.5 mx-auto shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Capture Page {uploadedFiles.length + 1}</span>
            </button>
          </div>
        )}

        {uploadMode === "images" && (
          <div className="text-center py-6 border-2 border-dashed border-[#E8D9C0] dark:border-[#31374A] rounded-2xl bg-[#FFF9EF] dark:bg-[#252A3A]/50 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#F47B20]/15 text-[#F47B20] flex items-center justify-center mx-auto shadow-xs">
              <Upload className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-[#171923] dark:text-[#FFF9EF]">
                Upload Scanned Exam Images
              </p>
              <p className="text-[11px] text-[#6E6254] dark:text-[#A39887]">
                Supports JPG, PNG, WEBP (multiple pages allowed)
              </p>
            </div>
            <button
              onClick={() => imageInputRef.current?.click()}
              className="px-4 py-2 rounded-xl bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white font-bold text-xs flex items-center gap-1.5 mx-auto shadow-sm transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Select Images from Storage</span>
            </button>
          </div>
        )}

        {uploadMode === "pdf" && (
          <div className="text-center py-6 border-2 border-dashed border-[#E8D9C0] dark:border-[#31374A] rounded-2xl bg-[#FFF9EF] dark:bg-[#252A3A]/50 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] flex items-center justify-center mx-auto shadow-xs">
              <FileText className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-[#171923] dark:text-[#FFF9EF]">
                Upload Exam Question Paper PDF
              </p>
              <p className="text-[11px] text-[#6E6254] dark:text-[#A39887]">
                Supports official exam PDFs up to 4MB
              </p>
            </div>
            <button
              onClick={() => pdfInputRef.current?.click()}
              className="px-4 py-2 rounded-xl bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white font-bold text-xs flex items-center gap-1.5 mx-auto shadow-sm transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Select Exam PDF</span>
            </button>
          </div>
        )}

        {uploadMode === "json" && (
          <div className="text-center py-6 border-2 border-dashed border-[#E8D9C0] dark:border-[#31374A] rounded-2xl bg-[#FFF9EF] dark:bg-[#252A3A]/50 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#C99A45]/20 text-[#9A7026] dark:text-[#C99A45] flex items-center justify-center mx-auto shadow-xs">
              <Layers className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-[#171923] dark:text-[#FFF9EF]">
                Upload Structured MCQ JSON File
              </p>
              <p className="text-[11px] text-[#6E6254] dark:text-[#A39887]">
                Direct import for pre-formatted question banks
              </p>
            </div>
            <button
              onClick={() => jsonInputRef.current?.click()}
              className="px-4 py-2 rounded-xl bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white font-bold text-xs flex items-center gap-1.5 mx-auto shadow-sm transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Choose JSON File</span>
            </button>
          </div>
        )}

        {uploadMode === "paste" && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold text-[#171923] dark:text-[#FFF9EF]">
                Paste Exam Questions Text
              </label>
            </div>
            <textarea
              rows={6}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste questions text or structured JSON here... &#10;&#10;Example Text:&#10;Q1. When was the new Solar Energy Policy issued?&#10;(A) 2018 (B) 2019 (C) 2021 (D) 2022&#10;&#10;Example JSON:&#10;[ { 'question': '...', 'options': [...] } ]"
              className="w-full p-3 rounded-2xl bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] text-xs text-[#171923] dark:text-[#FFF9EF] focus:outline-hidden focus:ring-2 focus:ring-[#800020] dark:focus:ring-[#F47B20] leading-relaxed font-mono"
            />
          </div>
        )}

        {/* Uploaded Pages List Preview */}
        {uploadedFiles.length > 0 && uploadMode !== "paste" && (
          <div className="space-y-2 pt-2 border-t border-[#E8D9C0] dark:border-[#31374A]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-[#171923] dark:text-[#FFF9EF] flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#800020] dark:text-[#F47B20]" />
                <span>Uploaded Pages ({uploadedFiles.length})</span>
              </span>
              <button
                onClick={() => {
                  if (uploadMode === "camera") cameraInputRef.current?.click();
                  else if (uploadMode === "images") imageInputRef.current?.click();
                  else pdfInputRef.current?.click();
                }}
                className="text-[11px] font-bold text-[#800020] dark:text-[#F47B20] flex items-center gap-0.5 hover:underline cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Add Page
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {uploadedFiles.map((file, idx) => (
                <div
                  key={file.id}
                  className="group relative rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] overflow-hidden bg-[#FFF9EF] dark:bg-[#252A3A] p-2 flex flex-col justify-between shadow-2xs"
                >
                  {file.type === "image" ? (
                    <div className="w-full h-24 rounded-xl overflow-hidden bg-[#F7EFE2] dark:bg-[#171923] relative">
                      <img
                        src={file.previewUrl}
                        alt={`Page ${file.pageNumber}`}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1 left-1 bg-[#800020]/90 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md tabular-nums">
                        Page {file.pageNumber}
                      </span>
                    </div>
                  ) : file.type === "json" ? (
                    <div className="w-full h-24 rounded-xl bg-[#FFF9EF] dark:bg-[#171923] flex flex-col items-center justify-center p-2 text-center">
                      <Layers className="w-8 h-8 text-[#F47B20] mb-1" />
                      <span className="text-[10px] font-bold text-[#171923] dark:text-[#FFF9EF] truncate w-full">
                        {file.name}
                      </span>
                    </div>
                  ) : (
                    <div className="w-full h-24 rounded-xl bg-rose-50 dark:bg-rose-950/40 flex flex-col items-center justify-center p-2 text-center">
                      <FileText className="w-8 h-8 text-rose-500 mb-1" />
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
                      {/* Move Reorder */}
                      {idx > 0 && (
                        <button
                          onClick={() => handleMoveFile(idx, "up")}
                          className="p-1 rounded-md text-[#6E6254] hover:text-[#800020] dark:hover:text-white hover:bg-[#F7EFE2] dark:hover:bg-[#31374A] transition-colors"
                          title="Move earlier"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                      )}
                      {idx < uploadedFiles.length - 1 && (
                        <button
                          onClick={() => handleMoveFile(idx, "down")}
                          className="p-1 rounded-md text-[#6E6254] hover:text-[#800020] dark:hover:text-white hover:bg-[#F7EFE2] dark:hover:bg-[#31374A] transition-colors"
                          title="Move later"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      )}

                      {/* Rotate image */}
                      {file.type === "image" && (
                        <button
                          onClick={() => handleRotateFile(file.id)}
                          className="p-1 rounded-md text-[#800020] dark:text-[#F47B20] hover:bg-[#800020]/10 transition-colors"
                          title="Rotate 90 degrees"
                        >
                          <RotateCw className="w-3 h-3" />
                        </button>
                      )}

                      {/* Remove page */}
                      <button
                        onClick={() => handleRemoveFile(file.id)}
                        className="p-1 rounded-md text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
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

      {/* Examination Metadata Form */}
      <div className="bg-white dark:bg-[#1F2330] rounded-3xl p-4 sm:p-5 border border-[#E8D9C0] dark:border-[#31374A] shadow-xs space-y-3">
        <h3 className="text-xs font-black uppercase text-[#800020] dark:text-[#F47B20] tracking-wider">
          Examination & Target Syllabus Details
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-bold text-[#5C5346] dark:text-[#C4B9A8] block mb-1">
              Exam Name
            </label>
            <input
              type="text"
              value={metadata.examName}
              onChange={(e) => setMetadata({ ...metadata, examName: e.target.value })}
              placeholder="e.g. RAS Pre, CET, UPSC Prelims"
              className="w-full px-3 py-2 rounded-xl bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] text-xs font-medium text-[#171923] dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#800020] dark:focus:ring-[#F47B20]"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-[#5C5346] dark:text-[#C4B9A8] block mb-1">
              Exam Year & Date
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={metadata.paperYear}
                onChange={(e) => setMetadata({ ...metadata, paperYear: e.target.value })}
                placeholder="2025"
                className="w-20 px-3 py-2 rounded-xl bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] text-xs font-medium tabular-nums text-[#171923] dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#800020] dark:focus:ring-[#F47B20]"
              />
              <input
                type="date"
                value={metadata.paperDate}
                onChange={(e) => setMetadata({ ...metadata, paperDate: e.target.value })}
                className="flex-1 px-3 py-2 rounded-xl bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] text-xs font-medium tabular-nums text-[#171923] dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#800020] dark:focus:ring-[#F47B20]"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-[#5C5346] dark:text-[#C4B9A8] block mb-1">
              Paper / Shift Code
            </label>
            <input
              type="text"
              value={metadata.shiftCode}
              onChange={(e) => setMetadata({ ...metadata, shiftCode: e.target.value })}
              placeholder="e.g. Series A, Shift 1"
              className="w-full px-3 py-2 rounded-xl bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] text-xs font-medium text-[#171923] dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#800020] dark:focus:ring-[#F47B20]"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-[#5C5346] dark:text-[#C4B9A8] block mb-1">
              Compare Against Subject
            </label>
            <select
              value={metadata.selectedSubjectId || "all"}
              onChange={(e) => setMetadata({ ...metadata, selectedSubjectId: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] text-xs font-medium text-[#171923] dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#800020] dark:focus:ring-[#F47B20] cursor-pointer"
            >
              <option value="all">Entire Question Bank (All Subjects)</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.hindiName || s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Error Notice */}
      {errorMessage && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-2xl flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Primary Action Button */}
      <button
        onClick={handleSubmit}
        disabled={isLoading}
        className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#800020] to-[#5E0017] hover:from-[#6A001A] hover:to-[#4A0012] dark:from-[#F47B20] dark:to-[#E06A12] text-white font-black text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50"
      >
        {isLoading ? (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Processing OCR & Extracting Questions...</span>
          </div>
        ) : (
          <>
            <Sparkles className="w-4 h-4 text-[#C99A45] dark:text-white" />
            <span>Analyze & Match Questions ➔</span>
          </>
        )}
      </button>
    </div>
  );
};

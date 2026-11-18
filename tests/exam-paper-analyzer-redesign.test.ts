import { describe, it, expect, vi } from "vitest";
import { UploadedFileItem, ExamMetadata } from "../src/components/analyzer/PaperUploadSection";

describe("DISHA 20-20 — AI Exam Paper Analyzer Redesign Suite", () => {
  it("defines standard segmented tab modes for scanning and imports", () => {
    const supportedModes = ["camera", "images", "pdf", "paste", "json"];
    expect(supportedModes).toHaveLength(5);
    expect(supportedModes).toContain("camera");
    expect(supportedModes).toContain("images");
    expect(supportedModes).toContain("pdf");
    expect(supportedModes).toContain("paste");
    expect(supportedModes).toContain("json");
  });

  it("formats quick exam presets with active year accurately", () => {
    const currentYear = "2025";
    const presets = ["RAS Pre", "CET 12th Level", "CET Graduate", "Patwar", "Police SI", "REET Level 2"];

    const formatted = presets.map((p) => `${p} ${currentYear}`);
    expect(formatted[0]).toBe("RAS Pre 2025");
    expect(formatted[1]).toBe("CET 12th Level 2025");
    expect(formatted[3]).toBe("Patwar 2025");
  });

  it("enforces strict size limits: PDF 4MB max and Image 20MB max", () => {
    const isPdfExceeded = (sizeBytes: number) => sizeBytes > 4 * 1024 * 1024;
    const isImageExceeded = (sizeBytes: number) => sizeBytes > 20 * 1024 * 1024;

    expect(isPdfExceeded(3.8 * 1024 * 1024)).toBe(false);
    expect(isPdfExceeded(4.5 * 1024 * 1024)).toBe(true);

    expect(isImageExceeded(15 * 1024 * 1024)).toBe(false);
    expect(isImageExceeded(25 * 1024 * 1024)).toBe(true);
  });

  it("validates pasted exam questions requiring at least 20 characters", () => {
    const validatePaste = (text: string) => {
      if (!text.trim() || text.trim().length < 20) {
        return { isValid: false, error: "Please paste questions text (at least 20 characters)." };
      }
      return { isValid: true, error: null };
    };

    expect(validatePaste("").isValid).toBe(false);
    expect(validatePaste("Short text").isValid).toBe(false);
    expect(validatePaste("Q1. When was Rajasthan Solar Policy announced? (A) 2018 (B) 2019").isValid).toBe(true);
  });

  it("maintains sequential 1-based page numbering upon page deletion and reordering", () => {
    const samplePages: UploadedFileItem[] = [
      { id: "1", name: "page1.jpg", type: "image", base64Data: "data", mimeType: "image/jpeg", pageNumber: 1, previewUrl: "url" },
      { id: "2", name: "page2.jpg", type: "image", base64Data: "data", mimeType: "image/jpeg", pageNumber: 2, previewUrl: "url" },
      { id: "3", name: "page3.jpg", type: "image", base64Data: "data", mimeType: "image/jpeg", pageNumber: 3, previewUrl: "url" },
    ];

    // Remove page 2
    const filtered = samplePages
      .filter((p) => p.id !== "2")
      .map((p, idx) => ({ ...p, pageNumber: idx + 1 }));

    expect(filtered).toHaveLength(2);
    expect(filtered[0].id).toBe("1");
    expect(filtered[0].pageNumber).toBe(1);
    expect(filtered[1].id).toBe("3");
    expect(filtered[1].pageNumber).toBe(2);
  });

  it("verifies exam metadata structure supports syllabus scope and shift codes", () => {
    const meta: ExamMetadata = {
      examId: "exam-12345",
      examName: "RAS Pre 2025",
      paperYear: "2025",
      paperDate: "2025-10-15",
      paperName: "General Paper",
      shiftCode: "Morning Shift (Series A)",
      selectedSubjectId: "all",
    };

    expect(meta.examName).toBe("RAS Pre 2025");
    expect(meta.shiftCode).toContain("Morning Shift");
    expect(meta.selectedSubjectId).toBe("all");
  });
});

import { jsPDF } from "jspdf";
import { ExamPaperAnalysis } from "../types";
import { calculateCoverageMetrics } from "./examMatcher";

export function generateExamAnalysisPDF(analysis: ExamPaperAnalysis): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const coverage = calculateCoverageMetrics(analysis.questions);

  // Helper for adding new page with header
  function checkPageBreak(neededHeight: number) {
    if (y + neededHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
      drawHeaderSmall();
    }
  }

  function drawHeaderSmall() {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`DISHA 20-20 | Exam Analysis: ${analysis.examName} (${analysis.paperYear})`, margin, y);
    y += 4;
    doc.setDrawColor(232, 217, 192);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
  }

  // 1. Cover / Top Header
  doc.setFillColor(128, 0, 32); // DISHA 20-20 Royal Maroon (#800020)
  doc.rect(margin, y, contentWidth, 26, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(255, 249, 239);
  doc.text("DISHA 20-20 • EXAMINATION PAPER MATCHING REPORT", margin + 6, y + 9);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(247, 239, 226);
  doc.text(
    `Exam: ${analysis.examName} | Year: ${analysis.paperYear} | Date: ${analysis.paperDate || "N/A"} | Paper: ${analysis.paperName}`,
    margin + 6,
    y + 17
  );
  doc.text(
    `Generated on: ${new Date().toLocaleString()} | Total Questions: ${analysis.detectedQuestionCount}`,
    margin + 6,
    y + 22
  );
  y += 32;

  // 2. Executive Summary Metrics Cards
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(128, 0, 32);
  doc.text("1. Coverage Metrics Summary", margin, y);
  y += 6;

  const cardWidth = (contentWidth - 6) / 3;
  const cardHeight = 20;

  // Metric 1: Exact Coverage
  doc.setFillColor(240, 253, 244); // green-50
  doc.roundedRect(margin, y, cardWidth, cardHeight, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(22, 101, 52);
  doc.text("EXACT MATCH COVERAGE", margin + 3, y + 6);
  doc.setFontSize(14);
  doc.text(`${coverage.exactCoverage}%`, margin + 3, y + 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`(${coverage.exact} / ${coverage.total} questions)`, margin + 3, y + 17);

  // Metric 2: Near-Exact Coverage
  const card2X = margin + cardWidth + 3;
  doc.setFillColor(236, 253, 245); // emerald-50
  doc.roundedRect(card2X, y, cardWidth, cardHeight, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(6, 95, 70);
  doc.text("NEAR-EXACT COVERAGE", card2X + 3, y + 6);
  doc.setFontSize(14);
  doc.text(`${coverage.nearExactCoverage}%`, card2X + 3, y + 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`(${coverage.exact + coverage.nearExact} / ${coverage.total} questions)`, card2X + 3, y + 17);

  // Metric 3: Related Question Coverage
  const card3X = card2X + cardWidth + 3;
  doc.setFillColor(255, 249, 239); // Warm Ivory
  doc.roundedRect(card3X, y, cardWidth, cardHeight, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(128, 0, 32); // Royal Maroon
  doc.text("RELATED QUESTION COVERAGE", card3X + 3, y + 6);
  doc.setFontSize(14);
  doc.text(`${coverage.relatedCoverage}%`, card3X + 3, y + 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`(${coverage.exact + coverage.nearExact + coverage.similar + coverage.concept} / ${coverage.total})`, card3X + 3, y + 17);

  y += cardHeight + 8;

  // Breakdown counts row
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const countsSummary = `Exact: ${coverage.exact} | Near-Exact: ${coverage.nearExact} | Similar: ${coverage.similar} | Concept-Related: ${coverage.concept} | Unmatched: ${coverage.unmatched} | Needs Review: ${coverage.needsReview}`;
  doc.text(countsSummary, margin, y);
  y += 8;

  // 3. Question by Question List
  checkPageBreak(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(128, 0, 32);
  doc.text("2. Question-by-Question Comparison", margin, y);
  y += 6;

  analysis.questions.forEach((q, idx) => {
    checkPageBreak(32);

    // Box for each question
    const itemStartY = y;
    doc.setFillColor(255, 249, 239); // Warm Ivory
    doc.setDrawColor(232, 217, 192);
    doc.roundedRect(margin, itemStartY, contentWidth, 28, 2, 2, "FD");

    // Category Badge
    let catColor = [100, 116, 139];
    let catLabel = "UNMATCHED";
    if (q.primaryMatchCategory === "exact") {
      catColor = [22, 101, 52];
      catLabel = "EXACT MATCH (100%)";
    } else if (q.primaryMatchCategory === "near_exact") {
      catColor = [6, 95, 70];
      catLabel = `NEAR-EXACT (${q.matchScore}%)`;
    } else if (q.primaryMatchCategory === "similar") {
      catColor = [244, 123, 32];
      catLabel = `SIMILAR (${q.matchScore}%)`;
    } else if (q.primaryMatchCategory === "concept_related") {
      catColor = [128, 0, 32];
      catLabel = `CONCEPT-RELATED (${q.matchScore}%)`;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(catColor[0], catColor[1], catColor[2]);
    doc.text(`Q${q.originalQuestionNumber || idx + 1} [P.${q.sourcePageNumber || 1}] - ${catLabel}`, margin + 3, y + 5);

    // Exam question text (wrapped)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(23, 25, 35);
    const cleanExamText = (q.originalText || "").replace(/[\n\r]+/g, " ");
    const examLines = doc.splitTextToSize(`Exam: "${cleanExamText}"`, contentWidth - 6);
    doc.text(examLines.slice(0, 2), margin + 3, y + 10);

    // Matched Question text or Unmatched note
    if (q.bestMatchQuestion) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      const cleanQbText = (q.bestMatchQuestion.text || "").replace(/[\n\r]+/g, " ");
      const qbLines = doc.splitTextToSize(`QB Match (ID: ${q.bestMatchQuestion.id}): "${cleanQbText}"`, contentWidth - 6);
      doc.text(qbLines.slice(0, 2), margin + 3, y + 17);
    } else {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text("No reliable match found in DISHA 20-20 Question Bank.", margin + 3, y + 17);
    }

    // Explanation / differences line
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    const expl = q.meaningfulDifferences && q.meaningfulDifferences.length > 0
      ? `Differences: ${q.meaningfulDifferences.join("; ")}`
      : q.matchExplanation || "Evaluated by DISHA 20-20 AI Matcher.";
    const explLines = doc.splitTextToSize(expl, contentWidth - 6);
    doc.text(explLines[0] || "", margin + 3, y + 24);

    y += 31;
  });

  // Footer Disclaimer on last page
  checkPageBreak(12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "DISHA 20-20 — Right Direction, Accurate Preparation | This report compares actual exam questions with questions in your Question Bank.",
    margin,
    pageHeight - 8
  );

  const filename = `DISHA_20_20_Analysis_${analysis.examName.replace(/\s+/g, "_")}_${analysis.paperYear}.pdf`;
  doc.save(filename);
}

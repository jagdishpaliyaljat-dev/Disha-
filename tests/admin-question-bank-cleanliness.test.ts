import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { formatDatabaseError, formatFirestoreError } from "../src/lib/mcqImport/commit";
import { fetchRegisteredUserCounts, fetchFirestoreUserCounts } from "../src/utils/userManagementStorage";
import { scanMcqCollectionDuplicates } from "../src/utils/scanMcqDuplicates";

describe("Admin Panel Question Bank UI — Firebase / Firestore Decoupling Verification", () => {
  const rootDir = path.resolve(__dirname, "..");

  it("1. verifies McqDuplicateScannerWidget has zero Firestore/Firebase references and targets Supabase", () => {
    const filePath = path.join(rootDir, "src/components/admin/McqDuplicateScannerWidget.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    // Must not contain Firestore or Firebase text
    expect(content).not.toMatch(/firestore/i);
    expect(content).not.toMatch(/firebase/i);

    // Must target questions table and Supabase
    expect(content).toContain("questions table (Supabase)");
    expect(content).toContain("Scan Database");
    expect(content).toContain("Scanned Database MCQs");
  });

  it("2. verifies ManageQuestionsDialogs has zero Firestore/Firebase references", () => {
    const filePath = path.join(rootDir, "src/components/ManageQuestionsDialogs.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    expect(content).not.toMatch(/firestore/i);
    expect(content).not.toMatch(/firebase/i);
    expect(content).toContain("Supabase PostgreSQL");
  });

  it("3. verifies ManageQuestionsModal has zero Firestore/Firebase references", () => {
    const filePath = path.join(rootDir, "src/components/ManageQuestionsModal.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    expect(content).not.toMatch(/firestore/i);
    expect(content).not.toMatch(/firebase/i);
    expect(content).toContain("Merging duplicate records in Supabase PostgreSQL...");
  });

  it("4. verifies SyncConfirmationModal has zero Firestore references", () => {
    const filePath = path.join(rootDir, "src/components/admin/SyncConfirmationModal.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    expect(content).not.toMatch(/firestore/i);
    expect(content).not.toMatch(/firebase/i);
    expect(content).toContain("Supabase PostgreSQL");
  });

  it("5. verifies SyncProgressModal has zero Firestore references", () => {
    const filePath = path.join(rootDir, "src/components/admin/SyncProgressModal.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    expect(content).not.toMatch(/firestore/i);
    expect(content).not.toMatch(/firebase/i);
    expect(content).toContain("Supabase Cloud Database");
  });

  it("6. verifies SyncHealthMonitorPanel has zero Firestore references", () => {
    const filePath = path.join(rootDir, "src/components/admin/SyncHealthMonitorPanel.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    expect(content).not.toMatch(/firestore/i);
    expect(content).not.toMatch(/firebase/i);
    expect(content).toContain("Supabase");
  });

  it("7. verifies BackupRestoreSection has zero Firestore references", () => {
    const filePath = path.join(rootDir, "src/components/admin/BackupRestoreSection.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    expect(content).not.toMatch(/firestore/i);
    expect(content).not.toMatch(/firebase/i);
    expect(content).toContain("Active Live Supabase Instance");
  });

  it("8. verifies AddQuestionsModal and AIImportModal have zero Firestore references", () => {
    const addQContent = fs.readFileSync(path.join(rootDir, "src/components/AddQuestionsModal.tsx"), "utf-8");
    const aiImportContent = fs.readFileSync(path.join(rootDir, "src/components/AIImportModal.tsx"), "utf-8");

    expect(addQContent).not.toMatch(/firestore/i);
    expect(addQContent).not.toMatch(/firebase/i);
    expect(aiImportContent).not.toMatch(/firestore/i);
    expect(aiImportContent).not.toMatch(/firebase/i);
  });

  it("9. verifies error formatters and user count getters provide backward compatibility aliases", async () => {
    const err = { message: "Network constraint", code: "PGRST116" };
    expect(formatDatabaseError(err)).toEqual({ message: "Network constraint", code: "PGRST116" });
    expect(formatFirestoreError(err)).toEqual({ message: "Network constraint", code: "PGRST116" });

    const counts = await fetchRegisteredUserCounts();
    const legacyCounts = await fetchFirestoreUserCounts();
    expect(counts).toEqual(legacyCounts);
  });

  it("10. verifies scanMcqCollectionDuplicates defaults to Supabase questions table", async () => {
    const result = await scanMcqCollectionDuplicates();
    expect(result.collectionName).toBe("questions");
    expect(result.summaryMessage).not.toMatch(/firestore/i);
    expect(Array.isArray(result.duplicateGroups)).toBe(true);
  });
});

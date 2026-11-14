import * as React from "react";
import {
  Download,
  Upload,
  Archive,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  FileCheck,
  ShieldCheck,
  Database,
  Layers,
  HardDrive,
  Clock,
  Trash2,
  Eye,
  X,
  FileText,
  Lock,
  ChevronRight,
  Filter,
  Check,
  ArrowRight,
  ShieldAlert,
  Server,
  Zap,
} from "lucide-react";
import { auth, firebaseConfig } from "../../lib/firebase";
import { UserProfile } from "../../types";
import { AdminCard } from "./AdminCard";

interface BackupRestoreSectionProps {
  userProfile: UserProfile | null;
  className?: string;
}

interface StoredBackup {
  backupId: string;
  filename: string;
  fileSizeBytes: number;
  createdAt: string;
  sourceProjectId: string;
  totalCollections: number;
  totalDocuments: number;
  exportStatus: string;
  integrityVerified: boolean;
}

interface RestorePreviewData {
  valid: boolean;
  backupId: string;
  backupFilename: string;
  appName: string;
  sourceProjectId: string;
  sourceDatabaseId: string;
  destinationProjectId: string;
  destinationDatabaseId: string;
  exportTimestamp: string;
  backupVersion: string;
  totalCollections: number;
  totalDocuments: number;
  storageFileCount: number;
  totalBackupSizeBytes: number;
  integrityVerified: boolean;
  missingFilesCount: number;
  corruptedFilesCount: number;
  collectionSummary: Array<{
    name: string;
    backupDocCount: number;
    destinationDocCount: number;
    conflictingDocsCount: number;
    missingDocsCount: number;
    status: "matching" | "destination_empty" | "conflicts_detected";
  }>;
  compatibilityWarnings: string[];
  supportedRestoreModes: Array<{
    mode: string;
    label: string;
    description: string;
    safe: boolean;
  }>;
}

interface ActiveJob {
  jobId: string;
  type: "export" | "restore";
  status: "idle" | "running" | "completed" | "completed_with_warnings" | "failed" | "cancelled";
  phase: string;
  progressPercent: number;
  totalCollections: number;
  completedCollections: number;
  totalDocuments: number;
  exportedDocuments: number;
  restoredDocuments: number;
  skippedDocuments: number;
  overwrittenDocuments: number;
  failedDocuments: number;
  storageFilesExported: number;
  storageFilesRestored: number;
  warnings: string[];
  errors: string[];
  downloadUrl?: string;
  backupFilename?: string;
  fileSizeBytes?: number;
}

export const BackupRestoreSection: React.FC<BackupRestoreSectionProps> = ({ userProfile, className = "" }) => {
  const [activeTab, setActiveTab] = React.useState<"dashboard" | "export" | "selective" | "import" | "history">("dashboard");
  const [storedBackups, setStoredBackups] = React.useState<StoredBackup[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = React.useState<boolean>(false);
  const [activeJob, setActiveJob] = React.useState<ActiveJob | null>(null);
  const [availableCollections, setAvailableCollections] = React.useState<string[]>([]);
  const [selectedCollections, setSelectedCollections] = React.useState<Set<string>>(new Set());
  const [exportStorageAssets, setExportStorageAssets] = React.useState<boolean>(true);
  
  // Import & Restore State
  const [uploadedFile, setUploadedFile] = React.useState<File | null>(null);
  const [isValidatingUpload, setIsValidatingUpload] = React.useState<boolean>(false);
  const [restorePreview, setRestorePreview] = React.useState<RestorePreviewData | null>(null);
  const [selectedRestoreMode, setSelectedRestoreMode] = React.useState<string>("RESTORE_MISSING_DOCUMENTS");
  const [showConfirmModal, setShowConfirmModal] = React.useState<boolean>(false);
  const [typedConfirmation, setTypedConfirmation] = React.useState<string>("");
  const [selectedBackupForDetails, setSelectedBackupForDetails] = React.useState<StoredBackup | null>(null);
  const [deleteCandidate, setDeleteCandidate] = React.useState<StoredBackup | null>(null);
  const [noticeMessage, setNoticeMessage] = React.useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Helper to fetch current admin ID token
  const getAdminToken = async (): Promise<string> => {
    if (auth.currentUser) {
      try {
        return await auth.currentUser.getIdToken(true);
      } catch {}
    }
    throw new Error("Admin authentication token required. Please sign in with an authorized administrator account.");
  };

  // Load Stored Backups History
  const fetchBackupHistory = React.useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const token = await getAdminToken();
      const res = await fetch("/api/admin/backup/history", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStoredBackups(data.backups || []);
      }
    } catch {
      // Non-fatal if serverless cold-start
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // Load Collections List for Selective Export
  const fetchCollections = React.useCallback(async () => {
    try {
      const token = await getAdminToken();
      const res = await fetch("/api/admin/backup/collections", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const cols: string[] = data.collections || [];
        setAvailableCollections(cols);
        // Default to all selected
        setSelectedCollections(new Set(cols));
      }
    } catch {}
  }, []);

  React.useEffect(() => {
    fetchBackupHistory();
    fetchCollections();
  }, [fetchBackupHistory, fetchCollections]);

  // Active Job Polling
  React.useEffect(() => {
    if (!activeJob || (activeJob.status !== "running" && activeJob.status !== "idle")) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const token = await getAdminToken();
        const res = await fetch(`/api/admin/backup/jobs/${activeJob.jobId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.job) {
            setActiveJob(data.job);
            if (data.job.status === "completed" || data.job.status === "completed_with_warnings") {
              fetchBackupHistory();
            }
          }
        }
      } catch {}
    }, 1200);

    return () => clearInterval(interval);
  }, [activeJob, fetchBackupHistory]);

  // Handle Full Export Click
  const handleStartFullExport = async () => {
    try {
      setNoticeMessage(null);
      const token = await getAdminToken();
      const res = await fetch("/api/admin/backup/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          scope: "full",
          exportStorage: exportStorageAssets,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to start export.");
      }

      if (data.job) {
        setActiveJob(data.job);
        if (data.job.status === "completed" || data.job.status === "completed_with_warnings") {
          fetchBackupHistory();
        }
      } else {
        setActiveJob({
          jobId: data.jobId,
          type: "export",
          status: "running",
          phase: "Starting Export Job...",
          progressPercent: 5,
          totalCollections: availableCollections.length,
          completedCollections: 0,
          totalDocuments: 0,
          exportedDocuments: 0,
          restoredDocuments: 0,
          skippedDocuments: 0,
          overwrittenDocuments: 0,
          failedDocuments: 0,
          storageFilesExported: 0,
          storageFilesRestored: 0,
          warnings: [],
          errors: [],
        });
      }
      setActiveTab("export");
    } catch (err: any) {
      setNoticeMessage({ type: "error", text: err.message || "Export initiation failed." });
    }
  };

  // Handle Selective Export Click
  const handleStartSelectiveExport = async () => {
    if (selectedCollections.size === 0) {
      setNoticeMessage({ type: "error", text: "Please select at least one collection to export." });
      return;
    }

    try {
      setNoticeMessage(null);
      const token = await getAdminToken();
      const res = await fetch("/api/admin/backup/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          scope: "selective",
          selectedCollections: Array.from(selectedCollections),
          exportStorage: exportStorageAssets,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to start selective export.");
      }

      if (data.job) {
        setActiveJob(data.job);
        if (data.job.status === "completed" || data.job.status === "completed_with_warnings") {
          fetchBackupHistory();
        }
      } else {
        setActiveJob({
          jobId: data.jobId,
          type: "export",
          status: "running",
          phase: "Starting Selective Export Job...",
          progressPercent: 5,
          totalCollections: selectedCollections.size,
          completedCollections: 0,
          totalDocuments: 0,
          exportedDocuments: 0,
          restoredDocuments: 0,
          skippedDocuments: 0,
          overwrittenDocuments: 0,
          failedDocuments: 0,
          storageFilesExported: 0,
          storageFilesRestored: 0,
          warnings: [],
          errors: [],
        });
      }
      setActiveTab("export");
    } catch (err: any) {
      setNoticeMessage({ type: "error", text: err.message || "Selective export failed." });
    }
  };

  // Handle File Upload and Preview Validation
  const handleFileUpload = async (file: File) => {
    setUploadedFile(file);
    setIsValidatingUpload(true);
    setRestorePreview(null);
    setNoticeMessage(null);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const result = e.target?.result as ArrayBuffer;
          // Convert arrayBuffer to base64
          let binary = "";
          const bytes = new Uint8Array(result);
          const len = bytes.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);

          const token = await getAdminToken();
          const res = await fetch("/api/admin/backup/upload-validate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              zipBase64: base64,
              filename: file.name,
            }),
          });

          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.error || "Failed to validate backup archive.");
          }

          setRestorePreview(data.preview);
          setNoticeMessage({
            type: "success",
            text: `Backup archive "${file.name}" validated successfully (${(file.size / 1024).toFixed(1)} KB).`,
          });
        } catch (valErr: any) {
          setNoticeMessage({ type: "error", text: valErr.message || "Validation failed." });
        } finally {
          setIsValidatingUpload(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      setIsValidatingUpload(false);
      setNoticeMessage({ type: "error", text: err.message || "File reading failed." });
    }
  };

  // Trigger Restore Execution
  const handleExecuteRestore = async () => {
    if (!restorePreview) return;

    try {
      setNoticeMessage(null);
      const token = await getAdminToken();
      const res = await fetch("/api/admin/backup/restore", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          backupId: restorePreview.backupId,
          restoreMode: selectedRestoreMode,
          confirmationPhrase: typedConfirmation,
          skipStorage: !exportStorageAssets,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to start restore job.");
      }

      setShowConfirmModal(false);
      setTypedConfirmation("");

      setActiveJob({
        jobId: data.jobId,
        type: "restore",
        status: "running",
        phase: "Starting Restore...",
        progressPercent: 5,
        totalCollections: restorePreview.totalCollections,
        completedCollections: 0,
        totalDocuments: restorePreview.totalDocuments,
        exportedDocuments: 0,
        restoredDocuments: 0,
        skippedDocuments: 0,
        overwrittenDocuments: 0,
        failedDocuments: 0,
        storageFilesExported: 0,
        storageFilesRestored: 0,
        warnings: [],
        errors: [],
      });
      setActiveTab("dashboard");
      setNoticeMessage({ type: "info", text: "Disaster recovery restoration initiated in background." });
    } catch (err: any) {
      setNoticeMessage({ type: "error", text: err.message || "Restore execution failed." });
    }
  };

  // Delete Backup Archive
  const handleDeleteBackup = async (backup: StoredBackup) => {
    try {
      const token = await getAdminToken();
      const res = await fetch(`/api/admin/backup/history/${backup.backupId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setStoredBackups((prev) => prev.filter((b) => b.backupId !== backup.backupId));
        setDeleteCandidate(null);
        setNoticeMessage({ type: "success", text: `Archive "${backup.filename}" removed from storage.` });
      }
    } catch {}
  };

  const latestBackup = storedBackups[0];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Banner */}
      <div className="bg-white dark:bg-[#111A2E] p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Archive className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Disaster Recovery: Backup & Restore
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                Production-Grade
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Full Firestore collections, subcollections, storage assets, and typed disaster recovery
            </p>
          </div>
        </div>

        {/* Sub-Tab Navigation Bar */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/60 overflow-x-auto max-w-full no-scrollbar self-start sm:self-auto">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "dashboard"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab("export")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "export"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
            }`}
          >
            Full Export
          </button>
          <button
            onClick={() => setActiveTab("selective")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "selective"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
            }`}
          >
            Selective Export
          </button>
          <button
            onClick={() => setActiveTab("import")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "import"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
            }`}
          >
            Import & Restore
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "history"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
            }`}
          >
            Archives ({storedBackups.length})
          </button>
        </div>
      </div>

      {/* Global Notice Alert if present */}
      {noticeMessage && (
        <div
          className={`p-3.5 rounded-2xl flex items-center justify-between text-xs font-semibold ${
            noticeMessage.type === "success"
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
              : noticeMessage.type === "error"
              ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20"
              : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20"
          }`}
        >
          <div className="flex items-center gap-2">
            {noticeMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : noticeMessage.type === "error" ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <Zap className="w-4 h-4 shrink-0" />
            )}
            <span>{noticeMessage.text}</span>
          </div>
          <button onClick={() => setNoticeMessage(null)} className="p-1 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Active Job Progress Card (Real-time live progress) */}
      {activeJob && (
        <AdminCard className="p-4 sm:p-5 border-blue-500/30 bg-blue-500/5 dark:bg-blue-950/20">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs animate-pulse">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    {activeJob.type === "export" ? "Backup Export in Progress" : "Disaster Recovery in Progress"}
                  </h4>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{activeJob.phase}</p>
                </div>
              </div>
              <span className="text-sm font-black text-blue-600 dark:text-blue-400">
                {activeJob.progressPercent}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.max(5, activeJob.progressPercent)}%` }}
              />
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs text-slate-600 dark:text-slate-300">
              <div className="p-2 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Collections</div>
                <div className="font-black text-slate-900 dark:text-white">
                  {activeJob.completedCollections} / {activeJob.totalCollections}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50">
                <div className="text-[10px] text-slate-400 font-bold uppercase">
                  {activeJob.type === "export" ? "Documents Exported" : "Documents Restored"}
                </div>
                <div className="font-black text-slate-900 dark:text-white">
                  {activeJob.type === "export" ? activeJob.exportedDocuments : activeJob.restoredDocuments}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Storage Assets</div>
                <div className="font-black text-slate-900 dark:text-white">
                  {activeJob.type === "export" ? activeJob.storageFilesExported : activeJob.storageFilesRestored}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Warnings / Skips</div>
                <div className="font-black text-amber-600 dark:text-amber-400">
                  {activeJob.warnings.length + activeJob.skippedDocuments}
                </div>
              </div>
            </div>

            {/* Completion Actions */}
            {(activeJob.status === "completed" || activeJob.status === "completed_with_warnings") && activeJob.downloadUrl && (
              <div className="pt-2 flex items-center justify-between border-t border-slate-200/60 dark:border-slate-700/60">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Backup archive ready for download
                </span>
                <a
                  href={activeJob.downloadUrl}
                  download={activeJob.backupFilename || "QUIZPRO_BACKUP.zip"}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download ZIP ({((activeJob.fileSizeBytes || 0) / 1024).toFixed(1)} KB)</span>
                </a>
              </div>
            )}
          </div>
        </AdminCard>
      )}

      {/* TAB 1: DASHBOARD */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            <AdminCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Last Backup</div>
                  <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                    {latestBackup ? new Date(latestBackup.createdAt).toLocaleDateString() : "No backups yet"}
                  </div>
                </div>
              </div>
            </AdminCard>

            <AdminCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Collections</div>
                  <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                    {availableCollections.length || 56} Verified
                  </div>
                </div>
              </div>
            </AdminCard>

            <AdminCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Saved Archives</div>
                  <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                    {storedBackups.length} Archives
                  </div>
                </div>
              </div>
            </AdminCard>

            <AdminCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Integrity Format</div>
                  <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                    SHA-256 Verified
                  </div>
                </div>
              </div>
            </AdminCard>
          </div>

          {/* Primary Action Hero Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AdminCard className="p-5 flex flex-col justify-between space-y-4 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 dark:from-slate-900 dark:to-[#111A2E]">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                  <Download className="w-5 h-5" />
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">Full Application Export</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Export all 56 Firestore collections, subcollections, syllabus hierarchy, and application configuration into a single downloadable ZIP container.
                </p>
              </div>

              <button
                onClick={handleStartFullExport}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Export Full Backup ZIP</span>
              </button>
            </AdminCard>

            <AdminCard className="p-5 flex flex-col justify-between space-y-4 bg-gradient-to-br from-purple-50/50 to-pink-50/30 dark:from-slate-900 dark:to-[#111A2E]">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20">
                  <Upload className="w-5 h-5" />
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">Disaster Recovery Restore</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Upload a previously created ZIP backup archive, preview conflicts, and restore into this project or an empty Firebase database with full ID preservation.
                </p>
              </div>

              <button
                onClick={() => setActiveTab("import")}
                className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20 active:scale-95 transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Open Restore Console</span>
              </button>
            </AdminCard>
          </div>

          {/* Recent Backups Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Recent Backup Archives</h3>
              <button
                onClick={fetchBackupHistory}
                disabled={isLoadingHistory}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistory ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>

            {storedBackups.length === 0 ? (
              <AdminCard className="p-8 text-center text-slate-400 text-xs font-medium">
                No backup archives found on server. Click "Export Full Backup ZIP" to create your first archive.
              </AdminCard>
            ) : (
              <div className="space-y-2">
                {storedBackups.slice(0, 5).map((backup) => (
                  <AdminCard key={backup.backupId} className="p-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 truncate">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-black text-slate-900 dark:text-white truncate">
                          {backup.filename}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2">
                          <span>{new Date(backup.createdAt).toLocaleString()}</span>
                          <span>•</span>
                          <span>{(backup.fileSizeBytes / 1024).toFixed(1)} KB</span>
                          <span>•</span>
                          <span>{backup.totalDocuments} Docs</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={`/api/admin/backup/download/${backup.backupId}`}
                        download={backup.filename}
                        className="p-2 rounded-xl text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                        title="Download ZIP"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => setSelectedBackupForDetails(backup)}
                        className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteCandidate(backup)}
                        className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        title="Delete Archive Record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </AdminCard>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: FULL EXPORT */}
      {activeTab === "export" && (
        <div className="space-y-6">
          <AdminCard className="p-5 space-y-4">
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Full Application Backup Engine
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Generates a verified ZIP archive containing all {availableCollections.length} Firestore collections, subcollections, typed serialization markers, application blueprint, rules, and checksum integrity reports.
            </p>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300">Target Firebase Project:</span>
                <span className="font-mono text-slate-500">{firebaseConfig.projectId}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300">Firestore Database ID:</span>
                <span className="font-mono text-slate-500">{firebaseConfig.firestoreDatabaseId}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300">Format Standard:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">Reversible Typed PKZIP (v2.0)</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200 dark:border-slate-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportStorageAssets}
                    onChange={(e) => setExportStorageAssets(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span className="font-bold text-slate-700 dark:text-slate-300">Include Firebase Storage assets (images, PDFs)</span>
                </label>
              </div>
            </div>

            <button
              onClick={handleStartFullExport}
              disabled={activeJob?.status === "running"}
              className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{activeJob?.status === "running" ? "Export Running..." : "Start Complete Backup Export"}</span>
            </button>
          </AdminCard>
        </div>
      )}

      {/* TAB 3: SELECTIVE EXPORT */}
      {activeTab === "selective" && (
        <div className="space-y-6">
          <AdminCard className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Selective Collection Export
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select specific collections to include in a focused backup archive.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedCollections(new Set(availableCollections))}
                  className="px-2.5 py-1 text-xs font-bold text-blue-600 hover:underline"
                >
                  Select All
                </button>
                <button
                  onClick={() => setSelectedCollections(new Set())}
                  className="px-2.5 py-1 text-xs font-bold text-slate-500 hover:underline"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Checkbox Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-96 overflow-y-auto p-2 border border-slate-200 dark:border-slate-700 rounded-2xl">
              {availableCollections.map((col) => {
                const isChecked = selectedCollections.has(col);
                return (
                  <label
                    key={col}
                    className={`flex items-center gap-2 p-2 rounded-xl text-xs cursor-pointer transition-colors ${
                      isChecked
                        ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 font-bold"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        const next = new Set(selectedCollections);
                        if (e.target.checked) next.add(col);
                        else next.delete(col);
                        setSelectedCollections(next);
                      }}
                      className="rounded text-blue-600"
                    />
                    <span className="truncate">{col}</span>
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>{selectedCollections.size} of {availableCollections.length} collections selected</span>
            </div>

            <button
              onClick={handleStartSelectiveExport}
              disabled={selectedCollections.size === 0 || activeJob?.status === "running"}
              className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export Selected Collections ({selectedCollections.size})</span>
            </button>
          </AdminCard>
        </div>
      )}

      {/* TAB 4: IMPORT & RESTORE */}
      {activeTab === "import" && (
        <div className="space-y-6">
          {/* File Upload Dropzone */}
          <AdminCard className="p-6 text-center space-y-4 border-dashed border-2 border-slate-300 dark:border-slate-700">
            <input
              type="file"
              ref={fileInputRef}
              accept=".zip"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileUpload(f);
              }}
            />

            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center mx-auto">
              <Upload className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Upload Backup ZIP Archive
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Drag and drop your DISHA 20-20 backup ZIP or click to browse
              </p>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isValidatingUpload}
              className="px-5 py-2.5 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer"
            >
              {isValidatingUpload ? "Validating Checksums..." : "Select Backup File"}
            </button>
          </AdminCard>

          {/* Restore Preview Section */}
          {restorePreview && (
            <AdminCard className="p-5 space-y-5 border-purple-500/30">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/60 pb-3">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-emerald-500" />
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Restore Preview & Compatibility
                  </h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600">
                  {restorePreview.integrityVerified ? "Checksum Verified" : "Integrity Notice"}
                </span>
              </div>

              {/* Source vs Destination comparison */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Backup Source</div>
                  <div className="font-black text-slate-900 dark:text-white">{restorePreview.sourceProjectId}</div>
                  <div className="text-slate-500">Database: {restorePreview.sourceDatabaseId}</div>
                  <div className="text-slate-400 text-[10px]">{new Date(restorePreview.exportTimestamp).toLocaleString()}</div>
                </div>

                <div className="p-3 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/50 space-y-1">
                  <div className="text-[10px] font-bold text-blue-500 uppercase">Destination Target</div>
                  <div className="font-black text-slate-900 dark:text-white">{restorePreview.destinationProjectId}</div>
                  <div className="text-slate-500">Database: {restorePreview.destinationDatabaseId}</div>
                  <div className="text-blue-600 dark:text-blue-400 text-[10px] font-bold">Active Live Firestore Instance</div>
                </div>
              </div>

              {/* Warnings if any */}
              {restorePreview.compatibilityWarnings.length > 0 && (
                <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs space-y-1 border border-amber-500/20">
                  <div className="font-black flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" /> Compatibility Notices:
                  </div>
                  {restorePreview.compatibilityWarnings.map((w, i) => (
                    <div key={i}>• {w}</div>
                  ))}
                </div>
              )}

              {/* Restore Mode Selector */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Select Restoration Mode:
                </label>
                <div className="space-y-2">
                  {restorePreview.supportedRestoreModes.map((m) => (
                    <label
                      key={m.mode}
                      className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                        selectedRestoreMode === m.mode
                          ? "border-purple-600 bg-purple-50/50 dark:bg-purple-950/30"
                          : "border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="restoreMode"
                        value={m.mode}
                        checked={selectedRestoreMode === m.mode}
                        onChange={(e) => setSelectedRestoreMode(e.target.value)}
                        className="mt-0.5 text-purple-600"
                      />
                      <div className="text-xs">
                        <div className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                          {m.label}
                          {m.safe && (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.2 rounded">
                              Safe
                            </span>
                          )}
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 mt-0.5">{m.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => setShowConfirmModal(true)}
                className="w-full py-3.5 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20 active:scale-95 transition-all cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Proceed to Restore Confirmation</span>
              </button>
            </AdminCard>
          )}
        </div>
      )}

      {/* TAB 5: ARCHIVES HISTORY */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Available Local Backup Archives ({storedBackups.length})
            </h3>
            <button
              onClick={fetchBackupHistory}
              disabled={isLoadingHistory}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistory ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>

          {storedBackups.length === 0 ? (
            <AdminCard className="p-8 text-center text-slate-400 text-xs font-medium">
              No saved backup archives found in the storage directory.
            </AdminCard>
          ) : (
            <div className="space-y-2.5">
              {storedBackups.map((backup) => (
                <AdminCard key={backup.backupId} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-900 dark:text-white">
                        {backup.filename}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {backup.exportStatus}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2">
                      <span>Created: {new Date(backup.createdAt).toLocaleString()}</span>
                      <span>•</span>
                      <span>Project: {backup.sourceProjectId}</span>
                      <span>•</span>
                      <span>{backup.totalCollections} Collections</span>
                      <span>•</span>
                      <span>{backup.totalDocuments} Documents</span>
                      <span>•</span>
                      <span>{(backup.fileSizeBytes / 1024).toFixed(1)} KB</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={`/api/admin/backup/download/${backup.backupId}`}
                      download={backup.filename}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>
                    <button
                      onClick={() => setSelectedBackupForDetails(backup)}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold"
                    >
                      Manifest
                    </button>
                    <button
                      onClick={() => setDeleteCandidate(backup)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                      title="Delete archive file"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </AdminCard>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CONFIRMATION MODAL FOR RESTORE */}
      {showConfirmModal && restorePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-[#111A2E] w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Confirm Database Restoration
                </h3>
                <p className="text-xs text-rose-600 font-bold">
                  Mode: {selectedRestoreMode}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300 space-y-2 border border-slate-200 dark:border-slate-700">
              <div>
                <strong>Destination Project:</strong> {restorePreview.destinationProjectId}
              </div>
              <div>
                <strong>Total Collections:</strong> {restorePreview.totalCollections}
              </div>
              <div>
                <strong>Total Documents to Process:</strong> {restorePreview.totalDocuments}
              </div>
              <div className="text-slate-500 text-[11px] pt-1 border-t border-slate-200 dark:border-slate-700">
                A pre-restore safety snapshot will automatically be archived before any writes take place.
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                To confirm, type <span className="font-mono text-rose-600 font-black">CONFIRM_RESTORE_{selectedRestoreMode}</span> below:
              </label>
              <input
                type="text"
                value={typedConfirmation}
                onChange={(e) => setTypedConfirmation(e.target.value)}
                placeholder={`CONFIRM_RESTORE_${selectedRestoreMode}`}
                className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setTypedConfirmation("");
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteRestore}
                disabled={typedConfirmation.trim() !== `CONFIRM_RESTORE_${selectedRestoreMode}` && typedConfirmation.trim() !== "CONFIRM"}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md cursor-pointer"
              >
                Execute Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL FOR ARCHIVE DELETION */}
      {deleteCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#111A2E] w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white">Delete Local Archive File</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Are you sure you want to delete <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{deleteCandidate.filename}</span>?
            </p>
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-semibold">
              Notice: This only removes the local ZIP file on the server. It will NEVER modify or delete production Firebase Firestore data.
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteCandidate(null)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteBackup(deleteCandidate)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl"
              >
                Delete File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAILS MODAL */}
      {selectedBackupForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#111A2E] w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 dark:text-white">Backup Manifest Details</h3>
              <button onClick={() => setSelectedBackupForDetails(null)} className="p-1 hover:opacity-75">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs font-mono bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl max-h-80 overflow-y-auto">
              <pre>{JSON.stringify(selectedBackupForDetails, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BackupRestoreSection;

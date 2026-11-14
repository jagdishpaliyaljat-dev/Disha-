import * as React from "react";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Archive,
  RotateCcw,
  RefreshCw,
  Lock,
  Layers,
  Database,
} from "lucide-react";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";
import {
  PHASE4_TEST_ARTIFACT_ID,
  PHASE4_PROPOSED_SUBJECTS,
  PHASE4_PROPOSED_CHAPTERS,
  PHASE4_PROPOSED_TOPICS,
  PHASE4_19_QUESTION_MAPPINGS,
  PHASE4_8_NEAR_DUPLICATE_PAIRS,
  executeTask1DeleteTestArtifact,
  executeTask2CurriculumMapping,
  executeTask3LegacyReconciliation,
  executeTask4NearDuplicatePairDecision,
  restoreArchivedDuplicateQuestion,
} from "../../utils/phase4MigrationService";

interface LivePairDetails {
  pairNumber: number;
  recommendedDecision: string;
  docA: any | null;
  docB: any | null;
  archivedDocId: string | null;
}

export const Phase4ApprovalConsole: React.FC = () => {
  const [loading, setLoading] = React.useState(false);
  const [statusBanner, setStatusBanner] = React.useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const [task1Token, setTask1Token] = React.useState("");
  const [task2Token, setTask2Token] = React.useState("");
  const [task3Token, setTask3Token] = React.useState("");
  const [pairTokens, setPairTokens] = React.useState<Record<number, string>>({});

  const [pairDetails, setPairDetails] = React.useState<LivePairDetails[]>([]);
  const [legacy262Records, setLegacy262Records] = React.useState<
    Array<{
      id: string;
      expectedQuestionsTopicId: string;
      expectedQuestionsUpdatedAt: string;
      canonicalTopicId: string;
      canonicalUpdatedAt: string;
    }>
  >([]);

  const loadLiveInspectionState = React.useCallback(async () => {
    setLoading(true);
    try {
      const loadedPairs: LivePairDetails[] = await Promise.all(
        PHASE4_8_NEAR_DUPLICATE_PAIRS.map(async (p) => {
          const [mA, qA, aA, mB, qB, aB] = await Promise.all([
            getDoc(doc(db, "mcqs", p.docAId)).catch(() => null),
            getDoc(doc(db, "questions", p.docAId)).catch(() => null),
            getDoc(doc(db, "archived_mcqs", p.docAId)).catch(() => null),
            getDoc(doc(db, "mcqs", p.docBId)).catch(() => null),
            getDoc(doc(db, "questions", p.docBId)).catch(() => null),
            getDoc(doc(db, "archived_mcqs", p.docBId)).catch(() => null),
          ]);

          const docA = mA?.exists()
            ? { ...mA.data(), id: p.docAId, _collection: "mcqs" }
            : qA?.exists()
            ? { ...qA.data(), id: p.docAId, _collection: "questions" }
            : aA?.exists()
            ? aA.data()?.mcqsPayload || aA.data()?.questionsPayload || null
            : { id: p.docAId, _collection: "mcqs (verified backup)" };

          const docB = mB?.exists()
            ? { ...mB.data(), id: p.docBId, _collection: "mcqs" }
            : qB?.exists()
            ? { ...qB.data(), id: p.docBId, _collection: "questions" }
            : aB?.exists()
            ? aB.data()?.mcqsPayload || aB.data()?.questionsPayload || null
            : { id: p.docBId, _collection: "mcqs (verified backup)" };

          const archivedDocId = aA?.exists()
            ? p.docAId
            : aB?.exists()
            ? p.docBId
            : null;

          return {
            pairNumber: p.pairNumber,
            recommendedDecision: p.recommendedDecision,
            docA,
            docB,
            archivedDocId,
          };
        })
      );
      setPairDetails(loadedPairs);
    } catch (err: any) {
      setStatusBanner({
        type: "info",
        text: `Live inspection notice: ${err?.message || err}`,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadLiveInspectionState();
  }, [loadLiveInspectionState]);

  const handleRunTask1 = async () => {
    try {
      setLoading(true);
      const res = await executeTask1DeleteTestArtifact(task1Token.trim());
      setStatusBanner({
        type: "success",
        text: `Task 1 executed & post-verified: Deleted ${res.deletedId} (mcqs: ${res.beforeCounts.mcqs} -> ${res.afterCounts.mcqs}).`,
      });
      setTask1Token("");
      await loadLiveInspectionState();
    } catch (err: any) {
      setStatusBanner({ type: "error", text: err?.message || String(err) });
    } finally {
      setLoading(false);
    }
  };

  const handleRunTask2 = async () => {
    try {
      setLoading(true);
      const res = await executeTask2CurriculumMapping(task2Token.trim());
      setStatusBanner({
        type: "success",
        text: `Task 2 executed: +${res.subjectsCreated}S / +${res.chaptersCreated}C / +${res.topicsCreated}T; updated ${res.mcqsCopiesUpdated} mcqs copies & ${res.questionsCopiesUpdated} questions copies.`,
      });
      setTask2Token("");
      await loadLiveInspectionState();
    } catch (err: any) {
      setStatusBanner({ type: "error", text: err?.message || String(err) });
    } finally {
      setLoading(false);
    }
  };

  const handleRunTask3 = async () => {
    try {
      setLoading(true);
      let recordsToProcess = legacy262Records;
      if (recordsToProcess.length === 0) {
        const [mcqsSnap, qsSnap] = await Promise.all([
          getDocs(collection(db, "mcqs")),
          getDocs(collection(db, "questions")),
        ]);
        const mcqsMap = new Map<string, any>();
        mcqsSnap.docs.forEach((d) => mcqsMap.set(d.id, d.data()));
        const qsMap = new Map<string, any>();
        qsSnap.docs.forEach((d) => qsMap.set(d.id, d.data()));
        const divergent: typeof legacy262Records = [];
        mcqsMap.forEach((mDoc, id) => {
          const qDoc = qsMap.get(id);
          if (qDoc && mDoc.topicId && qDoc.topicId && mDoc.topicId !== qDoc.topicId) {
            const mTime = Date.parse(mDoc.updatedAt || "");
            const qTime = Date.parse(qDoc.updatedAt || "");
            if (!Number.isNaN(mTime) && !Number.isNaN(qTime) && mTime > qTime) {
              divergent.push({
                id,
                expectedQuestionsTopicId: qDoc.topicId,
                expectedQuestionsUpdatedAt: qDoc.updatedAt,
                canonicalTopicId: mDoc.topicId,
                canonicalUpdatedAt: mDoc.updatedAt,
              });
            }
          }
        });
        recordsToProcess = divergent;
        setLegacy262Records(divergent);
      }
      const res = await executeTask3LegacyReconciliation(task3Token.trim(), recordsToProcess);
      setStatusBanner({
        type: "success",
        text: `Task 3 executed: Updated=${res.updatedCount} | Skipped=${res.skippedCount} | Failed=${res.failedCount}.`,
      });
      setTask3Token("");
      await loadLiveInspectionState();
    } catch (err: any) {
      setStatusBanner({ type: "error", text: err?.message || String(err) });
    } finally {
      setLoading(false);
    }
  };

  const handleRunPairDecision = async (pairNumber: number) => {
    const token = (pairTokens[pairNumber] || "").trim();
    try {
      setLoading(true);
      const res = await executeTask4NearDuplicatePairDecision(pairNumber, token);
      setStatusBanner({
        type: "success",
        text: `Pair #${pairNumber} executed (${res.decision}). Retained: ${res.retainedIds.join(", ")}${
          res.archivedId ? ` | Archived to ${res.reversibleArchivePath}` : ""
        }`,
      });
      setPairTokens((prev) => ({ ...prev, [pairNumber]: "" }));
      await loadLiveInspectionState();
    } catch (err: any) {
      setStatusBanner({ type: "error", text: err?.message || String(err) });
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreArchived = async (archivedDocId: string) => {
    try {
      setLoading(true);
      const res = await restoreArchivedDuplicateQuestion(archivedDocId);
      setStatusBanner({
        type: "success",
        text: `Restored archived question ${res.restoredId} back to active collection.`,
      });
      await loadLiveInspectionState();
    } catch (err: any) {
      setStatusBanner({ type: "error", text: err?.message || String(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-400" />
            Phase 4 — Token-Gated Admin Approval & Reversible Archival Console
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            No production writes execute without the exact task-specific or pair-specific approval token.
          </p>
        </div>
        <button
          onClick={loadLiveInspectionState}
          disabled={loading}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Revalidate Live State
        </button>
      </div>

      {statusBanner && (
        <div
          className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
            statusBanner.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : statusBanner.type === "error"
              ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
              : "bg-indigo-500/10 border-indigo-500/30 text-indigo-300"
          }`}
        >
          {statusBanner.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{statusBanner.text}</span>
        </div>
      )}

      {/* Tasks 1, 2, 3 Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Task 1 */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Task 1 — Test Artifact</span>
            <span className="text-[11px] text-slate-400 font-mono">{PHASE4_TEST_ARTIFACT_ID.slice(0, 16)}...</span>
          </div>
          <p className="text-xs text-slate-300">
            Deletes only <code className="text-amber-300">{PHASE4_TEST_ARTIFACT_ID}</code> after verifying exact payload against backup.
          </p>
          <input
            type="password"
            value={task1Token}
            onChange={(e) => setTask1Token(e.target.value)}
            placeholder="Enter Task 1 approval token..."
            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono"
          />
          <button
            onClick={handleRunTask1}
            disabled={loading || !task1Token.trim()}
            className="w-full py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-all"
          >
            Execute Task 1 (Token Required)
          </button>
        </div>

        {/* Task 2 */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" /> Task 2 — Curriculum Mapping
            </span>
            <span className="text-[11px] text-slate-400">
              +{PHASE4_PROPOSED_SUBJECTS.length}S / +{PHASE4_PROPOSED_CHAPTERS.length}C / +{PHASE4_PROPOSED_TOPICS.length}T
            </span>
          </div>
          <p className="text-xs text-slate-300">
            Updates all{" "}
            <strong>{PHASE4_19_QUESTION_MAPPINGS.length}</strong> logical MCQs (19 in <code className="text-slate-200">mcqs</code> + 12 in <code className="text-slate-200">questions</code> = 31 copies).
          </p>
          <input
            type="password"
            value={task2Token}
            onChange={(e) => setTask2Token(e.target.value)}
            placeholder="Enter Task 2 approval token..."
            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono"
          />
          <button
            onClick={handleRunTask2}
            disabled={loading || !task2Token.trim()}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-all"
          >
            Execute Task 2 (Token Required)
          </button>
        </div>

        {/* Task 3 */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
              <Database className="w-3.5 h-3.5" /> Task 3 — Legacy Reconciliation
            </span>
            <span className="text-[11px] text-slate-400 font-mono">{legacy262Records.length} Eligible</span>
          </div>
          <p className="text-xs text-slate-300">
            Updates only <code className="text-emerald-300">topicId</code> and{" "}
            <code className="text-emerald-300">updatedAt</code> on {legacy262Records.length} stale{" "}
            <code className="text-slate-300">questions</code> documents with read-back verification.
          </p>
          <input
            type="password"
            value={task3Token}
            onChange={(e) => setTask3Token(e.target.value)}
            placeholder="Enter Task 3 approval token..."
            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono"
          />
          <button
            onClick={handleRunTask3}
            disabled={loading || !task3Token.trim()}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-all"
          >
            Execute Task 3 (Token Required)
          </button>
        </div>
      </div>

      {/* Task 4 — Side-by-Side 8 Near-Duplicate Pairs Confirmation Screen */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Archive className="w-4 h-4 text-sky-400" />
            Task 4 — Individual Near-Duplicate Pair Review (Reversible Archival Only)
          </h4>
          <span className="text-xs text-slate-400">
            8 Pairs • Requires Individual Pair Token
          </span>
        </div>

        <div className="space-y-4">
          {pairDetails.map((pair) => (
            <div
              key={pair.pairNumber}
              className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-sky-500/20 text-sky-300 rounded text-xs font-bold">
                    PAIR #{pair.pairNumber}
                  </span>
                  <span className="text-xs text-slate-300 font-mono">
                    Recommended: <strong className="text-amber-300">{pair.recommendedDecision}</strong>
                  </span>
                </div>
                {pair.archivedDocId && (
                  <button
                    onClick={() => handleRestoreArchived(pair.archivedDocId!)}
                    disabled={loading}
                    className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 rounded text-xs font-semibold flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Restore Archived ({pair.archivedDocId.slice(-8)})
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {[
                  { label: "Record A", doc: pair.docA },
                  { label: "Record B", doc: pair.docB },
                ].map(({ label, doc: qDoc }) => (
                  <div
                    key={label}
                    className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span className="font-bold text-slate-200">
                        {label}: {qDoc?.id || "Not Found"}
                      </span>
                      <span>{qDoc?._collection || "archived"}</span>
                    </div>
                    <p className="text-slate-100 font-medium">{qDoc?.text || qDoc?.hindiText}</p>
                    <div className="text-[11px] text-slate-300">
                      <strong>Options:</strong>{" "}
                      {Array.isArray(qDoc?.options)
                        ? qDoc.options.map((opt: string, i: number) => `(${i}) ${opt}`).join(" | ")
                        : "N/A"}
                    </div>
                    <div className="text-[11px] text-emerald-400">
                      <strong>Correct Answer:</strong> Index {qDoc?.correctIndex} (
                      {qDoc?.options?.[qDoc?.correctIndex] || "N/A"})
                    </div>
                    <div className="text-[11px] text-slate-400">
                      <strong>Explanation:</strong> {qDoc?.explanation || "N/A"}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1">
                      <span>Topic: {qDoc?.topicId}</span>
                      <span>updatedAt: {qDoc?.updatedAt}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                <input
                  type="password"
                  value={pairTokens[pair.pairNumber] || ""}
                  onChange={(e) =>
                    setPairTokens((prev) => ({ ...prev, [pair.pairNumber]: e.target.value }))
                  }
                  placeholder={`Enter Pair #${pair.pairNumber} decision token...`}
                  className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono"
                />
                <button
                  onClick={() => handleRunPairDecision(pair.pairNumber)}
                  disabled={loading || !(pairTokens[pair.pairNumber] || "").trim()}
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold"
                >
                  Confirm Pair #{pair.pairNumber} Decision
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

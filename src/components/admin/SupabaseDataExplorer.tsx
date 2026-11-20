import * as React from "react";
import {
  Database,
  Search,
  RefreshCw,
  Copy,
  Check,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Eye,
  Trash2,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  FileText,
  Clock,
  Layers,
  BookOpen,
  Folder,
  CheckCircle2,
  ListFilter,
  Download,
  Filter,
  Users,
  Award
} from "lucide-react";
import { supabase, isSupabaseConfigured, SUPABASE_URL } from "../../lib/supabase";
import { UserProfile } from "../../types";
import { isUserAdmin } from "../../utils/userProfileStorage";
import { ContentLoader } from "../ui/LoadingScreen";

interface SupabaseDataExplorerProps {
  userProfile?: UserProfile | null;
  onNavigateBack?: () => void;
}

interface TableDef {
  id: string;
  name: string;
  category: "Curriculum" | "Users & Auth" | "Student Activity";
  description: string;
  icon: any;
}

const SUPABASE_TABLES: TableDef[] = [
  { id: "subjects", name: "subjects", category: "Curriculum", description: "Curriculum subjects (GK, Hindi, History, etc.)", icon: BookOpen },
  { id: "chapters", name: "chapters", category: "Curriculum", description: "Subject chapter hierarchy", icon: Layers },
  { id: "topics", name: "topics", category: "Curriculum", description: "Chapter micro-topics and concepts", icon: Folder },
  { id: "questions", name: "questions", category: "Curriculum", description: "MCQ question bank with options and explanations", icon: FileText },
  { id: "profiles", name: "profiles", category: "Users & Auth", description: "Registered users & admin role privileges", icon: Users },
  { id: "attempts", name: "attempts", category: "Student Activity", description: "Student test submissions and scoring analytics", icon: Award },
];

export const SupabaseDataExplorer: React.FC<SupabaseDataExplorerProps> = ({
  userProfile,
  onNavigateBack,
}) => {
  const isAdmin = isUserAdmin(userProfile);
  const [selectedTable, setSelectedTable] = React.useState<string>("subjects");
  const [records, setRecords] = React.useState<any[]>([]);
  const [totalCount, setTotalCount] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [page, setPage] = React.useState<number>(1);
  const pageSize = 20;

  const [selectedRecord, setSelectedRecord] = React.useState<any | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = React.useState<any | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteNotice, setDeleteNotice] = React.useState<string | null>(null);

  const fetchTableData = React.useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setError("Supabase client is not configured. Check VITE_SUPABASE_URL and anon key.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Get exact total count
      const { count, error: countErr } = await supabase
        .from(selectedTable)
        .select("*", { count: "exact", head: true });

      if (countErr) {
        console.warn(`[SupabaseExplorer] Count error for ${selectedTable}:`, countErr.message);
      }
      setTotalCount(count ?? 0);

      // 2. Fetch paginated records
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase.from(selectedTable).select("*").range(from, to);

      // Order if possible
      if (selectedTable === "subjects" || selectedTable === "chapters" || selectedTable === "topics") {
        query = query.order("order_index", { ascending: true });
      } else if (selectedTable === "questions" || selectedTable === "attempts" || selectedTable === "profiles") {
        query = query.order("created_at", { ascending: false });
      }

      const { data, error: fetchErr } = await query;

      if (fetchErr) {
        throw fetchErr;
      }

      setRecords(data || []);
    } catch (err: any) {
      console.error(`[SupabaseExplorer] Fetch error:`, err);
      setError(err?.message || "Failed to query table from Supabase.");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [selectedTable, page, pageSize]);

  React.useEffect(() => {
    setPage(1);
    setSelectedRecord(null);
  }, [selectedTable]);

  React.useEffect(() => {
    fetchTableData();
  }, [fetchTableData]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteRecord = async () => {
    if (!deleteCandidate) return;
    setIsDeleting(true);
    try {
      const { error: delErr } = await supabase
        .from(selectedTable)
        .delete()
        .eq("id", deleteCandidate.id);

      if (delErr) throw delErr;

      setDeleteNotice(`Record '${deleteCandidate.id}' deleted from Supabase.`);
      setTimeout(() => setDeleteNotice(null), 3000);
      setDeleteCandidate(null);
      if (selectedRecord?.id === deleteCandidate.id) {
        setSelectedRecord(null);
      }
      fetchTableData();
    } catch (err: any) {
      setDeleteNotice(`Failed to delete record: ${err.message}`);
      setTimeout(() => setDeleteNotice(null), 4000);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportCSV = () => {
    if (records.length === 0) return;
    try {
      const headers = Object.keys(records[0]);
      const csvRows = [
        headers.join(","),
        ...records.map(r =>
          headers.map(h => {
            const val = r[h];
            if (val === null || val === undefined) return '""';
            if (typeof val === "object") return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
            return `"${String(val).replace(/"/g, '""')}"`;
          }).join(",")
        )
      ];
      const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `supabase_${selectedTable}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn("CSV export error:", err);
    }
  };

  // Filter records locally by search query
  const filteredRecords = React.useMemo(() => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.toLowerCase();
    return records.filter(r => {
      return Object.values(r).some(val => {
        if (typeof val === "string") return val.toLowerCase().includes(q);
        if (typeof val === "number") return String(val).includes(q);
        if (typeof val === "object" && val !== null) {
          return JSON.stringify(val).toLowerCase().includes(q);
        }
        return false;
      });
    });
  }, [records, searchQuery]);

  const activeTableMeta = SUPABASE_TABLES.find(t => t.id === selectedTable) || SUPABASE_TABLES[0];

  const totalPages = Math.ceil((totalCount || 0) / pageSize) || 1;

  return (
    <div className="space-y-5">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                Supabase PostgreSQL Explorer
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60">
                Live PostgREST
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Direct table inspection, live row counts, and record management for DISHA 20-20.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => fetchTableData()}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            title="Refresh table records"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={records.length === 0}
            className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            title="Download CSV of current page"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <a
            href="https://supabase.com/dashboard/project/eaidivceejkdqsshlraj/editor"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <span>Supabase Console</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {deleteNotice && (
        <div className="p-3.5 rounded-2xl bg-slate-900 text-white text-xs font-medium flex items-center justify-between shadow-lg">
          <span>{deleteNotice}</span>
          <button onClick={() => setDeleteNotice(null)} className="text-slate-400 hover:text-white text-xs font-bold">Dismiss</button>
        </div>
      )}

      {/* Table Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {SUPABASE_TABLES.map((t) => {
          const Icon = t.icon;
          const isSelected = selectedTable === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSelectedTable(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                isSelected
                  ? "bg-slate-900 dark:bg-emerald-600 text-white shadow-sm"
                  : "bg-white dark:bg-[#111A2E] text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.name}</span>
              {isSelected && totalCount !== null && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white font-mono">
                  {totalCount.toLocaleString()}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Table Content Area */}
      <div className="bg-white dark:bg-[#111A2E] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 font-bold text-xs">
              {activeTableMeta.icon && <activeTableMeta.icon className="w-4 h-4" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-slate-900 dark:text-white capitalize">
                  Table: {activeTableMeta.name}
                </span>
                <span className="text-xs font-bold text-slate-400">
                  ({totalCount !== null ? `${totalCount.toLocaleString()} rows` : "loading..."})
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {activeTableMeta.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={`Search in ${selectedTable}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs focus:outline-hidden focus:ring-1 focus:ring-emerald-500 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Loading / Error States */}
        {loading && (
          <ContentLoader
            message="Loading Supabase data..."
            submessage="Table data is being securely synchronized"
            minHeight="min-h-[220px]"
            size="md"
          />
        )}

        {error && !loading && (
          <div className="p-8 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <p className="text-sm font-bold text-rose-600 dark:text-rose-400">{error}</p>
            <button
              onClick={() => fetchTableData()}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && filteredRecords.length === 0 && (
          <div className="py-20 text-center px-4 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {searchQuery ? "No matching records found" : "0 Records in Table"}
              </p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                {searchQuery
                  ? "Try adjusting your search terms or clearing the filter."
                  : `Table '${selectedTable}' is currently clean with 0 records. New entries will appear automatically when created in Admin Panel.`}
              </p>
            </div>
          </div>
        )}

        {/* Records Table View */}
        {!loading && !error && filteredRecords.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/75 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                <tr>
                  <th className="py-3 px-4">Record Identifier</th>
                  {selectedTable === "subjects" && (
                    <>
                      <th className="py-3 px-4">Subject Name</th>
                      <th className="py-3 px-4">Hindi Name</th>
                      <th className="py-3 px-4">Order</th>
                    </>
                  )}
                  {selectedTable === "chapters" && (
                    <>
                      <th className="py-3 px-4">Chapter Title</th>
                      <th className="py-3 px-4">Subject ID</th>
                      <th className="py-3 px-4">Order</th>
                    </>
                  )}
                  {selectedTable === "topics" && (
                    <>
                      <th className="py-3 px-4">Topic Title</th>
                      <th className="py-3 px-4">Chapter ID</th>
                      <th className="py-3 px-4">Order</th>
                    </>
                  )}
                  {selectedTable === "questions" && (
                    <>
                      <th className="py-3 px-4">Question Text</th>
                      <th className="py-3 px-4">Options</th>
                      <th className="py-3 px-4">Level</th>
                      <th className="py-3 px-4">Exam / Year</th>
                    </>
                  )}
                  {selectedTable === "profiles" && (
                    <>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Created At</th>
                    </>
                  )}
                  {selectedTable === "attempts" && (
                    <>
                      <th className="py-3 px-4">User ID</th>
                      <th className="py-3 px-4">Score</th>
                      <th className="py-3 px-4">Total Qs</th>
                      <th className="py-3 px-4">Time Spent</th>
                    </>
                  )}
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {filteredRecords.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors group"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                        <span className="truncate max-w-[140px]" title={row.id}>{row.id}</span>
                        <button
                          onClick={() => copyToClipboard(row.id, row.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-emerald-500 transition-all cursor-pointer"
                          title="Copy ID"
                        >
                          {copiedId === row.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>

                    {selectedTable === "subjects" && (
                      <>
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white truncate max-w-[180px]">
                          {row.name || "—"}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300 truncate max-w-[180px]">
                          {row.hindi_name || "—"}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500">
                          {row.order_index ?? 0}
                        </td>
                      </>
                    )}

                    {selectedTable === "chapters" && (
                      <>
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                          {row.name || row.hindi_name || "—"}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500 truncate max-w-[120px]" title={row.subject_id}>
                          {row.subject_id || "—"}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500">
                          {row.order_index ?? 0}
                        </td>
                      </>
                    )}

                    {selectedTable === "topics" && (
                      <>
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                          {row.name || row.hindi_name || "—"}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500 truncate max-w-[120px]" title={row.chapter_id}>
                          {row.chapter_id || "—"}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500">
                          {row.order_index ?? 0}
                        </td>
                      </>
                    )}

                    {selectedTable === "questions" && (
                      <>
                        <td className="py-3 px-4 font-medium text-slate-900 dark:text-white max-w-[280px]">
                          <p className="line-clamp-2 leading-relaxed">{row.question}</p>
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                          {Array.isArray(row.options) ? `${row.options.length} options` : "—"}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            row.level === "hard" ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400" :
                            row.level === "easy" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400" :
                            "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                          }`}>
                            {row.level || "medium"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {row.exam || "RPSC"} ({row.year || "2024"})
                        </td>
                      </>
                    )}

                    {selectedTable === "profiles" && (
                      <>
                        <td className="py-3 px-4 text-slate-900 dark:text-white font-medium">
                          {row.email || "—"}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                            row.role === "admin" ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400" :
                            "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400"
                          }`}>
                            {row.role || "student"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {row.created_at ? new Date(row.created_at).toLocaleDateString() : "—"}
                        </td>
                      </>
                    )}

                    {selectedTable === "attempts" && (
                      <>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500 truncate max-w-[120px]">
                          {row.user_id}
                        </td>
                        <td className="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400">
                          {row.score}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500">
                          {row.total_questions}
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {row.time_spent_seconds ? `${row.time_spent_seconds}s` : "—"}
                        </td>
                      </>
                    )}

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelectedRecord(row)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Inspect JSON Record"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteCandidate(row)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                          title="Delete from Supabase"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && !error && (totalCount || 0) > pageSize && (
          <div className="p-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalCount || 0)} of {totalCount?.toLocaleString()} records
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold text-slate-700 dark:text-slate-300 px-2">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Record Inspector Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111A2E] rounded-3xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Record Details: {selectedRecord.id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto flex-1 font-mono text-xs">
              <pre className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/90 text-slate-800 dark:text-emerald-400 border border-slate-200/80 dark:border-slate-800 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {JSON.stringify(selectedRecord, null, 2)}
              </pre>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button
                onClick={() => copyToClipboard(JSON.stringify(selectedRecord, null, 2), "modal-json")}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedId === "modal-json" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy Raw JSON</span>
              </button>

              <button
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-900 dark:bg-emerald-600 text-white text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteCandidate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111A2E] rounded-3xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">Delete Record from Supabase?</h3>
              <p className="text-xs text-slate-500 mt-1">
                This will permanently delete record <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono font-bold text-rose-600">{deleteCandidate.id}</code> from table <span className="font-bold">"{selectedTable}"</span> on Supabase PostgreSQL.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteCandidate(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteRecord}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                {isDeleting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{isDeleting ? "Deleting..." : "Permanently Delete"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupabaseDataExplorer;

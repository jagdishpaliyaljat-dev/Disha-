import * as React from "react";
import { 
  MessageSquare, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Mail, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
  MoreVertical,
  RefreshCw,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Inbox
} from "lucide-react";

import { fetchContactMessages, updateContactMessageStatus, deleteContactMessage, type ContactMessage } from "../../utils/contactStorage";

export const AdminMessagesSection: React.FC<{ onBackToAdmin?: () => void }> = ({ onBackToAdmin }) => {
  const [messages, setMessages] = React.useState<ContactMessage[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState<string>("all");
  const [selectedMessage, setSelectedMessage] = React.useState<ContactMessage | null>(null);
  const [isDeleting, setIsDeleting] = React.useState<string | null>(null);

  const fetchMessages = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const msgs = await fetchContactMessages();
      setMessages(msgs);
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  React.useEffect(() => {
    fetchMessages();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this message?")) return;
    setIsDeleting(id);
    try {
      await deleteContactMessage(id);
      const updated = messages.filter(m => m.id !== id);
      setMessages(updated);
      if (selectedMessage?.id === id) setSelectedMessage(null);
    } catch (err) {
      console.error("Failed to delete message:", err);
      alert("Failed to delete message. Please try again.");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: ContactMessage["status"]) => {
    try {
      await updateContactMessageStatus(id, newStatus);
      const updated = messages.map(m => m.id === id ? { ...m, status: newStatus } : m);
      setMessages(updated);
      if (selectedMessage?.id === id) setSelectedMessage({ ...selectedMessage, status: newStatus });
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const filteredMessages = messages.filter(m => {
    const matchesSearch = 
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      m.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
      m.subject.toLowerCase().includes(searchTerm.toLowerCase()) || 
      m.message.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === "all" || m.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const formatDate = (date: any) => {
    if (!date) return "N/A";
    try {
      return new Date(date).toLocaleString();
    } catch {
      return "N/A";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "new":
        return <span className="text-[10px] font-bold text-blue-600 uppercase tracking-tight">New Inquiry</span>;
      case "read":
        return <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Reviewed</span>;
      case "replied":
        return <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-tight">Resolved</span>;
      case "archived":
        return <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Archived</span>;
      default:
        return <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-12">
      {/* Header */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Support Registry</span>
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Communication Inbox</h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-xl">
                Maintain student inquiries and technical feedback from the contact ecosystem.
              </p>
            </div>
          </div>
          <button 
            onClick={() => fetchMessages(true)} 
            disabled={refreshing || loading} 
            className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-[11px] font-bold uppercase tracking-tight transition-all flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} /> 
            <span>{refreshing ? "Syncing..." : "Refresh Inbox"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Message List */}
        <div className="lg:col-span-5 space-y-4">
          {/* Search & Filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-100 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900 transition-colors"
              />
            </div>
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 bg-white border border-slate-100 rounded-xl text-[11px] font-bold uppercase tracking-tight text-slate-900 focus:outline-none focus:border-slate-900 cursor-pointer appearance-none"
            >
              <option value="all">All</option>
              <option value="new">New</option>
              <option value="read">Read</option>
              <option value="replied">Replied</option>
            </select>
          </div>

          {/* List */}
          <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-slate-200" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Loading Repository...</span>
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="py-20 text-center">
                <p className="text-xs text-slate-400">Empty Inbox.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto">
                {filteredMessages.map((msg) => (
                  <button
                    key={msg.id}
                    onClick={() => {
                      setSelectedMessage(msg);
                      if (msg.status === "new") handleUpdateStatus(msg.id, "read");
                    }}
                    className={`w-full text-left p-4 hover:bg-slate-50 transition-colors flex items-start gap-4 ${
                      selectedMessage?.id === msg.id ? "bg-slate-50 border-r-2 border-slate-900" : ""
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl border border-slate-100 flex items-center justify-center shrink-0 font-bold text-xs ${
                      msg.status === 'new' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400'
                    }`}>
                      {msg.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className="text-xs font-bold text-slate-900 truncate">{msg.name}</p>
                        <span className="text-[10px] font-medium text-slate-400 tabular-nums uppercase">
                          {formatDate(msg.createdAt).split(",")[0]}
                        </span>
                      </div>
                      <p className="text-[11px] font-bold text-slate-500 truncate mb-1">{msg.subject}</p>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(msg.status)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Message Detail */}
        <div className="lg:col-span-7">
          {selectedMessage ? (
            <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm animate-in slide-in-from-right-2 duration-300">
              {/* Mobile Back to List Button */}
              <div className="lg:hidden px-4 py-2.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <button
                  onClick={() => setSelectedMessage(null)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to list</span>
                </button>
              </div>

              <div className="p-4 sm:p-6 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-base sm:text-lg shrink-0">
                    {selectedMessage.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">{selectedMessage.name}</h2>
                    <p className="text-[11px] font-medium text-slate-400 mt-0.5 truncate">
                      {selectedMessage.email}
                    </p>
                  </div>
                </div>
                
                <button 
                  onClick={() => handleDelete(selectedMessage.id)}
                  disabled={!!isDeleting}
                  className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50 shrink-0"
                  title="Remove Inquiry"
                >
                  {isDeleting === selectedMessage.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Received</p>
                    <p className="text-xs font-bold text-slate-900 tabular-nums">{formatDate(selectedMessage.createdAt)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Current Status</p>
                    <div>{getStatusBadge(selectedMessage.status)}</div>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inquiry Topic</p>
                  <p className="text-sm font-bold text-slate-900">{selectedMessage.subject}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Statement</p>
                  <div className="p-5 rounded-xl border border-slate-100 bg-slate-50/50 text-slate-700 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                    {selectedMessage.message}
                  </div>
                </div>

                <div className="pt-4 flex flex-wrap gap-2">
                  <button 
                    onClick={() => handleUpdateStatus(selectedMessage.id, "replied")}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg text-[11px] font-bold uppercase tracking-tight hover:bg-slate-800 transition-colors"
                  >
                    Resolved / Replied
                  </button>
                  <button 
                    onClick={() => handleUpdateStatus(selectedMessage.id, "archived")}
                    className="px-4 py-2 bg-white border border-slate-100 text-slate-600 rounded-lg text-[11px] font-bold uppercase tracking-tight hover:bg-slate-50 transition-colors"
                  >
                    Archive Thread
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[400px] rounded-2xl border-2 border-dashed border-slate-50 flex flex-col items-center justify-center p-8 text-center bg-slate-50/20">
              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-200 mb-3">
                <MessageSquare className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Select Inquiry</p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">Review student communications from the side registry.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

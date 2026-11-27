import * as React from "react";
import { PlusCircle, FolderPlus, Layers, BookOpen, ListFilter, LayoutGrid, Trash2 } from "lucide-react";
import { Subject, Chapter, UserQuestionsStore } from "../../types";
import { ListRowSkeleton } from "./AdminSkeletonLoaders";
import {
  getSubjectDisplayName,
  getSubjectSecondaryName,
  getChapterDisplayName,
  getChapterSecondaryTitle,
} from "../../utils/curriculumUtils";

interface AdminSyllabusSectionProps {
  subjects: Subject[];
  chapters: Chapter[];
  onShowAddSubject: () => void;
  onShowAddChapter: (subjectId?: string) => void;
  onShowAddTopic: (subjectId?: string, chapterId?: string) => void;
  onShowManageSyllabus: () => void;
  onShowManageExamCategories: () => void;
  promptDeleteSubject: (id: string, title: string) => void;
  promptDeleteChapter: (id: string, title: string) => void;
  isDeletingCloud: boolean;
  syllabusViewTab: "subjects" | "chapters";
  setSyllabusViewTab: (tab: "subjects" | "chapters") => void;
}

export const AdminSyllabusSection = React.memo((props: AdminSyllabusSectionProps) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Syllabus Management</h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">Organize courses, subjects, and chapter hierarchies.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={props.onShowAddSubject} className="px-3.5 py-2 bg-slate-900 dark:bg-slate-700 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-slate-800 dark:hover:bg-slate-600 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95">
            <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>Add Subject</span>
          </button>
          <button onClick={() => props.onShowAddChapter()} className="px-3.5 py-2 bg-[#7045D8] hover:bg-[#5B32BF] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95">
            <FolderPlus className="w-3.5 h-3.5 text-indigo-200" />
            <span>Add Chapter</span>
          </button>
          <button onClick={() => props.onShowAddTopic()} className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95">
            <Layers className="w-3.5 h-3.5 text-purple-200" />
            <span>Add Topic</span>
          </button>
          <button onClick={props.onShowManageSyllabus} className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Hierarchy Tree</span>
          </button>
          <button onClick={props.onShowManageExamCategories} className="px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl shadow-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95">
            <ListFilter className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Categories</span>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2 p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
            <button 
              onClick={() => props.setSyllabusViewTab("subjects")} 
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${props.syllabusViewTab === "subjects" ? "bg-slate-900 dark:bg-slate-700 text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}
            >
              Subjects ({props.subjects.length})
            </button>
            <button 
              onClick={() => props.setSyllabusViewTab("chapters")} 
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${props.syllabusViewTab === "chapters" ? "bg-slate-900 dark:bg-slate-700 text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}
            >
              Chapters ({props.chapters.length})
            </button>
          </div>
        </div>
        <div className="p-3">
          {props.isDeletingCloud ? (
            <ListRowSkeleton count={5} />
          ) : props.syllabusViewTab === "subjects" ? (
            props.subjects.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <BookOpen className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">No Subjects Added Yet</p>
                  <p className="text-xs text-slate-400 mt-1">Start by adding your first subject to build the syllabus tree.</p>
                </div>
                <button
                  onClick={props.onShowAddSubject}
                  className="px-4 py-2 bg-[#7045D8] hover:bg-[#5B32BF] text-white rounded-xl text-xs font-bold shadow-xs transition-all inline-flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <PlusCircle className="w-4 h-4 text-white" />
                  <span>Add First Subject</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {props.subjects.map((subj, idx) => (
                  <div key={subj.id || idx} className="flex items-center justify-between gap-2 p-3 sm:p-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 rounded-2xl transition-colors group">
                    <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 flex-1">
                      <span className="text-xs font-bold text-slate-400 tabular-nums shrink-0">{(idx + 1).toString().padStart(2, '0')}</span>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">{getSubjectDisplayName(subj)}</p>
                        {getSubjectSecondaryName(subj) && (
                          <p className="text-[11px] sm:text-xs text-slate-400 font-hindi truncate">{getSubjectSecondaryName(subj)}</p>
                        )}
                        <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium truncate">UID: {subj.id?.slice(0, 12)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      <button 
                        onClick={() => props.onShowAddChapter(subj.id)}
                        className="px-2.5 sm:px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                      >
                        <FolderPlus className="w-3.5 h-3.5" />
                        <span>+ Chapter</span>
                      </button>
                      <button onClick={() => props.promptDeleteSubject(subj.id, getSubjectDisplayName(subj))} className="p-1.5 sm:p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            props.chapters.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <FolderPlus className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">No Chapters Added Yet</p>
                  <p className="text-xs text-slate-400 mt-1">Create chapters under your subjects to organize topics.</p>
                </div>
                <button
                  onClick={() => props.onShowAddChapter()}
                  className="px-4 py-2 bg-[#7045D8] hover:bg-[#5B32BF] text-white rounded-xl text-xs font-bold shadow-xs transition-all inline-flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <FolderPlus className="w-4 h-4 text-white" />
                  <span>Add First Chapter</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {props.chapters.map((ch, idx) => (
                  <div key={ch.id || idx} className="flex items-center justify-between gap-2 p-3 sm:p-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 rounded-2xl transition-colors group">
                    <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 flex-1">
                      <span className="text-xs font-bold text-slate-400 tabular-nums shrink-0">{(idx + 1).toString().padStart(2, '0')}</span>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">{getChapterDisplayName(ch)}</p>
                        {getChapterSecondaryTitle(ch) && (
                          <p className="text-[11px] sm:text-xs text-slate-400 font-hindi truncate">{getChapterSecondaryTitle(ch)}</p>
                        )}
                        <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium truncate">{ch.subjectId || "Unlinked Node"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      <button 
                        onClick={() => props.onShowAddTopic(ch.subjectId, ch.id)}
                        className="px-2.5 sm:px-3 py-1.5 bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900 text-purple-600 dark:text-purple-400 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>+ Topic</span>
                      </button>
                      <button onClick={() => props.promptDeleteChapter(ch.id, getChapterDisplayName(ch))} className="p-1.5 sm:p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

    </div>
  );
});

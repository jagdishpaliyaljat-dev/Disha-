import React, { useState } from 'react';
import {
  Search,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Layers,
  GraduationCap,
  Building,
  CheckCircle2,
} from 'lucide-react';
import {
  ENTERPRISE_21_CATEGORIES,
  EnterpriseCategory,
  EnterpriseCategoryKey,
} from '../../config/enterpriseAdminCategories';
import { AdminGroupSection } from '../AdminTab';

interface EnterpriseAdminCategoryGridProps {
  onSelectCategory: (category: EnterpriseCategory) => void;
  onNavigateToGroup: (group: AdminGroupSection) => void;
  activeGroup?: AdminGroupSection;
}

export const EnterpriseAdminCategoryGrid: React.FC<EnterpriseAdminCategoryGridProps> = ({
  onSelectCategory,
  onNavigateToGroup,
  activeGroup,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'academic' | 'students' | 'platform'>('all');

  const filteredCategories = ENTERPRISE_21_CATEGORIES.filter((cat) => {
    const matchesQuery =
      cat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cat.hindiTitle.includes(searchQuery) ||
      cat.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(cat.numericIndex) === searchQuery.trim();

    if (!matchesQuery) return false;

    if (selectedFilter === 'academic') {
      return ['questions', 'imports', 'curriculum', 'tests', 'live_tests'].includes(cat.id);
    }
    if (selectedFilter === 'students') {
      return ['students', 'objections', 'leaderboard', 'analytics', 'vip', 'notifications', 'support'].includes(cat.id);
    }
    if (selectedFilter === 'platform') {
      return ['overview', 'banners', 'revenue', 'coupons', 'config', 'maintenance', 'rbac', 'audit', 'system_health'].includes(cat.id);
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Institutional Banner Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/40 border border-slate-800 p-6 md:p-8 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <Building className="w-3.5 h-3.5" />
              <span>Enterprise Educational Portal • 21 Unified Categories</span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
              Disha 20-20 Institutional Administration Console
            </h1>
            <p className="text-xs md:text-sm text-slate-300 leading-relaxed font-medium">
              Comprehensive institutional management platform governing all 21 academic, examination,
              student support, financial, and infrastructure operational modules.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            <div className="px-4 py-3 rounded-2xl bg-slate-950/60 border border-slate-800 text-center">
              <span className="block text-2xl font-black text-amber-400 font-mono">21</span>
              <span className="text-[10px] uppercase font-bold text-slate-400">Categories</span>
            </div>
            <div className="px-4 py-3 rounded-2xl bg-slate-950/60 border border-slate-800 text-center">
              <span className="block text-2xl font-black text-emerald-400 font-mono">100%</span>
              <span className="text-[10px] uppercase font-bold text-slate-400">Operational</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search all 21 categories (e.g. Question Bank, Objection Desk, RBAC)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setSelectedFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              selectedFilter === 'all'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            All 21 Categories
          </button>
          <button
            onClick={() => setSelectedFilter('academic')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              selectedFilter === 'academic'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Academic & Question Bank
          </button>
          <button
            onClick={() => setSelectedFilter('students')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              selectedFilter === 'students'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Students & Doubts
          </button>
          <button
            onClick={() => setSelectedFilter('platform')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              selectedFilter === 'platform'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Platform & Governance
          </button>
        </div>
      </div>

      {/* 21 Categories Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCategories.map((cat) => {
          const Icon = cat.icon;
          return (
            <div
              key={cat.id}
              onClick={() => {
                onSelectCategory(cat);
                onNavigateToGroup(cat.targetGroup);
              }}
              className="group cursor-pointer p-5 rounded-2xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/50 transition-all duration-200 flex flex-col justify-between shadow-lg hover:shadow-amber-500/10 hover:-translate-y-0.5"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-xl bg-slate-800 group-hover:bg-amber-500/15 group-hover:text-amber-400 text-slate-300 transition-colors border border-slate-700/60 group-hover:border-amber-500/30">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="font-mono text-xs font-bold text-slate-500 group-hover:text-amber-400">
                      #{cat.numericIndex.toString().padStart(2, '0')}
                    </span>
                  </div>

                  {cat.badge && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                      {cat.badge}
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                  {cat.title}
                </h3>
                <div className="text-[11px] font-semibold text-amber-500/80 mb-2">
                  {cat.hindiTitle}
                </div>
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  {cat.description}
                </p>
              </div>

              <div className="pt-4 mt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500 group-hover:text-amber-400 transition-colors">
                <span className="text-[11px] font-medium">Open Module</span>
                <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

import * as React from "react";

/**
 * Shimmer List Row Skeleton for Admin Tables & Lists
 */
export const ListRowSkeleton: React.FC<{ count?: number; className?: string }> = ({
  count = 4,
  className = "",
}) => {
  return (
    <div className={`divide-y divide-slate-100 dark:divide-slate-800 ${className}`}>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="flex items-center justify-between p-4 animate-pulse space-x-4 bg-white/50 dark:bg-slate-900/30"
        >
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            {/* Number/Avatar badge placeholder */}
            <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 shrink-0" />
            <div className="space-y-1.5 flex-1 min-w-0">
              {/* Primary title placeholder */}
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-2/5 max-w-[200px]" />
              {/* Subtitle / tag placeholder */}
              <div className="h-3 bg-slate-150 dark:bg-slate-800/60 rounded-md w-1/4 max-w-[120px]" />
            </div>
          </div>
          {/* Action icon placeholder */}
          <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-800 shrink-0" />
        </div>
      ))}
    </div>
  );
};

/**
 * Shimmer Grid Cards Skeleton for Users, Banners, and Articles
 */
export const CardGridSkeleton: React.FC<{ count?: number; cols?: 1 | 2 | 3 | 4 }> = ({
  count = 4,
  cols = 2,
}) => {
  const gridCols =
    cols === 1
      ? "grid-cols-1"
      : cols === 3
      ? "grid-cols-1 md:grid-cols-3"
      : cols === 4
      ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
      : "grid-cols-1 md:grid-cols-2";

  return (
    <div className={`grid ${gridCols} gap-4`}>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 shadow-xs animate-pulse space-y-4"
        >
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-800 shrink-0" />
            <div className="space-y-2 flex-1 min-w-0">
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-3/4" />
              <div className="h-3 bg-slate-150 dark:bg-slate-800/60 rounded-md w-1/2" />
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded-md w-16" />
            <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Shimmer Metrics Cards Skeleton for Admin Overview Dashboard
 */
export const StatMetricsSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="p-5 bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs animate-pulse space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-md w-24" />
            <div className="w-9 h-9 rounded-lg bg-slate-200 dark:bg-slate-800 shrink-0" />
          </div>
          <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-lg w-20" />
          <div className="h-2.5 bg-slate-150 dark:bg-slate-800/60 rounded-md w-32" />
        </div>
      ))}
    </div>
  );
};

/**
 * Shimmer Table Skeleton for Document Explorers and Data Grids
 */
export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 4,
}) => {
  return (
    <div className="w-full overflow-hidden border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 shadow-xs">
      <div className="bg-slate-100 dark:bg-slate-800/80 p-3.5 flex items-center gap-4 border-b border-slate-200 dark:border-slate-700">
        {Array.from({ length: cols }).map((_, cIdx) => (
          <div key={cIdx} className="h-3.5 bg-slate-300 dark:bg-slate-700 rounded-md flex-1" />
        ))}
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className="p-3.5 flex items-center gap-4 animate-pulse">
            {Array.from({ length: cols }).map((_, cIdx) => (
              <div
                key={cIdx}
                className="h-3 bg-slate-200 dark:bg-slate-800 rounded-md flex-1"
                style={{ width: `${60 + ((cIdx * 15) % 35)}%` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Universal Section Skeleton for lazy-loaded admin panels
 */
export const AdminSectionLoader: React.FC<{
  type?: "metrics" | "list" | "table" | "cards";
  title?: string;
}> = ({ type = "list", title }) => {
  return (
    <div className="space-y-4 animate-fade-in p-1">
      {title && (
        <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
      )}
      {type === "metrics" && <StatMetricsSkeleton count={4} />}
      {type === "cards" && <CardGridSkeleton count={4} cols={2} />}
      {type === "table" && <TableSkeleton rows={5} cols={4} />}
      {type === "list" && <ListRowSkeleton count={5} />}
    </div>
  );
};

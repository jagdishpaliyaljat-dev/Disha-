import * as React from "react";

/**
 * Premium Shimmer List Row Skeleton for Admin Tables & Lists
 * Infused with DISHA 20-20 luxury minimal color theory
 */
export const ListRowSkeleton: React.FC<{ count?: number; className?: string }> = ({
  count = 4,
  className = "",
}) => {
  return (
    <div className={`divide-y divide-[#E8D9C0]/50 dark:divide-[#252E42] ${className}`}>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="flex items-center justify-between p-4 animate-pulse space-x-4 bg-white/40 dark:bg-[#121724]/40"
        >
          <div className="flex items-center space-x-3.5 flex-1 min-w-0">
            {/* Number/Avatar badge placeholder */}
            <div className="w-9 h-9 rounded-xl bg-[#EDE7DE] dark:bg-[#1A2234] border border-[#E8D9C0]/60 dark:border-[#252E42] shrink-0" />
            <div className="space-y-2 flex-1 min-w-0">
              {/* Primary title placeholder */}
              <div className="h-3.5 bg-[#EDE7DE] dark:bg-[#1A2234] rounded-md w-2/5 max-w-[200px]" />
              {/* Subtitle / tag placeholder */}
              <div className="h-2.5 bg-[#EDE7DE]/70 dark:bg-[#1A2234]/60 rounded-md w-1/4 max-w-[120px]" />
            </div>
          </div>
          {/* Action icon placeholder */}
          <div className="w-8 h-8 rounded-xl bg-[#EDE7DE] dark:bg-[#1A2234] shrink-0" />
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
          className="bg-white dark:bg-[#121724] border border-[#E8D9C0] dark:border-[#252E42] rounded-2xl p-5 shadow-xs animate-pulse space-y-4"
        >
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#EDE7DE] dark:bg-[#1A2234] border border-[#C99A45]/20 shrink-0" />
            <div className="space-y-2 flex-1 min-w-0">
              <div className="h-4 bg-[#EDE7DE] dark:bg-[#1A2234] rounded-md w-3/4" />
              <div className="h-3 bg-[#EDE7DE]/70 dark:bg-[#1A2234]/60 rounded-md w-1/2" />
            </div>
          </div>
          <div className="pt-3 border-t border-[#E8D9C0]/60 dark:border-[#252E42] flex items-center justify-between">
            <div className="h-4 bg-[#EDE7DE] dark:bg-[#1A2234] rounded-md w-20" />
            <div className="w-5 h-5 rounded-full bg-[#EDE7DE] dark:bg-[#1A2234]" />
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
          className="p-5 bg-white dark:bg-[#121724] border border-[#E8D9C0] dark:border-[#252E42] rounded-2xl shadow-xs animate-pulse space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="h-3 bg-[#EDE7DE] dark:bg-[#1A2234] rounded-md w-24" />
            <div className="w-9 h-9 rounded-xl bg-[#EDE7DE] dark:bg-[#1A2234] border border-[#C99A45]/20 shrink-0" />
          </div>
          <div className="h-7 bg-[#EDE7DE] dark:bg-[#1A2234] rounded-lg w-20" />
          <div className="h-2.5 bg-[#EDE7DE]/70 dark:bg-[#1A2234]/60 rounded-md w-28" />
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
    <div className="w-full overflow-hidden border border-[#E8D9C0] dark:border-[#252E42] rounded-2xl bg-white dark:bg-[#121724] shadow-xs">
      <div className="bg-[#FAF7F2] dark:bg-[#161D2E] p-4 flex items-center gap-4 border-b border-[#E8D9C0] dark:border-[#252E42]">
        {Array.from({ length: cols }).map((_, cIdx) => (
          <div key={cIdx} className="h-3.5 bg-[#EDE7DE] dark:bg-[#20293D] rounded-md flex-1" />
        ))}
      </div>
      <div className="divide-y divide-[#E8D9C0]/50 dark:divide-[#252E42]">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className="p-4 flex items-center gap-4 animate-pulse">
            {Array.from({ length: cols }).map((_, cIdx) => (
              <div
                key={cIdx}
                className="h-3 bg-[#EDE7DE] dark:bg-[#1A2234] rounded-md flex-1"
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
        <div className="h-6 w-48 bg-[#EDE7DE] dark:bg-[#1A2234] rounded-xl animate-pulse" />
      )}
      {type === "metrics" && <StatMetricsSkeleton count={4} />}
      {type === "cards" && <CardGridSkeleton count={4} cols={2} />}
      {type === "table" && <TableSkeleton rows={5} cols={4} />}
      {type === "list" && <ListRowSkeleton count={5} />}
    </div>
  );
};

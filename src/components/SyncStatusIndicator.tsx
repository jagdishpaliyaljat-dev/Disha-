import React from "react";

interface SyncStatusIndicatorProps {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  isAdmin?: boolean;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = () => {
  return null;
};


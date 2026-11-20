import React, { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

export type FeatureKey =
  | "disha_ai"
  | "live_battle"
  | "live_tests"
  | "pyq_vault"
  | "custom_test"
  | "news_articles"
  | "omr_scanner"
  | "pdf_export"
  | "guest_mode";

export type FeatureCategory = "ai" | "battle" | "exam" | "practice" | "general";

export interface AppFeatureItem {
  key: FeatureKey;
  name: string;
  hindiName: string;
  description: string;
  category: FeatureCategory;
  enabled: boolean;
  maintenanceMessage?: string;
  iconName?: string;
}

export const DEFAULT_APP_FEATURES: Record<FeatureKey, AppFeatureItem> = {
  disha_ai: {
    key: "disha_ai",
    name: "Disha AI Companion",
    hindiName: "Disha AI Companion & Doubt Solver",
    description: "Floating AI button, voice chatbot and explanation generator",
    category: "ai",
    enabled: true,
    iconName: "Sparkles",
  },
  live_battle: {
    key: "live_battle",
    name: "1v1 Quiz Battle",
    hindiName: "1v1 Live Quiz Battle",
    description: "Real-time multiplayer quiz battles with peers",
    category: "battle",
    enabled: true,
    iconName: "Swords",
  },
  live_tests: {
    key: "live_tests",
    name: "Live Mock Tests",
    hindiName: "Live Mock Tests & All-Rajasthan Rank",
    description: "Scheduled live mock tests and state-level rank list",
    category: "exam",
    enabled: true,
    iconName: "Trophy",
  },
  pyq_vault: {
    key: "pyq_vault",
    name: "PYQ Vault",
    hindiName: "Previous Year Question Papers",
    description: "Official previous year examination papers",
    category: "practice",
    enabled: true,
    iconName: "FileText",
  },
  custom_test: {
    key: "custom_test",
    name: "20-20 Custom Test Builder",
    hindiName: "20-20 Smart Custom Test",
    description: "Create custom tests by choosing subjects and question count",
    category: "practice",
    enabled: true,
    iconName: "Compass",
  },
  news_articles: {
    key: "news_articles",
    name: "Exam News & Current Affairs",
    hindiName: "Exam News & Official Circulars",
    description: "Latest exam notifications, announcements, and current affairs",
    category: "general",
    enabled: true,
    iconName: "Newspaper",
  },
  omr_scanner: {
    key: "omr_scanner",
    name: "Paper & OMR Scanner",
    hindiName: "Paper & OMR Scanner",
    description: "Camera and gallery question paper and OMR sheet scanning",
    category: "ai",
    enabled: true,
    iconName: "Scan",
  },
  pdf_export: {
    key: "pdf_export",
    name: "PDF Download & Export",
    hindiName: "PDF Download & Export",
    description: "Print-friendly PDF downloads of question banks and tests",
    category: "general",
    enabled: true,
    iconName: "Download",
  },
  guest_mode: {
    key: "guest_mode",
    name: "Guest Practice Mode",
    hindiName: "Guest Practice Mode",
    description: "Allow instant practice without logging in",
    category: "general",
    enabled: true,
    iconName: "UserCheck",
  },
};

const FEATURE_FLAGS_STORAGE_KEY = "disha_app_feature_flags_v1";
const REALTIME_CHANNEL_NAME = "app_features_channel";

// In-memory cache for ultra-fast sync
let inMemoryFeatures: Record<FeatureKey, AppFeatureItem> = { ...DEFAULT_APP_FEATURES };

/**
 * Get synchronously from local storage or memory cache (0ms latency)
 */
export function getLocalAppFeatures(): Record<FeatureKey, AppFeatureItem> {
  if (typeof window === "undefined") return { ...DEFAULT_APP_FEATURES };

  try {
    const raw = localStorage.getItem(FEATURE_FLAGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Merge with defaults in case new keys were added
      const merged: Record<FeatureKey, AppFeatureItem> = { ...DEFAULT_APP_FEATURES };
      for (const k of Object.keys(DEFAULT_APP_FEATURES) as FeatureKey[]) {
        if (parsed[k]) {
          merged[k] = { ...DEFAULT_APP_FEATURES[k], ...parsed[k] };
        }
      }
      inMemoryFeatures = merged;
      return merged;
    }
  } catch (err) {
    console.warn("[featureControl] Failed to read from localStorage:", err);
  }

  return { ...inMemoryFeatures };
}

/**
 * Check if a specific feature is currently enabled
 */
export function isAppFeatureEnabled(key: FeatureKey): boolean {
  const current = getLocalAppFeatures();
  return current[key] ? current[key].enabled : true;
}

/**
 * Save features locally and dispatch custom event
 */
function saveFeaturesLocally(features: Record<FeatureKey, AppFeatureItem>): void {
  inMemoryFeatures = { ...features };
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(FEATURE_FLAGS_STORAGE_KEY, JSON.stringify(features));
      window.dispatchEvent(new CustomEvent("disha_features_updated", { detail: features }));
    } catch (err) {
      console.warn("[featureControl] Failed to save to localStorage:", err);
    }
  }
}

/**
 * Fetch latest features from Supabase app_settings table
 */
export async function fetchAppFeaturesFromCloud(): Promise<Record<FeatureKey, AppFeatureItem>> {
  if (!isSupabaseConfigured()) {
    return getLocalAppFeatures();
  }

  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "feature_flags")
      .maybeSingle();

    if (error) {
      console.warn("[featureControl] Cloud fetch warning:", error.message);
      return getLocalAppFeatures();
    }

    if (data && data.value && typeof data.value === "object") {
      const cloudValues = data.value as Record<string, Partial<AppFeatureItem>>;
      const merged: Record<FeatureKey, AppFeatureItem> = { ...DEFAULT_APP_FEATURES };

      for (const k of Object.keys(DEFAULT_APP_FEATURES) as FeatureKey[]) {
        if (cloudValues[k]) {
          merged[k] = {
            ...DEFAULT_APP_FEATURES[k],
            ...cloudValues[k],
          };
        }
      }

      saveFeaturesLocally(merged);
      return merged;
    }
  } catch (err) {
    console.warn("[featureControl] Cloud fetch exception:", err);
  }

  return getLocalAppFeatures();
}

/**
 * Save/Update features in Cloud (Supabase) + LocalStorage + Realtime Broadcast
 */
export async function saveAppFeaturesToCloud(
  updatedFeatures: Record<FeatureKey, AppFeatureItem>,
  adminEmail: string = "admin"
): Promise<{ success: boolean; error?: string }> {
  // 1. Immediately update locally so UI responds with zero lag
  saveFeaturesLocally(updatedFeatures);

  // 2. Persist to Supabase app_settings table
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert(
          {
            key: "feature_flags",
            value: updatedFeatures,
            description: "Application feature toggles and access control",
            updated_at: new Date().toISOString(),
            updated_by: adminEmail,
          },
          { onConflict: "key" }
        );

      if (error) {
        console.error("[featureControl] Supabase upsert error:", error);
        return { success: false, error: error.message };
      }

      // 3. Broadcast update to all live client instances via Realtime
      try {
        const channel = supabase.channel(REALTIME_CHANNEL_NAME);
        await channel.send({
          type: "broadcast",
          event: "features_changed",
          payload: { features: updatedFeatures, timestamp: Date.now() },
        });
      } catch (broadcastErr) {
        console.warn("[featureControl] Realtime broadcast non-fatal err:", broadcastErr);
      }

      return { success: true };
    } catch (err: any) {
      console.error("[featureControl] Cloud save exception:", err);
      return { success: false, error: err?.message || "Failed to update cloud settings" };
    }
  }

  return { success: true };
}

/**
 * Toggle a single feature and sync
 */
export async function toggleSingleFeature(
  key: FeatureKey,
  enabled: boolean,
  adminEmail: string = "admin",
  maintenanceMessage?: string
): Promise<boolean> {
  const current = getLocalAppFeatures();
  if (!current[key]) return false;

  const updated: Record<FeatureKey, AppFeatureItem> = {
    ...current,
    [key]: {
      ...current[key],
      enabled,
      ...(maintenanceMessage !== undefined ? { maintenanceMessage } : {}),
    },
  };

  const res = await saveAppFeaturesToCloud(updated, adminEmail);
  return res.success;
}

/**
 * Setup Realtime Subscription to listen for Admin changes
 */
export function subscribeToAppFeatureUpdates(
  onUpdate: (features: Record<FeatureKey, AppFeatureItem>) => void
): () => void {
  // 1. Listen for local events across browser tabs/components
  const handleLocalEvent = (e: Event) => {
    const custom = e as CustomEvent<Record<FeatureKey, AppFeatureItem>>;
    if (custom.detail) {
      onUpdate(custom.detail);
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("disha_features_updated", handleLocalEvent);
  }

  // 2. Realtime listener from Supabase
  let channel: any = null;
  if (isSupabaseConfigured()) {
    try {
      channel = supabase
        .channel(REALTIME_CHANNEL_NAME)
        .on("broadcast", { event: "features_changed" }, (payload: any) => {
          if (payload?.payload?.features) {
            saveFeaturesLocally(payload.payload.features);
            onUpdate(payload.payload.features);
          }
        })
        .subscribe();
    } catch (err) {
      console.warn("[featureControl] Realtime subscription failed:", err);
    }
  }

  return () => {
    if (typeof window !== "undefined") {
      window.removeEventListener("disha_features_updated", handleLocalEvent);
    }
    if (channel) {
      try {
        supabase.removeChannel(channel);
      } catch {}
    }
  };
}

/**
 * React Hook for User App & Admin to consume and control features dynamically
 */
export function useAppFeatures() {
  const [features, setFeatures] = useState<Record<FeatureKey, AppFeatureItem>>(() => getLocalAppFeatures());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Initial fetch from cloud
    setIsLoading(true);
    fetchAppFeaturesFromCloud().then((cloud) => {
      setFeatures(cloud);
      setIsLoading(false);
    });

    // Real-time listener
    const unsubscribe = subscribeToAppFeatureUpdates((updated) => {
      setFeatures(updated);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const isEnabled = useCallback(
    (key: FeatureKey): boolean => {
      return features[key] ? features[key].enabled : true;
    },
    [features]
  );

  const toggle = useCallback(
    async (key: FeatureKey, enabled: boolean, adminEmail?: string, message?: string) => {
      // Optimistic local update
      setFeatures((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          enabled,
          ...(message !== undefined ? { maintenanceMessage: message } : {}),
        },
      }));

      return await toggleSingleFeature(key, enabled, adminEmail, message);
    },
    []
  );

  return {
    features,
    isEnabled,
    toggle,
    isLoading,
    refresh: fetchAppFeaturesFromCloud,
  };
}


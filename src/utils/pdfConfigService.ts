import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

export type PDFAccessTier = "free_all" | "login_required" | "vip_only";

export interface AdminPDFConfig {
  enabled: boolean;
  disabledMessage: string;
  accessTier: PDFAccessTier;
  maxQuestionsFree: number; // 0 = unlimited
  dailyQuotaFree: number;   // 0 = unlimited
  allowPrint: boolean;
  allowJsonExport: boolean;
  allowedFormats: {
    question_paper: boolean;
    question_paper_omr: boolean;
    answer_key: boolean;
    detailed_solutions: boolean;
  };
  brandTitle: string;
  watermarkText: string;
  forceBranding: boolean;
  defaultColorMode: "color" | "bw";
  updatedAt: string;
  updatedBy: string;
}

const PDF_CONFIG_STORAGE_KEY = "disha_admin_pdf_config_v1";
const PDF_DAILY_COUNT_KEY = "disha_pdf_daily_usage_v1";

export const DEFAULT_PDF_CONFIG: AdminPDFConfig = {
  enabled: true,
  disabledMessage: "PDF Downloads are temporarily paused by Admin for maintenance.",
  accessTier: "free_all",
  maxQuestionsFree: 0, // 0 = unlimited by default
  dailyQuotaFree: 0,   // 0 = unlimited by default
  allowPrint: true,
  allowJsonExport: false,
  allowedFormats: {
    question_paper: true,
    question_paper_omr: true,
    answer_key: true,
    detailed_solutions: true,
  },
  brandTitle: "Disha PYQ — Rajasthan Exam Prep",
  watermarkText: "Downloaded from Disha PYQ App",
  forceBranding: true,
  defaultColorMode: "color",
  updatedAt: new Date().toISOString(),
  updatedBy: "system",
};

export function loadLocalPDFConfig(): AdminPDFConfig {
  try {
    if (typeof localStorage === "undefined") return DEFAULT_PDF_CONFIG;
    const raw = localStorage.getItem(PDF_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_PDF_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PDF_CONFIG,
      ...parsed,
      allowedFormats: {
        ...DEFAULT_PDF_CONFIG.allowedFormats,
        ...(parsed.allowedFormats || {}),
      },
    };
  } catch {
    return DEFAULT_PDF_CONFIG;
  }
}

export function saveLocalPDFConfig(config: AdminPDFConfig): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(PDF_CONFIG_STORAGE_KEY, JSON.stringify(config));
      window.dispatchEvent(new CustomEvent("disha_pdf_config_updated", { detail: config }));
    }
  } catch {}
}

export async function fetchPDFConfigFromCloud(): Promise<AdminPDFConfig> {
  const local = loadLocalPDFConfig();
  if (!isSupabaseConfigured()) return local;
  try {
    const { data, error } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "pdf_export_config")
      .maybeSingle();

    if (!error && data?.value) {
      const merged: AdminPDFConfig = {
        ...DEFAULT_PDF_CONFIG,
        ...data.value,
        allowedFormats: {
          ...DEFAULT_PDF_CONFIG.allowedFormats,
          ...(data.value.allowedFormats || {}),
        },
      };
      saveLocalPDFConfig(merged);
      return merged;
    }
  } catch {}
  return local;
}

export async function savePDFConfigToCloud(
  config: AdminPDFConfig,
  adminEmail = "admin"
): Promise<{ success: boolean; error?: string }> {
  const payload: AdminPDFConfig = {
    ...config,
    updatedAt: new Date().toISOString(),
    updatedBy: adminEmail,
  };
  saveLocalPDFConfig(payload);

  if (!isSupabaseConfigured()) {
    return { success: true };
  }

  try {
    const { error } = await supabase.from("app_config").upsert(
      {
        key: "pdf_export_config",
        value: payload,
        updated_at: payload.updatedAt,
      },
      { onConflict: "key" }
    );
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to sync PDF config" };
  }
}

export function getTodayPDFDownloadCount(): number {
  try {
    if (typeof localStorage === "undefined") return 0;
    const today = new Date().toISOString().slice(0, 10);
    const raw = localStorage.getItem(PDF_DAILY_COUNT_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return parsed.date === today ? Number(parsed.count) || 0 : 0;
  } catch {
    return 0;
  }
}

export function incrementTodayPDFDownloadCount(): number {
  try {
    if (typeof localStorage === "undefined") return 0;
    const today = new Date().toISOString().slice(0, 10);
    const next = getTodayPDFDownloadCount() + 1;
    localStorage.setItem(PDF_DAILY_COUNT_KEY, JSON.stringify({ date: today, count: next }));
    return next;
  } catch {
    return 0;
  }
}

export function usePdfConfig() {
  const [config, setConfig] = useState<AdminPDFConfig>(() => loadLocalPDFConfig());
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const latest = await fetchPDFConfigFromCloud();
    setConfig(latest);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const handler = (e: Event) => {
      const custom = e as CustomEvent<AdminPDFConfig>;
      if (custom.detail) setConfig(custom.detail);
    };
    window.addEventListener("disha_pdf_config_updated", handler);
    return () => window.removeEventListener("disha_pdf_config_updated", handler);
  }, [refresh]);

  return { config, setConfig, refresh, isLoading };
}

import { UserProfile } from "../types";

/**
 * QuizPro Feature Access Control Service
 * Simplified to always allow access after removing subscription logic.
 */


export type FeatureModuleKey = 
  | "curriculum" 
  | "mcq_practice" 
  | "tests" 
  | "pyq_vault" 
  | "revision" 
  | "ai_tools" 
  | "articles" 
  | "exports" 
  | "general";

export type LimitPeriod = "hourly" | "daily" | "weekly" | "monthly" | "lifetime";

export interface FeatureAccessCheckResult {
  allowed: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
  period: string;
  message?: string;
}

export interface FeatureAccessRule {
  key: string;
  name: string;
  hindiName?: string;
  description: string;
  module: FeatureModuleKey;
  globalEnabled: boolean;
}

export interface ContentAccessOverride {
  overrideId: string;
  contentType: "subject" | "chapter" | "topic" | "article" | "test";
  contentId: string;
  contentName: string;
  isDisabled: boolean;
  createdAt: string;
}

export interface FeatureAccessConfig {
  features: Record<string, FeatureAccessRule>;
  contentOverrides: Record<string, ContentAccessOverride>;
  updatedAt: string;
  updatedBy: string;
}

export const DEFAULT_FEATURE_RULES: Record<string, FeatureAccessRule> = {
  ai_scanner: {
    key: "ai_scanner",
    name: "AI Question Scanner",
    description: "Scan exam papers and extract questions using Gemini AI",
    module: "ai_tools",
    globalEnabled: true
  },
  ai_explanation: {
    key: "ai_explanation",
    name: "AI Explanations",
    description: "Generate instant explanations for any question",
    module: "ai_tools",
    globalEnabled: true
  },
  pdf_export: {
    key: "pdf_export",
    name: "PDF Downloads",
    description: "Export question banks and tests as PDF",
    module: "exports",
    globalEnabled: true
  }
};

export const DEFAULT_FEATURE_CONFIG: FeatureAccessConfig = {
  features: DEFAULT_FEATURE_RULES,
  contentOverrides: {},
  updatedAt: new Date().toISOString(),
  updatedBy: "system"
};

/**
 * Always returns allowed: true for all features.
 */
export async function checkFeatureAccess(
  _featureKey: string,
  _userProfile?: UserProfile | null,
  _contentId?: string
): Promise<{ allowed: boolean; limit: number | null; used: number; remaining: number | null; period: string }> {
  return {
    allowed: true,
    limit: null,
    used: 0,
    remaining: null,
    period: "lifetime"
  };
}

export async function consumeFeatureUsage(
  _featureKey: string,
  _userProfile?: UserProfile | null,
  _amount: number = 1
): Promise<boolean> {
  return true;
}

export async function getFeatureAccessConfig(): Promise<FeatureAccessConfig> {
  return DEFAULT_FEATURE_CONFIG;
}

export async function saveFeatureAccessConfig(config: FeatureAccessConfig, _adminEmail: string): Promise<boolean> {
  console.log("Saving mock config:", config);
  return true;
}

export async function resetFeatureAccessToDefaults(_adminEmail: string): Promise<FeatureAccessConfig> {
  return DEFAULT_FEATURE_CONFIG;
}

export type ContentTypeOverride = "subject" | "chapter" | "topic" | "article" | "test";

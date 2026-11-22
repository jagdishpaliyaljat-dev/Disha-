import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { UserProfile } from "../../types";

export interface AdminPremiumPlan {
  id: "monthly" | "yearly" | "lifetime";
  name: string;
  hindiName: string;
  amount: number;
  originalAmount: number;
  duration: string;
  tag?: string;
  isPopular?: boolean;
  enabled: boolean;
  features: string[];
}

export type PaywallMode = "free" | "vip_only" | "limited_free";

export interface PaywallRuleItem {
  key: string;
  title: string;
  mode?: PaywallMode;
  freeDailyLimit?: number;
  freeDemoTestsCount?: number;
  isVipOnly?: boolean;
  description: string;
}

export interface PaywallRules {
  ai_tutor: PaywallRuleItem & { mode: PaywallMode; freeDailyLimit: number };
  mock_tests: PaywallRuleItem & { mode: PaywallMode; freeDemoTestsCount: number };
  state_merit_rank: PaywallRuleItem & { isVipOnly: boolean };
  detailed_explanations: PaywallRuleItem & { isVipOnly: boolean };
  mistake_bank: PaywallRuleItem & { isVipOnly: boolean };
  live_battle: PaywallRuleItem & { isVipOnly: boolean };
  pdf_export: PaywallRuleItem & { isVipOnly: boolean };
  ad_free: PaywallRuleItem & { isVipOnly: boolean };
  [key: string]: any;
}

export const DEFAULT_PREMIUM_PLANS: AdminPremiumPlan[] = [
  {
    id: "monthly",
    name: "1 Month Pass",
    hindiName: "1 माह पास",
    amount: 49,
    originalAmount: 99,
    duration: "30 दिन",
    tag: "स्टार्टर",
    enabled: true,
    features: [
      "सभी RPSC & RSMSSB Mock Tests अनलॉक",
      "Disha AI Tutor अनलिमिटेड 24/7 उपयोग",
      "असीमित PYQ Vault और टॉपिक वाइज़ प्रैक्टिस",
      "1v1 लाइव बैटल मोड असीमित खेलें",
    ],
  },
  {
    id: "yearly",
    name: "1 Year Super Pass",
    hindiName: "1 वर्ष सुपर पास",
    amount: 149,
    originalAmount: 499,
    duration: "365 दिन (1 साल)",
    tag: "🔥 सबसे लोकप्रिय",
    isPopular: true,
    enabled: true,
    features: [
      "पूरे 1 साल के लिए सभी Mock Tests & पेपर्स",
      "राज्य-स्तरीय मेरिट रैंकिंग और विस्तृत विश्लेषण",
      "Disha AI Tutor द्वारा कठिन प्रश्नों का तुरंत हल",
      "सभी नए टेस्ट पेपर्स तुरंत मुफ्त अपडेट",
      "ऑफ़लाइन टेस्ट डाउनलोड और पूर्ण विज्ञापन-मुक्त",
    ],
  },
  {
    id: "lifetime",
    name: "Lifetime VIP Pass",
    hindiName: "लाइफटाइम VIP पास",
    amount: 249,
    originalAmount: 999,
    duration: "आजीवन (Lifetime)",
    tag: "💎 बेस्ट वैल्यू",
    enabled: true,
    features: [
      "आजीवन सभी आगामी परीक्षाओं के पेपर्स अनलॉक",
      "भविष्य में आने वाले सभी नए फ़ीचर्स हमेशा मुफ़्त",
      "गोल्डन VIP प्रोफाइल बैज और प्राथमिकता सहायता",
      "असीमित लाइव टेस्ट सीरीज़ व लीडरबोर्ड एक्सेस",
      "एक बार भुगतान — कभी दोबारा रिन्यूअल नहीं",
    ],
  },
];

export const DEFAULT_PAYWALL_RULES: PaywallRules = {
  ai_tutor: {
    key: "ai_tutor",
    title: "Disha AI Tutor (24x7 डाउट सॉल्वर)",
    mode: "limited_free",
    freeDailyLimit: 3,
    description: "कठिन प्रश्नों का तत्काल समाधान व व्याख्या जनरेटर",
  },
  mock_tests: {
    key: "mock_tests",
    title: "RPSC व RSMSSB Mock Tests & Live Series",
    mode: "limited_free",
    freeDemoTestsCount: 1,
    description: "आगामी परीक्षाओं के पूर्ण अभ्यास टेस्ट पेपर्स",
  },
  state_merit_rank: {
    key: "state_merit_rank",
    title: "All-Rajasthan Live Merit Ranking",
    isVipOnly: true,
    description: "सैकड़ों अभ्यर्थियों के बीच राज्यस्तरीय रैंक और परसेंटाइल",
  },
  detailed_explanations: {
    key: "detailed_explanations",
    title: "विस्तृत उत्तर व्याख्या व शॉर्ट ट्रिक्स",
    isVipOnly: false,
    description: "प्रत्येक प्रश्न की मानक पुस्तकों से प्रामाणिक व्याख्या",
  },
  mistake_bank: {
    key: "mistake_bank",
    title: "मिस्टेक बैंक (गलत प्रश्नों का ऑटो-रिवीज़न)",
    isVipOnly: true,
    description: "टेस्ट में गलत हुए प्रश्नों का स्मार्ट रिवीज़न वॉल्ट",
  },
  live_battle: {
    key: "live_battle",
    title: "1v1 लाइव क्विज़ मुकाबला",
    isVipOnly: false,
    description: "सहपाठियों के साथ रियल-टाइम क्विज़ बैटल रूम",
  },
  pdf_export: {
    key: "pdf_export",
    title: "PDF टेस्ट पेपर डाउनलोड व एक्सपोर्ट",
    isVipOnly: true,
    description: "प्रिंट-योग्य ऑफ़लाइन पीडीएफ टेस्ट पेपर्स",
  },
  ad_free: {
    key: "ad_free",
    title: "100% विज्ञापन-मुक्त अनुभव",
    isVipOnly: true,
    description: "बिना किसी रुकावट या विज्ञापन के निर्बाध अध्ययन",
  },
};

const STORAGE_KEY_PLANS = "disha_premium_plans_config_v1";
const STORAGE_KEY_PAYWALL = "disha_paywall_rules_config_v1";

let inMemoryPlans: AdminPremiumPlan[] = [...DEFAULT_PREMIUM_PLANS];
let inMemoryPaywallRules: PaywallRules = { ...DEFAULT_PAYWALL_RULES };

/**
 * Get synchronously cached plans
 */
export function getLocalPremiumPlans(): AdminPremiumPlan[] {
  if (typeof window === "undefined") return DEFAULT_PREMIUM_PLANS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PLANS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        inMemoryPlans = parsed;
        return parsed;
      }
    }
  } catch (e) {
    console.warn("[premiumConfig] Failed to read plans from storage:", e);
  }
  return inMemoryPlans;
}

/**
 * Get active plans enabled for users
 */
export function getActivePremiumPlans(): AdminPremiumPlan[] {
  const plans = getLocalPremiumPlans();
  return plans.filter((p) => p.enabled !== false);
}

/**
 * Get synchronously cached paywall rules
 */
export function getLocalPaywallRules(): PaywallRules {
  if (typeof window === "undefined") return DEFAULT_PAYWALL_RULES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PAYWALL);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const merged = { ...DEFAULT_PAYWALL_RULES, ...parsed };
        inMemoryPaywallRules = merged;
        return merged;
      }
    }
  } catch (e) {
    console.warn("[premiumConfig] Failed to read paywall rules from storage:", e);
  }
  return inMemoryPaywallRules;
}

/**
 * Check if a specific feature is restricted by paywall for this user
 */
export function isFeatureVipLocked(
  featureKey: keyof PaywallRules | string,
  userProfile?: UserProfile | null,
  context?: { dailyAttemptsCount?: number; testIndex?: number }
): boolean {
  // If user has active VIP pass, NEVER lock anything
  if (userProfile?.isPremium) {
    return false;
  }

  const rules = getLocalPaywallRules();
  const rule = (rules as any)[featureKey];
  if (!rule) return false;

  // 1. AI Tutor specific checks
  if (featureKey === "ai_tutor") {
    if (rule.mode === "free") return false;
    if (rule.mode === "vip_only") return true;
    if (rule.mode === "limited_free") {
      const count = context?.dailyAttemptsCount || 0;
      const limit = rule.freeDailyLimit ?? 3;
      return count >= limit;
    }
  }

  // 2. Mock Tests specific checks
  if (featureKey === "mock_tests") {
    if (rule.mode === "free") return false;
    if (rule.mode === "vip_only") return true;
    if (rule.mode === "limited_free") {
      const index = context?.testIndex ?? 0;
      const allowed = rule.freeDemoTestsCount ?? 1;
      return index >= allowed;
    }
  }

  // 3. Boolean flags
  if (typeof rule.isVipOnly === "boolean") {
    return rule.isVipOnly;
  }

  return false;
}

/**
 * Fetch latest plans and paywall rules from Supabase Cloud
 */
export async function fetchPremiumConfigFromCloud(): Promise<{
  plans: AdminPremiumPlan[];
  paywallRules: PaywallRules;
}> {
  if (!isSupabaseConfigured()) {
    return {
      plans: getLocalPremiumPlans(),
      paywallRules: getLocalPaywallRules(),
    };
  }

  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["premium_plans_config", "paywall_rules"]);

    if (error) {
      console.warn("[premiumConfig] Failed to fetch settings:", error.message);
      return {
        plans: getLocalPremiumPlans(),
        paywallRules: getLocalPaywallRules(),
      };
    }

    let loadedPlans = inMemoryPlans;
    let loadedRules = inMemoryPaywallRules;

    for (const row of data || []) {
      if (row.key === "premium_plans_config" && Array.isArray(row.value)) {
        loadedPlans = row.value;
        inMemoryPlans = loadedPlans;
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY_PLANS, JSON.stringify(loadedPlans));
        }
      }
      if (row.key === "paywall_rules" && row.value && typeof row.value === "object") {
        loadedRules = { ...DEFAULT_PAYWALL_RULES, ...row.value };
        inMemoryPaywallRules = loadedRules;
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY_PAYWALL, JSON.stringify(loadedRules));
        }
      }
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("disha_premium_config_updated", {
          detail: { plans: loadedPlans, paywallRules: loadedRules },
        })
      );
    }

    return { plans: loadedPlans, paywallRules: loadedRules };
  } catch (err) {
    console.warn("[premiumConfig] Fetch error:", err);
    return {
      plans: getLocalPremiumPlans(),
      paywallRules: getLocalPaywallRules(),
    };
  }
}

/**
 * Admin: Save Premium Plans Configuration to Supabase Cloud
 */
export async function savePremiumPlansToCloud(
  plans: AdminPremiumPlan[],
  adminEmail: string = "admin"
): Promise<{ success: boolean; error?: string }> {
  try {
    inMemoryPlans = [...plans];
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_PLANS, JSON.stringify(plans));
      window.dispatchEvent(
        new CustomEvent("disha_premium_config_updated", {
          detail: { plans, paywallRules: inMemoryPaywallRules },
        })
      );
    }

    if (!isSupabaseConfigured()) {
      return { success: true };
    }

    const { error } = await supabase
      .from("app_settings")
      .upsert({
        key: "premium_plans_config",
        value: plans,
        description: "Configurable VIP pricing tiers and features list",
        updated_at: new Date().toISOString(),
        updated_by: adminEmail,
      }, { onConflict: "key" });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to save plans" };
  }
}

/**
 * Admin: Save Paywall Rules to Supabase Cloud
 */
export async function savePaywallRulesToCloud(
  rules: PaywallRules,
  adminEmail: string = "admin"
): Promise<{ success: boolean; error?: string }> {
  try {
    inMemoryPaywallRules = { ...rules };
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_PAYWALL, JSON.stringify(rules));
      window.dispatchEvent(
        new CustomEvent("disha_premium_config_updated", {
          detail: { plans: inMemoryPlans, paywallRules: rules },
        })
      );
    }

    if (!isSupabaseConfigured()) {
      return { success: true };
    }

    const { error } = await supabase
      .from("app_settings")
      .upsert({
        key: "paywall_rules",
        value: rules,
        description: "Configurable paywall rules controlling which features require VIP pass",
        updated_at: new Date().toISOString(),
        updated_by: adminEmail,
      }, { onConflict: "key" });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to save paywall rules" };
  }
}

// Auto-fetch on module load in browser
if (typeof window !== "undefined") {
  setTimeout(() => {
    fetchPremiumConfigFromCloud().catch(() => {});
  }, 100);
}

import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { guardedGetDoc, guardedSetDoc } from "./quotaTracker";
import { UserProfile } from "../types";
import { isUserAdmin } from "./userProfileStorage";

export interface MonetagZoneConfig {
  enabled: boolean;
  zoneId: string;
  scriptUrl: string;
}

export interface MonetagAdsConfig {
  masterEnabled: boolean;
  monetagEnabled: boolean;
  zones: {
    zone1: MonetagZoneConfig; // In-Page Push: 12139283
    zone2: MonetagZoneConfig; // Vignette: 12139338
  };
  userTypes: {
    free: boolean;
    guest: boolean;
  };
  pages: {
    home: boolean;
    subject: boolean;
    chapter: boolean;
    topic: boolean;
    mcqPractice: boolean;
    pyqTest: boolean;
    liveTest: boolean;
    mockTest: boolean;
    result: boolean;
    articles: boolean;
    profile: boolean;
  };
  frequency?: {
    cooldownMinutes?: number;
    allowAfterSubmission?: boolean;
    allowAfterResult?: boolean;
  };
  lastUpdated?: string;
  updatedBy?: string;
}

export const DEFAULT_MONETAG_CONFIG: MonetagAdsConfig = {
  masterEnabled: false,
  monetagEnabled: false,
  zones: {
    zone1: {
      enabled: false,
      zoneId: "12139283",
      scriptUrl: "",
    },
    zone2: {
      enabled: false,
      zoneId: "12139338",
      scriptUrl: "",
    },
  },
  userTypes: {
    free: false,
    guest: false,
  },
  pages: {
    home: false,
    subject: false,
    chapter: false,
    topic: false,
    mcqPractice: false,
    pyqTest: false,
    liveTest: false,
    mockTest: false,
    result: false,
    articles: false,
    profile: false,
  },
  frequency: {
    cooldownMinutes: 9999,
    allowAfterSubmission: false,
    allowAfterResult: false,
  },
};

const STORAGE_KEY = "quizpro_monetag_ads_config_v1";

export function getCachedMonetagConfig(): MonetagAdsConfig {
  if (typeof window === "undefined") return DEFAULT_MONETAG_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { 
        ...DEFAULT_MONETAG_CONFIG, 
        ...parsed, 
        masterEnabled: false, 
        monetagEnabled: false,
        zones: { 
          zone1: { ...DEFAULT_MONETAG_CONFIG.zones.zone1, enabled: false, scriptUrl: "" },
          zone2: { ...DEFAULT_MONETAG_CONFIG.zones.zone2, enabled: false, scriptUrl: "" }
        }
      };
    }
  } catch (e) {
    console.warn("Failed to load cached Monetag config:", e);
  }
  return DEFAULT_MONETAG_CONFIG;
}

export function saveCachedMonetagConfig(config: MonetagAdsConfig) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn("Failed to save cached Monetag config:", e);
  }
}

export async function fetchMonetagConfigFromCloud(): Promise<MonetagAdsConfig> {
  try {
    const docRef = doc(db, "settings", "monetagAds");
    const snap = await guardedGetDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as Partial<MonetagAdsConfig>;
      const merged: MonetagAdsConfig = {
        ...DEFAULT_MONETAG_CONFIG,
        ...data,
        zones: {
          zone1: { ...DEFAULT_MONETAG_CONFIG.zones.zone1, ...(data.zones?.zone1 || {}) },
          zone2: { ...DEFAULT_MONETAG_CONFIG.zones.zone2, ...(data.zones?.zone2 || {}) },
        },
        userTypes: { ...DEFAULT_MONETAG_CONFIG.userTypes, ...(data.userTypes || {}) },
        pages: { ...DEFAULT_MONETAG_CONFIG.pages, ...(data.pages || {}) },
        frequency: { ...DEFAULT_MONETAG_CONFIG.frequency, ...(data.frequency || {}) },
      };
      saveCachedMonetagConfig(merged);
      return merged;
    }
  } catch (e) {
    console.warn("Could not fetch Monetag config from cloud, using cache:", e);
  }
  return getCachedMonetagConfig();
}

export async function saveMonetagConfigToCloud(config: MonetagAdsConfig): Promise<{ success: boolean; message: string }> {
  try {
    const payload = {
      ...config,
      lastUpdated: new Date().toISOString(),
    };
    const docRef = doc(db, "settings", "monetagAds");
    await guardedSetDoc(docRef, payload, { merge: true });
    saveCachedMonetagConfig(payload);
    return { success: true, message: "Monetag ads configuration saved successfully!" };
  } catch (err: any) {
    console.error("Failed to save Monetag config to cloud:", err);
    saveCachedMonetagConfig(config); // Save locally as fallback
    return { success: false, message: `Cloud save failed: ${err.message || 'Unknown error'}. Saved locally.` };
  }
}

export function subscribeToMonetagConfig(onChange: (config: MonetagAdsConfig) => void) {
  try {
    const docRef = doc(db, "settings", "monetagAds");
    return onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<MonetagAdsConfig>;
        const merged: MonetagAdsConfig = {
          ...DEFAULT_MONETAG_CONFIG,
          ...data,
          zones: {
            zone1: { ...DEFAULT_MONETAG_CONFIG.zones.zone1, ...(data.zones?.zone1 || {}) },
            zone2: { ...DEFAULT_MONETAG_CONFIG.zones.zone2, ...(data.zones?.zone2 || {}) },
          },
          userTypes: { ...DEFAULT_MONETAG_CONFIG.userTypes, ...(data.userTypes || {}) },
          pages: { ...DEFAULT_MONETAG_CONFIG.pages, ...(data.pages || {}) },
          frequency: { ...DEFAULT_MONETAG_CONFIG.frequency, ...(data.frequency || {}) },
        };
        saveCachedMonetagConfig(merged);
        onChange(merged);
      }
    }, (err) => {
      console.warn("Monetag config snapshot error:", err);
    });
  } catch (e) {
    return () => {};
  }
}

export function shouldShowAdsForUser(_userProfile: UserProfile | null, _config?: MonetagAdsConfig): boolean {
  return false;
}

export function shouldShowAdsOnPage(_pageKey: keyof MonetagAdsConfig['pages'], _config?: MonetagAdsConfig, _isTestActive?: boolean): boolean {
  return false;
}

/**
 * CENTRALIZED AD ELIGIBILITY CHECK
 * All Monetag ads completely disabled.
 */
export function canShowAds(_userProfile: UserProfile | null, _config?: MonetagAdsConfig, _pageKey?: keyof MonetagAdsConfig['pages'], _isTestActive?: boolean): boolean {
  return false;
}

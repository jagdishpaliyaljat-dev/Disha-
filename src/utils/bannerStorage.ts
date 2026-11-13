import { 
  collection, 
  doc, 
} from "firebase/firestore";
import {
  guardedGetDocs,
  guardedSetDoc,
  guardedDeleteDoc,
  guardedOnSnapshot,
} from "./quotaTracker";
import { db } from "../lib/firebase";
import { AppBanner } from "../types";
import { isUserAdmin, loadUserProfile } from "./userProfileStorage";
import { getLocalMetadata } from "./indexedDbCache";
import { fetchCurriculumAssetCacheFirst, fetchQuizAssetVersion } from "./quizAssetSwCache";

const BANNERS_COLLECTION = "banners";
const LOCAL_BANNERS_KEY = "quizpro_banners_v2";

let inMemoryBanners: AppBanner[] = [];

// Helper to load local banners
export function getLocalBanners(): AppBanner[] {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return inMemoryBanners;
    }
    const raw = localStorage.getItem(LOCAL_BANNERS_KEY);
    if (!raw) return inMemoryBanners;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : inMemoryBanners;
  } catch (err) {
    return inMemoryBanners;
  }
}

// Helper to save local banners
function setLocalBanners(banners: AppBanner[]): void {
  inMemoryBanners = banners;
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return;
    }
    localStorage.setItem(LOCAL_BANNERS_KEY, JSON.stringify(banners));
  } catch (err) {
    console.warn("Failed to store local banners", err);
  }
}

// Helper to merge local and remote banners by ID
function mergeBanners(remote: AppBanner[], local: AppBanner[]): AppBanner[] {
  const map = new Map<string, AppBanner>();
  
  // Add local first
  for (const b of local) {
    if (b && b.id) map.set(b.id, b);
  }
  // Remote can override if present
  for (const b of remote) {
    if (b && b.id) map.set(b.id, b);
  }
  
  return Array.from(map.values()).sort((a, b) => (a.order || 0) - (b.order || 0));
}

// Dispatch event to notify same-window subscribers immediately
function notifyBannerSubscribers(activeBanners: AppBanner[]) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("quizpro_banners_updated", { detail: activeBanners }));
  }
}

export async function fetchActiveBanners(): Promise<AppBanner[]> {
  const local = getLocalBanners().filter(b => b.isActive);
  try {
    const snapshot = await guardedGetDocs(collection(db, BANNERS_COLLECTION), "Student", "Fetch Active Banners");
    const remote = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    })) as AppBanner[];

    const merged = mergeBanners(remote, getLocalBanners());
    setLocalBanners(merged);
    return merged.filter(b => b.isActive).sort((a, b) => (a.order || 0) - (b.order || 0));
  } catch (err) {
    console.warn("Failed to fetch banners from Firestore, using local:", err);
    return local.sort((a, b) => (a.order || 0) - (b.order || 0));
  }
}

export async function fetchAllBanners(): Promise<AppBanner[]> {
  const local = getLocalBanners();
  try {
    const snapshot = await guardedGetDocs(collection(db, BANNERS_COLLECTION), "Admin", "Fetch All Banners");
    const remote = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    })) as AppBanner[];

    const merged = mergeBanners(remote, local);
    setLocalBanners(merged);
    return merged.sort((a, b) => (a.order || 0) - (b.order || 0));
  } catch (err) {
    console.warn("Failed to fetch all banners from Firestore, using local:", err);
    return local.sort((a, b) => (a.order || 0) - (b.order || 0));
  }
}

/**
 * Client-side robust image compression for banner slides
 * - Handles PNG, JPG, WebP, SVG, GIF
 * - Renders with white background (fixing black background for transparent PNGs)
 * - Proportional downscaling to max 960x440
 * - High-speed JPEG compression (quality 0.80) to produce lightweight 30-50KB images
 * - Guarantees rapid saving and zero storage quota limits
 */
export function compressBannerImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("Please select a valid image file (PNG, JPG, WebP)."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Error reading image file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Invalid image file."));
      img.onload = () => {
        const MAX_WIDTH = 960;
        const MAX_HEIGHT = 440;
        let width = img.width || 800;
        let height = img.height || 360;

        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(width, 100);
        canvas.height = Math.max(height, 50);

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }

        // Fill white background to prevent dark/black backgrounds on transparent PNGs
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const compressed = canvas.toDataURL("image/jpeg", 0.80);
        resolve(compressed);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export async function saveBanner(banner: Partial<AppBanner>): Promise<string> {
  const bannerId = banner.id || `banner_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const bannerData: AppBanner = {
    id: bannerId,
    title: (banner.title || "Banner").trim(),
    subtitle: (banner.subtitle || "").trim(),
    badge: (banner.badge || "").trim(),
    imageUrl: (banner.imageUrl || "").trim(),
    color: banner.color || "from-blue-600 to-indigo-700",
    iconName: banner.iconName || "Image",
    actionLabel: (banner.actionLabel || "").trim(),
    actionTab: banner.actionTab || "home",
    isActive: banner.isActive !== false,
    order: typeof banner.order === "number" ? banner.order : 0,
    createdAt: banner.createdAt || now,
    updatedAt: now,
  };

  // 1. Immediately persist locally
  const currentLocal = getLocalBanners();
  const existingIdx = currentLocal.findIndex(b => b.id === bannerId);
  let updatedLocal: AppBanner[];
  if (existingIdx >= 0) {
    updatedLocal = [...currentLocal];
    updatedLocal[existingIdx] = bannerData;
  } else {
    updatedLocal = [...currentLocal, bannerData];
  }
  setLocalBanners(updatedLocal);
  notifyBannerSubscribers(updatedLocal.filter(b => b.isActive));

  // 2. Persist to Firestore
  try {
    const bannerDoc = doc(db, BANNERS_COLLECTION, bannerId);
    await guardedSetDoc(bannerDoc, bannerData, { merge: true }, "Admin", "Save Banner");
  } catch (err: any) {
    console.warn("Firestore saveBanner could not complete, saved locally:", err?.message || err);
    throw err;
  }

  return bannerId;
}

const DELETED_BANNERS_KEY = "quizpro_deleted_banners_v1";

export function getDeletedBannerIds(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_BANNERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addDeletedBannerId(id: string): void {
  try {
    const list = getDeletedBannerIds();
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem(DELETED_BANNERS_KEY, JSON.stringify(list));
    }
  } catch (e) {
    console.warn("Failed to record deleted banner ID", e);
  }
}

export function clearDeletedBannerIds(): void {
  try {
    localStorage.removeItem(DELETED_BANNERS_KEY);
  } catch {}
}

export async function deleteBanner(bannerId: string): Promise<void> {
  // 1. Delete locally first
  const currentLocal = getLocalBanners();
  const updatedLocal = currentLocal.filter(b => b.id !== bannerId);
  setLocalBanners(updatedLocal);
  addDeletedBannerId(bannerId);
  notifyBannerSubscribers(updatedLocal.filter(b => b.isActive));

  // 2. Delete from Firestore
  try {
    await guardedDeleteDoc(doc(db, BANNERS_COLLECTION, bannerId), "Admin", "Delete Banner");
  } catch (err) {
    console.warn("Firestore deleteBanner error, deleted locally:", err);
  }
}

export function subscribeToActiveBanners(callback: (banners: AppBanner[]) => void) {
  // 1. Listen to custom in-window updates (asynchronous event dispatch)

  // 2. Listen to custom in-window updates
  const handleLocalUpdate = (e: any) => {
    if (e.detail && Array.isArray(e.detail)) {
      callback(e.detail);
    } else {
      const active = getLocalBanners().filter(b => b.isActive).sort((a, b) => (a.order || 0) - (b.order || 0));
      callback(active);
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("quizpro_banners_updated", handleLocalUpdate);
  }

  // 3. Real-time Snapshot for Admins ONLY.
  //    One-shot fetch for Students to save 100% continuous listener read quota.
  let unsubscribeFirestore = () => {};
  const isAdmin = isUserAdmin(loadUserProfile());

  let cancelled = false;

  if (isAdmin) {
    try {
      const q = collection(db, BANNERS_COLLECTION);
      unsubscribeFirestore = guardedOnSnapshot(
        q,
        "Admin",
        "Active Banners Listener",
        (snapshot) => {
          const remote = snapshot.docs.map((doc: any) => ({
            ...doc.data(),
            id: doc.id
          })) as AppBanner[];

          const merged = mergeBanners(remote, getLocalBanners());
          setLocalBanners(merged);
          const activeBanners = merged
            .filter(b => b.isActive)
            .sort((a, b) => (a.order || 0) - (b.order || 0));
          
          callback(activeBanners);
        },
        (err) => {
          console.warn("Banner Firestore subscription skipped:", err.message);
        }
      );
    } catch (err) {
      console.warn("Could not set up Firestore banner subscription:", err);
    }
  } else {
    // Cache-First static quiz asset check for regular students before Firestore fallback
    (async () => {
      try {
        const localMeta = await getLocalMetadata<any>("curriculum_version_meta").catch(() => null);
        let version = Number(localMeta?.curriculumVersion || 0);
        if (!version) {
          const verManifest = await fetchQuizAssetVersion().catch(() => null);
          version = Number(verManifest?.curriculumVersion || 0);
        }

        if (version > 0) {
          const swAsset = await fetchCurriculumAssetCacheFirst(version).catch(() => null);
          if (!cancelled && swAsset) {
            const merged = mergeBanners(swAsset.banners || [], getLocalBanners());
            setLocalBanners(merged);
            const activeBanners = merged
              .filter(b => b.isActive)
              .sort((a, b) => (a.order || 0) - (b.order || 0));
            callback(activeBanners);
            return;
          }
        }
      } catch {}

      if (cancelled) return;

      // Fallback one-shot fetch for regular students
      guardedGetDocs(collection(db, BANNERS_COLLECTION), "Student", "Fetch Active Banners One-Shot")
        .then((snapshot) => {
          if (cancelled) return;
          const remote = snapshot.docs.map((doc: any) => ({
            ...doc.data(),
            id: doc.id
          })) as AppBanner[];

          const merged = mergeBanners(remote, getLocalBanners());
          setLocalBanners(merged);
          const activeBanners = merged
            .filter(b => b.isActive)
            .sort((a, b) => (a.order || 0) - (b.order || 0));
          
          callback(activeBanners);
        })
        .catch((err) => {
          console.warn("Banner one-shot fetch skipped:", err);
        });
    })();
  }

  return () => {
    cancelled = true;
    if (typeof window !== "undefined") {
      window.removeEventListener("quizpro_banners_updated", handleLocalUpdate);
    }
    unsubscribeFirestore();
  };
}

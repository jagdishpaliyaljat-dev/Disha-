import { AppBanner } from "../types";

const LOCAL_BANNERS_KEY = "disha2020_banners_v2";
const LEGACY_LOCAL_BANNERS_KEY = "quizpro_banners_v2";
const DELETED_BANNERS_KEY = "disha2020_deleted_banners_v1";
const LEGACY_DELETED_BANNERS_KEY = "quizpro_deleted_banners_v1";

let inMemoryBanners: AppBanner[] = [];

/** Upgrades legacy (pre-AppBanner) records to the current shape. */
function normalizeBanner(raw: any, idx = 0): AppBanner {
  const legacy = raw || {};
  const actionTab = legacy.actionTab
    || (typeof legacy.actionData === "string" ? legacy.actionData : undefined)
    || (legacy.actionType && legacy.actionType !== "none" ? legacy.actionType : undefined);

  return {
    id: legacy.id || `banner_${Date.now()}_${idx}`,
    title: legacy.title || "",
    subtitle: legacy.subtitle || "",
    badge: legacy.badge || "",
    color: legacy.color || "from-[#800020] to-[#3B0613]",
    iconName: legacy.iconName || "Image",
    actionLabel: legacy.actionLabel || "",
    actionTab,
    imageUrl: legacy.imageUrl || "",
    isActive: legacy.isActive !== undefined ? Boolean(legacy.isActive) : true,
    order: typeof legacy.order === "number"
      ? legacy.order
      : (typeof legacy.priority === "number" ? legacy.priority : idx),
    createdAt: legacy.createdAt || new Date().toISOString(),
    updatedAt: legacy.updatedAt,
  };
}

export function getLocalBanners(): AppBanner[] {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return inMemoryBanners;
    }
    const raw = localStorage.getItem(LOCAL_BANNERS_KEY) || localStorage.getItem(LEGACY_LOCAL_BANNERS_KEY);
    if (!raw) return inMemoryBanners;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeBanner) : inMemoryBanners;
  } catch (err) {
    return inMemoryBanners;
  }
}

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

export function getDeletedBannerIds(): string[] {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return [];
    }
    const raw = localStorage.getItem(DELETED_BANNERS_KEY) || localStorage.getItem(LEGACY_DELETED_BANNERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addDeletedBannerId(id: string): void {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return;
    const list = getDeletedBannerIds();
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem(DELETED_BANNERS_KEY, JSON.stringify(list));
    }
  } catch {}
}

export function clearDeletedBannerIds(): void {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return;
    localStorage.removeItem(DELETED_BANNERS_KEY);
  } catch {}
}

export async function fetchActiveBanners(): Promise<AppBanner[]> {
  const local = getLocalBanners();
  const deleted = new Set(getDeletedBannerIds());
  return local
    .filter((b) => b.isActive !== false && !deleted.has(b.id))
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

export async function fetchAllBanners(): Promise<AppBanner[]> {
  const local = getLocalBanners();
  const deleted = new Set(getDeletedBannerIds());
  return local
    .filter((b) => !deleted.has(b.id))
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

export function compressBannerImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/webp", 0.82));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

export async function saveBanner(banner: Partial<AppBanner>): Promise<string> {
  const current = getLocalBanners();
  const bannerId = banner.id || `banner_${Date.now()}`;
  const existing = current.find((b) => b.id === bannerId);
  const completeBanner: AppBanner = normalizeBanner({
    ...existing,
    ...banner,
    id: bannerId,
    order: typeof banner.order === "number"
      ? banner.order
      : (existing?.order ?? current.length),
    isActive: banner.isActive !== undefined ? banner.isActive : (existing?.isActive ?? true),
    createdAt: banner.createdAt || existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const idx = current.findIndex((b) => b.id === bannerId);
  const updatedList = idx >= 0 ? [...current] : [...current, completeBanner];
  if (idx >= 0) updatedList[idx] = completeBanner;

  setLocalBanners(updatedList);
  return bannerId;
}

export async function deleteBanner(bannerId: string): Promise<void> {
  const current = getLocalBanners();
  const updated = current.filter((b) => b.id !== bannerId);
  setLocalBanners(updated);
  addDeletedBannerId(bannerId);
}

export function subscribeToActiveBanners(callback: (banners: AppBanner[]) => void): () => void {
  const local = getLocalBanners();
  const deleted = new Set(getDeletedBannerIds());
  const active = local
    .filter((b) => b.isActive !== false && !deleted.has(b.id))
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  callback(active);
  return () => {};
}

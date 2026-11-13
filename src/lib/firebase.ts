import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { 
  initializeFirestore, 
  setLogLevel, 
  disableNetwork, 
  doc, 
  getDocFromServer,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import appletConfig from "../../firebase-applet-config.json";

const metaEnv: Record<string, string | undefined> = typeof import.meta !== "undefined" && import.meta?.env ? (import.meta.env as any) : {};

const rawDatabaseId = (metaEnv.VITE_FIREBASE_DATABASE_ID || appletConfig.firestoreDatabaseId || "(default)").trim();
const databaseId = (rawDatabaseId === "default" || !rawDatabaseId) ? "(default)" : rawDatabaseId;

export const firebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || appletConfig.apiKey,
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain,
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId,
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket,
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId,
  appId: metaEnv.VITE_FIREBASE_APP_ID || appletConfig.appId,
  measurementId: appletConfig.measurementId || "",
  firestoreDatabaseId: databaseId,
};

export const isFirebaseConfigured = (): boolean => {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.apiKey !== "YOUR_API_KEY" &&
    firebaseConfig.projectId &&
    firebaseConfig.projectId !== "YOUR_PROJECT_ID"
  );
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
if (typeof window !== "undefined") {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
}

const isBrowserWithIndexedDb = typeof window !== "undefined" && typeof window.indexedDB !== "undefined";

let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      localCache: memoryLocalCache(),
      experimentalForceLongPolling: true,
      ignoreUndefinedProperties: true,
    },
    databaseId
  );
} catch (err) {
  try {
    firestoreInstance = initializeFirestore(
      app,
      {
        ignoreUndefinedProperties: true,
        experimentalForceLongPolling: true,
      },
      databaseId
    );
  } catch {
    firestoreInstance = initializeFirestore(app, { ignoreUndefinedProperties: true }, databaseId);
  }
}

export const db = firestoreInstance;

// Global error handler to gracefully suppress non-fatal Firestore SDK internal assertion bugs and offline notices
if (typeof window !== "undefined") {
  const isIgnoredFirestoreError = (msg: string) => {
    return (
      msg.includes("INTERNAL ASSERTION FAILED") ||
      msg.includes("Unexpected state") ||
      msg.includes("QuotaExceededError") ||
      msg.includes("Exceeded the quota") ||
      msg.includes("c050") ||
      msg.includes("b815") ||
      msg.includes("c051") ||
      msg.includes("Could not reach Cloud Firestore backend") ||
      msg.includes("the client is offline")
    );
  };

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const msg = reason instanceof Error ? reason.message : String(reason || "");
    const code = (reason as any)?.code || "";
    if (isIgnoredFirestoreError(msg) || code === "unavailable") {
      event.preventDefault();
      event.stopImmediatePropagation?.();
    }
  });

  window.addEventListener("error", (event) => {
    const msg = event?.message || (event?.error instanceof Error ? event.error.message : String(event?.error || ""));
    if (isIgnoredFirestoreError(msg)) {
      event.preventDefault();
      event.stopImmediatePropagation?.();
    }
  });
}

// Silence internal Firestore SDK retry and transient offline logs
try {
  setLogLevel("silent");
  if (typeof localStorage !== "undefined") {
    const exhaustedVal = localStorage.getItem("quizpro_quota_exhausted_v1");
    const exhaustedDate = localStorage.getItem("quizpro_quota_exhausted_date_v1");
    const todayPacific = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    // Auto-disable network if quota was marked exhausted for today (or if date metadata was missing, latch to today)
    if (exhaustedVal === "true" && (!exhaustedDate || exhaustedDate === todayPacific)) {
      if (!exhaustedDate) {
        localStorage.setItem("quizpro_quota_exhausted_date_v1", todayPacific);
      }
      disableNetwork(db).catch(() => {});
    } else if (exhaustedDate && exhaustedDate !== todayPacific) {
      localStorage.removeItem("quizpro_quota_exhausted_v1");
      localStorage.removeItem("quizpro_quota_exhausted_date_v1");
    }
  }
} catch {}

export const storage = getStorage(app);

// Safe probe connection helper
export async function testConnection(): Promise<boolean> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return false;
  }
  try {
    if (typeof localStorage !== "undefined" && localStorage.getItem("quizpro_quota_exhausted_v1") === "true") {
      return false;
    }
    await getDocFromServer(doc(db, "test", "connection"));
    console.log("[Firebase] Firestore connection verified successfully.");
    return true;
  } catch (error: any) {
    if (error?.code === "unavailable" || (error instanceof Error && (error.message.includes("the client is offline") || error.message.includes("unavailable")))) {
      return false;
    }
    return false;
  }
}

export default app;

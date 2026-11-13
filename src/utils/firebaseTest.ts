import { doc, serverTimestamp } from "firebase/firestore";
import { auth, db, firebaseConfig, isFirebaseConfigured } from "../lib/firebase";
import { guardedSetDoc, guardedGetDoc } from "./quotaTracker";

export interface FirebaseTestResult {
  configValid: boolean;
  configDetails: {
    projectId: string;
    authDomain: string;
    firestoreDatabaseId: string;
    appId: string;
  };
  firestoreRead: {
    success: boolean;
    message: string;
    latencyMs?: number;
  };
  firestoreWrite: {
    success: boolean;
    message: string;
    latencyMs?: number;
  };
  authState: {
    isAuthenticated: boolean;
    uid?: string;
    email?: string;
    isAnonymous?: boolean;
  };
  timestamp: string;
}

/**
 * Runs a complete diagnostic check on Firebase services (Auth + Firestore).
 * REUSES fixed doc '_health/admin_ping' (1 write + 1 read at most).
 */
export async function runFirebaseDiagnostic(): Promise<FirebaseTestResult> {
  const configValid = isFirebaseConfigured();

  const result: FirebaseTestResult = {
    configValid,
    configDetails: {
      projectId: firebaseConfig.projectId || "Not configured",
      authDomain: firebaseConfig.authDomain || "Not configured",
      firestoreDatabaseId: firebaseConfig.firestoreDatabaseId || "(default)",
      appId: firebaseConfig.appId || "Not configured",
    },
    firestoreRead: { success: false, message: "Not executed" },
    firestoreWrite: { success: false, message: "Not executed" },
    authState: {
      isAuthenticated: Boolean(auth.currentUser),
      uid: auth.currentUser?.uid,
      email: auth.currentUser?.email || undefined,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    timestamp: new Date().toISOString(),
  };

  // Fixed ping document ID to avoid document growth and multiple reads
  const healthDocRef = doc(db, "_health", "admin_ping");

  // Firestore Write Test (1 write)
  try {
    const writeStart = Date.now();
    await guardedSetDoc(
      healthDocRef,
      {
        ping: true,
        timestamp: serverTimestamp(),
        clientTime: new Date().toISOString()
      },
      { merge: true },
      "Health",
      "Diagnostic Write Test"
    );
    const writeLatency = Date.now() - writeStart;
    result.firestoreWrite = {
      success: true,
      message: `Write test passed (${writeLatency}ms)`,
      latencyMs: writeLatency,
    };
  } catch (err: any) {
    console.error("Firestore write error:", err);
    let errMsg = err.message || String(err);
    if (errMsg.includes("resource-exhausted") || errMsg.includes("quota")) {
      errMsg = "Quota Exceeded: Daily free tier write limit reached.";
    } else if (errMsg.includes("permission-denied")) {
      errMsg = "Permission Denied: Ensure you are logged in and security rules allow access.";
    }
    result.firestoreWrite = {
      success: false,
      message: errMsg,
    };
  }

  // Firestore Read Test (1 read)
  try {
    const readStart = Date.now();
    await guardedGetDoc(healthDocRef, "Health", "Diagnostic Read Test");
    const readLatency = Date.now() - readStart;
    
    result.firestoreRead = {
      success: true,
      message: `Read test passed (${readLatency}ms)`,
      latencyMs: readLatency,
    };
  } catch (err: any) {
    console.error("Firestore read error:", err);
    let errMsg = err.message || String(err);
    if (errMsg.includes("resource-exhausted") || errMsg.includes("quota")) {
      errMsg = "Quota Exceeded: Daily read limit reached.";
    } else if (errMsg.includes("permission-denied")) {
      errMsg = "Permission Denied: Read not allowed by Firestore security rules.";
    }
    result.firestoreRead = {
      success: false,
      message: errMsg,
    };
  }

  return result;
}

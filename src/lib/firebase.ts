/**
 * DISHA 20-20 — Standalone Offline Firebase Re-export Layer
 * Redirects all Firebase usage to 100% offline local mocks.
 */
export * from "./mockFirebase";
import mockDefault from "./mockFirebase";
export default mockDefault;

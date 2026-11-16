/**
 * DISHA 20-20 — 100% Standalone Offline Firebase Mock Layer
 * Replaces all Firebase SDK dependencies with zero-network, local offline mocks.
 * Enables 100% standalone offline PWA operation with zero cloud calls.
 */

// --- Firebase App Mock ---
export const initializeApp = (_config?: any, _name?: string) => ({ name: '[DEFAULT]' });
export const getApps = () => [{ name: '[DEFAULT]' }];
export const getApp = (_name?: string) => ({ name: '[DEFAULT]' });

// --- Firebase Auth Mock ---
const LOCAL_USER_KEY = 'disha_local_auth_user_v1';

function getStoredLocalUser(): any {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCAL_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setStoredLocalUser(user: any): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (user) {
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(LOCAL_USER_KEY);
    }
  } catch {}
}

const authListeners = new Set<(user: any) => void>();

export const auth = {
  currentUser: getStoredLocalUser(),
  async signOut() {
    setStoredLocalUser(null);
    this.currentUser = null;
    authListeners.forEach((cb) => cb(null));
  },
};

export const getAuth = (_app?: any) => auth;
export const setPersistence = async (_auth: any, _persistence: any) => {};
export const browserLocalPersistence = 'LOCAL';

export const onAuthStateChanged = (_auth: any, callback: (user: any) => void) => {
  authListeners.add(callback);
  callback(auth.currentUser);
  return () => {
    authListeners.delete(callback);
  };
};

export const signInWithEmailAndPassword = async (_auth: any, email: string, _pass: string) => {
  const user = {
    uid: 'local-user-' + Math.random().toString(36).slice(2, 9),
    email,
    displayName: email.split('@')[0],
    emailVerified: true,
    isAnonymous: false,
    getIdToken: async () => 'mock-local-token',
  };
  setStoredLocalUser(user);
  auth.currentUser = user;
  authListeners.forEach((cb) => cb(user));
  return { user };
};

export const createUserWithEmailAndPassword = async (_auth: any, email: string, _pass: string) => {
  return signInWithEmailAndPassword(_auth, email, _pass);
};

export class GoogleAuthProvider {}

export const signInWithPopup = async (_auth: any, _provider: any) => {
  const user = {
    uid: 'local-google-user',
    email: 'student@example.com',
    displayName: 'Student',
    emailVerified: true,
    isAnonymous: false,
    getIdToken: async () => 'mock-local-token',
  };
  setStoredLocalUser(user);
  auth.currentUser = user;
  authListeners.forEach((cb) => cb(user));
  return { user };
};

export const updateProfile = async (user: any, profile: { displayName?: string; photoURL?: string }) => {
  if (user) {
    Object.assign(user, profile);
    setStoredLocalUser(user);
    auth.currentUser = user;
    authListeners.forEach((cb) => cb(user));
  }
};

// --- Firestore Mock ---
export const initializeFirestore = (_app: any, _settings?: any, _databaseId?: string) => ({});
export const getFirestore = (_app?: any, _databaseId?: string) => ({});
export const setLogLevel = (_level: string) => {};
export const disableNetwork = async (_db?: any) => {};
export const enableNetwork = async (_db?: any) => {};

export const memoryLocalCache = () => ({});
export const persistentLocalCache = (_settings?: any) => ({});
export const persistentMultipleTabManager = () => ({});

export interface MockDocRef {
  id: string;
  path: string;
}

export const doc = (_db: any, pathOrCollection: any, ...pathSegments: string[]): MockDocRef => {
  let fullPath = '';
  if (typeof pathOrCollection === 'string') {
    fullPath = [pathOrCollection, ...pathSegments].join('/');
  } else if (pathOrCollection && typeof pathOrCollection === 'object') {
    fullPath = [pathOrCollection.path || pathOrCollection.id || '', ...pathSegments].join('/');
  }
  const id = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] : fullPath.split('/').pop() || 'id';
  return { id, path: fullPath };
};

export const collection = (_db: any, path: string, ...segments: string[]) => {
  const fullPath = [path, ...segments].join('/');
  return { id: path.split('/').pop() || path, path: fullPath };
};

export const query = (col: any, ..._constraints: any[]) => col;
export const where = (_field: string, _op: string, _val: any) => ({});
export const orderBy = (_field: string, _direction?: string) => ({});
export const limit = (_n: number) => ({});
export const startAfter = (_docOrVal: any) => ({});

const EMPTY_SNAPSHOT = {
  exists: () => false,
  empty: true,
  docs: [] as any[],
  data: () => ({}),
  id: '',
};

export const getDoc = async (_docRef: any) => EMPTY_SNAPSHOT;
export const getDocs = async (_query: any) => EMPTY_SNAPSHOT;
export const getDocFromServer = async (_docRef: any) => EMPTY_SNAPSHOT;
export const getCountFromServer = async (_query: any) => ({ data: () => ({ count: 0 }) });

export const onSnapshot = (_refOrQuery: any, nextOrObserver: any, _error?: any) => {
  if (typeof nextOrObserver === 'function') {
    setTimeout(() => nextOrObserver(EMPTY_SNAPSHOT), 0);
  } else if (nextOrObserver && typeof nextOrObserver.next === 'function') {
    setTimeout(() => nextOrObserver.next(EMPTY_SNAPSHOT), 0);
  }
  return () => {}; // unsubscribe no-op
};

export const setDoc = async (_docRef: any, _data: any, _options?: any) => {};
export const updateDoc = async (_docRef: any, _data: any, ..._more: any[]) => {};
export const deleteDoc = async (_docRef: any) => {};

export const writeBatch = (_db?: any) => ({
  set(_ref: any, _data: any, _options?: any) { return this; },
  update(_ref: any, _data: any, ..._more: any[]) { return this; },
  delete(_ref: any) { return this; },
  async commit() {},
});

export const runTransaction = async (_db: any, updateFunction: (transaction: any) => Promise<any>) => {
  const mockTransaction = {
    async get(_ref: any) { return EMPTY_SNAPSHOT; },
    set(_ref: any, _data: any, _options?: any) { return this; },
    update(_ref: any, _data: any, ..._more: any[]) { return this; },
    delete(_ref: any) { return this; },
  };
  return updateFunction(mockTransaction);
};

export const serverTimestamp = () => new Date().toISOString();
export const increment = (n: number) => n;
export const deleteField = () => undefined;

export class Timestamp {
  seconds: number;
  nanoseconds: number;
  constructor(seconds: number, nanoseconds: number) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }
  toDate() {
    return new Date(this.seconds * 1000);
  }
  toISOString() {
    return this.toDate().toISOString();
  }
  static now() {
    const ms = Date.now();
    return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6);
  }
  static fromDate(date: Date) {
    const ms = date.getTime();
    return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6);
  }
}

// --- Firebase Storage Mock ---
export const getStorage = (_app?: any) => ({});
export const ref = (_storage: any, _urlOrPath: string) => ({});
export const uploadBytes = async (_ref: any, _blob: any) => ({});
export const getDownloadURL = async (_ref: any) => '';

// --- Default Client Instances ---
export const db = {};
export const storage = {};
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
  measurementId: '',
  firestoreDatabaseId: '(default)',
};

export const isFirebaseConfigured = (): boolean => false;

export async function testConnection(): Promise<boolean> {
  return false;
}

export default {
  initializeApp,
  getApps,
  getApp,
  auth,
  db,
  storage,
};

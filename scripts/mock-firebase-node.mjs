// Minimal Node.js mock stubs for firebase and other browser packages
export const doc = (...args) => ({ id: args[args.length - 1], path: args.join("/") });
export const collection = (...args) => ({ id: args[args.length - 1], path: args.join("/") });
export const query = (...args) => ({ ...args[0], queries: args.slice(1) });
export const where = (field, op, val) => ({ field, op, val });
export const limit = (n) => ({ limit: n });
export const getDoc = async () => ({ exists: () => false, data: () => null });
export const getDocs = async () => ({ empty: true, docs: [], forEach: () => {} });
export const setDoc = async () => {};
export const updateDoc = async () => {};
export const deleteDoc = async () => {};
export const writeBatch = () => ({ set: () => {}, update: () => {}, delete: () => {}, commit: async () => {} });
export const onSnapshot = () => () => {};
export const runTransaction = async (db, fn) => fn({ get: getDoc, set: setDoc, update: updateDoc, delete: deleteDoc });
export const getCountFromServer = async () => ({ data: () => ({ count: 0 }) });
export const increment = (n) => n;
export const serverTimestamp = () => new Date().toISOString();
export const deleteField = () => undefined;
export const enableNetwork = async () => {};
export const disableNetwork = async () => {};
export const getDocFromServer = async () => ({ exists: () => false, data: () => null });

export const getFirestore = () => ({});
export const initializeFirestore = () => ({});
export const persistentLocalCache = () => ({});
export const persistentMultipleTabManager = () => ({});
export const memoryLocalCache = () => ({});
export const setLogLevel = () => {};
export const getStorage = () => ({});

export class DocumentReference {}
export class Query {}
export class CollectionReference {}
export class Firestore {}
export class WriteBatch {}
export class Transaction {}
export class DocumentSnapshot {}
export class QuerySnapshot {}

export const initializeApp = () => ({});
export const getApps = () => [{}];
export const getApp = () => ({});
export const getAuth = () => ({ currentUser: null });
export const browserLocalPersistence = {};
export const setPersistence = async () => {};

export const createInstance = () => ({
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
  clear: async () => {},
  keys: async () => [],
});

export default { 
  doc, 
  collection, 
  query, 
  where, 
  limit, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc,
  deleteDoc,
  writeBatch, 
  onSnapshot,
  runTransaction,
  getCountFromServer,
  getFirestore,
  initializeFirestore,
  getAuth,
  browserLocalPersistence,
  setPersistence
};

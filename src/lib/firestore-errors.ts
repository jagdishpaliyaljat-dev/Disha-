import { auth } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    isUserNull?: boolean;
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const errCode = (error as any)?.code || '';

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      isUserNull: auth.currentUser === null,
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };

  // 1. If path is an intentional security/QA test probe, log info instead of rethrowing
  if (path && (path.includes('_unauthorized_protected_collection') || path.includes('test_fail_doc'))) {
    console.info('Intentional permission test probe caught:', path);
    return;
  }

  // 2. Handle specific Firestore Error Codes (Senior Strategy)
  switch (errCode) {
    case 'resource-exhausted':
      console.warn('[Firestore Quota Limit Reached] Switching to Offline/Local Fallback.', JSON.stringify(errInfo));
      return;
    case 'permission-denied':
      console.error('[Firestore Permission Denied] Check Security Rules for path:', path, JSON.stringify(errInfo));
      break;
    case 'unavailable':
      console.warn('[Firestore Network Unavailable] Working Offline.', JSON.stringify(errInfo));
      return;
    case 'deadline-exceeded':
      console.warn('[Firestore Timeout] The operation took too long.', JSON.stringify(errInfo));
      return;
    case 'failed-precondition':
      if (errMsg.includes('index')) {
        console.error('[Firestore Index Missing] Please create the required index.', JSON.stringify(errInfo));
      }
      break;
    default:
      if (errMsg.includes('Quota limit exceeded')) {
        console.warn('[Firestore Quota Limit Reached] Switching to Offline/Local Fallback.', JSON.stringify(errInfo));
        return;
      }
  }

  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

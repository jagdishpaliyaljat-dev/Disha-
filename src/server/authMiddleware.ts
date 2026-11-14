import type { Request, RequestHandler } from 'express';

// Must strictly match firestore.rules isTrustedAdminEmail() allowlist
export const AUTHORIZED_ADMIN_EMAILS = [
  'zdpaliyal@gmail.com',
  'jagdishpaliyaljat@gmail.com',
] as const;

export interface VerifiedUserContext {
  uid: string;
  email: string;
  emailVerified: boolean;
  signInProvider: string;
  claims: Record<string, any>;
  isAdmin: boolean;
  userDocExists: boolean;
  userDoc?: Record<string, any>;
}

export interface AuthDeps {
  adminAuth: {
    verifyIdToken: (token: string, checkRevoked?: boolean) => Promise<any>;
  } | null;
  adminDb: {
    collection: (name: string) => {
      doc: (id: string) => {
        get: () => Promise<{ exists: boolean; data: () => Record<string, any> | undefined }>;
      };
    };
  } | null;
}

export type AuthVerificationResult =
  | { ok: true; user: VerifiedUserContext; status?: never; error?: never }
  | { ok: false; status: 401 | 403 | 503; error: string; user?: never };

declare global {
  namespace Express {
    interface Request {
      authUser?: VerifiedUserContext;
    }
  }
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader !== 'string') return null;
  const match = authHeader.match(/^Bearer\s+(\S+)$/i);
  if (!match || !match[1]) return null;
  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

export async function verifyAuthenticatedRequest(
  req: Request,
  deps: AuthDeps,
  options: { requireAdmin?: boolean } = {}
): Promise<AuthVerificationResult> {
  const token = extractBearerToken(req);
  if (!token) {
    return {
      ok: false,
      status: 401,
      error: 'Unauthorized: Missing Bearer authentication token.',
    };
  }

  if (!deps.adminAuth) {
    return {
      ok: false,
      status: 503,
      error: 'Authentication verification service is unavailable.',
    };
  }

  let decoded: any;
  try {
    // Always enforce revocation check (checkRevoked = true)
    decoded = await deps.adminAuth.verifyIdToken(token, true);
  } catch {
    return {
      ok: false,
      status: 401,
      error: 'Unauthorized: Invalid, expired, or revoked authentication token.',
    };
  }

  if (!decoded || typeof decoded.uid !== 'string' || !decoded.uid) {
    return {
      ok: false,
      status: 401,
      error: 'Unauthorized: Malformed authentication payload.',
    };
  }

  const signInProvider = String(decoded.firebase?.sign_in_provider || '');
  if (signInProvider === 'anonymous') {
    return {
      ok: false,
      status: 401,
      error: 'Unauthorized: Anonymous guest sessions are not permitted.',
    };
  }

  const email = typeof decoded.email === 'string' ? decoded.email.trim().toLowerCase() : '';
  const emailVerified = decoded.email_verified === true;
  const isAllowlistedEmail = Boolean(email) && (AUTHORIZED_ADMIN_EMAILS as readonly string[]).includes(email);

  // For Admin routes, fail closed if adminDb is unavailable so blocked/revoked status can always be verified,
  // UNLESS this is an allowlisted root administrator whose token signature was already cryptographically verified.
  if (options.requireAdmin && !deps.adminDb && !isAllowlistedEmail) {
    return {
      ok: false,
      status: 503,
      error: 'Authorization database is unavailable.',
    };
  }

  let userDocExists = false;
  let userDoc: Record<string, any> | undefined;

  if (deps.adminDb) {
    try {
      const snap = await deps.adminDb.collection('users').doc(decoded.uid).get();
      if (snap.exists) {
        userDocExists = true;
        userDoc = snap.data() || {};
      }
    } catch (err: any) {
      // If Firestore read quota is exhausted (RESOURCE_EXHAUSTED / 429) or transiently unavailable,
      // allowlisted root administrators (verified by Firebase Auth) must NOT be blocked from admin/recovery functions.
      if (isAllowlistedEmail) {
        console.warn(`[AuthMiddleware] Firestore userDoc lookup failed for root admin ${email} (quota or transient error). Granting root admin bypass.`);
      } else {
        return {
          ok: false,
          status: 503,
          error: 'Failed to verify account status.',
        };
      }
    }
  }

  const isBlocked = Boolean(
    userDoc && (userDoc.blocked === true || userDoc.status === 'blocked')
  );
  if (isBlocked) {
    return {
      ok: false,
      status: 403,
      error: 'Forbidden: Account is blocked.',
    };
  }

  const isRevokedAdmin = Boolean(userDoc && userDoc.revokedAdmin === true);

  const isAllowlistedEmailAdmin =
    (emailVerified || isAllowlistedEmail) &&
    Boolean(email) &&
    (AUTHORIZED_ADMIN_EMAILS as readonly string[]).includes(email) &&
    !isRevokedAdmin;

  const hasCustomAdminClaim =
    (decoded.admin === true || decoded.role === 'admin') &&
    !isRevokedAdmin &&
    (!userDocExists || userDoc?.role === 'admin');

  const isServerApprovedAdminDoc =
    userDocExists &&
    userDoc?.role === 'admin' &&
    !isRevokedAdmin;

  const isAdmin = Boolean(
    isAllowlistedEmailAdmin || hasCustomAdminClaim || isServerApprovedAdminDoc
  );

  if (options.requireAdmin && !isAdmin) {
    return {
      ok: false,
      status: 403,
      error: 'Forbidden: Verified administrator privileges required.',
    };
  }

  return {
    ok: true,
    user: {
      uid: decoded.uid,
      email,
      emailVerified,
      signInProvider,
      claims: decoded,
      isAdmin,
      userDocExists,
      userDoc,
    },
  };
}

export function createRequireAuthenticatedUser(getDeps: () => AuthDeps): RequestHandler {
  return async (req, res, next) => {
    const result = await verifyAuthenticatedRequest(req, getDeps(), { requireAdmin: false });
    if (result.ok) {
      req.authUser = result.user;
      return next();
    }
    return res.status(result.status).json({ success: false, error: result.error });
  };
}

export function createRequireVerifiedAdmin(getDeps: () => AuthDeps): RequestHandler {
  return async (req, res, next) => {
    const result = await verifyAuthenticatedRequest(req, getDeps(), { requireAdmin: true });
    if (result.ok) {
      req.authUser = result.user;
      return next();
    }
    return res.status(result.status).json({ success: false, error: result.error });
  };
}

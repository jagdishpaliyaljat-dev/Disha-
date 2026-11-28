import { App as CapacitorApp, URLOpenListenerEvent } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const GOOGLE_WEB_CLIENT_ID = '30041667176-63sq18vqm32a3fj465kb845ubc6cku44.apps.googleusercontent.com';
export const NATIVE_CUSTOM_SCHEME = 'com.rajexam.prep://auth-callback';
export const NATIVE_FALLBACK_SCHEME = 'disha2020://auth-callback';
export const PRODUCTION_WEB_ORIGIN = 'https://disha-2020.vercel.app';

let isSocialLoginInitialized = false;

/**
 * Initialize native social login provider with the Google Web Client ID
 */
export const initNativeSocialLogin = async (): Promise<boolean> => {
  if (!isNativePlatform()) return false;
  try {
    const { SocialLogin } = await import('@capgo/capacitor-social-login');
    if (!isSocialLoginInitialized) {
      await SocialLogin.initialize({
        google: {
          webClientId: GOOGLE_WEB_CLIENT_ID,
          mode: 'online',
          skipAuthOnlyAuthorizationAfterSignIn: true,
        },
      });
      isSocialLoginInitialized = true;
    }
    return true;
  } catch (err) {
    console.warn('[MobileAuth] SocialLogin.initialize warning:', err);
    return false;
  }
};

/**
 * Trigger Native Google One-Tap Login on Android / iOS
 * Uses native bottom-sheet on device and exchanges Google ID Token directly with Supabase.
 * Returns { success: boolean, session?: any, error?: string, cancelled?: boolean, isNative: boolean }
 */
export const performNativeGoogleLogin = async (): Promise<{
  success: boolean;
  session?: any;
  profile?: any;
  idToken?: string;
  error?: string;
  cancelled?: boolean;
  isNative: boolean;
}> => {
  if (!isNativePlatform()) {
    return { success: false, isNative: false };
  }

  try {
    const { SocialLogin } = await import('@capgo/capacitor-social-login');
    await initNativeSocialLogin();

    console.info('[MobileAuth] Launching Native Google Account Picker...');
    let response: any = null;
    try {
      response = await SocialLogin.login({
        provider: 'google',
        options: {
          style: 'bottom',
          filterByAuthorizedAccounts: false,
          autoSelectEnabled: false,
        },
      });
    } catch (bottomErr: any) {
      const bottomMsg = String(bottomErr?.message || '');
      const isUserCancelled =
        bottomErr?.code === 'USER_CANCELLED' ||
        bottomMsg.toLowerCase().includes('cancel') ||
        bottomMsg.toLowerCase().includes('dismiss');

      if (isUserCancelled) {
        console.info('[MobileAuth] User cancelled Google account selection.');
        return { success: false, cancelled: true, error: 'User cancelled', isNative: true };
      }

      console.warn('[MobileAuth] Native Google login error, stopping retry loop:', bottomMsg);
      return {
        success: false,
        error: bottomMsg.includes('[16]') || bottomMsg.toLowerCase().includes('reauth')
          ? 'Google account verification pending for this build. Use Instant 1-Click Login or Email OTP below.'
          : bottomMsg || 'Google Sign-In could not complete on this device.',
        isNative: true,
      };
    }

    const rawResult = response?.result as any;
    const idToken = rawResult?.idToken;
    const googleProfile = rawResult?.profile;

    if (!idToken && !googleProfile) {
      console.warn('[MobileAuth] No credentials received in native response:', response);
      return { success: false, error: 'No account credential received from Google.', isNative: true };
    }

    let session: any = null;
    let exchangeError: string | null = null;

    if (idToken && isSupabaseConfigured() && supabase) {
      try {
        console.info('[MobileAuth] Exchanging Google ID Token with Supabase signInWithIdToken...');
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
        });

        if (error) {
          exchangeError = error.message;
          console.warn('[MobileAuth] Supabase signInWithIdToken warning:', error.message);
        } else if (data?.session) {
          session = data.session;
        }
      } catch (ex: any) {
        exchangeError = ex?.message || 'Token exchange failed';
        console.warn('[MobileAuth] Supabase exchange exception:', ex);
      }
    }

    if (session) {
      return { success: true, session, isNative: true };
    }

    // Helper: decode JWT claims if profile is missing fields
    let parsedEmail = googleProfile?.email;
    let parsedName = googleProfile?.name || googleProfile?.givenName;
    let parsedAvatar = googleProfile?.imageUrl;
    let parsedSub = googleProfile?.id;

    if ((!parsedEmail || !parsedName) && idToken) {
      try {
        const parts = idToken.split('.');
        if (parts.length >= 2) {
          const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(
            atob(base64)
              .split('')
              .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
              .join('')
          );
          const claims = JSON.parse(jsonPayload);
          if (!parsedEmail && claims?.email) parsedEmail = claims.email;
          if (!parsedName && claims?.name) parsedName = claims.name;
          if (!parsedAvatar && claims?.picture) parsedAvatar = claims.picture;
          if (!parsedSub && claims?.sub) parsedSub = claims.sub;
        }
      } catch (jwtErr) {
        console.warn('[MobileAuth] JWT decode fallback error:', jwtErr);
      }
    }

    if (parsedEmail) {
      const { isSuperAdmin } = await import('./userProfileStorage');
      const cleanEmail = parsedEmail.trim();
      const isSuper = isSuperAdmin(cleanEmail) || isSuperAdmin(parsedSub);
      const verifiedProfile = {
        id: parsedSub || `google_${Date.now()}`,
        email: cleanEmail,
        name: parsedName || 'Student',
        avatar: parsedAvatar || undefined,
        photoURL: parsedAvatar || undefined,
        role: (isSuper ? 'admin' : 'student') as 'admin' | 'student',
        status: 'active' as const,
        isPremium: true,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };
      return {
        success: true,
        profile: verifiedProfile,
        idToken,
        isNative: true,
      };
    }

    return {
      success: false,
      error: exchangeError || 'Unable to verify account credentials.',
      isNative: true,
    };
  } catch (err: any) {
    const msg = String(err?.message || 'Native Google Sign-In failed.');
    const cancelled =
      err?.code === 'USER_CANCELLED' || msg.toLowerCase().includes('cancel');
    console.warn('[MobileAuth] Native Google One-Tap error or cancelled:', err);
    return {
      success: false,
      error: msg,
      cancelled,
      isNative: true,
    };
  }
};

/**
 * Check if the application is running inside a native Capacitor shell (Android / iOS)
 */
export const isNativePlatform = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean((window as any).Capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
};

/**
 * Check if the current browser is running on a mobile device (Android / iOS)
 */
export const isMobileBrowser = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

/**
 * Get the appropriate OAuth Redirect URL depending on the platform
 */
export const getOAuthRedirectUrl = (): string => {
  if (isNativePlatform()) {
    return NATIVE_CUSTOM_SCHEME;
  }
  if (typeof window !== 'undefined' && window.location.origin && window.location.origin.startsWith('http')) {
    return window.location.origin;
  }
  return PRODUCTION_WEB_ORIGIN;
};

/**
 * Safely open the OAuth authentication URL
 */
export const openOAuthBrowser = async (url: string): Promise<void> => {
  if (!url) return;

  if (isNativePlatform()) {
    try {
      await Browser.open({
        url,
        windowName: '_system',
      });
      return;
    } catch (err) {
      console.warn('[MobileAuth] Browser.open failed on native platform:', err);
      return;
    }
  }

  // Fallback for Web platform only
  if (typeof window !== 'undefined') {
    window.location.href = url;
  }
};

/**
 * Parse tokens from URL hash or query params
 */
export const parseAuthTokensFromUrl = (url: string): {
  accessToken: string | null;
  refreshToken: string | null;
  code: string | null;
  errorDescription: string | null;
} => {
  let accessToken: string | null = null;
  let refreshToken: string | null = null;
  let code: string | null = null;
  let errorDescription: string | null = null;

  try {
    // 1. Check Hash Fragment (#access_token=...&refresh_token=...)
    const hashIndex = url.indexOf('#');
    if (hashIndex !== -1) {
      const hashParams = new URLSearchParams(url.substring(hashIndex + 1));
      accessToken = hashParams.get('access_token');
      refreshToken = hashParams.get('refresh_token');
      errorDescription = hashParams.get('error_description');
    }

    // 2. Check Query Params (?code=... or ?access_token=...)
    const queryIndex = url.indexOf('?');
    if (queryIndex !== -1) {
      const queryString = hashIndex !== -1 && hashIndex > queryIndex
        ? url.substring(queryIndex + 1, hashIndex)
        : url.substring(queryIndex + 1);
      const queryParams = new URLSearchParams(queryString);

      if (!accessToken) accessToken = queryParams.get('access_token');
      if (!refreshToken) refreshToken = queryParams.get('refresh_token');
      if (!code) code = queryParams.get('code');
      if (!errorDescription) errorDescription = queryParams.get('error_description');
    }
  } catch (err) {
    console.warn('[MobileAuth] Error parsing URL auth tokens:', err);
  }

  return { accessToken, refreshToken, code, errorDescription };
};

let activeExchangePromise: Promise<boolean> | null = null;
let lastHandledAuthUrl = '';

/**
 * Handle incoming OAuth callback URL and set Supabase session
 */
export const handleIncomingAuthUrl = async (
  rawUrl: string,
  onSessionEstablished?: (session: any) => void
): Promise<boolean> => {
  if (!rawUrl || !isSupabaseConfigured() || !supabase) {
    return false;
  }

  // Deduplicate concurrent triggers for the exact same callback URL across listeners
  if (rawUrl === lastHandledAuthUrl && activeExchangePromise) {
    return activeExchangePromise;
  }

  lastHandledAuthUrl = rawUrl;
  activeExchangePromise = (async () => {
    try {
      const { accessToken, refreshToken, code, errorDescription } = parseAuthTokensFromUrl(rawUrl);

      if (errorDescription) {
        console.warn('[MobileAuth] OAuth error description received:', errorDescription);
        try {
          await Browser.close();
        } catch {}
        return false;
      }

      // Flow A: Implicit Hash Flow (access_token + refresh_token)
      if (accessToken && refreshToken) {
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          try {
            await Browser.close();
          } catch {}

          if (!error && data?.session) {
            if (onSessionEstablished) onSessionEstablished(data.session);
            return true;
          }
          if (error) {
            console.warn('[MobileAuth] Failed to setSession:', error.message);
          }
        } catch (err) {
          console.warn('[MobileAuth] Exception setting session from tokens:', err);
        }
      }

      // Flow B: PKCE Auth Code Flow (code)
      if (code) {
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);

          try {
            await Browser.close();
          } catch {}

          if (!error && data?.session) {
            if (onSessionEstablished) onSessionEstablished(data.session);
            return true;
          }
          if (error) {
            console.warn('[MobileAuth] Failed to exchangeCodeForSession:', error.message);
          }
        } catch (err) {
          console.warn('[MobileAuth] Exception exchanging auth code:', err);
        }
      }

      return false;
    } finally {
      setTimeout(() => {
        activeExchangePromise = null;
      }, 2500);
    }
  })();

  return activeExchangePromise;
};

/**
 * Register mobile deep link listener in Capacitor environment
 */
export const registerMobileDeepLinkListener = (
  onSessionEstablished?: (session: any) => void
): (() => void) => {
  if (!isNativePlatform()) {
    return () => {};
  }

  let isSubscribed = true;

  try {
    const listenerPromise = CapacitorApp.addListener(
      'appUrlOpen',
      async (event: URLOpenListenerEvent) => {
        if (!isSubscribed) return;
        const incomingUrl = event?.url;
        if (!incomingUrl) return;

        console.info('[MobileAuth] App opened with URL:', incomingUrl);

        const isAuthUrl =
          incomingUrl.includes('auth-callback') ||
          incomingUrl.includes('access_token=') ||
          incomingUrl.includes('code=');

        if (isAuthUrl) {
          await handleIncomingAuthUrl(incomingUrl, onSessionEstablished);
        }

        if (incomingUrl.includes('order_id=') || incomingUrl.includes('subscription_id=')) {
          const orderMatch = incomingUrl.match(/order_id=([^&]+)/);
          const subMatch = incomingUrl.match(/subscription_id=([^&]+)/);
          const orderId = orderMatch ? decodeURIComponent(orderMatch[1]) : null;
          const subscriptionId = subMatch ? decodeURIComponent(subMatch[1]) : null;
          if (orderId || subscriptionId) {
            import('../services/payment/cashfreeService').then(
              async ({ verifyCashfreeOrder, verifyCashfreeSubscription }) => {
                if (subscriptionId) await verifyCashfreeSubscription(subscriptionId);
                else if (orderId) await verifyCashfreeOrder(orderId);
              }
            );
          }
        }
      }
    );

    return () => {
      isSubscribed = false;
      listenerPromise.then((sub) => sub.remove()).catch(() => {});
    };
  } catch (err) {
    console.warn('[MobileAuth] Failed to register appUrlOpen listener:', err);
    return () => {};
  }
};

/**
 * Check if the app was launched directly from a deep link URL on cold start
 */
export const checkLaunchUrlForAuth = async (
  onSessionEstablished?: (session: any) => void
): Promise<boolean> => {
  if (!isNativePlatform()) return false;
  try {
    const launchUrl = await CapacitorApp.getLaunchUrl();
    if (launchUrl?.url) {
      console.info('[MobileAuth] App launched with URL:', launchUrl.url);
      const isAuthUrl =
        launchUrl.url.includes('auth-callback') ||
        launchUrl.url.includes('access_token=') ||
        launchUrl.url.includes('code=');
      if (isAuthUrl) {
        return await handleIncomingAuthUrl(launchUrl.url, onSessionEstablished);
      }
    }
  } catch (err) {
    console.warn('[MobileAuth] Error checking launch URL:', err);
  }
  return false;
};

/**
 * Generate deep link to hand over session from WebApp to installed Mobile App
 */
export const getAppDeepLinkFromSession = (
  accessToken: string,
  refreshToken: string
): string => {
  return `${NATIVE_CUSTOM_SCHEME}#access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}&type=recovery`;
};


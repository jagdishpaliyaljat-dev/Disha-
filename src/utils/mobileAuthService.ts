import { App as CapacitorApp, URLOpenListenerEvent } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const GOOGLE_WEB_CLIENT_ID = '30041667176-vftn1ar5sj8qmtsv3rh81hl11kdd18b0.apps.googleusercontent.com';
export const NATIVE_CUSTOM_SCHEME = 'com.disha2020.examprep://auth-callback';
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
 * Returns { success: boolean, session?: any, error?: string, isNative: boolean }
 */
export const performNativeGoogleLogin = async (): Promise<{
  success: boolean;
  session?: any;
  error?: string;
  isNative: boolean;
}> => {
  if (!isNativePlatform()) {
    return { success: false, isNative: false };
  }

  try {
    const { SocialLogin } = await import('@capgo/capacitor-social-login');
    await initNativeSocialLogin();

    console.info('[MobileAuth] Launching Native Google One-Tap Sheet...');
    const response = await SocialLogin.login({
      provider: 'google',
      options: {
        forceRefreshToken: true,
      },
    });

    const idToken = (response?.result as any)?.idToken;
    if (!idToken) {
      console.warn('[MobileAuth] No idToken received in native response:', response);
      return { success: false, error: 'No ID token received from Google.', isNative: true };
    }

    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Supabase is not configured.', isNative: true };
    }

    console.info('[MobileAuth] Exchanging Google ID Token with Supabase signInWithIdToken...');
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) {
      console.error('[MobileAuth] Supabase signInWithIdToken error:', error.message);
      return { success: false, error: error.message, isNative: true };
    }

    return { success: true, session: data?.session, isNative: true };
  } catch (err: any) {
    console.warn('[MobileAuth] Native Google One-Tap error or cancelled:', err);
    return {
      success: false,
      error: err?.message || 'Native Google Sign-In failed.',
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
        presentationStyle: 'popover',
      });
      return;
    } catch (err) {
      console.warn('[MobileAuth] Browser.open failed, falling back to window.open:', err);
    }
  }

  // Fallback for Web or if Browser plugin failed
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


import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Retrieve credentials safely from Vite environment or process fallback
const getEnvVar = (key: string): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] as string;
  }
  return '';
};

export const SUPABASE_URL = getEnvVar('VITE_SUPABASE_URL');
export const SUPABASE_ANON_KEY = getEnvVar('VITE_SUPABASE_ANON_KEY');

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    SUPABASE_URL.startsWith('http') &&
    SUPABASE_ANON_KEY.length > 10
  );
};

// Safe fallback client to prevent client-side crashes if credentials are not yet entered
const createSafeClient = (): SupabaseClient => {
  if (isSupabaseConfigured()) {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  // Graceful proxy client when unconfigured
  const emptyPromise = () => Promise.resolve({ data: null, error: null });
  const handler: ProxyHandler<any> = {
    get: (_target, prop) => {
      if (prop === 'auth') {
        return {
          getUser: () => Promise.resolve({ data: { user: null }, error: null }),
          getSession: () => Promise.resolve({ data: { session: null }, error: null }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
          signInWithOAuth: emptyPromise,
          signOut: emptyPromise,
        };
      }
      if (prop === 'from') {
        return () => {
          const chainable = {
            select: () => chainable,
            insert: emptyPromise,
            update: emptyPromise,
            delete: emptyPromise,
            eq: () => chainable,
            neq: () => chainable,
            order: () => chainable,
            limit: () => chainable,
            then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
          };
          return chainable;
        };
      }
      return () => emptyPromise();
    },
  };

  return new Proxy({}, handler) as unknown as SupabaseClient;
};

export const supabase = createSafeClient();

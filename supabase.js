/**
 * Supabase JS UMD Bundle — Placeholder
 *
 * IMPORTANT: Replace this file with the actual Supabase UMD build.
 * Download it by running:
 *
 *   curl -o supabase.js https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js
 *
 * Or download manually from:
 *   https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js
 *
 * Save the downloaded file as supabase.js in the extension root folder,
 * replacing this placeholder.
 */

// Stub so the extension doesn't crash before the real bundle is added
if (typeof globalThis.supabase === 'undefined') {
  globalThis.supabase = {
    createClient: function() {
      console.warn('DD: Supabase placeholder loaded — replace supabase.js with the real UMD bundle');
      return {
        auth: {
          signInWithPassword: () => Promise.reject(new Error('Supabase not loaded')),
          signUp: () => Promise.reject(new Error('Supabase not loaded')),
          getSession: () => Promise.resolve({ data: { session: null } }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
        },
        from: () => ({
          select: () => Promise.resolve({ data: [], error: null }),
          insert: () => Promise.resolve({ data: null, error: null }),
          update: () => Promise.resolve({ data: null, error: null }),
          upsert: () => Promise.resolve({ data: null, error: null })
        })
      };
    }
  };
}

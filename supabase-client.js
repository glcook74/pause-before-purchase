// Supabase client initialization for Chrome extension
// Uses the global `supabase` object loaded via CDN importScripts

let _supabaseClient = null;

function getSupabaseClient() {
  if (_supabaseClient) return _supabaseClient;

  if (typeof supabase === 'undefined' || !supabase.createClient) {
    console.warn('[DD] Supabase SDK not loaded yet');
    return null;
  }

  _supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: {
        getItem: async (key) => {
          const result = await chrome.storage.local.get(key);
          return result[key] || null;
        },
        setItem: async (key, value) => {
          await chrome.storage.local.set({ [key]: value });
        },
        removeItem: async (key) => {
          await chrome.storage.local.remove(key);
        },
      },
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  return _supabaseClient;
}

/**
 * Clear all auth tokens and user identity keys from chrome.storage.
 * User-specific data (points, streaks, etc.) is cleared separately via DDStorage.clearAllUserData().
 */
async function clearAllAuthData() {
  await chrome.storage.local.remove([
    'dd_session',
    'dd_user_id',
    'dd_user_email',
    'dd_local_only',
  ]);
  console.log('[DD] Cleared all auth data');
}

/**
 * Restore session from chrome.storage.local.
 * Handles refresh token errors by clearing all auth state.
 * Saves refreshed tokens back if the SDK rotated them.
 */
async function restoreSession() {
  const client = getSupabaseClient();
  if (!client) return null;

  const { dd_session } = await chrome.storage.local.get('dd_session');
  if (!dd_session) return null;

  try {
    const { data, error } = await client.auth.setSession(dd_session);
    if (error) {
      const msg = error.message || '';
      console.warn('[DD] Failed to restore session:', msg);

      // If refresh token is already used/invalid, clear everything
      if (msg.includes('Refresh Token') || msg.includes('refresh_token') || msg.includes('Invalid')) {
        console.warn('[DD] Invalid refresh token detected — clearing all auth data');
        try { await client.auth.signOut(); } catch (e) { /* ignore */ }
        await clearAllAuthData();
      } else {
        await chrome.storage.local.remove(['dd_session', 'dd_user_id']);
      }
      return null;
    }

    // Save the NEW session back (tokens may have been refreshed)
    if (data.session) {
      await saveSession(data.session);
    }

    return data.session;
  } catch (e) {
    console.warn('[DD] Session restore error:', e);
    await clearAllAuthData();
    return null;
  }
}

// Save session to chrome.storage.local
async function saveSession(session) {
  if (session) {
    await chrome.storage.local.set({
      dd_session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      },
      dd_user_id: session.user.id,
    });
  } else {
    await clearAllAuthData();
  }
}

/**
 * Verify current session is valid by restoring and double-checking with Supabase.
 * Returns the session if valid, null otherwise (clears auth data on failure).
 */
async function verifySession() {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const session = await restoreSession();
    if (!session) return null;

    // Double-check with getSession
    const { data, error } = await client.auth.getSession();
    if (error || !data.session) {
      console.warn('[DD] Session verification failed:', error?.message);
      await clearAllAuthData();
      return null;
    }

    return data.session;
  } catch (e) {
    console.warn('[DD] Session verification error:', e);
    await clearAllAuthData();
    return null;
  }
}

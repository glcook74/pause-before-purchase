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

// Restore session from chrome.storage.local
async function restoreSession() {
  const client = getSupabaseClient();
  if (!client) return null;

  const { dd_session } = await chrome.storage.local.get('dd_session');
  if (!dd_session) return null;

  try {
    const { data, error } = await client.auth.setSession(dd_session);
    if (error) {
      console.warn('[DD] Failed to restore session:', error.message);
      await chrome.storage.local.remove(['dd_session', 'dd_user_id']);
      return null;
    }
    return data.session;
  } catch (e) {
    console.warn('[DD] Session restore error:', e);
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
    await chrome.storage.local.remove(['dd_session', 'dd_user_id']);
  }
}

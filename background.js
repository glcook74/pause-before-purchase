// Background service worker for Pause Before Purchase extension
// Loads Supabase via CDN and handles sync + pro status checks

try {
  importScripts(
    'lib/storage.js',
    'supabase.js',
    'supabase-config.js',
    'supabase-client.js',
    'sync.js'
  );
} catch (e) {
  console.warn('[DD] Failed to load scripts:', e);
}

const BG_WEB_APP_ORIGINS = ['https://dopaminedelay.com', 'https://www.dopaminedelay.com'];

// On install: set up device-level defaults only.
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({ dd_onboarded: true });
  await DDStorage.initActiveUser();
  await retrySyncQueue();
  await checkProStatus();
});

chrome.runtime.onStartup.addListener(async () => {
  await DDStorage.initActiveUser();
  await retrySyncQueue();
  await checkProStatus();
});

/**
 * Clear session from all open dopaminedelay.com tabs via bridge.
 */
async function clearWebAppSessions() {
  try {
    const tabs = await chrome.tabs.query({ url: BG_WEB_APP_ORIGINS.map(o => o + '/*') });
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'DD_BRIDGE_CLEAR_SESSION',
          reload: true,
        });
      } catch (e) { /* tab may not have bridge loaded */ }
    }
  } catch (e) {
    console.warn('[DD] Failed to clear web app sessions:', e);
  }
}

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PAUSE_EVENT') {
    DDStorage.initActiveUser().then(() => {
      syncPauseEvent(message.data)
        .then(() => sendResponse({ success: true }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
    });
    return true;
  }

  if (message.type === 'CHECK_PRO') {
    DDStorage.initActiveUser().then(() => {
      checkProStatus()
        .then(() => sendResponse({ success: true }))
        .catch(() => sendResponse({ success: false }));
    });
    return true;
  }

  if (message.type === 'RETRY_QUEUE') {
    DDStorage.initActiveUser().then(() => {
      retrySyncQueue()
        .then(() => sendResponse({ success: true }))
        .catch(() => sendResponse({ success: false }));
    });
    return true;
  }

  // Verify session — returns userId AND email so popup can detect mismatches
  if (message.type === 'VERIFY_SESSION') {
    verifySession()
      .then((session) => {
        if (session) {
          sendResponse({
            success: true,
            userId: session.user.id,
            email: session.user.email || null,
          });
        } else {
          sendResponse({ success: false });
        }
      })
      .catch(() => sendResponse({ success: false }));
    return true;
  }

  // Full sign out — clears extension data AND web app sessions via bridge
  if (message.type === 'SIGN_OUT') {
    (async () => {
      try {
        const { dd_user_id } = await chrome.storage.local.get('dd_user_id');

        const client = getSupabaseClient();
        if (client) {
          try { await client.auth.signOut(); } catch (e) { /* ignore */ }
        }

        // Clear user-scoped data for this account
        if (dd_user_id) {
          await DDStorage.clearAllUserData(dd_user_id);
        }

        // Clear auth keys
        await clearAllAuthData();
        DDStorage.setActiveUser(null);

        // Also clear session from any open dopaminedelay.com tabs
        await clearWebAppSessions();

        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false });
      }
    })();
    return true;
  }
});

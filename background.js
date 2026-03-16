// Background service worker for Pause Before Purchase extension
// Loads Supabase via CDN and handles sync + pro status checks

try {
  importScripts(
    'supabase.js',
    'supabase-config.js',
    'supabase-client.js',
    'sync.js'
  );
} catch (e) {
  console.warn('[DD] Failed to load scripts:', e);
}

// On service worker startup: retry queued events and check pro status
chrome.runtime.onInstalled.addListener(async () => {
  // Award 50 welcome bonus points if not yet awarded
  const { dd_welcome_bonus } = await chrome.storage.local.get('dd_welcome_bonus');
  if (!dd_welcome_bonus) {
    const { dd_points } = await chrome.storage.local.get('dd_points');
    await chrome.storage.local.set({
      dd_points: (dd_points || 0) + 50,
      dd_welcome_bonus: true,
    });
  }

  await retrySyncQueue();
  await checkProStatus();
});

chrome.runtime.onStartup.addListener(async () => {
  await retrySyncQueue();
  await checkProStatus();
});

// Listen for pause events from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PAUSE_EVENT') {
    syncPauseEvent(message.data)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // keep message channel open for async response
  }

  if (message.type === 'CHECK_PRO') {
    checkProStatus()
      .then(() => sendResponse({ success: true }))
      .catch(() => sendResponse({ success: false }));
    return true;
  }

  if (message.type === 'RETRY_QUEUE') {
    retrySyncQueue()
      .then(() => sendResponse({ success: true }))
      .catch(() => sendResponse({ success: false }));
    return true;
  }
});

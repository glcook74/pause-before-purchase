// Background service worker for Pause Before Purchase extension
// Loads Supabase via CDN and handles sync + pro status checks

try {
  importScripts(
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
    'supabase-config.js',
    'supabase-client.js',
    'sync.js'
  );
} catch (e) {
  console.warn('[DD] Failed to load scripts:', e);
}

// On service worker startup: retry queued events and check pro status
chrome.runtime.onInstalled.addListener(async () => {
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

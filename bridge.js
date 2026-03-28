window.__DD_EXTENSION_INSTALLED = true;
localStorage.setItem('dd_extension_installed', 'true');
window.dispatchEvent(new CustomEvent('dd-extension-detected'));

/**
 * Dopamine Delay — Bridge Content Script
 * Runs ONLY on dopaminedelay.com pages.
 * Relays auth sessions between the web app and the Chrome extension,
 * so signing in via the extension also signs into the dashboard (and vice versa).
 */

(function () {
  'use strict';

  // Supabase stores sessions in localStorage under "sb-<projectRef>-auth-token"
  function findSessionKey() {
    const keys = Object.keys(localStorage);
    return keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token')) || null;
  }

  // Listen for messages from the extension (background or popup)
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    // --- Read the web app's current Supabase session ---
    if (message.type === 'DD_BRIDGE_GET_SESSION') {
      try {
        const key = findSessionKey();
        if (key) {
          const raw = localStorage.getItem(key);
          const session = raw ? JSON.parse(raw) : null;
          sendResponse({ success: true, session });
        } else {
          sendResponse({ success: false });
        }
      } catch (e) {
        console.warn('[DD Bridge] Error reading session:', e);
        sendResponse({ success: false, error: e.message });
      }
      return true;
    }

    // --- Inject a session into the web app's localStorage ---
    if (message.type === 'DD_BRIDGE_SET_SESSION') {
      try {
        // Derive the key from the project ref in the URL, or find existing key
        let key = findSessionKey();
        if (!key && message.projectRef) {
          key = 'sb-' + message.projectRef + '-auth-token';
        }
        if (!key) {
          sendResponse({ success: false, error: 'No session key found' });
          return true;
        }

        localStorage.setItem(key, JSON.stringify(message.session));
        sendResponse({ success: true });

        // Reload so the web app picks up the new session
        if (message.reload !== false) {
          window.location.reload();
        }
      } catch (e) {
        console.warn('[DD Bridge] Error setting session:', e);
        sendResponse({ success: false, error: e.message });
      }
      return true;
    }

    // --- Clear the web app's session (sign out) ---
    if (message.type === 'DD_BRIDGE_CLEAR_SESSION') {
      try {
        const key = findSessionKey();
        if (key) {
          localStorage.removeItem(key);
        }
        sendResponse({ success: true });

        if (message.reload !== false) {
          window.location.reload();
        }
      } catch (e) {
        console.warn('[DD Bridge] Error clearing session:', e);
        sendResponse({ success: false, error: e.message });
      }
      return true;
    }
  });

  console.log('[DD Bridge] Ready on', window.location.hostname);
})();

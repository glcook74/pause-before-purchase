/**
 * Dopamine Delay — Browser API Compatibility Layer
 * Normalises Chrome and Safari (browser.*) API differences.
 *
 * Safari Web Extensions support the chrome.* namespace but also
 * expose browser.* APIs. This polyfill ensures consistent behaviour
 * across both browsers.
 *
 * Key differences handled:
 * - Safari merges storage.local and storage.sync (we use local only)
 * - Safari storage.onChanged works in content scripts but not in
 *   iframe-embedded extension pages
 * - Safari supports both service_worker and background scripts
 */

(function () {
  'use strict';

  // Ensure globalThis.chrome exists (Safari uses browser.* but also supports chrome.*)
  if (typeof globalThis.chrome === 'undefined' && typeof globalThis.browser !== 'undefined') {
    globalThis.chrome = globalThis.browser;
  }

  // Ensure chrome.runtime is available
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    // Not running in extension context — skip polyfill
    return;
  }

  // Wrap callback-style APIs to also support Promises where needed
  // (Safari's browser.* APIs return Promises; Chrome's chrome.* use callbacks)
  // Our code uses callbacks consistently, so this is mainly defensive.

  const originalStorageGet = chrome.storage.local.get.bind(chrome.storage.local);
  const originalStorageSet = chrome.storage.local.set.bind(chrome.storage.local);

  // Ensure get() always works with callbacks
  chrome.storage.local.get = function (keys, callback) {
    const result = originalStorageGet(keys, callback);
    // If the browser returns a Promise (Safari) and a callback was provided,
    // the callback approach should still work. This is defensive.
    if (result && typeof result.then === 'function' && callback) {
      result.then(callback).catch(() => callback({}));
    }
    return result;
  };

  // Ensure set() always works with callbacks
  chrome.storage.local.set = function (items, callback) {
    const result = originalStorageSet(items, callback);
    if (result && typeof result.then === 'function' && callback) {
      result.then(callback).catch(() => callback());
    }
    return result;
  };
})();

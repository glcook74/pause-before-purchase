/**
 * Pause Before Purchase - Background Service Worker
 * Handles extension initialization and default settings.
 */

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default settings on first install
    chrome.storage.sync.set({
      enabled: true,
      cooldownMinutes: '10',
      plannedCooldownMinutes: '2',
      stats: {
        pausesToday: 0,
        impulseCaught: 0,
        proceededCount: 0,
        lastResetDate: new Date().toDateString(),
      },
    });
  }
});

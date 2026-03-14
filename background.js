/**
 * Dopamine Delay — Background Service Worker
 * Handles extension lifecycle, onboarding trigger, and checkout URL detection.
 */

// Checkout URL patterns to detect
const CHECKOUT_URL_PATTERNS = [
  /\/checkout/i,
  /\/basket/i,
  /\/cart/i,
  /\/payment/i,
  /\/order-confirm/i,
  /\/buy-now/i,
  /\/order.*confirm/i,
  /\/pay\b/i
];

// Major UK e-commerce domains
const SHOPPING_DOMAINS = [
  'amazon.co.uk',
  'asos.com',
  'ebay.co.uk',
  'argos.co.uk',
  'tesco.com',
  'boots.com',
  'johnlewis.com',
  'currys.co.uk',
  'shein.co.uk',
  'shein.com',
  'klarna.com'
];

/**
 * On install: open onboarding, set welcome points.
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // Set default settings
    await chrome.storage.local.set({
      dd_settings: {
        pauseDuration: 10,
        lateNightMode: true,
        theme: 'cream'
      },
      dd_points: 0,
      dd_streak: { count: 0, lastDate: null },
      dd_pauses_today: { count: 0, date: null },
      dd_saved_items: [],
      dd_onboarded: false,
      dd_disabled_sites: []
    });

    // Open onboarding
    chrome.tabs.create({
      url: chrome.runtime.getURL('onboarding.html')
    });
  }
});

/**
 * Listen for tab updates to detect checkout pages.
 * Send a message to the content script when a checkout page is detected.
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;

  const isCheckoutPage = isCheckoutURL(tab.url);

  if (isCheckoutPage) {
    chrome.tabs.sendMessage(tabId, {
      type: 'DD_CHECKOUT_DETECTED',
      url: tab.url,
      hostname: extractHostname(tab.url)
    }).catch(() => {
      // Content script may not be injected yet — that's fine
    });
  }
});

function isCheckoutURL(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/^www\./, '');

    // Check if it's a known shopping domain
    const isShoppingSite = SHOPPING_DOMAINS.some(domain =>
      hostname === domain || hostname.endsWith('.' + domain)
    );

    // Check URL path patterns
    const hasCheckoutPath = CHECKOUT_URL_PATTERNS.some(pattern =>
      pattern.test(urlObj.pathname)
    );

    return isShoppingSite || hasCheckoutPath;
  } catch {
    return false;
  }
}

function extractHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Handle messages from content scripts and popup.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DD_CHECK_CHECKOUT') {
    const result = isCheckoutURL(message.url);
    sendResponse({ isCheckout: result });
    return true;
  }

  if (message.type === 'DD_GET_HOSTNAME') {
    sendResponse({ hostname: extractHostname(message.url) });
    return true;
  }
});

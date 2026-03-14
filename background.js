/**
 * Dopamine Delay — Background Service Worker
 * Handles extension lifecycle, onboarding trigger, and checkout URL detection.
 */

// Checkout URL patterns to detect
const CHECKOUT_URL_PATTERNS = [
  /\/checkout/i,
  /\/basket/i,
  /\/cart/i,
  /\/buy-now/i,
  /\/payment/i,
  /\/order-summary/i,
  /\/confirm-order/i,
  /\/place-order/i,
  /\/secure\/checkout/i,
  /\/purchase/i
];

// URL segments that indicate non-purchase pages
const EXCLUDED_URL_SEGMENTS = [
  'signin', 'login', 'register', 'account', 'profile',
  'wishlist', 'saved-items', 'returns', 'orders', 'help',
  'support', 'search', 'browse', 'category', 'department',
  'homepage', 'yourstore'
];

// Amazon-specific checkout paths
const AMAZON_CHECKOUT_PATTERNS = [
  /\/gp\/buy\//i, /\/checkout\//i, /\/gp\/cart/i
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
    const fullUrl = url.toLowerCase();

    // Never trigger on excluded URL segments (unless also contains checkout)
    const hasExcluded = EXCLUDED_URL_SEGMENTS.some(seg => fullUrl.includes(seg));
    const hasCheckoutWord = /checkout/i.test(fullUrl);
    if (hasExcluded && !hasCheckoutWord) return false;

    const isAmazon = hostname === 'amazon.co.uk' || hostname.endsWith('.amazon.co.uk');

    // Amazon-specific: only trigger on known checkout/cart paths
    if (isAmazon) {
      return AMAZON_CHECKOUT_PATTERNS.some(p => p.test(urlObj.pathname));
    }

    // All other sites: require a checkout URL pattern
    // (DOM signal check happens in content script where we have page access)
    return CHECKOUT_URL_PATTERNS.some(pattern =>
      pattern.test(urlObj.pathname)
    );
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

try {
  importScripts(
    'supabase.js',
    'supabase-config.js',
    'supabase-client.js',
    'sync.js'
  );
} catch (e) {
  console.warn('DD: Could not load Supabase scripts', e);
  // Extension will run in local-only mode
}

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

// URL patterns that should NEVER trigger the overlay
const EXCLUDED_URL_PATTERNS = [
  /\/signin/i,
  /\/sign-in/i,
  /\/login/i,
  /\/log-in/i,
  /\/register/i,
  /\/account/i,
  /\/profile/i,
  /\/wishlist/i,
  /\/wish-list/i,
  /\/returns/i,
  /\/orders(?!.*checkout)/i,
  /\/help/i,
  /\/support/i,
  /\/ap\/signin/i,
  /\/ap\/register/i,
  /\/gp\/css/i,
  /\/yourstore/i,
  /\/gp\/yourstore/i
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
    const fullPath = urlObj.pathname + urlObj.search;

    // Never trigger on excluded pages
    const isExcluded = EXCLUDED_URL_PATTERNS.some(pattern =>
      pattern.test(fullPath)
    );
    if (isExcluded) {
      console.log('DD: Excluded URL —', url);
      return false;
    }

    // Must be a known shopping domain
    const isShoppingSite = SHOPPING_DOMAINS.some(domain =>
      hostname === domain || hostname.endsWith('.' + domain)
    );
    if (!isShoppingSite) return false;

    // Must have a checkout path pattern
    const hasCheckoutPath = CHECKOUT_URL_PATTERNS.some(pattern =>
      pattern.test(fullPath)
    );

    if (hasCheckoutPath) {
      console.log('DD: Checkout detected —', url);
    }

    return hasCheckoutPath;

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

  if (message.type === 'PAUSE_EVENT') {
    // Forward to sync.js handler
    // sync.js will be loaded via importScripts
    if (typeof syncPauseEvent === 'function') {
      syncPauseEvent(message.data).then(() => {
        sendResponse({ success: true });
      }).catch((err) => {
        console.error('DD: Sync failed', err);
        sendResponse({ success: false, error: err.message });
      });
      return true; // Keep channel open for async response
    }
  }

  if (message.type === 'DD_RETRY_SYNC') {
    if (typeof retrySyncQueue === 'function') {
      retrySyncQueue();
    }
    sendResponse({ success: true });
    return true;
  }
});

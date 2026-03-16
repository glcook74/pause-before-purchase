/**
 * Dopamine Delay — Content Script
 * Detects checkout/payment pages and injects the pause overlay.
 * Grounded in dopamine reward deficit model (Volkow et al., 2009),
 * delay discounting research, and inhibitory control evidence.
 */

(function () {
  'use strict';

  // ===== CHECKOUT DETECTION =====

  const CHECKOUT_URL_PATTERNS = [
    /\/checkout/i, /\/basket/i, /\/cart/i, /\/payment/i,
    /\/order-confirm/i, /\/buy-now/i, /\/order.*confirm/i, /\/pay\b/i
  ];

  const SHOPPING_DOMAINS = [
    'amazon.co.uk', 'asos.com', 'ebay.co.uk', 'argos.co.uk',
    'tesco.com', 'boots.com', 'johnlewis.com', 'currys.co.uk',
    'shein.co.uk', 'shein.com', 'klarna.com','very'
  ];

  const DARK_PATTERN_PHRASES = [
    /only \d+ left/i, /ends in/i, /flash sale/i, /limited time/i,
    /selling fast/i, /just \d+ people? viewing/i, /hurry/i,
    /don't miss out/i, /last chance/i, /almost gone/i,
    /order within/i, /low stock/i
  ];

  let overlayActive = false;
  let timerInterval = null;

  // ===== INITIALISATION =====

  async function init() {
    // Check if onboarded
  const { dd_onboarded } = await chrome.storage.local.get('dd_onboarded');const onboarded = dd_onboarded || false;
    if (!onboarded) return;

    // Check if this site is disabled
    const hostname = window.location.hostname.replace(/^www\./, '');
    const { dd_disabled_sites } = await chrome.storage.local.get('dd_disabled_sites'); const disabledSites = dd_disabled_sites || []; if (disabledSites.includes(hostname)) return;

    // Check if this is a checkout page
    if (isCheckoutPage()) {
      showOverlay();
    }

    // Also listen for messages from background script
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'DD_CHECKOUT_DETECTED' && !overlayActive) {
        showOverlay();
      }
    });
  }

  function isCheckoutPage() {
    const url = window.location.href;
    const hostname = window.location.hostname.replace(/^www\./, '');

    const isShoppingSite = SHOPPING_DOMAINS.some(domain =>
      hostname === domain || hostname.endsWith('.' + domain)
    );

    const hasCheckoutPath = CHECKOUT_URL_PATTERNS.some(pattern =>
      pattern.test(window.location.pathname)
    );

    return isShoppingSite || hasCheckoutPath;
  }

  // ===== PRODUCT EXTRACTION =====

  function extractProductInfo() {
    const info = {
      product: '',
      price: '',
      site: window.location.hostname.replace(/^www\./, '')
    };

    // Try common product name selectors
    const productSelectors = [
      '#productTitle',                           // Amazon
      'h1[data-test-id="product-title"]',        // ASOS
      '.product-title h1', '.product-title',     // Generic
      'h1.product-name', '.product-name h1',
      '[data-testid="product-title"]',
      '.item-title', '#itemTitle',               // eBay
      'h1[itemprop="name"]',
      '.product-details h1',
      'h1'
    ];

    for (const selector of productSelectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent.trim().length > 2 && el.textContent.trim().length < 200) {
        info.product = el.textContent.trim().substring(0, 100);
        break;
      }
    }

    // Try common price selectors
    const priceSelectors = [
      '.a-price .a-offscreen',                   // Amazon
      '[data-test-id="current-price"]',          // ASOS
      '.current-price', '.product-price',
      '#prcIsum', '.display-price',              // eBay
      '[itemprop="price"]',
      '.price-current', '.sale-price',
      '.product-price-amount',
      '.price'
    ];

    for (const selector of priceSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.textContent.trim();
        const priceMatch = text.match(/[£$€]\s*[\d,.]+/);
        if (priceMatch) {
          info.price = priceMatch[0];
          break;
        }
      }
    }

    return info;
  }

  // ===== DARK PATTERN DETECTION =====

  function detectDarkPatterns() {
    const bodyText = document.body.innerText || '';
    const detected = [];

    for (const pattern of DARK_PATTERN_PHRASES) {
      const match = bodyText.match(pattern);
      if (match) {
        detected.push(match[0]);
      }
    }

    return detected;
  }

  // ===== POINTS TOAST =====

  function showPointsToast(message) {
    // Remove any existing toast
    const existing = document.querySelector('.dd-points-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'dd-points-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 3000);
  }

  // ===== SCREEN 1: BEFORE YOU BUY =====

  async function showOverlay() {
    if (overlayActive) return;
    overlayActive = true;

    const productInfo = extractProductInfo();
    const darkPatterns = detectDarkPatterns();
    const settings = await DDStorage.getSettings();

    // Record pause
    await DDStorage.incrementPausesToday();
    await DDStorage.recordPauseForStreak();

    const overlay = document.createElement('div');
    overlay.className = 'dd-overlay';
    if (settings.theme === 'dark') {
      overlay.classList.add('dd-dark');
    }

    let darkPatternHTML = '';
    if (darkPatterns.length > 0) {
      darkPatternHTML = `
        <div class="dd-dark-pattern-banner">
          <strong>Heads up:</strong> this page is using urgency tactics. You have more time than it seems.
        </div>
      `;
    }

    let purchaseInfoHTML = '';
    if (productInfo.site || productInfo.product || productInfo.price) {
      purchaseInfoHTML = `
        <div class="dd-purchase-info">
          ${productInfo.site ? `<div class="dd-purchase-site">${escapeHTML(productInfo.site)}</div>` : ''}
          ${productInfo.product ? `<div class="dd-purchase-product">${escapeHTML(productInfo.product)}</div>` : ''}
          ${productInfo.price ? `<div class="dd-purchase-price">${escapeHTML(productInfo.price)}</div>` : ''}
        </div>
      `;
    }

    overlay.innerHTML = `
      <div class="dd-modal">
        <button class="dd-close-btn" title="Close" aria-label="Close">&times;</button>
        ${darkPatternHTML}
        <h2 class="dd-heading">Before you buy</h2>
        ${purchaseInfoHTML}
        <p class="dd-question">Quick check — what kind of purchase is this?</p>
        <div class="dd-choices">
          <button class="dd-choice-card" data-type="necessary">
            <span class="dd-choice-icon">✅</span>
            <span class="dd-choice-content">
              <span class="dd-choice-label">NECESSARY</span>
              <span class="dd-choice-desc">I genuinely need this</span>
            </span>
          </button>
          <button class="dd-choice-card" data-type="planned">
            <span class="dd-choice-icon">📋</span>
            <span class="dd-choice-content">
              <span class="dd-choice-label">PLANNED</span>
              <span class="dd-choice-desc">I've been thinking about this for a while</span>
            </span>
          </button>
          <button class="dd-choice-card" data-type="impulsive">
            <span class="dd-choice-icon">⚡</span>
            <span class="dd-choice-content">
              <span class="dd-choice-label">IMPULSIVE</span>
              <span class="dd-choice-desc">I just want it right now</span>
            </span>
          </button>
        </div>
        <p class="dd-honesty">Be honest — it helps.</p>
      </div>
    `;

    document.body.appendChild(overlay);

    // Event handlers
    overlay.querySelector('.dd-close-btn').addEventListener('click', () => {
      closeOverlay(overlay);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeOverlay(overlay);
    });

    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeOverlay(overlay);
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    overlay.querySelectorAll('.dd-choice-card').forEach(card => {
      card.addEventListener('click', async () => {
        const type = card.dataset.type;
        // +5 points for completing classification
        await DDStorage.addPoints(5);

        if (type === 'necessary' || type === 'planned') {
          showAffirmation(overlay);
          showPointsToast('+5 Delay Points');
        } else if (type === 'impulsive') {
          showPointsToast('+5 Delay Points');
          showScreen2(overlay, productInfo, settings);
        }
      });
    });
  }

  // ===== AFFIRMATION =====

  function showAffirmation(overlay) {
    const modal = overlay.querySelector('.dd-modal');
    modal.innerHTML = `
      <div class="dd-affirmation">
        <span class="dd-affirmation-icon">💚</span>
        <p class="dd-affirmation-text">Good thinking. You've got this.</p>
        <p class="dd-affirmation-sub">Your choice, always.</p>
      </div>
    `;

    setTimeout(() => {
      closeOverlay(overlay);
    }, 2500);
  }

  // ===== SCREEN 2: REDIRECT THAT ENERGY =====

  async function showScreen2(overlay, productInfo, settings) {
    const modal = overlay.querySelector('.dd-modal');
    const profile = await DDStorage.getProfile();
    const alternatives = DDAlternatives.getAlternatives(4, profile);
    const pauseDuration = await DDStorage.getEffectivePauseDuration(productInfo.price);

    let remaining = pauseDuration;

    const altTilesHTML = alternatives.map(alt => `
      <button class="dd-alt-tile" data-id="${alt.id}" data-action="${alt.action}" ${alt.url ? `data-url="${alt.url}"` : ''} ${alt.detail ? `data-detail="${escapeHTML(alt.detail)}"` : ''}>
        <span class="dd-alt-icon">${alt.icon}</span>
        <span class="dd-alt-category">${alt.category}</span>
        <span class="dd-alt-label">${alt.label}</span>
      </button>
    `).join('');

    modal.innerHTML = `
      <button class="dd-close-btn" title="Close" aria-label="Close">&times;</button>
      <h2 class="dd-heading">Let's redirect that energy</h2>
      <p class="dd-subheading">Your brain wants dopamine. Here are some ways to get it without spending.</p>

      <div class="dd-alternatives-grid">
        ${altTilesHTML}
      </div>

      <div id="dd-alt-detail" class="dd-detail-box" style="display: none !important;"></div>

      <div class="dd-timer-section">
        <p class="dd-breathe-text">Breathe in... breathe out...</p>
        <p class="dd-timer-display" id="dd-timer">${remaining}</p>
        <p class="dd-timer-label">seconds remaining</p>
        <div class="dd-progress-bar">
          <div class="dd-progress-fill" id="dd-progress"></div>
        </div>
      </div>

      <button class="dd-save-btn" id="dd-save-btn">Save for later</button>
      <button class="dd-proceed-link" id="dd-proceed" disabled>Wait for pause to finish...</button>
    `;

    // Close button
    modal.querySelector('.dd-close-btn').addEventListener('click', () => {
      closeOverlay(overlay);
    });

    // Timer
    const timerEl = document.getElementById('dd-timer');
    const progressEl = document.getElementById('dd-progress');
    const proceedBtn = document.getElementById('dd-proceed');

    timerInterval = setInterval(() => {
      remaining--;
      if (timerEl) timerEl.textContent = remaining;
      if (progressEl) {
        const pct = ((pauseDuration - remaining) / pauseDuration) * 100;
        progressEl.style.width = pct + '%';
      }
      if (remaining <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        if (timerEl) timerEl.textContent = '0';
        if (proceedBtn) {
          proceedBtn.disabled = false;
          proceedBtn.textContent = 'Continue to purchase — your choice';
          proceedBtn.style.color = '#6B6459';
        }
      }
    }, 1000);

    // Alternative tiles
    modal.querySelectorAll('.dd-alt-tile').forEach(tile => {
      tile.addEventListener('click', () => {
        const action = tile.dataset.action;
        if (action === 'external' && tile.dataset.url) {
          window.open(tile.dataset.url, '_blank');
        } else if (action === 'inline' && tile.dataset.detail) {
          const detailBox = document.getElementById('dd-alt-detail');
          if (detailBox) {
            detailBox.textContent = tile.dataset.detail;
            detailBox.style.display = 'block';
          }
        }
      });
    });

    // Save for later
    document.getElementById('dd-save-btn').addEventListener('click', async () => {
      await DDStorage.saveItem({
        product: productInfo.product,
        site: productInfo.site,
        price: productInfo.price,
        url: window.location.href
      });
      await DDStorage.addPoints(15);
      showPointsToast('+15 Delay Points — brilliant pause!');
      closeOverlay(overlay);
    });

    // Proceed button
    proceedBtn.addEventListener('click', () => {
      if (!proceedBtn.disabled) {
        closeOverlay(overlay);
      }
    });
  }

  // ===== HELPERS =====

  function closeOverlay(overlay) {
    overlayActive = false;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ===== START =====

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

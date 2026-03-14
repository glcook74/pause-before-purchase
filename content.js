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
    'shein.co.uk', 'shein.com', 'klarna.com'
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
    const onboarded = await DDStorage.isOnboarded();
    if (!onboarded) return;

    // Check if this site is disabled
    const hostname = window.location.hostname.replace(/^www\./, '');
    const disabledSites = await DDStorage.getDisabledSites();
    if (disabledSites.includes(hostname)) return;

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

        if (type === 'necessary') {
          // Points are only awarded for behaviour that demonstrates
          // genuine pause and redirection. Proceeding with a necessary
          // purchase requires no intervention — rewarding it would
          // dilute the meaning of the points system and create
          // perverse incentives (Jason Lear advisory principle:
          // reward real behaviour change, not gaming).
          showAffirmation(overlay, 'Got it — good luck with your purchase.');
        } else if (type === 'planned') {
          // Planned: 0 points for classification. Points only awarded
          // if user saves the item (+15), not if they buy now.
          showPlannedScreen(overlay, productInfo, settings);
        } else if (type === 'impulsive') {
          // +5 points for completing the impulsive check-in
          await DDStorage.addPoints(5);
          showPointsToast('+5 Delay Points');
          showScreen2(overlay, productInfo, settings);
        }
      });
    });
  }

  // ===== AFFIRMATION =====

  function showAffirmation(overlay, customMessage) {
    const modal = overlay.querySelector('.dd-modal');
    const message = customMessage || 'Good thinking. You\'ve got this.';
    modal.innerHTML = `
      <div class="dd-affirmation">
        <span class="dd-affirmation-icon">💚</span>
        <p class="dd-affirmation-text">${escapeHTML(message)}</p>
        <p class="dd-affirmation-sub">Your choice, always.</p>
      </div>
    `;

    setTimeout(() => {
      closeOverlay(overlay);
    }, 2500);
  }

  // ===== SCREEN 2 (PLANNED): SAVE OR BUY =====

  function showPlannedScreen(overlay, productInfo, settings) {
    const modal = overlay.querySelector('.dd-modal');

    modal.innerHTML = `
      <button class="dd-close-btn" title="Close" aria-label="Close">&times;</button>
      <h2 class="dd-heading">Good thinking — you've been here before.</h2>
      <p class="dd-subheading">Since you've been planning this, do you want to save it to your list to buy at the right moment?</p>

      <div class="dd-planned-actions">
        <button class="dd-save-btn" id="dd-planned-save">Add to my shopping list</button>
        <button class="dd-proceed-link dd-planned-buy" id="dd-planned-buy">Buy it now — I'm ready</button>
      </div>
    `;

    modal.querySelector('.dd-close-btn').addEventListener('click', () => {
      closeOverlay(overlay);
    });

    document.getElementById('dd-planned-save').addEventListener('click', async () => {
      await DDStorage.saveItem({
        product: productInfo.product,
        site: productInfo.site,
        price: productInfo.price,
        url: window.location.href,
        type: 'planned'
      });
      await DDStorage.addPoints(15);
      showPointsToast('Added to your list! +15 Delay Points ⭐');
      closeOverlay(overlay);
    });

    document.getElementById('dd-planned-buy').addEventListener('click', () => {
      // 0 points — buying a planned purchase is fine but not rewarded
      closeOverlay(overlay);
    });
  }

  // ===== SCREEN 2: REDIRECT THAT ENERGY =====

  async function showScreen2(overlay, productInfo, settings) {
    const modal = overlay.querySelector('.dd-modal');
    const profile = await DDStorage.getProfile();
    const pauseDuration = await DDStorage.getEffectivePauseDuration(productInfo.price);

    // Check Pro status
    const proData = await new Promise(resolve => {
      chrome.storage.local.get('dd_pro', result => resolve(result));
    });
    const isPro = proData.dd_pro === true;

    const altCount = isPro ? 4 : 3;
    const alternatives = DDAlternatives.getAlternatives(altCount, profile);

    let remaining = pauseDuration;

    const altTilesHTML = alternatives.map(alt => `
      <button class="dd-alt-tile" data-id="${alt.id}" data-action="${alt.action}" ${alt.url ? `data-url="${alt.url}"` : ''} ${alt.detail ? `data-detail="${escapeHTML(alt.detail)}"` : ''}>
        <span class="dd-alt-icon">${alt.icon}</span>
        <span class="dd-alt-category">${alt.category}</span>
        <span class="dd-alt-label">${alt.label}</span>
      </button>
    `).join('');

    // Pro: "See more options" button | Free: locked upsell card
    let proSectionHTML = '';
    if (isPro) {
      proSectionHTML = `
        <button class="dd-see-more-btn" id="dd-see-more">See more options</button>
        <div id="dd-more-alternatives" class="dd-alternatives-grid dd-more-grid" style="display: none !important;"></div>
      `;
    } else {
      const remaining_count = DDAlternatives.LIBRARY.length - altCount;
      proSectionHTML = `
        <div class="dd-locked-card">
          <span class="dd-locked-icon">⭐</span>
          <span class="dd-locked-text">Pro — ${remaining_count} more activities + your personalised picks</span>
          <a href="https://buy.stripe.com/test_dopamine_delay_pro" target="_blank" class="dd-locked-btn">Unlock Pro — £4.99/month</a>
        </div>
      `;
    }

    modal.innerHTML = `
      <button class="dd-close-btn" title="Close" aria-label="Close">&times;</button>
      <h2 class="dd-heading">Let's redirect that energy</h2>
      <p class="dd-subheading">Your brain wants dopamine. Here are some ways to get it without spending.</p>

      <div class="dd-alternatives-grid">
        ${altTilesHTML}
      </div>

      ${proSectionHTML}

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

    // Pro: See more options
    const seeMoreBtn = document.getElementById('dd-see-more');
    if (seeMoreBtn) {
      seeMoreBtn.addEventListener('click', () => {
        const moreGrid = document.getElementById('dd-more-alternatives');
        if (moreGrid && moreGrid.style.display !== 'none') {
          moreGrid.style.display = 'none';
          seeMoreBtn.textContent = 'See more options';
          return;
        }
        const shownIds = alternatives.map(a => a.id);
        const remaining = DDAlternatives.getFullLibrary().filter(a => !shownIds.includes(a.id));
        if (moreGrid) {
          moreGrid.innerHTML = remaining.map(alt => `
            <button class="dd-alt-tile" data-id="${alt.id}" data-action="${alt.action}" ${alt.url ? `data-url="${alt.url}"` : ''} ${alt.detail ? `data-detail="${escapeHTML(alt.detail)}"` : ''}>
              <span class="dd-alt-icon">${alt.icon}</span>
              <span class="dd-alt-category">${alt.category}</span>
              <span class="dd-alt-label">${alt.label}</span>
            </button>
          `).join('');
          moreGrid.style.display = 'grid';
          seeMoreBtn.textContent = 'Show fewer';
          // Attach click handlers to new tiles
          moreGrid.querySelectorAll('.dd-alt-tile').forEach(tile => {
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
        }
      });
    }

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

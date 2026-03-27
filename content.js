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
    /\/order-confirm/i, /\/buy-now/i, /\/order.*confirm/i, /\/pay\b/i,
    /\/gp\/buy/i, /\/spc\//i, /place.*order/i
  ];

  const SHOPPING_DOMAINS = [
    'amazon.co.uk', 'amazon.com', 'asos.com', 'ebay.co.uk', 'argos.co.uk',
    'tesco.com', 'boots.com', 'johnlewis.com', 'currys.co.uk',
    'shein.co.uk', 'shein.com', 'klarna.com', 'very.co.uk', 'next.co.uk'
  ];

  const DARK_PATTERN_PHRASES = [
    /only \d+ left/i, /ends in/i, /flash sale/i, /limited time/i,
    /selling fast/i, /just \d+ people? viewing/i, /hurry/i,
    /don't miss out/i, /last chance/i, /almost gone/i,
    /order within/i, /low stock/i
  ];

  let overlayActive = false;
  let timerInterval = null;
  let currentEmotion = null;
  let currentDarkPatterns = [];

  // ===== INITIALISATION =====

  async function init() {
    try {
      console.log('DD: content script loaded', window.location.href);

      // Set the active user so all DDStorage reads/writes are scoped correctly
      await DDStorage.initActiveUser();

      // Check if onboarded
      const { dd_onboarded } = await chrome.storage.local.get('dd_onboarded');
      // Default to true so overlay works without completing onboarding
      const onboarded = dd_onboarded !== false;
      if (!onboarded) return;

      // Check if paused
      const { dd_paused } = await chrome.storage.local.get('dd_paused');
      if (dd_paused) return;

      // Check if this site is disabled
      const hostname = window.location.hostname.replace(/^www\./, '');
      const disabledSites = await DDStorage.getDisabledSites();
      if (disabledSites.includes(hostname)) return;

      // Check if this is a checkout page
      console.log('DD: isCheckout =', isCheckoutPage());
      if (isCheckoutPage()) {
        console.log('DD: triggering overlay');
        showOverlay();
      }

      // Also listen for messages from background script
      chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'DD_CHECKOUT_DETECTED' && !overlayActive) {
          showOverlay();
        }
      });
    } catch (e) {
      console.error('DD: init() failed', e);
    }
  }

  function isCheckoutPage() {
    const hostname = window.location.hostname.replace(/^www\./, '');

    const isShoppingSite = SHOPPING_DOMAINS.some(domain =>
      hostname === domain || hostname.endsWith('.' + domain)
    );

    const hasCheckoutPath = CHECKOUT_URL_PATTERNS.some(pattern =>
      pattern.test(window.location.pathname + window.location.search)
    );

    // Fire on ANY site with a checkout URL pattern
    return hasCheckoutPath;
  }

  // ===== PRODUCT EXTRACTION =====

  const BASKET_PATH_PATTERN = /\/(cart|basket|gp\/cart)\b/i;

  function isBasketPage() {
    return BASKET_PATH_PATTERN.test(window.location.pathname);
  }

  /**
   * Search the page for an element whose visible text contains one of the
   * total-related keywords, then extract the price from it or a nearby sibling.
   * Returns the matched price string or null.
   */
  function getTotalFromPage() {
    const keywords = ['subtotal', 'order total', 'basket total', 'cart total', 'total'];
    const priceRe = /[£$€]\s*[\d,.]+/;

    // Walk every element with short, visible text — likely a label
    const candidates = document.querySelectorAll(
      'span, div, p, td, th, dt, dd, strong, b, h2, h3, h4, label'
    );

    let bestPrice = null;
    let bestValue = 0;

    for (const el of candidates) {
      const text = el.textContent.trim().toLowerCase();
      if (text.length > 80) continue; // skip large blocks

      const matchesKeyword = keywords.some(kw => text.includes(kw));
      if (!matchesKeyword) continue;

      // Try to extract a price from this element or its parent
      const searchTargets = [el, el.parentElement];
      for (const target of searchTargets) {
        if (!target) continue;
        const m = target.textContent.match(priceRe);
        if (m) {
          const numStr = m[0].replace(/[^0-9.]/g, '');
          const num = parseFloat(numStr);
          if (!isNaN(num) && num > bestValue) {
            bestPrice = m[0];
            bestValue = num;
          }
        }
      }
    }

    return bestPrice;
  }


  function extractProductInfo() {
    const info = {
      product: '',
      price: '',
      site: window.location.hostname.replace(/^www\./, '')
    };

    const onBasketPage = isBasketPage();

    // --- Product name ---
    if (onBasketPage) {
      info.product = info.site || 'Unknown site';
    } else {
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
    }

    // --- Price ---
    // On basket/cart pages, try to find the order total first
    if (onBasketPage) {
      // 1. Try specific basket-total selectors
      const basketTotalSelectors = [
        // Amazon basket total
        '#sc-subtotal-amount-activecart .a-color-price',
        '#sc-subtotal-amount-buybox .a-color-price',
        '.sc-cart-header-total-price',
        '[data-testid="cart-subtotal"]',
        // Generic basket totals
        '.basket-total .price',
        '.cart-total .price',
        '.order-total .price',
        '.subtotal-price',
        '#cart-subtotal',
        '.cart-subtotal',
        '[class*="subtotal"]',
        '[class*="cart-total"]',
        '[class*="basket-total"]',
        '[class*="order-total"]',
      ];

      for (const selector of basketTotalSelectors) {
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

      // 2. If no selector matched, do a text-based search for "Total" / "Subtotal"
      if (!info.price) {
        const totalPrice = getTotalFromPage();
        if (totalPrice) info.price = totalPrice;
      }
    }

    // 3. Fall back to individual item price selectors (always used on non-basket pages)
    if (!info.price) {
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
    currentDarkPatterns = darkPatterns;
    currentEmotion = null;
    const settings = await DDStorage.getSettings();

    // Record pause
    /* pauses tracked via storage */
    /* streak tracked via storage */

    const overlay = document.createElement('div');
    overlay.className = 'dd-overlay';
    if (settings.theme === 'dark') {
      overlay.classList.add('dd-dark');
    }

    let darkPatternHTML = '';
    if (darkPatterns.length > 0) {
      darkPatternHTML = `
        <div class="dd-dark-pattern-banner">
          <strong>Just so you know:</strong> this page is using urgency tactics. You have more time than it feels.
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
        <span class="dd-brand-label">Dopamine Delay</span>
        <button class="dd-close-btn" title="Close" aria-label="Close">&times;</button>
        ${darkPatternHTML}
        <h2 class="dd-heading">Before you buy</h2>
        ${purchaseInfoHTML}
        <p class="dd-question">What's this one?</p>
        <div class="dd-choices">
          <button class="dd-choice-card" data-type="impulsive">
            <span class="dd-choice-content">
              <span class="dd-choice-label">Impulsive</span>
              <span class="dd-choice-desc">I just want it right now</span>
            </span>
          </button>
          <button class="dd-choice-card" data-type="planned">
            <span class="dd-choice-content">
              <span class="dd-choice-label">Planned</span>
              <span class="dd-choice-desc">I've been thinking about this</span>
            </span>
          </button>
          <button class="dd-choice-card" data-type="necessary">
            <span class="dd-choice-content">
              <span class="dd-choice-label">Necessary</span>
              <span class="dd-choice-desc">I genuinely need this</span>
            </span>
          </button>
        </div>
        <p class="dd-honesty">No wrong answers — just helps us help you.</p>
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

        // Track streak and daily pauses
        await DDStorage.recordPauseForStreak();
        await DDStorage.incrementPausesToday();

        // Sync to Supabase via background
        chrome.runtime.sendMessage({
          type: 'PAUSE_EVENT',
          data: {
            site: productInfo.site,
            product: productInfo.product,
            price: productInfo.price,
            choiceType: type,
            outcome: type === 'impulsive' ? 'redirected' : 'bought',
            pointsEarned: 5,
            dark_patterns_detected: darkPatterns.length > 0 ? darkPatterns : null,
          },
        });

        if (type === 'necessary') {
          showAffirmation(overlay);
          showPointsToast('+5 Delay Points');
        } else if (type === 'planned') {
          showPointsToast('+5 Delay Points');
          showPlannedScreen(overlay, productInfo);
        } else if (type === 'impulsive') {
          showPointsToast('+5 Delay Points');
          showEmotionalCheckIn(overlay, productInfo);
        }
      });
    });
  }

  // ===== AFFIRMATION =====

  function showAffirmation(overlay) {
    const modal = overlay.querySelector('.dd-modal');
    modal.innerHTML = `
      <span class="dd-brand-label">Dopamine Delay</span>
      <div class="dd-affirmation">
        <span class="dd-affirmation-icon">💚</span>
        <p class="dd-affirmation-text">Nice one. You've got this.</p>
        <p class="dd-affirmation-sub">Your call, always.</p>
      </div>
    `;

    setTimeout(() => {
      closeOverlay(overlay);
    }, 2500);
  }

  // ===== PLANNED PURCHASE SCREEN =====

  async function showPlannedScreen(overlay, productInfo) {
    const modal = overlay.querySelector('.dd-modal');
    modal.innerHTML = `
      <span class="dd-brand-label">Dopamine Delay</span>
      <button class="dd-close-btn" title="Close" aria-label="Close">&times;</button>
      <h2 class="dd-heading">Good thinking.</h2>
      <p class="dd-subheading">Since you have been planning this, do you want to save it to your list to buy at the right moment?</p>
      <div class="dd-choices" style="margin-top: 16px;">
        <button class="dd-choice-card" id="dd-planned-save">
          <span class="dd-choice-content">
            <span class="dd-choice-label">Save to my list</span>
            <span class="dd-choice-desc">I will buy it when the time is right</span>
          </span>
        </button>
        <button class="dd-choice-card" id="dd-planned-buy">
          <span class="dd-choice-content">
            <span class="dd-choice-label">Buy now</span>
            <span class="dd-choice-desc">I am ready — this is the right moment</span>
          </span>
        </button>
      </div>
    `;

    modal.querySelector('.dd-close-btn')
      .addEventListener('click', () => closeOverlay(overlay));

    modal.querySelector('#dd-planned-save')
      .addEventListener('click', async () => {
        await DDStorage.savePlannedItem({
          product: productInfo.product,
          site: productInfo.site,
          price: productInfo.price,
          url: window.location.href,
        });
        await DDStorage.addPoints(15);
        chrome.runtime.sendMessage({
          type: 'PAUSE_EVENT',
          data: {
            site: productInfo.site,
            product: productInfo.product,
            price: productInfo.price,
            choiceType: 'planned',
            outcome: 'saved',
            pointsEarned: 15,
            dark_patterns_detected: currentDarkPatterns.length > 0 ? currentDarkPatterns : null,
          }
        });
        showPointsToast('+15 Delay Points — smart save!');
        closeOverlay(overlay);
      });

    modal.querySelector('#dd-planned-buy')
      .addEventListener('click', () => {
        closeOverlay(overlay);
      });
  }

  // ===== EMOTIONAL CHECK-IN =====

  async function showEmotionalCheckIn(overlay, productInfo) {
    const modal = overlay.querySelector('.dd-modal');
    modal.innerHTML = `
      <span class="dd-brand-label">Dopamine Delay</span>
      <button class="dd-close-btn" title="Close" aria-label="Close">&times;</button>
      <h2 class="dd-heading">What's driving this?</h2>
      <p class="dd-subheading">No wrong answers — this helps us find the right alternative for you.</p>
      <div class="dd-choices" style="gap:8px;">
        <button class="dd-choice-card dd-emotion-btn" data-emotion="stress">
          <span class="dd-emotion-dot" style="background:#7B9EA6"></span>
          <span class="dd-choice-content">
            <span class="dd-choice-label">Stressed</span>
            <span class="dd-choice-desc">Overwhelmed or anxious right now</span>
          </span>
        </button>
        <button class="dd-choice-card dd-emotion-btn" data-emotion="bored">
          <span class="dd-emotion-dot" style="background:#A07830"></span>
          <span class="dd-choice-content">
            <span class="dd-choice-label">Bored</span>
            <span class="dd-choice-desc">Nothing else is doing it for me</span>
          </span>
        </button>
        <button class="dd-choice-card dd-emotion-btn" data-emotion="treat">
          <span class="dd-emotion-dot" style="background:#2D7A5F"></span>
          <span class="dd-choice-content">
            <span class="dd-choice-label">Treating myself</span>
            <span class="dd-choice-desc">I am in a good mood and feeling it</span>
          </span>
        </button>
        <button class="dd-choice-card dd-emotion-btn" data-emotion="habit">
          <span class="dd-emotion-dot" style="background:#9CA3AF"></span>
          <span class="dd-choice-content">
            <span class="dd-choice-label">Just browsing</span>
            <span class="dd-choice-desc">Honestly not sure how I got here</span>
          </span>
        </button>
      </div>
    `;

    modal.querySelector('.dd-close-btn')
      .addEventListener('click', () => closeOverlay(overlay));

    modal.querySelectorAll('.dd-emotion-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const emotion = btn.dataset.emotion;
        currentEmotion = emotion;
        // Store emotion for analytics (scoped to user)
        DDStorage.set(DDStorage.KEYS.LAST_EMOTION, emotion);
        showScreen2(overlay, productInfo, emotion);
      });
    });
  }

  // ===== SCREEN 2: REDIRECT THAT ENERGY =====

  // Curated alternatives — all internal, no external links
  const ALL_ALTERNATIVES = [
    { id: 'box_breathing', category: 'Calm', label: 'Box breathing \u2014 4 counts in, hold, out, hold', desc: 'Interrupts the urgency physically. 60 seconds.', tags: ['STRESSED', 'EXCITED'], action: 'internal' },
    { id: 'body_scan', category: 'Calm', label: '30-second body scan', desc: 'Close your eyes. Notice feet, legs, chest, hands.', tags: ['STRESSED', 'BORED'], action: 'internal' },
    { id: '478_breathing', category: 'Calm', label: '4-7-8 breathing', desc: 'In for 4, hold for 7, out for 8. Designed for anxiety.', tags: ['STRESSED'], action: 'internal' },
    { id: 'write_feeling', category: 'Reflect', label: 'Write what you are feeling', desc: 'Three sentences. No wrong answers.', tags: ['STRESSED', 'BORED', 'TREATING MYSELF', 'JUST BROWSING'], action: 'internal' },
    { id: 'micro_journal', category: 'Reflect', label: 'Quick check-in \u2014 how did you get here?', desc: 'What were you feeling? What triggered this?', tags: ['STRESSED', 'BORED', 'JUST BROWSING'], action: 'internal' },
    { id: 'wordle', category: 'Puzzle', label: "Today's Wordle", desc: 'One puzzle. The win feels genuinely good.', tags: ['BORED', 'TREATING MYSELF'], action: 'internal' },
    { id: 'connections', category: 'Puzzle', label: "Today's Connections", desc: '4 groups. Satisfying when it clicks.', tags: ['BORED', 'TREATING MYSELF'], action: 'internal' },
    { id: 'sketch', category: 'Creative', label: 'Sketch something nearby', desc: 'Pick one object and draw it. 5 minutes.', tags: ['BORED', 'STRESSED', 'JUST BROWSING'], action: 'internal' },
    { id: 'wishlist', category: 'Creative', label: 'Add it to a wishlist instead', desc: "Write why you want it. The wanting gets heard.", tags: ['TREATING MYSELF', 'EXCITED', 'JUST BROWSING'], action: 'internal' },
    { id: 'walk', category: 'Move', label: '2-minute walk', desc: 'Change of environment interrupts the impulse loop.', tags: ['BORED', 'STRESSED', 'TREATING MYSELF'], action: 'internal' },
    { id: 'dance', category: 'Move', label: 'Dance to one song', desc: 'One song. Full commitment. The dopamine hit is real.', tags: ['BORED', 'TREATING MYSELF', 'EXCITED'], action: 'internal' },
    { id: 'stretch', category: 'Move', label: '5 desk stretches', desc: 'Neck, shoulders, forward fold. Your body has been still.', tags: ['STRESSED', 'BORED'], action: 'internal' },
    { id: 'jump_sequence', category: 'Move', label: '10 jumping jacks, 10 squats', desc: 'Fast, free, effective. Strongest biological redirect.', tags: ['EXCITED', 'BORED', 'TREATING MYSELF'], action: 'internal' },
    { id: 'text_friend', category: 'Connect', label: 'Text someone something nice', desc: 'Social reward activates the same pathway as purchases.', tags: ['BORED', 'STRESSED', 'JUST BROWSING'], action: 'internal' },
    { id: 'voice_note', category: 'Reflect', label: 'Record a 60-second voice note', desc: "Say what you're feeling. You don't have to send it.", tags: ['STRESSED', 'BORED', 'JUST BROWSING'], action: 'internal' },
    { id: 'bank_check', category: 'Reality check', label: 'Check your balance first', desc: 'Makes the abstract future concrete and immediate.', tags: ['TREATING MYSELF', 'JUST BROWSING', 'EXCITED'], action: 'internal' },
    { id: 'work_hours', category: 'Reality check', label: 'How many hours of work is this?', desc: 'Converts price to time. Changes perspective.', tags: ['JUST BROWSING', 'EXCITED'], action: 'internal' },
    { id: 'sleep', category: 'Sleep on it', label: 'Remind me tomorrow', desc: 'Most of the time, the wanting fades on its own.', tags: ['TREATING MYSELF', 'EXCITED', 'JUST BROWSING', 'STRESSED', 'BORED'], action: 'internal' },
    { id: 'water', category: 'Reset', label: 'Drink water, wait 3 minutes', desc: 'Simple. Physical. Surprisingly effective.', tags: ['STRESSED', 'BORED', 'JUST BROWSING'], action: 'internal' },
  ];

  // Map emotion data-attributes to tag values used in ALL_ALTERNATIVES
  const EMOTION_TO_TAG = {
    'stress': 'STRESSED',
    'bored': 'BORED',
    'treat': 'TREATING MYSELF',
    'habit': 'JUST BROWSING',
  };

  // Select 4 alternatives based on emotion
  function getAlternativesForEmotion(emotion) {
    const tag = EMOTION_TO_TAG[emotion] || emotion;
    const matching = ALL_ALTERNATIVES.filter(a => a.tags.includes(tag));
    const nonMatching = ALL_ALTERNATIVES.filter(a => !a.tags.includes(tag));
    // Shuffle matching ones
    const shuffled = matching.sort(() => Math.random() - 0.5);
    // Take 3 emotion-matched + 1 wildcard for novelty
    const selected = shuffled.slice(0, 3);
    const wildcard = nonMatching[Math.floor(Math.random() * nonMatching.length)];
    if (wildcard) selected.push(wildcard);
    return selected.slice(0, 4);
  }

  async function showScreen2(overlay, productInfo, emotion = 'habit') {
    const modal = overlay.querySelector('.dd-modal');
    const alternatives = getAlternativesForEmotion(emotion);
    const pauseDuration = await DDStorage.getEffectivePauseDuration(productInfo.price);

    const priceNum = parseFloat((productInfo.price || '0').replace(/[^0-9.]/g, ''));
    let remaining = pauseDuration;

    const altTilesHTML = alternatives.map(alt => `
      <button class="dd-alt-tile" data-id="${alt.id}" data-category="${alt.category}" data-desc="${escapeHTML(alt.desc)}">
        <span class="dd-alt-category">${alt.category}</span>
        <span class="dd-alt-label">${alt.label}</span>
        <span class="dd-alt-desc">${alt.desc}</span>
      </button>
    `).join('');

    modal.innerHTML = `
      <span class="dd-brand-label">Dopamine Delay</span>
      <button class="dd-close-btn" title="Close" aria-label="Close">&times;</button>
      <h2 class="dd-heading" style="font-size:18px !important;">Your pause</h2>
      <p class="dd-subheading">Your brain wants a hit of something. Here are some ways to get it without spending.</p>

      <div class="dd-alternatives-grid">
        ${altTilesHTML}
      </div>

      <div id="dd-alt-detail" class="dd-detail-box" style="display: none;"></div>

      <div class="dd-timer-section">
        <p class="dd-breathe-text">Take a moment.</p>
        <div class="dd-progress-bar">
          <div class="dd-progress-fill" id="dd-progress" style="width:100%"></div>
        </div>
        <p class="dd-timer-label" id="dd-timer">Pausing for ${remaining} more seconds</p>
      </div>

      <button class="dd-save-btn" id="dd-save-btn">Keep waiting — save for later</button>
      ${priceNum > 50 ? '<button class="dd-save-btn" id="dd-sleep-btn" style="background: #C9921A; margin-top: 8px;">🌙 Sleep on it — remind me tomorrow</button>' : ''}
      <button class="dd-proceed-link" id="dd-proceed" disabled>Take a breath. You can always come back.</button>
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
      if (timerEl) timerEl.textContent = 'Pausing for ' + remaining + ' more seconds';
      if (progressEl) {
        const pct = (remaining / pauseDuration) * 100;
        progressEl.style.width = pct + '%';
      }
      if (remaining <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        if (timerEl) timerEl.textContent = '';
        if (proceedBtn) {
          proceedBtn.disabled = false;
          proceedBtn.textContent = 'I still want to buy';
          proceedBtn.style.color = '#9CA3AF';
        }
      }
    }, 1000);

    // Alternative tiles — all internal, track selection
    modal.querySelectorAll('.dd-alt-tile').forEach(tile => {
      tile.addEventListener('click', async () => {
        // Track which alternative was selected
        const altId = tile.dataset.id;
        const altCategory = tile.dataset.category;
        DDStorage.set(DDStorage.KEYS.LAST_ALTERNATIVE, altId);
        DDStorage.set(DDStorage.KEYS.LAST_ALTERNATIVE_CATEGORY, altCategory);

        // Award points for choosing a redirect
        await DDStorage.addPoints(5);
        showPointsToast('+5 Delay Points — good redirect');
        chrome.runtime.sendMessage({
          type: 'PAUSE_EVENT',
          data: {
            site: productInfo.site,
            product: productInfo.product,
            price: productInfo.price,
            choiceType: 'impulsive',
            outcome: 'redirected',
            pointsEarned: 5,
            emotional_state: currentEmotion || null,
            alternative_chosen: altId,
            alternative_category: altCategory,
            dark_patterns_detected: currentDarkPatterns.length > 0 ? currentDarkPatterns : null,
          },
        });

        // Show activity prompt in detail box
        const detailBox = document.getElementById('dd-alt-detail');
        if (detailBox && tile.dataset.desc) {
          detailBox.innerHTML = `
            <div class="dd-activity-prompt">
              <p class="dd-activity-desc">${tile.dataset.desc}</p>
              <p class="dd-activity-cue">Take your time — the checkout will still be here.</p>
            </div>
          `;
          detailBox.style.display = 'block';
        }

        // Highlight selected tile
        modal.querySelectorAll('.dd-alt-tile').forEach(t => t.classList.remove('dd-alt-selected'));
        tile.classList.add('dd-alt-selected');
      });
    });

    // Save for later
    document.getElementById('dd-save-btn').addEventListener('click', async () => {
      await DDStorage.saveItem({
        product: productInfo.product,
        site: productInfo.site,
        price: productInfo.price,
        url: window.location.href,
      });
      await DDStorage.addPoints(15);

      // Read last selected alternative before sending
      const lastAlt = await DDStorage.get(DDStorage.KEYS.LAST_ALTERNATIVE);
      const lastAltCat = await DDStorage.get(DDStorage.KEYS.LAST_ALTERNATIVE_CATEGORY);

      // Sync to Supabase via background
      chrome.runtime.sendMessage({
        type: 'PAUSE_EVENT',
        data: {
          site: productInfo.site,
          product: productInfo.product,
          price: productInfo.price,
          choiceType: 'impulsive',
          outcome: 'saved',
          pointsEarned: 15,
          emotional_state: emotion || currentEmotion || null,
          alternative_chosen: lastAlt || null,
          alternative_category: lastAltCat || null,
          dark_patterns_detected: currentDarkPatterns.length > 0 ? currentDarkPatterns : null,
        },
      });

      closeOverlay(overlay);
      showCelebrationToast();
    });

    // Sleep on it button (high-value items only)
    const sleepBtn = document.getElementById('dd-sleep-btn');
    if (sleepBtn) {
      sleepBtn.addEventListener('click', async () => {
        await DDStorage.addReminder({
          product: productInfo.product,
          site: productInfo.site,
          price: productInfo.price,
          url: window.location.href,
          remindAt: new Date(Date.now() + 86400000).toISOString()
        });
        showPointsToast('Reminder set! +10 Delay Points 🌙');
        await DDStorage.addPoints(10);
        closeOverlay(overlay);
      });
    }

    // Proceed button
    proceedBtn.addEventListener('click', () => {
      if (!proceedBtn.disabled) {
        closeOverlay(overlay);
      }
    });
  }

  // ===== CELEBRATION TOAST =====

  function showCelebrationToast() {
    const existing = document.querySelector('.dd-celebration-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'dd-celebration-toast';
    toast.innerHTML = `
      <div class="dd-celebration">
        <div class="dd-celebration-points">✦ +15 Delay Points</div>
        <div class="dd-celebration-message">You just chose differently.</div>
        <div class="dd-celebration-sub">That's what control looks like.</div>
      </div>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) toast.remove();
      window.open('https://dopaminedelay.com/dashboard', '_blank');
    }, 2500);
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

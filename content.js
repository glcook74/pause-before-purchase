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

  // ===== INITIALISATION =====

  async function init() {
    try {
      console.log('DD: content script loaded', window.location.href);

      // Check if onboarded
      const { dd_onboarded } = await chrome.storage.local.get('dd_onboarded');
      // Default to true so overlay works without completing onboarding
      const onboarded = dd_onboarded !== false;
      if (!onboarded) return;

      // Check if this site is disabled
      const hostname = window.location.hostname.replace(/^www\./, '');
      const { dd_disabled_sites } = await chrome.storage.local.get('dd_disabled_sites');
      const disabledSites = dd_disabled_sites || [];
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
    const { dd_settings } = await chrome.storage.local.get('dd_settings');
    const settings = dd_settings || { theme: 'cream', pauseDuration: 10 };

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
        const { dd_points: p1 } = await chrome.storage.local.get('dd_points');
        await chrome.storage.local.set({ dd_points: (p1 || 0) + 5 });

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
          showEmotionalCheckIn(overlay, productInfo, settings);
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

  // ===== PLANNED PURCHASE SCREEN =====

  async function showPlannedScreen(overlay, productInfo) {
    const modal = overlay.querySelector('.dd-modal');
    modal.innerHTML = `
      <button class="dd-close-btn" title="Close" aria-label="Close">&times;</button>
      <h2 class="dd-heading">Good thinking.</h2>
      <p class="dd-subheading">Since you have been planning this, do you want to save it to your list to buy at the right moment?</p>
      <div class="dd-choices" style="margin-top: 16px;">
        <button class="dd-choice-card" id="dd-planned-save">
          <span class="dd-choice-icon">💾</span>
          <span class="dd-choice-content">
            <span class="dd-choice-label">SAVE TO MY LIST</span>
            <span class="dd-choice-desc">I will buy it when the time is right</span>
          </span>
        </button>
        <button class="dd-choice-card" id="dd-planned-buy">
          <span class="dd-choice-icon">✅</span>
          <span class="dd-choice-content">
            <span class="dd-choice-label">BUY NOW</span>
            <span class="dd-choice-desc">I am ready — this is the right moment</span>
          </span>
        </button>
      </div>
    `;

    modal.querySelector('.dd-close-btn')
      .addEventListener('click', () => closeOverlay(overlay));

    modal.querySelector('#dd-planned-save')
      .addEventListener('click', async () => {
        const { dd_planned_items: pi } = await chrome.storage.local.get('dd_planned_items');
        const plannedItems = pi || [];
        plannedItems.push({
          product: productInfo.product,
          site: productInfo.site,
          price: productInfo.price,
          url: window.location.href,
          savedAt: new Date().toISOString(),
          status: 'pending',
          type: 'planned'
        });
        await chrome.storage.local.set({ dd_planned_items: plannedItems });
        const { dd_points: p } = await chrome.storage.local.get('dd_points');
        await chrome.storage.local.set({ dd_points: (p || 0) + 15 });
        chrome.runtime.sendMessage({
          type: 'PAUSE_EVENT',
          data: {
            site: productInfo.site,
            product: productInfo.product,
            price: productInfo.price,
            choiceType: 'planned',
            outcome: 'saved',
            pointsEarned: 15
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

  async function showEmotionalCheckIn(overlay, productInfo, settings) {
    const modal = overlay.querySelector('.dd-modal');
    modal.innerHTML = `
      <button class="dd-close-btn" title="Close" aria-label="Close">&times;</button>
      <h2 class="dd-heading">One quick thing...</h2>
      <p class="dd-subheading">What is driving this right now? No judgment — just helps us help you.</p>
      <div class="dd-choices" style="gap:8px;">
        <button class="dd-choice-card dd-emotion-btn" data-emotion="stress">
          <span class="dd-choice-icon">😤</span>
          <span class="dd-choice-content">
            <span class="dd-choice-label">STRESSED</span>
            <span class="dd-choice-desc">Overwhelmed or anxious right now</span>
          </span>
        </button>
        <button class="dd-choice-card dd-emotion-btn" data-emotion="bored">
          <span class="dd-choice-icon">😴</span>
          <span class="dd-choice-content">
            <span class="dd-choice-label">BORED</span>
            <span class="dd-choice-desc">Nothing else is doing it for me</span>
          </span>
        </button>
        <button class="dd-choice-card dd-emotion-btn" data-emotion="treat">
          <span class="dd-choice-icon">🎉</span>
          <span class="dd-choice-content">
            <span class="dd-choice-label">TREATING MYSELF</span>
            <span class="dd-choice-desc">I am in a good mood and feeling it</span>
          </span>
        </button>
        <button class="dd-choice-card dd-emotion-btn" data-emotion="habit">
          <span class="dd-choice-icon">😶</span>
          <span class="dd-choice-content">
            <span class="dd-choice-label">JUST BROWSING</span>
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
        // Store emotion for analytics
        chrome.storage.local.get('dd_last_emotion').then(() => {
          chrome.storage.local.set({ dd_last_emotion: emotion });
        });
        showScreen2(overlay, productInfo, settings, emotion);
      });
    });
  }

  // ===== SCREEN 2: REDIRECT THAT ENERGY =====

  // Full alternatives library
  const ALL_ALTERNATIVES = [
    // HIGH DOPAMINE — novelty/excitement (good for: treat, habit, bored)
    { id: 'neal', icon: '🎮', category: 'Play', label: 'Something delightful', action: 'external', url: 'https://neal.fun', tags: ['bored', 'habit', 'treat'] },
    { id: 'spotify_discover', icon: '🎵', category: 'Music', label: 'Discover something new', action: 'external', url: 'https://open.spotify.com/section/0JQ5DAqbMKFQ00XGBls6ym', tags: ['bored', 'habit', 'treat', 'stress'] },
    { id: 'wikipedia', icon: '🌍', category: 'Learn', label: 'Random rabbit hole', action: 'external', url: 'https://en.wikipedia.org/wiki/Special:Random', tags: ['bored', 'habit'] },
    { id: 'wordle', icon: '🧩', category: 'Puzzle', label: "Today's Wordle", action: 'external', url: 'https://www.nytimes.com/games/wordle/index.html', tags: ['bored', 'habit', 'treat'] },
    { id: 'connections', icon: '🔗', category: 'Puzzle', label: "Today's Connections", action: 'external', url: 'https://www.nytimes.com/games/connections', tags: ['bored', 'habit'] },
    { id: 'price_hunt', icon: '🎯', category: 'Challenge', label: 'Find it cheaper in 5 mins', action: 'inline', detail: 'Open a new tab and search for the same item on Google Shopping. If you find it cheaper, great. If not, you have spent 5 minutes thinking about it — still want it?', tags: ['treat', 'habit'] },

    // EMOTIONAL REGULATION — for stress and overwhelm
    { id: 'box_breathing', icon: '🌬️', category: 'Calm', label: 'Box breathing — 60 seconds', action: 'inline', detail: 'Breathe IN for 4 counts. HOLD for 4. OUT for 4. HOLD for 4. Repeat 4 times. This activates your parasympathetic nervous system and reduces the urgency feeling.', tags: ['stress', 'bored'] },
    { id: 'body_scan', icon: '🧘', category: 'Calm', label: '30-second body scan', action: 'inline', detail: 'Close your eyes. Notice your feet. Your legs. Your stomach — is it tight? Your chest. Your shoulders. Your jaw. Where are you holding tension right now? That tension is not fixed by buying something.', tags: ['stress'] },
    { id: 'write_feeling', icon: '✍️', category: 'Reflect', label: 'Write what you are feeling', action: 'inline', detail: 'Name it: I am feeling _______ right now, and I want to buy this because _______. You do not have to save it. Just name it.', tags: ['stress', 'bored'] },
    { id: 'water', icon: '💧', category: 'Reset', label: 'Drink water, wait 3 minutes', action: 'inline', detail: 'Get up. Get a glass of water. Drink it slowly. Set a 3-minute timer. Come back and see if you still feel the same urgency. Dehydration increases impulsivity — seriously.', tags: ['stress', 'habit', 'bored'] },

    // MOVEMENT — proven dopamine release
    { id: 'walk', icon: '🏃', category: 'Move', label: '2-minute walk', action: 'inline', detail: 'Stand up right now. Walk to another room, or outside if you can. Set a 2-minute timer. Physical movement raises dopamine naturally — this is not a trick, it is neuroscience.', tags: ['stress', 'bored', 'habit'] },
    { id: 'dance', icon: '🕺', category: 'Move', label: 'Watch something on YouTube', action: 'external', url: 'https://www.youtube.com', tags: ['bored', 'treat', 'habit'] },
    { id: 'stretch', icon: '🤸', category: 'Move', label: '5 stretches', action: 'inline', detail: '1. Roll your shoulders back 5 times. 2. Reach both arms up and stretch. 3. Neck rolls — slow, each side. 4. Shake out your hands. 5. Take one big breath and let it go. Done.', tags: ['stress', 'habit'] },

    // SOCIAL CONNECTION
    { id: 'text_friend', icon: '💬', category: 'Connect', label: 'Text someone something nice', action: 'inline', detail: 'Think of one person who would appreciate a message right now. Send them something — a compliment, a memory, a stupid meme. Social connection releases oxytocin, which competes directly with the buying urge.', tags: ['stress', 'bored', 'treat'] },
    { id: 'call', icon: '📞', category: 'Connect', label: 'Call someone for 5 minutes', action: 'inline', detail: 'Who have you been meaning to call? Do it now — 5 minutes maximum. The shopping will still be there. The urge probably will not be.', tags: ['stress', 'bored'] },

    // FINANCIAL REALITY
    { id: 'bank_check', icon: '💰', category: 'Reality check', label: 'Check your balance first', action: 'inline', detail: 'Open your banking app and look at your actual balance before you decide. Not your available credit — your actual balance. How does this purchase feel now?', tags: ['habit', 'treat'] },
    { id: 'work_hours', icon: '⏱️', category: 'Reality check', label: 'How many hours is this?', action: 'inline', detail: 'Think about how long you had to work to earn the money for this. Is this item worth that many hours of your life? Sometimes it is. Sometimes that changes things.', tags: ['habit', 'treat', 'stress'] },
    { id: 'saved_list', icon: '📋', category: 'Reality check', label: 'Check your saved list', action: 'inline', detail: 'You have already saved some things for later. Go check if any of them are still calling you — maybe something on your list matters more than this does right now.', tags: ['habit', 'treat'] },

    // SLEEP ON IT — for higher value items
    { id: 'sleep', icon: '🌙', category: 'Sleep on it', label: 'Remind me tomorrow', action: 'inline', detail: 'Research shows desire for impulse purchases drops significantly within 24 hours. Set a reminder and come back tomorrow. If you still want it, buy it.', tags: ['stress', 'bored', 'habit', 'treat'] },
    { id: 'youtube', icon: '▶️', category: 'Watch', label: 'Watch something on YouTube', action: 'external', url: 'https://www.youtube.com', tags: ['bored', 'habit', 'treat'] }
  ];

  // Select 4 alternatives based on emotion
  function getAlternativesForEmotion(emotion) {
    const matching = ALL_ALTERNATIVES.filter(a => a.tags.includes(emotion));
    const nonMatching = ALL_ALTERNATIVES.filter(a => !a.tags.includes(emotion));
    // Shuffle matching ones
    const shuffled = matching.sort(() => Math.random() - 0.5);
    // Take 3 emotion-matched + 1 wildcard for novelty
    const selected = shuffled.slice(0, 3);
    const wildcard = nonMatching[Math.floor(Math.random() * nonMatching.length)];
    if (wildcard) selected.push(wildcard);
    return selected.slice(0, 4);
  }

  async function showScreen2(overlay, productInfo, settings, emotion = 'habit') {
    const modal = overlay.querySelector('.dd-modal');
    const alternatives = getAlternativesForEmotion(emotion);
    const pauseDuration = (settings && settings.pauseDuration) || 10;

    const priceNum = parseFloat((productInfo.price || '0').replace(/[^0-9.]/g, ''));
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
      ${priceNum > 50 ? '<button class="dd-save-btn" id="dd-sleep-btn" style="background: #C9921A; margin-top: 8px;">🌙 Sleep on it — remind me tomorrow</button>' : ''}
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
      const { dd_saved_items: si } = await chrome.storage.local.get('dd_saved_items');
      const savedItems = si || [];
      savedItems.push({
        product: productInfo.product,
        site: productInfo.site,
        price: productInfo.price,
        url: window.location.href,
        savedAt: new Date().toISOString(),
        status: 'pending'
      });
      await chrome.storage.local.set({ dd_saved_items: savedItems });
      const { dd_points: p2 } = await chrome.storage.local.get('dd_points');
      await chrome.storage.local.set({ dd_points: (p2 || 0) + 15 });

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
        },
      });

      showPointsToast('+15 Delay Points — brilliant pause!');
      closeOverlay(overlay);
    });

    // Sleep on it button (high-value items only)
    const sleepBtn = document.getElementById('dd-sleep-btn');
    if (sleepBtn) {
      sleepBtn.addEventListener('click', async () => {
        const reminder = {
          product: productInfo.product,
          site: productInfo.site,
          price: productInfo.price,
          url: window.location.href,
          remindAt: new Date(Date.now() + 86400000).toISOString()
        };
        const { dd_reminders: existing } = await chrome.storage.local.get('dd_reminders');
        const reminders = existing || [];
        reminders.push(reminder);
        await chrome.storage.local.set({ dd_reminders: reminders });
        showPointsToast('Reminder set! +10 Delay Points 🌙');
        const { dd_points: p3 } = await chrome.storage.local.get('dd_points');
        await chrome.storage.local.set({ dd_points: (p3 || 0) + 10 });
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

/**
 * Pause Before Purchase - Content Script
 * Detects purchase/checkout buttons and intercepts clicks with a reflection prompt.
 */

(function () {
  'use strict';

  // Purchase button detection patterns
  const PURCHASE_PATTERNS = [
    /buy\s*now/i,
    /place\s*(your\s*)?order/i,
    /complete\s*(your\s*)?(purchase|order|checkout)/i,
    /checkout/i,
    /pay\s*now/i,
    /submit\s*order/i,
    /confirm\s*(and\s*)?(pay|purchase|order)/i,
    /proceed\s*to\s*(checkout|payment)/i,
    /add\s*to\s*cart/i,
    /purchase/i,
    /order\s*now/i,
  ];

  // Selectors commonly used for purchase buttons
  const PURCHASE_SELECTORS = [
    '[id*="buy" i]',
    '[id*="checkout" i]',
    '[id*="purchase" i]',
    '[id*="place-order" i]',
    '[id*="placeOrder" i]',
    '[class*="buy-now" i]',
    '[class*="checkout" i]',
    '[class*="purchase" i]',
    '[data-action*="buy" i]',
    '[data-action*="checkout" i]',
    '[name*="checkout" i]',
    '#submitOrderButtonId',
    '#placeYourOrder',
    '.a-button-input[name="placeYourOrder1"]',
  ];

  const REFLECTION_PROMPTS = [
    'Will this still feel like a good decision tomorrow morning?',
    'Can you name three specific times you will use this in the next month?',
    'What would you tell a friend who was about to make this purchase?',
    'Is this solving a real problem, or filling an emotional need?',
    'If you had to walk to a store to buy this, would you still go?',
    'What else could you do with this money that matters to you?',
    'Are you buying this for who you are, or who you wish you were?',
    'Would you still want this if no one else could see it?',
    'Have you looked for this item secondhand or on sale?',
    'If you wait a week, will you still remember wanting this?',
  ];

  let overlayActive = false;
  let currentCooldown = null;

  function isPurchaseButton(element) {
    if (!element) return false;

    const text = (element.textContent || '').trim();
    const ariaLabel = (element.getAttribute('aria-label') || '').trim();
    const value = (element.getAttribute('value') || '').trim();
    const title = (element.getAttribute('title') || '').trim();

    const combinedText = `${text} ${ariaLabel} ${value} ${title}`;

    // Check text content against patterns
    for (const pattern of PURCHASE_PATTERNS) {
      if (pattern.test(combinedText)) return true;
    }

    // Check if element matches purchase selectors
    for (const selector of PURCHASE_SELECTORS) {
      try {
        if (element.matches(selector)) return true;
      } catch {
        // Invalid selector, skip
      }
    }

    return false;
  }

  function getRandomPrompt() {
    return REFLECTION_PROMPTS[Math.floor(Math.random() * REFLECTION_PROMPTS.length)];
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function createChoiceOverlay(originalEvent, originalElement) {
    if (overlayActive) return;
    overlayActive = true;

    const overlay = document.createElement('div');
    overlay.className = 'pbp-overlay';
    overlay.innerHTML = `
      <div class="pbp-modal">
        <div class="pbp-header">
          <span class="pbp-icon" aria-hidden="true">&#9208;</span>
          <h2 class="pbp-title">Let's pause for a moment</h2>
          <p class="pbp-subtitle">Take a breath. No judgment — just a quick check-in with yourself.</p>
        </div>
        <p class="pbp-question">What kind of purchase is this?</p>
        <div class="pbp-choices">
          <button class="pbp-choice-btn" data-type="necessary">
            <span class="pbp-choice-icon" aria-hidden="true">&#9989;</span>
            <span class="pbp-choice-text">
              <span class="pbp-choice-label">Necessary</span>
              <span class="pbp-choice-desc">Something I genuinely need — groceries, bills, medicine, etc.</span>
            </span>
          </button>
          <button class="pbp-choice-btn" data-type="planned">
            <span class="pbp-choice-icon" aria-hidden="true">&#128203;</span>
            <span class="pbp-choice-text">
              <span class="pbp-choice-label">Planned</span>
              <span class="pbp-choice-desc">I've been thinking about this for a while and budgeted for it.</span>
            </span>
          </button>
          <button class="pbp-choice-btn" data-type="impulse">
            <span class="pbp-choice-icon" aria-hidden="true">&#9889;</span>
            <span class="pbp-choice-text">
              <span class="pbp-choice-label">Impulse</span>
              <span class="pbp-choice-desc">I just saw it and want it right now. I hadn't planned on this.</span>
            </span>
          </button>
        </div>
        <button class="pbp-btn pbp-btn-skip">I'd rather not answer — let me through</button>
      </div>
    `;

    document.body.appendChild(overlay);

    // Prevent scrolling
    document.body.style.overflow = 'hidden';

    // Handle choices
    overlay.querySelectorAll('.pbp-choice-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        handleChoice(type, overlay, originalElement);
      });
    });

    // Skip button
    overlay.querySelector('.pbp-btn-skip').addEventListener('click', () => {
      closeOverlay(overlay);
      proceedWithPurchase(originalElement);
    });

    // Close on overlay background click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeOverlay(overlay);
      }
    });

    // Close on Escape
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeOverlay(overlay);
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    // Update stats
    updateStats('pause');
  }

  function handleChoice(type, overlay, originalElement) {
    chrome.storage.sync.get(
      ['cooldownMinutes', 'plannedCooldownMinutes'],
      (data) => {
        const impulseCooldown = parseInt(data.cooldownMinutes || '10', 10);
        const plannedCooldown = parseInt(data.plannedCooldownMinutes || '2', 10);

        switch (type) {
          case 'necessary':
            // Let them through with a brief affirmation
            showAffirmation(overlay, originalElement);
            break;

          case 'planned':
            if (plannedCooldown > 0) {
              showCooldown(overlay, originalElement, plannedCooldown, 'planned');
            } else {
              showAffirmation(overlay, originalElement);
            }
            break;

          case 'impulse':
            updateStats('impulse');
            showCooldown(overlay, originalElement, impulseCooldown, 'impulse');
            break;
        }
      }
    );
  }

  function showAffirmation(overlay, originalElement) {
    const modal = overlay.querySelector('.pbp-modal');
    modal.innerHTML = `
      <span class="pbp-icon" aria-hidden="true">&#128154;</span>
      <h2 class="pbp-title">Sounds good!</h2>
      <p class="pbp-subtitle">Thanks for checking in with yourself. Go ahead.</p>
      <div class="pbp-btn-row">
        <button class="pbp-btn pbp-btn-proceed">Continue to purchase</button>
      </div>
    `;

    modal.querySelector('.pbp-btn-proceed').addEventListener('click', () => {
      updateStats('proceed');
      closeOverlay(overlay);
      proceedWithPurchase(originalElement);
    });
  }

  function showCooldown(overlay, originalElement, minutes, type) {
    const totalSeconds = minutes * 60;
    let remaining = totalSeconds;
    const prompt = getRandomPrompt();

    const isImpulse = type === 'impulse';
    const title = isImpulse
      ? "Let's take a breather"
      : 'Quick pause for reflection';
    const message = isImpulse
      ? "This looks like an impulse purchase. That's completely okay — let's just give it a moment. Use this time to check in with yourself."
      : "You've planned this one. Just a short moment to make sure it still feels right.";

    const modal = overlay.querySelector('.pbp-modal');
    modal.innerHTML = `
      <div class="pbp-cooldown">
        <span class="pbp-cooldown-icon" aria-hidden="true">${isImpulse ? '&#9200;' : '&#128173;'}</span>
        <h2 class="pbp-cooldown-title">${title}</h2>
        <p class="pbp-cooldown-message">${message}</p>
        <p class="pbp-breathe-text">Breathe in... breathe out...</p>
        <p class="pbp-timer">${formatTime(remaining)}</p>
        <p class="pbp-timer-label">remaining</p>
        <div class="pbp-progress-bar">
          <div class="pbp-progress-fill" style="width: 0%"></div>
        </div>
        <div class="pbp-reflection-prompt">
          <p>${prompt}</p>
        </div>
        <div class="pbp-btn-row">
          <button class="pbp-btn pbp-btn-cancel">I don't need this</button>
          <button class="pbp-btn pbp-btn-proceed" disabled>Wait for timer...</button>
        </div>
      </div>
    `;

    const timerEl = modal.querySelector('.pbp-timer');
    const progressFill = modal.querySelector('.pbp-progress-fill');
    const proceedBtn = modal.querySelector('.pbp-btn-proceed');
    const cancelBtn = modal.querySelector('.pbp-btn-cancel');

    currentCooldown = setInterval(() => {
      remaining--;
      timerEl.textContent = formatTime(remaining);
      const progress = ((totalSeconds - remaining) / totalSeconds) * 100;
      progressFill.style.width = progress + '%';

      // Rotate reflection prompts
      if (remaining > 0 && remaining % 30 === 0) {
        const promptEl = modal.querySelector('.pbp-reflection-prompt p');
        if (promptEl) promptEl.textContent = getRandomPrompt();
      }

      if (remaining <= 0) {
        clearInterval(currentCooldown);
        currentCooldown = null;
        proceedBtn.disabled = false;
        proceedBtn.textContent = 'I still want this — proceed';
        timerEl.textContent = 'Time is up!';
      }
    }, 1000);

    proceedBtn.addEventListener('click', () => {
      if (!proceedBtn.disabled) {
        updateStats('proceed');
        cleanupCooldown();
        closeOverlay(overlay);
        proceedWithPurchase(originalElement);
      }
    });

    cancelBtn.addEventListener('click', () => {
      cleanupCooldown();
      closeOverlay(overlay);
    });
  }

  function cleanupCooldown() {
    if (currentCooldown) {
      clearInterval(currentCooldown);
      currentCooldown = null;
    }
  }

  function closeOverlay(overlay) {
    overlayActive = false;
    document.body.style.overflow = '';
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }

  function proceedWithPurchase(element) {
    if (element) {
      // Temporarily mark to avoid re-interception
      element.dataset.pbpAllowed = 'true';
      element.click();
      // Clean up after a short delay
      setTimeout(() => {
        delete element.dataset.pbpAllowed;
      }, 1000);
    }
  }

  function updateStats(action) {
    chrome.storage.sync.get(['stats'], (data) => {
      const stats = data.stats || {
        pausesToday: 0,
        impulseCaught: 0,
        proceededCount: 0,
        lastResetDate: new Date().toDateString(),
      };

      // Reset daily counter if new day
      const today = new Date().toDateString();
      if (stats.lastResetDate !== today) {
        stats.pausesToday = 0;
        stats.lastResetDate = today;
      }

      switch (action) {
        case 'pause':
          stats.pausesToday++;
          break;
        case 'impulse':
          stats.impulseCaught++;
          break;
        case 'proceed':
          stats.proceededCount++;
          break;
      }

      chrome.storage.sync.set({ stats });
    });
  }

  function interceptClicks(event) {
    // Check if extension is pausing
    if (overlayActive) return;

    const target = event.target;
    if (!target) return;

    // Skip if explicitly allowed through
    if (target.dataset && target.dataset.pbpAllowed === 'true') return;

    // Walk up the DOM tree to find the actual button
    let element = target;
    let depth = 0;
    while (element && depth < 5) {
      if (
        element.tagName === 'BUTTON' ||
        element.tagName === 'A' ||
        element.tagName === 'INPUT' ||
        element.getAttribute('role') === 'button'
      ) {
        if (isPurchaseButton(element)) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          createChoiceOverlay(event, element);
          return;
        }
      }
      element = element.parentElement;
      depth++;
    }
  }

  // Initialize
  function init() {
    chrome.storage.sync.get(['enabled'], (data) => {
      if (data.enabled === false) return;

      // Use capture phase to intercept before other handlers
      document.addEventListener('click', interceptClicks, true);
    });
  }

  // Listen for setting changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.enabled) {
      if (changes.enabled.newValue === false) {
        document.removeEventListener('click', interceptClicks, true);
      } else {
        document.addEventListener('click', interceptClicks, true);
      }
    }
  });

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/**
 * Dopamine Delay — Popup Dashboard
 * Three tabs: Today, Saved for Later, Settings
 */

document.addEventListener('DOMContentLoaded', async () => {
  // ===== TAB SWITCHING =====
  const tabs = document.querySelectorAll('.dd-tab');
  const tabContents = document.querySelectorAll('.dd-tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(tc => tc.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');

      // Refresh data when switching tabs
      if (tab.dataset.tab === 'today') loadTodayTab();
      if (tab.dataset.tab === 'saved') loadSavedTab();
      if (tab.dataset.tab === 'settings') loadSettingsTab();
    });
  });

  // ===== LOAD TODAY TAB =====
  async function loadTodayTab() {
    const pauses = await DDStorage.getPausesToday();
    const points = await DDStorage.getPoints();
    const streak = await DDStorage.getStreak();
    const moneySaved = await DDStorage.getMoneySaved();

    document.getElementById('stat-pauses').textContent = pauses.count || 0;
    document.getElementById('stat-points').textContent = points || 0;
    document.getElementById('stat-streak').textContent = streak.count || 0;
    document.getElementById('stat-saved-money').textContent = '£' + moneySaved.toFixed(2);
    document.getElementById('dd-total-points').textContent = points + ' pts';

    // Encouragement messages
    const messages = [
      'Every pause is a win.',
      'Your prefrontal cortex thanks you.',
      'Small pauses, big changes.',
      "You're building a new pattern.",
      'Awareness is the first step.'
    ];
    const count = pauses.count || 0;
    const msg = count > 0
      ? messages[Math.min(count - 1, messages.length - 1)]
      : 'Ready when you are.';
    document.getElementById('dd-encouragement').textContent = msg;
  }

  // ===== LOAD SAVED TAB =====
  async function loadSavedTab() {
    const items = await DDStorage.getSavedItems();
    const list = document.getElementById('saved-list');

    if (items.length === 0) {
      list.innerHTML = '<p class="dd-empty-state">No saved items yet. When you pause and save, they will appear here.</p>';
      return;
    }

    list.innerHTML = items.map(item => {
      const date = new Date(item.savedAt);
      const dateStr = date.toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric'
      });

      return `
        <div class="dd-saved-item" data-id="${item.id}">
          <div class="dd-saved-item-header">
            <span class="dd-saved-product">${escapeHTML(item.product || 'Unknown item')}</span>
            <span class="dd-saved-price">${escapeHTML(item.price || '')}</span>
          </div>
          <div class="dd-saved-meta">${escapeHTML(item.site)} · Saved ${dateStr}</div>
          <p class="dd-still-want">Still want it?</p>
          <div class="dd-saved-actions">
            <button class="dd-saved-btn dd-saved-btn-buy" data-url="${escapeHTML(item.url || '')}">Yes, buy it now</button>
            <button class="dd-saved-btn dd-saved-btn-remove" data-id="${item.id}">Remove — I've moved on</button>
          </div>
        </div>
      `;
    }).join('');

    // Buy buttons
    list.querySelectorAll('.dd-saved-btn-buy').forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.dataset.url;
        if (url) chrome.tabs.create({ url });
      });
    });

    // Remove buttons
    list.querySelectorAll('.dd-saved-btn-remove').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        await DDStorage.removeSavedItem(id);
        await DDStorage.addPoints(10);
        loadSavedTab();
        loadTodayTab();
      });
    });
  }

  // ===== LOAD SETTINGS TAB =====
  async function loadSettingsTab() {
    const settings = await DDStorage.getSettings();

    const pauseSelect = document.getElementById('setting-pause-duration');
    const lateNightToggle = document.getElementById('setting-late-night');
    const themeSelect = document.getElementById('setting-theme');

    pauseSelect.value = String(settings.pauseDuration);
    lateNightToggle.checked = settings.lateNightMode !== false;
    themeSelect.value = settings.theme || 'cream';

    pauseSelect.onchange = async () => {
      await DDStorage.updateSettings({ pauseDuration: parseInt(pauseSelect.value) });
    };

    lateNightToggle.onchange = async () => {
      await DDStorage.updateSettings({ lateNightMode: lateNightToggle.checked });
    };

    themeSelect.onchange = async () => {
      await DDStorage.updateSettings({ theme: themeSelect.value });
    };
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // ===== PRO LICENCE =====
  async function loadProStatus() {
    const result = await new Promise(resolve => {
      chrome.storage.local.get('dd_pro', resolve);
    });
    const isPro = result.dd_pro === true;

    const badge = document.getElementById('dd-pro-badge');
    const form = document.getElementById('dd-pro-form');
    const activated = document.getElementById('dd-pro-activated');

    if (isPro) {
      badge.style.display = 'inline-block';
      form.style.display = 'none';
      activated.style.display = 'block';
    } else {
      badge.style.display = 'none';
      form.style.display = 'block';
      activated.style.display = 'none';
    }
  }

  document.getElementById('dd-activate-btn').addEventListener('click', async () => {
    const input = document.getElementById('dd-licence-key');
    const error = document.getElementById('dd-pro-error');
    const key = input.value.trim().toUpperCase();

    if (DDKeys.isValid(key)) {
      await new Promise(resolve => {
        chrome.storage.local.set({ dd_pro: true }, resolve);
      });
      error.style.display = 'none';
      loadProStatus();
      loadTodayTab();
    } else {
      error.style.display = 'block';
      input.classList.add('dd-pro-input-error');
      setTimeout(() => input.classList.remove('dd-pro-input-error'), 2000);
    }
  });

  document.getElementById('dd-licence-key').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('dd-activate-btn').click();
  });

  // Initial load
  loadTodayTab();
  loadProStatus();
});

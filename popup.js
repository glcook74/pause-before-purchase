// Popup auth UI logic for Dopamine Delay extension

const authScreen = document.getElementById('auth-screen');
const mainScreen = document.getElementById('main-screen');
const signedInBar = document.getElementById('signed-in-bar');
const userEmailEl = document.getElementById('user-email');
const authError = document.getElementById('auth-error');
const emailInput = document.getElementById('auth-email');
const passwordInput = document.getElementById('auth-password');
const btnSignin = document.getElementById('btn-signin');
const linkSignup = document.getElementById('link-signup');
const linkSkip = document.getElementById('link-skip');
const linkSignout = document.getElementById('link-signout');
const loadingOverlay = document.getElementById('dd-loading-overlay');

const DASHBOARD_URL = 'https://dopaminedelay.com/dashboard';

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function sanitizeURL(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return escapeHTML(url);
    }
  } catch (e) { /* invalid URL */ }
  return '';
}
const WEB_APP_ORIGINS = ['https://dopaminedelay.com', 'https://www.dopaminedelay.com'];
// Project ref extracted from SUPABASE_URL for bridge session key
const SUPABASE_PROJECT_REF = 'eimvpjrvnbsuqbtuxqmp';

let popupSupabase = null;

function getPopupClient() {
  if (popupSupabase) return popupSupabase;
  if (typeof supabase === 'undefined') return null;
  popupSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return popupSupabase;
}

function hideLoading() {
  if (loadingOverlay) loadingOverlay.classList.add('hidden');
}

/**
 * Send a message to the background service worker with error handling.
 */
function sendMessageToBackground(message) {
  return new Promise(resolve => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('[DD] Background message error:', chrome.runtime.lastError.message);
          resolve(null);
        } else {
          resolve(response);
        }
      });
    } catch (e) {
      resolve(null);
    }
  });
}

/**
 * Find any open dopaminedelay.com tab and send it a message via the bridge.
 * Returns the first successful response, or null.
 */
async function sendToBridge(msg) {
  try {
    const tabs = await chrome.tabs.query({ url: WEB_APP_ORIGINS.map(o => o + '/*') });
    for (const tab of tabs) {
      try {
        const response = await chrome.tabs.sendMessage(tab.id, msg);
        if (response) return response;
      } catch (e) {
        // Tab may not have bridge loaded yet — skip
      }
    }
  } catch (e) {
    console.warn('[DD] Bridge query failed:', e);
  }
  return null;
}

/**
 * Try to pick up a session from an open dopaminedelay.com tab.
 * If the web app is logged in but the extension isn't, we can sync automatically.
 */
async function tryGetSessionFromWebApp() {
  const response = await sendToBridge({ type: 'DD_BRIDGE_GET_SESSION' });
  if (response && response.success && response.session) {
    return response.session;
  }
  return null;
}

/**
 * Inject the extension's session into all open dopaminedelay.com tabs.
 */
async function injectSessionToWebApp(session) {
  try {
    const tabs = await chrome.tabs.query({ url: WEB_APP_ORIGINS.map(o => o + '/*') });
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'DD_BRIDGE_SET_SESSION',
          session,
          projectRef: SUPABASE_PROJECT_REF,
          reload: true,
        });
      } catch (e) { /* skip tabs without bridge */ }
    }
  } catch (e) {
    console.warn('[DD] Bridge inject failed:', e);
  }
}

/**
 * Clear the session from all open dopaminedelay.com tabs.
 */
async function clearSessionFromWebApp() {
  try {
    const tabs = await chrome.tabs.query({ url: WEB_APP_ORIGINS.map(o => o + '/*') });
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'DD_BRIDGE_CLEAR_SESSION',
          reload: true,
        });
      } catch (e) { /* skip */ }
    }
  } catch (e) {
    console.warn('[DD] Bridge clear failed:', e);
  }
}

// ===== INIT =====

async function init() {
  const { dd_user_id, dd_local_only } = await chrome.storage.local.get([
    'dd_user_id',
    'dd_local_only',
  ]);

  if (dd_user_id) {
    DDStorage.setActiveUser(dd_user_id);

    // Verify session via background
    const result = await sendMessageToBackground({ type: 'VERIFY_SESSION' });

    if (!result || !result.success || result.userId !== dd_user_id) {
      // Session expired or user mismatch — full sign out
      await sendMessageToBackground({ type: 'SIGN_OUT' });
      DDStorage.setActiveUser(null);

      // Before showing auth screen, try to pick up a session from the web app
      const webSession = await tryGetSessionFromWebApp();
      if (webSession && webSession.user) {
        await loginFromSession(webSession);
        hideLoading();
        return;
      }

      hideLoading();
      showAuthScreen();
      return;
    }

    // Check for email mismatch — if VERIFY_SESSION returns a different email
    // than what we have stored, update our stored copy
    const { dd_user_email } = await chrome.storage.local.get('dd_user_email');
    if (result.email && dd_user_email && result.email !== dd_user_email) {
      await chrome.storage.local.set({ dd_user_email: result.email });
      userEmailEl.textContent = result.email;
    } else if (dd_user_email) {
      userEmailEl.textContent = dd_user_email;
    } else if (result.email) {
      await chrome.storage.local.set({ dd_user_email: result.email });
      userEmailEl.textContent = result.email;
    }

    hideLoading();
    showMainScreen(true);

  } else if (dd_local_only) {
    DDStorage.setActiveUser('local');
    hideLoading();
    showMainScreen(false);

  } else {
    // Not signed in — check if the web app has a session we can use
    const webSession = await tryGetSessionFromWebApp();
    if (webSession && webSession.user) {
      await loginFromSession(webSession);
      hideLoading();
      return;
    }

    hideLoading();
    showAuthScreen();
  }

  // Pause duration setting
  const pauseDurationSelect = document.getElementById('pause-duration');
  if (pauseDurationSelect) {
    const settings = await DDStorage.getSettings();
    pauseDurationSelect.value = String(settings.pauseDuration || 10);
    pauseDurationSelect.addEventListener('change', async () => {
      await DDStorage.updateSettings({ pauseDuration: parseInt(pauseDurationSelect.value, 10) });
    });
  }

  // Pause protection toggle
  const toggle = document.getElementById('dd-enabled-toggle');
  if (toggle) {
    const { dd_paused } = await chrome.storage.local.get('dd_paused');
    toggle.checked = !dd_paused;
    updateStatusDot(!dd_paused);
    toggle.addEventListener('change', async () => {
      await chrome.storage.local.set({ dd_paused: !toggle.checked });
      updateStatusDot(toggle.checked);
    });
  }
}

/**
 * Log in from a raw Supabase session object (from the web app bridge or SDK).
 * Sets up storage, loads profile, shows main screen.
 */
async function loginFromSession(session) {
  const userId = session.user.id;
  const email = session.user.email || '';

  // Clear previous user data if switching accounts
  const { dd_user_id: previousUserId } = await chrome.storage.local.get('dd_user_id');
  if (previousUserId && previousUserId !== userId) {
    await DDStorage.clearAllUserData(previousUserId);
  }
  const { dd_local_only } = await chrome.storage.local.get('dd_local_only');
  if (dd_local_only) {
    await DDStorage.clearAllUserData('local');
  }

  // Store session
  await chrome.storage.local.set({
    dd_session: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    },
    dd_user_id: userId,
    dd_user_email: email,
  });
  await chrome.storage.local.remove('dd_local_only');

  DDStorage.setActiveUser(userId);

  // Fetch profile from Supabase
  const client = getPopupClient();
  if (client) {
    try {
      await client.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });

      const { data: profile } = await client
        .from('user_profiles')
        .select('total_points, current_streak, is_pro')
        .eq('id', userId)
        .single();

      if (profile) {
        const localPts = await DDStorage.getPoints();
        const serverPts = profile.total_points || 0;
        if (serverPts > localPts) {
          await DDStorage.set(DDStorage.KEYS.POINTS, serverPts);
        }
        await DDStorage.set(DDStorage.KEYS.STREAK, profile.current_streak || 0);
        await DDStorage.set(DDStorage.KEYS.PRO, profile.is_pro || false);
      }
    } catch (e) {
      console.warn('[DD] Profile fetch failed:', e);
    }
  }

  sendMessageToBackground({ type: 'RETRY_QUEUE' });

  userEmailEl.textContent = email;
  showMainScreen(true);

  // Set up the toggle after showing main screen
  const toggle = document.getElementById('dd-enabled-toggle');
  if (toggle) {
    const { dd_paused } = await chrome.storage.local.get('dd_paused');
    toggle.checked = !dd_paused;
    updateStatusDot(!dd_paused);
    toggle.addEventListener('change', async () => {
      await chrome.storage.local.set({ dd_paused: !toggle.checked });
      updateStatusDot(toggle.checked);
    });
  }
}

// ===== UI HELPERS =====

function updateStatusDot(active) {
  const dot = document.getElementById('status-dot');
  const label = document.getElementById('status-label');
  if (dot) {
    dot.className = 'dd-status-dot' + (active ? '' : ' paused');
  }
  if (label) {
    label.textContent = active ? 'Active' : 'Paused';
  }
}

function showAuthScreen() {
  authScreen.style.display = 'flex';
  mainScreen.style.display = 'none';
}

function showMainScreen(signedIn) {
  authScreen.style.display = 'none';
  mainScreen.style.display = 'block';
  signedInBar.style.display = signedIn ? 'flex' : 'none';
  loadDashboardData();
}

function showError(msg) {
  authError.textContent = msg;
  authError.style.display = 'block';
}

function clearError() {
  authError.style.display = 'none';
}

// ===== SIGN IN =====

btnSignin.addEventListener('click', async () => {
  clearError();
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showError('Please enter email and password');
    return;
  }

  btnSignin.disabled = true;
  btnSignin.textContent = 'Signing in\u2026';

  const client = getPopupClient();
  if (!client) {
    showError('Connection error. Try again.');
    btnSignin.disabled = false;
    btnSignin.textContent = 'Sign in';
    return;
  }

  try {
    const { data, error } = await client.auth.signInWithPassword({ email, password });

    if (error) {
      const msg = error.message || '';
      if (msg.includes('Refresh Token') || msg.includes('refresh_token')) {
        await sendMessageToBackground({ type: 'SIGN_OUT' });
        showError('Session expired. Please sign in again.');
      } else {
        showError(msg);
      }
      btnSignin.disabled = false;
      btnSignin.textContent = 'Sign in';
      return;
    }

    const session = data.session;
    const userId = session.user.id;

    // Clear previous user data if switching accounts
    const { dd_user_id: previousUserId } = await chrome.storage.local.get('dd_user_id');
    if (previousUserId && previousUserId !== userId) {
      await DDStorage.clearAllUserData(previousUserId);
    }
    const { dd_local_only } = await chrome.storage.local.get('dd_local_only');
    if (dd_local_only) {
      await DDStorage.clearAllUserData('local');
    }

    // Store session and set active user
    await chrome.storage.local.set({
      dd_session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      },
      dd_user_id: userId,
      dd_user_email: email,
    });
    await chrome.storage.local.remove('dd_local_only');

    DDStorage.setActiveUser(userId);

    // Fetch profile from Supabase
    const { data: profile } = await client
      .from('user_profiles')
      .select('total_points, current_streak, is_pro')
      .eq('id', userId)
      .single();

    if (profile) {
      const localPts = await DDStorage.getPoints();
      const serverPts = profile.total_points || 0;
      if (serverPts > localPts) {
        await DDStorage.set(DDStorage.KEYS.POINTS, serverPts);
      }
      await DDStorage.set(DDStorage.KEYS.STREAK, profile.current_streak || 0);
      await DDStorage.set(DDStorage.KEYS.PRO, profile.is_pro || false);
    }

    // Retry any queued events
    sendMessageToBackground({ type: 'RETRY_QUEUE' });

    // Inject session into the web app via bridge — open dashboard if not already open
    const fullSession = {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      expires_in: session.expires_in,
      token_type: session.token_type || 'bearer',
      user: session.user,
    };

    const existingTabs = await chrome.tabs.query({ url: WEB_APP_ORIGINS.map(o => o + '/*') });
    if (existingTabs.length > 0) {
      // Inject into existing tabs
      await injectSessionToWebApp(fullSession);
    } else {
      // Open the dashboard — bridge.js will load on it, then we inject
      const newTab = await chrome.tabs.create({ url: DASHBOARD_URL, active: false });
      // Wait briefly for the page to load enough for bridge.js to be ready
      setTimeout(async () => {
        try {
          await chrome.tabs.sendMessage(newTab.id, {
            type: 'DD_BRIDGE_SET_SESSION',
            session: fullSession,
            projectRef: SUPABASE_PROJECT_REF,
            reload: true,
          });
        } catch (e) {
          // Bridge may not be ready yet — the user can refresh manually
          console.warn('[DD] Could not inject session into new tab:', e);
        }
      }, 2000);
    }

    userEmailEl.textContent = email;
    showMainScreen(true);
  } catch (e) {
    showError('Sign in failed. Please try again.');
  }

  btnSignin.disabled = false;
  btnSignin.textContent = 'Sign in';
});

// Enter key triggers sign in
passwordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btnSignin.click();
});

// Create account
linkSignup.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://dopaminedelay.com/signup' });
});

// Use without account
linkSkip.addEventListener('click', async () => {
  await chrome.storage.local.set({ dd_local_only: true });
  DDStorage.setActiveUser('local');
  showMainScreen(false);
});

// Sign out — clears extension data AND syncs sign-out to the web app
linkSignout.addEventListener('click', async () => {
  // Clear web app sessions via bridge first (before we lose auth)
  await clearSessionFromWebApp();

  // Then do the full extension sign-out
  await sendMessageToBackground({ type: 'SIGN_OUT' });
  DDStorage.setActiveUser(null);
  showAuthScreen();
});

// ===== TABS =====

function showTab(tab) {
  ['today','saved','settings'].forEach(t => {
    document.getElementById('panel-'+t).classList.toggle('active', t===tab);
    document.getElementById('tab-'+t).classList.toggle('active', t===tab);
  });
}

document.getElementById('tab-today').addEventListener('click', () => showTab('today'));
document.getElementById('tab-saved').addEventListener('click', () => showTab('saved'));
document.getElementById('tab-settings').addEventListener('click', () => showTab('settings'));

// ===== DASHBOARD DATA =====

async function loadDashboardData() {
  const pts = await DDStorage.getPoints();
  const streakData = await DDStorage.getStreak();
  const streak = typeof streakData === 'object' ? (streakData?.count || 0) : (streakData || 0);
  const pausesData = await DDStorage.getPausesToday();
  const pauses = pausesData?.count || 0;

  if (document.getElementById('points-display')) {
    document.getElementById('points-display').textContent = pts;
    document.getElementById('streak-display').textContent = streak;
    document.getElementById('pauses-display').textContent = pauses;
  }

  // Show friendly empty state message for new accounts
  const isNewAccount = pts === 0 && pauses === 0 && streak === 0;
  const todayPanel = document.getElementById('panel-today');
  const existingMsg = todayPanel?.querySelector('.dd-new-account-msg');
  if (isNewAccount && todayPanel && !existingMsg) {
    const msg = document.createElement('div');
    msg.className = 'dd-new-account-msg';
    msg.textContent = "Nothing tracked yet \u2014 we'll start counting your pauses from today.";
    todayPanel.insertBefore(msg, todayPanel.firstChild);
  } else if (!isNewAccount && existingMsg) {
    existingMsg.remove();
  }

  // Render impulse saved items
  const savedList = document.getElementById('saved-list');
  const savedItems = await DDStorage.getSavedItems();
  if (savedList) {
    if (savedItems.length === 0) {
      savedList.innerHTML = '<div class="empty-state">Nothing saved yet.</div>';
    } else {
      savedList.innerHTML = savedItems.map((item, i) => `
        <div class="dd-saved-item">
          <div class="dd-saved-item-name">${escapeHTML(item.product || 'Unknown item')}</div>
          <div class="dd-saved-item-meta">${escapeHTML(item.site || '')}${item.price ? ' \u00b7 ' + escapeHTML(item.price) : ''}</div>
          <div class="dd-saved-item-actions">
            ${sanitizeURL(item.url) ? '<a href="' + sanitizeURL(item.url) + '" target="_blank" class="dd-item-link">View</a>' : ''}
            <a class="dd-item-remove dd-remove-saved" data-index="${i}">Remove</a>
          </div>
        </div>
      `).join('');
      savedList.querySelectorAll('.dd-remove-saved').forEach(link => {
        link.addEventListener('click', async () => {
          const idx = parseInt(link.dataset.index);
          const items = await DDStorage.getSavedItems();
          if (items) {
            items.splice(idx, 1);
            await DDStorage.set(DDStorage.KEYS.SAVED_ITEMS, items);
            loadDashboardData();
          }
        });
      });
    }
  }

  // Render planned items
  const plannedList = document.getElementById('planned-list');
  const plannedItems = await DDStorage.getPlannedItems();
  if (plannedList) {
    if (plannedItems.length === 0) {
      plannedList.innerHTML = '<div class="empty-state">Nothing planned yet.</div>';
    } else {
      plannedList.innerHTML = plannedItems.map((item, i) => `
        <div class="dd-saved-item">
          <div class="dd-saved-item-name">${escapeHTML(item.product || 'Unknown item')}</div>
          <div class="dd-saved-item-meta">${escapeHTML(item.site || '')}${item.price ? ' \u00b7 ' + escapeHTML(item.price) : ''}</div>
          <div class="dd-saved-item-actions">
            ${sanitizeURL(item.url) ? '<a href="' + sanitizeURL(item.url) + '" target="_blank" class="dd-item-link">View</a>' : ''}
            <a class="dd-item-remove dd-remove-planned" data-index="${i}">Remove</a>
          </div>
        </div>
      `).join('');
      plannedList.querySelectorAll('.dd-remove-planned').forEach(link => {
        link.addEventListener('click', async () => {
          const idx = parseInt(link.dataset.index);
          const items = await DDStorage.getPlannedItems();
          if (items) {
            items.splice(idx, 1);
            await DDStorage.set(DDStorage.KEYS.PLANNED_ITEMS, items);
            loadDashboardData();
          }
        });
      });
    }
  }
}

// ===== PROFILE TAB =====

async function initProfileTab() {
  const stored = await chrome.storage.local.get('dd_user_profile');
  const profile = stored.dd_user_profile || {};

  const salaryEl = document.getElementById('dd-salary-bracket');
  const genderEl = document.getElementById('dd-gender');
  const ageEl = document.getElementById('dd-age-range');
  const adhdEl = document.getElementById('dd-adhd-status');

  if (salaryEl && profile.annual_salary) salaryEl.value = String(profile.annual_salary);
  if (genderEl && profile.gender) genderEl.value = profile.gender;
  if (ageEl && profile.age_range) ageEl.value = profile.age_range;
  if (adhdEl && profile.adhd_status) adhdEl.value = profile.adhd_status;

  const saveBtn = document.getElementById('dd-profile-save');
  const savedMsg = document.getElementById('dd-profile-saved-msg');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const newProfile = {
        annual_salary: salaryEl ? Number(salaryEl.value) || null : null,
        gender: genderEl ? genderEl.value || null : null,
        age_range: ageEl ? ageEl.value || null : null,
        adhd_status: adhdEl ? adhdEl.value || null : null,
      };
      await chrome.storage.local.set({ dd_user_profile: newProfile });
      if (savedMsg) {
        savedMsg.style.display = 'block';
        setTimeout(() => { savedMsg.style.display = 'none'; }, 2000);
      }
    });
  }
}
initProfileTab();

// Init on popup open
init();

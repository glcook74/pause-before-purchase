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

// Check if user is already signed in or in local-only mode
async function init() {
  // Restore Supabase session from storage
  const { dd_session } = await chrome.storage.local.get('dd_session');
  const client = getPopupClient();
  if (dd_session && client) {
    try {
      await client.auth.setSession({
        access_token: dd_session.access_token,
        refresh_token: dd_session.refresh_token
      });
    } catch (e) {
      console.warn('DD: session restore failed', e);
    }
  }

  const { dd_user_id, dd_local_only } = await chrome.storage.local.get([
    'dd_user_id',
    'dd_local_only',
  ]);

  if (dd_user_id) {
    showMainScreen(true);
    // Show email
    const { dd_user_email } = await chrome.storage.local.get('dd_user_email');
    if (dd_user_email) userEmailEl.textContent = dd_user_email;
  } else if (dd_local_only) {
    showMainScreen(false);
  } else {
    showAuthScreen();
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

// Sign in
btnSignin.addEventListener('click', async () => {
  clearError();
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showError('Please enter email and password');
    return;
  }

  btnSignin.disabled = true;
  btnSignin.textContent = 'Signing in…';

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
      showError(error.message);
      btnSignin.disabled = false;
      btnSignin.textContent = 'Sign in';
      return;
    }

    const session = data.session;
    const userId = session.user.id;

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

    // Fetch profile data and sync locally
    const { data: profile } = await client
      .from('profiles')
      .select('total_points, current_streak, is_pro')
      .eq('id', userId)
      .single();

    if (profile) {
      await chrome.storage.local.set({
        dd_points: profile.total_points,
        dd_streak: profile.current_streak,
        dd_pro: profile.is_pro,
      });
    }

    // Retry any queued events
    chrome.runtime.sendMessage({ type: 'RETRY_QUEUE' });

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

// Create account → open signup page
linkSignup.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://dopaminedelay.com/signup' });
});

// Use without account
linkSkip.addEventListener('click', async () => {
  await chrome.storage.local.set({ dd_local_only: true });
  showMainScreen(false);
});

// Sign out
linkSignout.addEventListener('click', async () => {
  const client = getPopupClient();
  if (client) {
    try { await client.auth.signOut(); } catch (e) { /* ignore */ }
  }
  await chrome.storage.local.remove([
    'dd_session',
    'dd_user_id',
    'dd_user_email',
    'dd_pro',
    'dd_local_only',
  ]);
  showAuthScreen();
});
function showTab(tab) {
  ['today','saved','settings'].forEach(t => {
    document.getElementById('panel-'+t).classList.toggle('active', t===tab);
    document.getElementById('tab-'+t).classList.toggle('active', t===tab);
  });
}

document.getElementById('tab-today').addEventListener('click', () => showTab('today'));
document.getElementById('tab-saved').addEventListener('click', () => showTab('saved'));
document.getElementById('tab-settings').addEventListener('click', () => showTab('settings'));

async function loadDashboardData() {
  const data = await chrome.storage.local.get(['dd_points','dd_streak','dd_pauses_today','dd_saved_items']);
  const pts = data.dd_points || 0;
  const streakData = data.dd_streak;
  const streak = typeof streakData === 'object' ? (streakData?.count || 0) : (streakData || 0);
  const pauses = data.dd_pauses_today?.count || 0;
  if (document.getElementById('points-display')) {
    document.getElementById('points-display').textContent = pts;
    document.getElementById('streak-display').textContent = streak;
    document.getElementById('pauses-display').textContent = pauses;
  }

  // Render saved items
  const savedList = document.getElementById('saved-list');
  const savedItems = data.dd_saved_items || [];
  if (savedList) {
    if (savedItems.length === 0) {
      savedList.innerHTML = '<div class="empty-state">Items you save for later appear here.</div>';
    } else {
      savedList.innerHTML = savedItems.map((item, i) => `
        <div style="padding:8px 0;border-bottom:1px solid #E8E2D9;font-size:12px;">
          <div style="font-weight:600;color:#1a1a1a;">${item.product || 'Unknown item'}</div>
          <div style="color:#666;">${item.site || ''}${item.price ? ' · ' + item.price : ''}${item.type ? ' · ' + item.type : ''}</div>
          <div style="display:flex;gap:8px;margin-top:4px;">
            ${item.url ? '<a href="' + item.url + '" target="_blank" style="color:#2A7D6B;text-decoration:none;">View</a>' : ''}
            <a class="dd-remove-saved" data-index="${i}" style="color:#c0392b;cursor:pointer;text-decoration:none;">Remove</a>
          </div>
        </div>
      `).join('');
      savedList.querySelectorAll('.dd-remove-saved').forEach(link => {
        link.addEventListener('click', async () => {
          const idx = parseInt(link.dataset.index);
          const { dd_saved_items: items } = await chrome.storage.local.get('dd_saved_items');
          if (items) {
            items.splice(idx, 1);
            await chrome.storage.local.set({ dd_saved_items: items });
            loadDashboardData();
          }
        });
      });
    }
  }
}
// Init on popup open
init();

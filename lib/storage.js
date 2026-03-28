/**
 * Dopamine Delay — Storage Utility
 * Namespaced Chrome local storage helpers for points, streaks, saved items, and settings.
 * User-aware: all user-specific data is keyed by the active user ID to prevent
 * data leaking between accounts.
 */

const DDStorage = (() => {
  'use strict';

  const KEYS = {
    POINTS: 'dd_points',
    STREAK: 'dd_streak',
    SAVED_ITEMS: 'dd_saved_items',
    PLANNED_ITEMS: 'dd_planned_items',
    PAUSES_TODAY: 'dd_pauses_today',
    REMINDERS: 'dd_reminders',
    LAST_EMOTION: 'dd_last_emotion',
    LAST_ALTERNATIVE: 'dd_last_alternative',
    LAST_ALTERNATIVE_CATEGORY: 'dd_last_alternative_category',
    SYNC_QUEUE: 'dd_sync_queue',
    PRO: 'dd_pro',
    PROFILE: 'dd_profile',
    SETTINGS: 'dd_settings',
    ONBOARDED: 'dd_onboarded',
    DISABLED_SITES: 'dd_disabled_sites'
  };

  // Keys that contain user-specific data and must be scoped to a userId.
  // Stored as e.g. "dd_points_<userId>" to prevent cross-account data bleed.
  const USER_DATA_KEYS = new Set([
    KEYS.POINTS, KEYS.STREAK, KEYS.SAVED_ITEMS, KEYS.PLANNED_ITEMS,
    KEYS.PAUSES_TODAY, KEYS.REMINDERS, KEYS.LAST_EMOTION,
    KEYS.LAST_ALTERNATIVE, KEYS.LAST_ALTERNATIVE_CATEGORY,
    KEYS.SYNC_QUEUE, KEYS.PRO
  ]);

  const DEFAULT_SETTINGS = {
    pauseDuration: 10,
    lateNightMode: true,
    theme: 'cream'
  };

  let _activeUserId = null;

  function setActiveUser(userId) {
    _activeUserId = userId || null;
  }

  function getActiveUser() {
    return _activeUserId;
  }

  /**
   * Resolve a storage key, prefixing with the active userId for user-specific keys.
   * Device-level keys (settings, onboarding, disabled sites) are returned as-is.
   */
  function resolveKey(key) {
    if (_activeUserId && USER_DATA_KEYS.has(key)) {
      return `${key}_${_activeUserId}`;
    }
    return key;
  }

  function get(key) {
    const resolved = resolveKey(key);
    return new Promise(resolve => {
      chrome.storage.local.get([resolved], result => {
        resolve(result[resolved]);
      });
    });
  }

  function set(key, value) {
    const resolved = resolveKey(key);
    return new Promise(resolve => {
      chrome.storage.local.set({ [resolved]: value }, resolve);
    });
  }

  /**
   * Clear all user-specific data for a given userId.
   * Called on logout to prevent data leaking to the next account.
   */
  async function clearAllUserData(userId) {
    if (!userId) return;
    const keysToRemove = Array.from(USER_DATA_KEYS).map(k => `${k}_${userId}`);
    await chrome.storage.local.remove(keysToRemove);
  }

  /**
   * Initialise the active user from storage.
   * Returns the userId that was set, or null.
   */
  async function initActiveUser() {
    const result = await chrome.storage.local.get(['dd_user_id', 'dd_local_only']);
    const userId = result.dd_user_id || (result.dd_local_only ? 'local' : null);
    setActiveUser(userId);
    return userId;
  }

  // --- Points ---

  async function getPoints() {
    return (await get(KEYS.POINTS)) || 0;
  }

  async function addPoints(amount) {
    const current = await getPoints();
    const newTotal = current + amount;
    await set(KEYS.POINTS, newTotal);
    return newTotal;
  }

  // --- Streak ---

  async function getStreak() {
    const data = await get(KEYS.STREAK);
    return data || { count: 0, lastDate: null };
  }

  async function recordPauseForStreak() {
    const streak = await getStreak();
    const today = new Date().toISOString().split('T')[0];

    if (streak.lastDate === today) {
      return streak;
    }

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    let newCount;

    if (streak.lastDate === yesterday) {
      newCount = streak.count + 1;
    } else if (streak.lastDate === null) {
      newCount = 1;
    } else {
      newCount = 1;
    }

    const newStreak = { count: newCount, lastDate: today };
    await set(KEYS.STREAK, newStreak);

    // Award streak bonus at 7-day milestone
    if (newCount > 0 && newCount % 7 === 0) {
      await addPoints(25);
    }

    return newStreak;
  }

  // --- Pauses today ---

  async function getPausesToday() {
    const data = await get(KEYS.PAUSES_TODAY);
    if (!data) return { count: 0, date: null };
    const today = new Date().toISOString().split('T')[0];
    if (data.date !== today) {
      return { count: 0, date: today };
    }
    return data;
  }

  async function incrementPausesToday() {
    const today = new Date().toISOString().split('T')[0];
    const data = await getPausesToday();
    const newData = {
      count: data.date === today ? data.count + 1 : 1,
      date: today
    };
    await set(KEYS.PAUSES_TODAY, newData);
    return newData;
  }

  // --- Saved items ---

  async function getSavedItems() {
    return (await get(KEYS.SAVED_ITEMS)) || [];
  }

  async function saveItem(item) {
    const items = await getSavedItems();
    items.unshift({
      id: Date.now().toString(),
      product: item.product || 'Unknown item',
      site: item.site || '',
      price: item.price || '',
      url: item.url || '',
      savedAt: new Date().toISOString(),
      status: 'pending'
    });
    await set(KEYS.SAVED_ITEMS, items);
    return items;
  }

  async function removeSavedItem(id) {
    const items = await getSavedItems();
    const filtered = items.filter(item => item.id !== id);
    await set(KEYS.SAVED_ITEMS, filtered);
    return filtered;
  }

  // --- Planned items ---

  async function getPlannedItems() {
    return (await get(KEYS.PLANNED_ITEMS)) || [];
  }

  async function savePlannedItem(item) {
    const items = await getPlannedItems();
    items.unshift({
      id: Date.now().toString(),
      product: item.product || 'Unknown item',
      site: item.site || '',
      price: item.price || '',
      url: item.url || '',
      savedAt: new Date().toISOString(),
      status: 'pending',
      type: 'planned'
    });
    await set(KEYS.PLANNED_ITEMS, items);
    return items;
  }

  // --- Reminders ---

  async function getReminders() {
    return (await get(KEYS.REMINDERS)) || [];
  }

  async function addReminder(reminder) {
    const reminders = await getReminders();
    reminders.push(reminder);
    await set(KEYS.REMINDERS, reminders);
    return reminders;
  }

  // --- Settings ---

  async function getSettings() {
    const stored = await get(KEYS.SETTINGS);
    return { ...DEFAULT_SETTINGS, ...(stored || {}) };
  }

  async function updateSettings(partial) {
    const current = await getSettings();
    const updated = { ...current, ...partial };
    await set(KEYS.SETTINGS, updated);
    return updated;
  }

  // --- Profile ---

  async function getProfile() {
    return (await get(KEYS.PROFILE)) || null;
  }

  async function setProfile(profileType) {
    await set(KEYS.PROFILE, profileType);
  }

  // --- Onboarding ---

  async function isOnboarded() {
    return (await get(KEYS.ONBOARDED)) === true;
  }

  async function setOnboarded() {
    await set(KEYS.ONBOARDED, true);
  }

  // --- Disabled sites ---

  async function getDisabledSites() {
    return (await get(KEYS.DISABLED_SITES)) || [];
  }

  async function toggleSite(hostname, enabled) {
    const sites = await getDisabledSites();
    if (enabled) {
      const filtered = sites.filter(s => s !== hostname);
      await set(KEYS.DISABLED_SITES, filtered);
    } else {
      if (!sites.includes(hostname)) {
        sites.push(hostname);
        await set(KEYS.DISABLED_SITES, sites);
      }
    }
  }

  // --- Effective pause duration ---

  async function getEffectivePauseDuration(priceText) {
    const settings = await getSettings();
    let duration = settings.pauseDuration;

    // Scale up for purchases over £50
    const priceNum = parseFloat((priceText || '').replace(/[^0-9.]/g, ''));
    if (!isNaN(priceNum) && priceNum > 50) {
      duration = Math.max(duration, 30);
    }

    // Late-night mode: extended pause after 9pm
    if (settings.lateNightMode) {
      const hour = new Date().getHours();
      if (hour >= 21 || hour < 6) {
        duration = Math.max(duration, 30);
      }
    }

    return duration;
  }

  // --- Money saved ---

  async function getMoneySaved() {
    const items = await getSavedItems();
    let total = 0;
    items.forEach(item => {
      const price = parseFloat((item.price || '').replace(/[^0-9.]/g, ''));
      if (!isNaN(price)) total += price;
    });
    return total;
  }

  return {
    KEYS,
    USER_DATA_KEYS,
    get, set,
    resolveKey,
    setActiveUser, getActiveUser, initActiveUser,
    clearAllUserData,
    getPoints, addPoints,
    getStreak, recordPauseForStreak,
    getPausesToday, incrementPausesToday,
    getSavedItems, saveItem, removeSavedItem,
    getPlannedItems, savePlannedItem,
    getReminders, addReminder,
    getSettings, updateSettings,
    getProfile, setProfile,
    isOnboarded, setOnboarded,
    getDisabledSites, toggleSite,
    getEffectivePauseDuration,
    getMoneySaved
  };
})();

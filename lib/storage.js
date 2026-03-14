/**
 * Dopamine Delay — Storage Utility
 * Namespaced Chrome local storage helpers for points, streaks, saved items, and settings.
 */

const DDStorage = (() => {
  'use strict';

  const KEYS = {
    POINTS: 'dd_points',
    STREAK: 'dd_streak',
    SAVED_ITEMS: 'dd_saved_items',
    PAUSES_TODAY: 'dd_pauses_today',
    PROFILE: 'dd_profile',
    SETTINGS: 'dd_settings',
    ONBOARDED: 'dd_onboarded',
    DISABLED_SITES: 'dd_disabled_sites'
  };

  const DEFAULT_SETTINGS = {
    pauseDuration: 10,
    lateNightMode: true,
    theme: 'cream'
  };

  function get(key) {
    return new Promise(resolve => {
      chrome.storage.local.get([key], result => {
        resolve(result[key]);
      });
    });
  }

  function set(key, value) {
    return new Promise(resolve => {
      chrome.storage.local.set({ [key]: value }, resolve);
    });
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
      savedAt: new Date().toISOString()
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
    get, set,
    getPoints, addPoints,
    getStreak, recordPauseForStreak,
    getPausesToday, incrementPausesToday,
    getSavedItems, saveItem, removeSavedItem,
    getSettings, updateSettings,
    getProfile, setProfile,
    isOnboarded, setOnboarded,
    getDisabledSites, toggleSite,
    getEffectivePauseDuration,
    getMoneySaved
  };
})();

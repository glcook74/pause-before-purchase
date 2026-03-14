document.addEventListener('DOMContentLoaded', () => {
  const toggleEnabled = document.getElementById('toggle-enabled');
  const cooldownTime = document.getElementById('cooldown-time');
  const plannedCooldown = document.getElementById('planned-cooldown');
  const resetStats = document.getElementById('reset-stats');

  // Load settings
  chrome.storage.sync.get(
    ['enabled', 'cooldownMinutes', 'plannedCooldownMinutes', 'stats'],
    (data) => {
      toggleEnabled.checked = data.enabled !== false;
      cooldownTime.value = data.cooldownMinutes || '10';
      plannedCooldown.value = data.plannedCooldownMinutes || '2';
      updateStatsDisplay(data.stats || {});
    }
  );

  toggleEnabled.addEventListener('change', () => {
    chrome.storage.sync.set({ enabled: toggleEnabled.checked });
  });

  cooldownTime.addEventListener('change', () => {
    chrome.storage.sync.set({ cooldownMinutes: cooldownTime.value });
  });

  plannedCooldown.addEventListener('change', () => {
    chrome.storage.sync.set({ plannedCooldownMinutes: plannedCooldown.value });
  });

  resetStats.addEventListener('click', () => {
    const emptyStats = {
      pausesToday: 0,
      impulseCaught: 0,
      proceededCount: 0,
      lastResetDate: new Date().toDateString(),
    };
    chrome.storage.sync.set({ stats: emptyStats }, () => {
      updateStatsDisplay(emptyStats);
    });
  });

  function updateStatsDisplay(stats) {
    // Reset daily stats if it's a new day
    const today = new Date().toDateString();
    if (stats.lastResetDate !== today) {
      stats.pausesToday = 0;
      stats.lastResetDate = today;
      chrome.storage.sync.set({ stats });
    }

    document.getElementById('pauses-today').textContent = stats.pausesToday || 0;
    document.getElementById('impulse-caught').textContent = stats.impulseCaught || 0;
    document.getElementById('proceeded-count').textContent = stats.proceededCount || 0;
  }
});

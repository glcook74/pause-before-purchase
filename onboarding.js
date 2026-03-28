/**
 * Dopamine Delay — Onboarding Flow
 * 5 screens: Welcome -> How it works -> Profile -> Permissions -> Ready
 */

(function () {
  'use strict';

  let currentScreen = 1;
  let selectedProfile = null;

  function showScreen(num) {
    document.querySelectorAll('.ob-screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-' + num).classList.add('active');

    document.querySelectorAll('.ob-dot').forEach(dot => {
      dot.classList.toggle('active', parseInt(dot.dataset.screen) === num);
    });

    currentScreen = num;
  }

  // Screen 1 -> 2
  document.getElementById('btn-next-1').addEventListener('click', () => {
    showScreen(2);
  });

  // Screen 2 -> 3
  document.getElementById('btn-next-2').addEventListener('click', () => {
    showScreen(3);
  });

  // Screen 3: Profile selection
  document.querySelectorAll('.ob-option').forEach(option => {
    option.addEventListener('click', () => {
      document.querySelectorAll('.ob-option').forEach(o => o.classList.remove('selected'));
      option.classList.add('selected');
      selectedProfile = option.dataset.profile;
      document.getElementById('btn-next-3').disabled = false;
    });
  });

  // Screen 3 -> 4
  document.getElementById('btn-next-3').addEventListener('click', async () => {
    if (selectedProfile) {
      await DDStorage.setProfile(selectedProfile);
    }
    showScreen(4);
  });

  document.getElementById('btn-skip-3').addEventListener('click', () => {
    showScreen(4);
  });

  // Screen 4 -> 5
  document.getElementById('btn-next-4').addEventListener('click', async () => {
    showScreen(5);
  });

  // Screen 5: Finish
  document.getElementById('btn-finish').addEventListener('click', async () => {
    // Initialise user context so points go to the right scoped key
    await DDStorage.initActiveUser();
    // Award 50 welcome points
    await DDStorage.addPoints(50);
    // Mark as onboarded (device-level)
    await DDStorage.setOnboarded();
    // Close the tab
    window.close();
  });
})();

/**
 * Dopamine Delay — Dopamine Alternatives Library
 * Rotating set of substitute dopamine sources to offer during the pause.
 * Alternatives rotate on each visit to maintain novelty (Black et al., 2012).
 */

const DDAlternatives = (() => {
  'use strict';

  const LIBRARY = [
    {
      id: 'music',
      icon: '🎵',
      label: 'Listen to something you love',
      category: 'MUSIC',
      action: 'external',
      url: 'https://open.spotify.com'
    },
    {
      id: 'movement',
      icon: '🤸',
      label: 'Get up and move for 2 minutes',
      category: 'MOVEMENT',
      action: 'inline',
      detail: 'Stand up, stretch your arms overhead, roll your shoulders, touch your toes. Two minutes — your body will thank you.'
    },
    {
      id: 'puzzle',
      icon: '🧩',
      label: 'Try a short puzzle',
      category: 'PUZZLE',
      action: 'inline',
      detail: 'Quick challenge: count backwards from 100 by 7s. Or try naming 5 countries beginning with the letter B.'
    },
    {
      id: 'breathing',
      icon: '🌬️',
      label: '4 counts in, hold, out, hold',
      category: 'BREATHING',
      action: 'inline',
      detail: 'Box breathing: breathe in for 4 counts, hold for 4, breathe out for 4, hold for 4. Repeat 3 times.'
    },
    {
      id: 'learning',
      icon: '📚',
      label: 'Learn something surprising',
      category: 'LEARNING',
      action: 'external',
      url: 'https://en.wikipedia.org/wiki/Special:Random'
    },
    {
      id: 'creativity',
      icon: '🎨',
      label: 'Sketch something for 5 minutes',
      category: 'CREATIVITY',
      action: 'inline',
      detail: 'Grab a pen and paper. Draw the first object you see on your desk, or doodle whatever comes to mind. No skill needed!'
    },
    {
      id: 'social',
      icon: '💬',
      label: 'Connect with someone',
      category: 'SOCIAL',
      action: 'inline',
      detail: 'Text a friend something kind, or send a silly meme. Connection releases oxytocin — a natural mood booster.'
    },
    {
      id: 'nature',
      icon: '🌿',
      label: '60 seconds of fresh air',
      category: 'NATURE',
      action: 'inline',
      detail: 'Step outside for just 60 seconds. Look at the sky. Feel the air. Nature resets your attention system.'
    }
  ];

  /**
   * Return a shuffled selection of alternatives.
   * Prioritises based on user profile if available.
   */
  function getAlternatives(count, profile) {
    let pool = [...LIBRARY];

    // Prioritise based on profile
    if (profile === 'impulsive') {
      pool = prioritise(pool, ['breathing', 'movement', 'nature']);
    } else if (profile === 'stressed') {
      pool = prioritise(pool, ['breathing', 'nature', 'music']);
    } else if (profile === 'tracker') {
      pool = prioritise(pool, ['puzzle', 'learning', 'creativity']);
    }

    // Shuffle using Fisher-Yates
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    return pool.slice(0, count || 4);
  }

  function prioritise(pool, ids) {
    const prioritised = [];
    const rest = [];
    pool.forEach(item => {
      if (ids.includes(item.id)) {
        prioritised.push(item);
      } else {
        rest.push(item);
      }
    });
    return [...prioritised, ...rest];
  }

  return { getAlternatives, LIBRARY };
})();

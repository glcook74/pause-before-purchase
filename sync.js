// Sync logic: write pause events to Supabase, manage offline queue

/**
 * Sync a pause event to Supabase.
 * @param {Object} data - { site, product, price, choice_type, outcome, points_earned, alternative_chosen, url }
 */
function parsePriceNumber(priceStr) {
  if (!priceStr) return 0;
  const cleaned = String(priceStr).replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

async function syncPauseEvent(data) {
  const { dd_user_id } = await chrome.storage.local.get('dd_user_id');
  if (!dd_user_id) return; // local-only mode, no sync
  console.log('[DD] Syncing pause event for user:', dd_user_id);

  // Ensure DDStorage knows the active user for scoped key access
  DDStorage.setActiveUser(dd_user_id);

  const client = getSupabaseClient();
  if (!client) {
    await queueEvent(data);
    return;
  }

  try {
    // Restore session first — if it fails, don't queue (auth is broken)
    const session = await restoreSession();
    if (!session) {
      console.warn('[DD] No valid session, skipping sync');
      return;
    }

    const pointsEarned = data.pointsEarned || data.points_earned || 0;
    const priceNum = parsePriceNumber(data.price);
    const isDelayed = data.outcome === 'saved' || data.outcome === 'redirected';

    // 1. Insert into spend_events
    const spendEvent = {
      user_id: dd_user_id,
      source: 'extension',
      action_taken: isDelayed ? 'delayed' : 'bought',
      site: data.site,
      product: data.product || null,
      price: priceNum || null,
      choice_type: data.choiceType || data.choice_type,
      outcome: data.outcome,
      emotional_state: data.emotional_state || null,
      alternative_chosen: data.alternative_chosen || null,
      alternative_category: data.alternative_category || null,
      dark_patterns_detected: data.dark_patterns_detected || null,
    };

    const { error: spendErr } = await client.from('spend_events').insert(spendEvent);
    if (spendErr) console.error('[DD] Update error:', JSON.stringify(spendErr));
    if (spendErr) throw spendErr;

    // 2. Insert into points table
    if (pointsEarned > 0) {
      const { error: pointsErr } = await client.from('points').insert({
        user_id: dd_user_id,
        source: 'extension',
        points_earned: pointsEarned,
        reason: isDelayed ? 'delayed_purchase' : 'pause',
      });
      if (pointsErr) console.error('[DD] Update error:', JSON.stringify(pointsErr));
      if (pointsErr) console.warn('[DD] points insert error:', pointsErr.message);
    }

    // 3. Update user_profiles streak & totals
    try {
      const { data: profile, error: profileErr } = await client
        .from('user_profiles')
        .select('total_points, total_pauses, current_streak, longest_streak, last_pause_date, money_saved_estimate, total_saved')
        .eq('id', dd_user_id)
        .single();

      if (!profileErr && profile) {
        const today = new Date().toISOString().split('T')[0];
        const lastPause = profile.last_pause_date;
        let newStreak = profile.current_streak || 0;

        if (lastPause === today) {
          // Same day, no streak change
        } else if (lastPause) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];
          newStreak = lastPause === yesterdayStr ? (profile.current_streak || 0) + 1 : 1;
        } else {
          newStreak = 1;
        }

        const newLongest = Math.max(newStreak, profile.longest_streak || 0);
        const priceSaved = data.outcome === 'saved' ? priceNum : 0;

        await client
          .from('user_profiles')
          .update({
            total_points: (profile.total_points || 0) + pointsEarned,
            total_pauses: (profile.total_pauses || 0) + 1,
            current_streak: newStreak,
            longest_streak: newLongest,
            last_pause_date: today,
            money_saved_estimate: (profile.money_saved_estimate || 0) + priceSaved,
            total_saved: data.outcome === 'saved' ? (profile.total_saved || 0) + 1 : (profile.total_saved || 0),
          })
          .eq('id', dd_user_id);

        await DDStorage.set(DDStorage.KEYS.POINTS, (profile.total_points || 0) + pointsEarned);
        await DDStorage.set(DDStorage.KEYS.STREAK, newStreak);
      }
    } catch (profileErr) {
      console.warn('[DD] user_profiles update failed (non-critical):', profileErr.message || profileErr);
    }

    // Update local points cache as fallback
    if (pointsEarned > 0) {
      const localPts = await DDStorage.getPoints();
      await DDStorage.set(DDStorage.KEYS.POINTS, localPts + pointsEarned);
    }

    console.log('[DD] Synced pause event successfully');
  } catch (err) {
    console.warn('[DD] Sync failed, queuing event:', err.message || err);
    await queueEvent(data);
  }
}

/**
 * Queue a failed event for later retry (scoped to the current user).
 */
async function queueEvent(data) {
  const queue = (await DDStorage.get(DDStorage.KEYS.SYNC_QUEUE)) || [];
  queue.push({ ...data, queued_at: Date.now() });
  await DDStorage.set(DDStorage.KEYS.SYNC_QUEUE, queue);
}

/**
 * Retry all queued events for the current user.
 */
async function retrySyncQueue() {
  const queue = (await DDStorage.get(DDStorage.KEYS.SYNC_QUEUE)) || [];
  if (queue.length === 0) return;

  console.log(`[DD] Retrying ${queue.length} queued events`);

  // Clear queue first to avoid duplicates if new events come in
  await DDStorage.set(DDStorage.KEYS.SYNC_QUEUE, []);

  const failedEvents = [];
  for (const event of queue) {
    const { queued_at, ...data } = event;
    try {
      const { dd_user_id } = await chrome.storage.local.get('dd_user_id');
      if (!dd_user_id) continue;

      const client = getSupabaseClient();
      if (!client) {
        failedEvents.push(event);
        continue;
      }

      const session = await restoreSession();
      if (!session) {
        // Auth is broken — stop retrying all events
        const remaining = queue.slice(queue.indexOf(event)).map(e => {
          const { queued_at: _, ...d } = e;
          return { ...d, queued_at: Date.now() };
        });
        if (remaining.length > 0) {
          const currentQueue = (await DDStorage.get(DDStorage.KEYS.SYNC_QUEUE)) || [];
          await DDStorage.set(DDStorage.KEYS.SYNC_QUEUE, [...currentQueue, ...remaining]);
        }
        return;
      }
      await syncPauseEvent(data);
    } catch (e) {
      failedEvents.push(event);
    }
  }

  if (failedEvents.length > 0) {
    const currentQueue = (await DDStorage.get(DDStorage.KEYS.SYNC_QUEUE)) || [];
    await DDStorage.set(DDStorage.KEYS.SYNC_QUEUE, [...currentQueue, ...failedEvents]);
  }
}

/**
 * Check pro status from Supabase and cache locally (scoped to user).
 */
async function checkProStatus() {
  const { dd_user_id } = await chrome.storage.local.get('dd_user_id');
  if (!dd_user_id) return;

  DDStorage.setActiveUser(dd_user_id);

  const client = getSupabaseClient();
  if (!client) return;

  try {
    const session = await restoreSession();
    if (!session) return; // No valid session, skip

    const { data, error } = await client
      .from('user_profiles')
      .select('is_pro')
      .eq('id', dd_user_id)
      .single();

    if (!error && data) {
      await DDStorage.set(DDStorage.KEYS.PRO, data.is_pro);
    }
  } catch (e) {
    console.warn('[DD] Pro status check failed:', e);
  }
}

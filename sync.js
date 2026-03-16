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

  const client = getSupabaseClient();
  if (!client) {
    await queueEvent(data);
    return;
  }

  try {
    // Restore session first
    await restoreSession();

    // 1. Fetch current profile for streak calculation
    const { data: profile, error: profileErr } = await client
      .from('profiles')
      .select('total_points, total_pauses, current_streak, longest_streak, last_pause_date, money_saved_estimate, total_saved')
      .eq('id', dd_user_id)
      .single();

    if (profileErr) throw profileErr;

    // 2. Calculate streak
    const today = new Date().toISOString().split('T')[0];
    const lastPause = profile.last_pause_date;
    let newStreak = profile.current_streak;

    if (lastPause === today) {
      // Same day, no streak change
    } else if (lastPause) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      newStreak = lastPause === yesterdayStr ? profile.current_streak + 1 : 1;
    } else {
      newStreak = 1;
    }

    const newLongest = Math.max(newStreak, profile.longest_streak);
    const pointsEarned = data.pointsEarned || data.points_earned || 0;
    const priceSaved = data.outcome === 'saved' ? parsePriceNumber(data.price) : 0;

    // 3. Update profile
    const { error: updateErr } = await client
      .from('profiles')
      .update({
        total_points: profile.total_points + pointsEarned,
        total_pauses: profile.total_pauses + 1,
        current_streak: newStreak,
        longest_streak: newLongest,
        last_pause_date: today,
        money_saved_estimate: profile.money_saved_estimate + priceSaved,
        total_saved: data.outcome === 'saved' ? profile.total_saved + 1 : profile.total_saved,
      })
      .eq('id', dd_user_id);

    if (updateErr) throw updateErr;

    // 4. Insert pause record
    const { error: pauseErr } = await client.from('pauses').insert({
      user_id: dd_user_id,
      site: data.site,
      product: data.product || null,
      price: parsePriceNumber(data.price) || null,
      choice_type: data.choiceType || data.choice_type,
      outcome: data.outcome,
      points_earned: pointsEarned,
      alternative_chosen: data.alternative_chosen || null,
    });

    if (pauseErr) throw pauseErr;

    // 5. If saved, insert into saved_items
    if (data.outcome === 'saved') {
      const { error: savedErr } = await client.from('saved_items').insert({
        user_id: dd_user_id,
        site: data.site,
        product: data.product || null,
        price: parsePriceNumber(data.price) || null,
        url: data.url || null,
        status: 'pending',
      });

      if (savedErr) console.warn('[DD] saved_items insert error:', savedErr.message);
    }

    // Update local points cache
    const newTotal = profile.total_points + pointsEarned;
    await chrome.storage.local.set({
      dd_points: newTotal,
      dd_streak: newStreak,
    });

    console.log('[DD] Synced pause event successfully');
  } catch (err) {
    console.warn('[DD] Sync failed, queuing event:', err.message || err);
    await queueEvent(data);
  }
}

/**
 * Queue a failed event for later retry.
 */
async function queueEvent(data) {
  const { dd_sync_queue = [] } = await chrome.storage.local.get('dd_sync_queue');
  dd_sync_queue.push({ ...data, queued_at: Date.now() });
  await chrome.storage.local.set({ dd_sync_queue });
}

/**
 * Retry all queued events.
 */
async function retrySyncQueue() {
  const { dd_sync_queue = [] } = await chrome.storage.local.get('dd_sync_queue');
  if (dd_sync_queue.length === 0) return;

  console.log(`[DD] Retrying ${dd_sync_queue.length} queued events`);

  // Clear queue first to avoid duplicates if new events come in
  await chrome.storage.local.set({ dd_sync_queue: [] });

  const failedEvents = [];
  for (const event of dd_sync_queue) {
    const { queued_at, ...data } = event;
    try {
      // Try direct insert without queue (avoid infinite recursion)
      const { dd_user_id } = await chrome.storage.local.get('dd_user_id');
      if (!dd_user_id) continue;

      const client = getSupabaseClient();
      if (!client) {
        failedEvents.push(event);
        continue;
      }

      await restoreSession();
      await syncPauseEvent(data);
    } catch (e) {
      failedEvents.push(event);
    }
  }

  if (failedEvents.length > 0) {
    const { dd_sync_queue: currentQueue = [] } = await chrome.storage.local.get('dd_sync_queue');
    await chrome.storage.local.set({ dd_sync_queue: [...currentQueue, ...failedEvents] });
  }
}

/**
 * Check pro status from Supabase and cache locally.
 */
async function checkProStatus() {
  const { dd_user_id } = await chrome.storage.local.get('dd_user_id');
  if (!dd_user_id) return;

  const client = getSupabaseClient();
  if (!client) return;

  try {
    await restoreSession();
    const { data, error } = await client
      .from('profiles')
      .select('is_pro')
      .eq('id', dd_user_id)
      .single();

    if (!error && data) {
      await chrome.storage.local.set({ dd_pro: data.is_pro });
    }
  } catch (e) {
    console.warn('[DD] Pro status check failed:', e);
  }
}

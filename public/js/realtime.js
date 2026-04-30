// Supabase Realtime subscriptions
let supabaseClient = null;
let queueChannel = null;
let ticketChannel = null;

function initRealtime() {
  if (!window.supabase) {
    console.warn('Supabase client not loaded');
    return;
  }
  const { createClient } = window.supabase;
  supabaseClient = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

  // Subscribe to queues table changes
  queueChannel = supabaseClient
    .channel('queues-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'queues' }, (payload) => {
      console.log('Queue change:', payload);
      if (typeof onQueueUpdate === 'function') onQueueUpdate(payload);
    })
    .subscribe();

  // Subscribe to queue_tickets table changes
  ticketChannel = supabaseClient
    .channel('tickets-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_tickets' }, (payload) => {
      console.log('Ticket change:', payload);
      if (typeof onTicketUpdate === 'function') onTicketUpdate(payload);
    })
    .subscribe();
}

function cleanupRealtime() {
  if (supabaseClient) {
    if (queueChannel) supabaseClient.removeChannel(queueChannel);
    if (ticketChannel) supabaseClient.removeChannel(ticketChannel);
  }
}

// Notification helper
function checkAlmostCalled(currentNumber, myNumber) {
  const diff = myNumber - currentNumber;
  if (diff > 0 && diff <= 3) {
    showToast(`⚡ Nomor Anda ${myNumber} akan segera dipanggil! (${diff} nomor lagi)`, 'warning');
    playNotificationSound();
    if (Notification.permission === 'granted') {
      new Notification('KlinikQ', { body: `Nomor ${myNumber} akan segera dipanggil! (${diff} nomor lagi)`, icon: '🏥' });
    }
  }
  if (diff === 0) {
    showToast(`🎉 Nomor ${myNumber} sedang dipanggil! Silakan menuju loket.`, 'success');
    playNotificationSound();
    if (Notification.permission === 'granted') {
      new Notification('KlinikQ', { body: `Nomor ${myNumber} dipanggil! Silakan menuju loket.`, icon: '🏥' });
    }
  }
}

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    gain.gain.value = 0.3;
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) { /* silent */ }
}

window.addEventListener('beforeunload', cleanupRealtime);

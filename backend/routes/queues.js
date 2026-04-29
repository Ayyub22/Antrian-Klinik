const express = require('express');
const supabase = require('../config/supabase');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { getTodayDate, estimateWaitTime } = require('../utils/helpers');

const router = express.Router();

/**
 * GET /api/queues/today
 * Ambil semua antrian hari ini
 */
router.get('/today', async (req, res) => {
  try {
    const today = getTodayDate();

    const { data: queues, error } = await supabase
      .from('queues')
      .select(`
        *,
        doctors (id, nama, spesialis, foto)
      `)
      .eq('tanggal', today)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Get queues error:', error);
      return res.status(500).json({ error: 'Gagal mengambil data antrian.' });
    }

    // Untuk setiap queue, ambil tiket-tiketnya
    const queuesWithTickets = await Promise.all(
      (queues || []).map(async (queue) => {
        const { data: tickets } = await supabase
          .from('queue_tickets')
          .select(`
            *,
            users (id, nama, no_telp)
          `)
          .eq('queue_id', queue.id)
          .order('nomor', { ascending: true });

        return {
          ...queue,
          tickets: tickets || [],
          waiting_count: (tickets || []).filter(t => t.status === 'waiting').length,
          done_count: (tickets || []).filter(t => t.status === 'done').length
        };
      })
    );

    res.json({ queues: queuesWithTickets });
  } catch (err) {
    console.error('Get queues error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});

/**
 * POST /api/queues/create
 * Buat sesi antrian baru (Admin only)
 */
router.post('/create', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { doctor_id } = req.body;
    const today = getTodayDate();

    if (!doctor_id) {
      return res.status(400).json({ error: 'doctor_id wajib diisi.' });
    }

    // Cek apakah sudah ada antrian untuk dokter ini hari ini
    const { data: existing } = await supabase
      .from('queues')
      .select('id')
      .eq('doctor_id', doctor_id)
      .eq('tanggal', today)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Sesi antrian untuk dokter ini hari ini sudah ada.' });
    }

    const { data, error } = await supabase
      .from('queues')
      .insert({
        doctor_id,
        tanggal: today,
        status: 'open',
        current_number: 0,
        last_number: 0
      })
      .select(`
        *,
        doctors (id, nama, spesialis)
      `)
      .single();

    if (error) {
      console.error('Create queue error:', error);
      return res.status(500).json({ error: 'Gagal membuat sesi antrian.' });
    }

    res.status(201).json({ message: 'Sesi antrian berhasil dibuat.', queue: data });
  } catch (err) {
    console.error('Create queue error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});

/**
 * POST /api/queues/take
 * Ambil nomor antrian (Pasien)
 */
router.post('/take', authenticateToken, async (req, res) => {
  try {
    const { queue_id } = req.body;
    const userId = req.user.id;

    if (!queue_id) {
      return res.status(400).json({ error: 'queue_id wajib diisi.' });
    }

    // Cek apakah antrian masih open
    const { data: queue, error: queueError } = await supabase
      .from('queues')
      .select('*')
      .eq('id', queue_id)
      .single();

    if (queueError || !queue) {
      return res.status(404).json({ error: 'Antrian tidak ditemukan.' });
    }

    if (queue.status === 'closed') {
      return res.status(400).json({ error: 'Antrian sudah ditutup.' });
    }

    // Cek apakah pasien sudah punya tiket aktif di antrian ini
    const { data: existingTicket } = await supabase
      .from('queue_tickets')
      .select('id')
      .eq('queue_id', queue_id)
      .eq('user_id', userId)
      .in('status', ['waiting', 'called'])
      .single();

    if (existingTicket) {
      return res.status(409).json({ error: 'Anda sudah memiliki nomor antrian aktif di sesi ini.' });
    }

    // Ambil nomor berikutnya
    const nextNumber = queue.last_number + 1;

    // Update last_number di queue
    await supabase
      .from('queues')
      .update({ last_number: nextNumber })
      .eq('id', queue_id);

    // Buat tiket
    const { data: ticket, error: ticketError } = await supabase
      .from('queue_tickets')
      .insert({
        queue_id,
        user_id: userId,
        nomor: nextNumber,
        status: 'waiting',
        waktu_ambil: new Date().toISOString()
      })
      .select()
      .single();

    if (ticketError) {
      console.error('Take ticket error:', ticketError);
      return res.status(500).json({ error: 'Gagal mengambil nomor antrian.' });
    }

    // Hitung posisi
    const { data: waitingTickets } = await supabase
      .from('queue_tickets')
      .select('id')
      .eq('queue_id', queue_id)
      .eq('status', 'waiting')
      .lt('nomor', nextNumber);

    const position = (waitingTickets ? waitingTickets.length : 0) + 1;

    res.status(201).json({
      message: 'Nomor antrian berhasil diambil!',
      ticket: {
        ...ticket,
        position,
        estimasi_waktu: estimateWaitTime(position - 1)
      }
    });
  } catch (err) {
    console.error('Take queue error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});

/**
 * PUT /api/queues/:id/call
 * Panggil nomor antrian berikutnya (Admin)
 */
router.put('/:id/call', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const queueId = req.params.id;

    // Ambil data queue
    const { data: queue } = await supabase
      .from('queues')
      .select('*')
      .eq('id', queueId)
      .single();

    if (!queue) {
      return res.status(404).json({ error: 'Antrian tidak ditemukan.' });
    }

    // Tandai tiket yang sedang serving jadi done
    await supabase
      .from('queue_tickets')
      .update({ status: 'done', waktu_selesai: new Date().toISOString() })
      .eq('queue_id', queueId)
      .eq('status', 'serving');

    // Cari tiket waiting berikutnya
    const { data: nextTicket, error: nextError } = await supabase
      .from('queue_tickets')
      .select('*')
      .eq('queue_id', queueId)
      .eq('status', 'waiting')
      .order('nomor', { ascending: true })
      .limit(1)
      .single();

    if (nextError || !nextTicket) {
      return res.status(404).json({ error: 'Tidak ada antrian yang menunggu.' });
    }

    // Update tiket jadi serving
    const { data: updatedTicket } = await supabase
      .from('queue_tickets')
      .update({ 
        status: 'serving', 
        waktu_panggil: new Date().toISOString() 
      })
      .eq('id', nextTicket.id)
      .select(`
        *,
        users (id, nama, no_telp)
      `)
      .single();

    // Update current_number di queue
    await supabase
      .from('queues')
      .update({ current_number: nextTicket.nomor })
      .eq('id', queueId);

    res.json({
      message: `Nomor ${nextTicket.nomor} dipanggil!`,
      ticket: updatedTicket
    });
  } catch (err) {
    console.error('Call queue error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});

/**
 * PUT /api/queues/:id/skip
 * Skip pasien (Admin)
 */
router.put('/:id/skip', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const ticketId = req.params.id;

    const { data, error } = await supabase
      .from('queue_tickets')
      .update({ status: 'skipped' })
      .eq('id', ticketId)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Tiket tidak ditemukan.' });
    }

    res.json({ message: 'Pasien di-skip.', ticket: data });
  } catch (err) {
    console.error('Skip error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});

/**
 * PUT /api/queues/:id/done
 * Tandai selesai (Admin)
 */
router.put('/:id/done', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const ticketId = req.params.id;

    const { data, error } = await supabase
      .from('queue_tickets')
      .update({ 
        status: 'done',
        waktu_selesai: new Date().toISOString()
      })
      .eq('id', ticketId)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Tiket tidak ditemukan.' });
    }

    res.json({ message: 'Pasien selesai dilayani.', ticket: data });
  } catch (err) {
    console.error('Done error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});

/**
 * PUT /api/queues/:id/cancel
 * Batalkan antrian (Pasien)
 */
router.put('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const ticketId = req.params.id;

    // Cek apakah tiket milik user ini
    const { data: ticket } = await supabase
      .from('queue_tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (!ticket) {
      return res.status(404).json({ error: 'Tiket tidak ditemukan.' });
    }

    // Hanya pemilik tiket atau admin yang bisa cancel
    if (ticket.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Anda tidak memiliki akses untuk membatalkan tiket ini.' });
    }

    if (ticket.status === 'done' || ticket.status === 'cancelled') {
      return res.status(400).json({ error: 'Tiket sudah selesai atau dibatalkan.' });
    }

    const { data, error } = await supabase
      .from('queue_tickets')
      .update({ status: 'cancelled' })
      .eq('id', ticketId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Gagal membatalkan antrian.' });
    }

    res.json({ message: 'Antrian berhasil dibatalkan.', ticket: data });
  } catch (err) {
    console.error('Cancel error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});

/**
 * GET /api/queues/status/:ticketId
 * Cek posisi antrian
 */
router.get('/status/:ticketId', async (req, res) => {
  try {
    const ticketId = req.params.ticketId;

    // Ambil tiket
    const { data: ticket, error } = await supabase
      .from('queue_tickets')
      .select(`
        *,
        queues (
          id, current_number, last_number, status,
          doctors (id, nama, spesialis)
        )
      `)
      .eq('id', ticketId)
      .single();

    if (error || !ticket) {
      return res.status(404).json({ error: 'Tiket tidak ditemukan.' });
    }

    // Hitung posisi antrian
    let position = 0;
    if (ticket.status === 'waiting') {
      const { data: waitingBefore } = await supabase
        .from('queue_tickets')
        .select('id')
        .eq('queue_id', ticket.queue_id)
        .eq('status', 'waiting')
        .lt('nomor', ticket.nomor);

      position = (waitingBefore ? waitingBefore.length : 0) + 1;
    }

    res.json({
      ticket: {
        ...ticket,
        position,
        estimasi_waktu: ticket.status === 'waiting' ? estimateWaitTime(position - 1) : null
      }
    });
  } catch (err) {
    console.error('Status error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});

/**
 * GET /api/queues/my-tickets
 * Lihat tiket antrian saya (Pasien)
 */
router.get('/my-tickets', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = getTodayDate();

    const { data: tickets, error } = await supabase
      .from('queue_tickets')
      .select(`
        *,
        queues (
          id, current_number, last_number, status, tanggal,
          doctors (id, nama, spesialis, foto)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Gagal mengambil data tiket.' });
    }

    // Tambahkan posisi untuk tiket yang masih waiting
    const ticketsWithPosition = await Promise.all(
      (tickets || []).map(async (ticket) => {
        let position = 0;
        if (ticket.status === 'waiting') {
          const { data: waitingBefore } = await supabase
            .from('queue_tickets')
            .select('id')
            .eq('queue_id', ticket.queue_id)
            .eq('status', 'waiting')
            .lt('nomor', ticket.nomor);

          position = (waitingBefore ? waitingBefore.length : 0) + 1;
        }

        return {
          ...ticket,
          position,
          estimasi_waktu: ticket.status === 'waiting' ? estimateWaitTime(position - 1) : null
        };
      })
    );

    res.json({ tickets: ticketsWithPosition });
  } catch (err) {
    console.error('My tickets error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});

/**
 * PUT /api/queues/:id/close
 * Tutup sesi antrian (Admin)
 */
router.put('/:id/close', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const queueId = req.params.id;

    const { data, error } = await supabase
      .from('queues')
      .update({ status: 'closed' })
      .eq('id', queueId)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Antrian tidak ditemukan.' });
    }

    res.json({ message: 'Sesi antrian berhasil ditutup.', queue: data });
  } catch (err) {
    console.error('Close queue error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});

module.exports = router;

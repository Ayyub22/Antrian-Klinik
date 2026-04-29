const express = require('express');
const supabase = require('../config/supabase');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/doctors
 * Lihat semua dokter aktif
 */
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('doctors')
      .select('*')
      .eq('is_active', true)
      .order('nama', { ascending: true });

    if (error) {
      return res.status(500).json({ error: 'Gagal mengambil data dokter.' });
    }

    res.json({ doctors: data });
  } catch (err) {
    console.error('Get doctors error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});

/**
 * GET /api/doctors/:id
 * Lihat detail dokter
 */
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('doctors')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Dokter tidak ditemukan.' });
    }

    res.json({ doctor: data });
  } catch (err) {
    console.error('Get doctor error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});

/**
 * POST /api/doctors
 * Tambah dokter baru (Admin only)
 */
router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { nama, spesialis, foto, jadwal } = req.body;

    if (!nama || !spesialis) {
      return res.status(400).json({ error: 'Nama dan spesialis wajib diisi.' });
    }

    const { data, error } = await supabase
      .from('doctors')
      .insert({
        nama,
        spesialis,
        foto: foto || '',
        jadwal: jadwal || {}
      })
      .select()
      .single();

    if (error) {
      console.error('Create doctor error:', error);
      return res.status(500).json({ error: 'Gagal menambahkan dokter.' });
    }

    res.status(201).json({ message: 'Dokter berhasil ditambahkan.', doctor: data });
  } catch (err) {
    console.error('Create doctor error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});

/**
 * PUT /api/doctors/:id
 * Update data dokter (Admin only)
 */
router.put('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { nama, spesialis, foto, jadwal, is_active } = req.body;

    const updateData = {};
    if (nama !== undefined) updateData.nama = nama;
    if (spesialis !== undefined) updateData.spesialis = spesialis;
    if (foto !== undefined) updateData.foto = foto;
    if (jadwal !== undefined) updateData.jadwal = jadwal;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data, error } = await supabase
      .from('doctors')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Gagal mengupdate dokter.' });
    }

    res.json({ message: 'Dokter berhasil diupdate.', doctor: data });
  } catch (err) {
    console.error('Update doctor error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});

/**
 * DELETE /api/doctors/:id
 * Hapus dokter (Admin only)
 */
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { error } = await supabase
      .from('doctors')
      .delete()
      .eq('id', req.params.id);

    if (error) {
      return res.status(500).json({ error: 'Gagal menghapus dokter.' });
    }

    res.json({ message: 'Dokter berhasil dihapus.' });
  } catch (err) {
    console.error('Delete doctor error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});

module.exports = router;

-- ============================================
-- QueueEase — Database Schema
-- Sistem Antrian Klinik/Puskesmas Online
-- ============================================

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nama VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'pasien' CHECK (role IN ('admin', 'pasien')),
  no_telp VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. DOCTORS TABLE
CREATE TABLE IF NOT EXISTS doctors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nama VARCHAR(100) NOT NULL,
  spesialis VARCHAR(100) NOT NULL,
  foto TEXT DEFAULT '',
  jadwal JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. QUEUES TABLE (Sesi antrian per dokter per hari)
CREATE TABLE IF NOT EXISTS queues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  current_number INT DEFAULT 0,
  last_number INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(doctor_id, tanggal)
);

-- 4. QUEUE TICKETS TABLE
CREATE TABLE IF NOT EXISTS queue_tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  queue_id UUID REFERENCES queues(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  nomor INT NOT NULL,
  status VARCHAR(20) DEFAULT 'waiting' 
    CHECK (status IN ('waiting', 'called', 'serving', 'done', 'skipped', 'cancelled')),
  waktu_ambil TIMESTAMPTZ DEFAULT NOW(),
  waktu_panggil TIMESTAMPTZ,
  waktu_selesai TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Realtime on queue tables
ALTER PUBLICATION supabase_realtime ADD TABLE queues;
ALTER PUBLICATION supabase_realtime ADD TABLE queue_tickets;

-- Set replica identity for realtime old records
ALTER TABLE queues REPLICA IDENTITY FULL;
ALTER TABLE queue_tickets REPLICA IDENTITY FULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_queues_tanggal ON queues(tanggal);
CREATE INDEX IF NOT EXISTS idx_queues_doctor_tanggal ON queues(doctor_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_queue_tickets_queue_id ON queue_tickets(queue_id);
CREATE INDEX IF NOT EXISTS idx_queue_tickets_user_id ON queue_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_queue_tickets_status ON queue_tickets(status);

-- Disable RLS for simplicity (backend handles auth via JWT)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_tickets ENABLE ROW LEVEL SECURITY;

-- Allow anon key to read/write (backend uses service_role, frontend uses anon for realtime only)
CREATE POLICY "Allow all for anon" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON doctors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON queues FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON queue_tickets FOR ALL USING (true) WITH CHECK (true);

/**
 * Format tanggal ke YYYY-MM-DD
 */
function getTodayDate() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Estimasi waktu tunggu berdasarkan posisi antrian
 * Default: 10 menit per pasien
 */
function estimateWaitTime(position, avgMinutesPerPatient = 10) {
  const totalMinutes = position * avgMinutesPerPatient;
  if (totalMinutes < 60) {
    return `${totalMinutes} menit`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours} jam ${minutes} menit`;
}

module.exports = { getTodayDate, estimateWaitTime };

// Data tamu yang dicatat dari halaman Jalur Tamu

export const GUEST_NAME_MAX = 60;
export const GUEST_INSTANCE_MAX = 80;

const clean = (value) =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ');

/** Validasi nama & instansi tamu. Mengembalikan { value, errors }. */
export function validateGuest(input) {
  const value = { nama: clean(input.nama), instansi: clean(input.instansi) };
  const errors = {};
  if (!value.nama) errors.nama = 'Nama tamu wajib diisi.';
  else if (value.nama.length > GUEST_NAME_MAX) {
    errors.nama = `Nama maksimal ${GUEST_NAME_MAX} karakter.`;
  }
  if (!value.instansi) errors.instansi = 'Instansi wajib diisi.';
  else if (value.instansi.length > GUEST_INSTANCE_MAX) {
    errors.instansi = `Instansi maksimal ${GUEST_INSTANCE_MAX} karakter.`;
  }
  return { value, errors };
}

export const VISIT_STATUS_LABEL = {
  aman: 'Jalur aman',
  penuh: 'Terhalang ruangan penuh',
  'tidak-ada-jalur': 'Tidak ada jalur',
};

export function formatDateTime(date) {
  if (!date) return '—';
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function startOfDay(date = new Date()) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

/** Cocokkan kunjungan dengan kata kunci (nama, instansi, ruangan). */
export function matchesVisit(visit, keyword) {
  const key = keyword.trim().toLowerCase();
  if (!key) return true;
  return [visit.nama, visit.instansi, visit.asal_nama, visit.tujuan_nama]
    .join(' ')
    .toLowerCase()
    .includes(key);
}

const csvCell = (value) => {
  const text = String(value ?? '');
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** CSV riwayat tamu (pemisah koma, UTF-8 dengan BOM supaya terbaca rapi di Excel). */
export function visitsToCsv(visits, officeName) {
  const header = ['Waktu', 'Nama', 'Instansi', 'Kantor', 'Asal', 'Tujuan', 'Jarak (m)', 'Status'];
  const rows = visits.map((v) => [
    formatDateTime(v.created_at),
    v.nama,
    v.instansi,
    officeName(v.office_id),
    v.asal_nama,
    v.tujuan_nama,
    v.jarak == null ? '' : v.jarak.toFixed(1),
    VISIT_STATUS_LABEL[v.status] ?? v.status,
  ]);
  return `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
}

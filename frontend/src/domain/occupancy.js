// Aturan status occupancy ruangan: hijau < kuning% <= kuning < merah% <= merah.
// Batasnya bisa diubah di Back Office (settings/occupancy); ini nilai bawaannya.
export const DEFAULT_STATUS_RULES = { kuning: 70, merah: 90 };

export const STATUS_ORDER = ['hijau', 'kuning', 'merah'];

// Class Tailwind ditulis lengkap (bukan dirangkai) supaya terdeteksi saat build
const STATUS_STYLE = {
  hijau: {
    label: 'Hijau',
    description: 'Aman',
    hex: '#10b981',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    bar: 'bg-emerald-500',
  },
  kuning: {
    label: 'Kuning',
    description: 'Perhatian',
    hex: '#f59e0b',
    dot: 'bg-amber-500',
    text: 'text-amber-700',
    badge: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    bar: 'bg-amber-500',
  },
  merah: {
    label: 'Merah',
    description: 'Hampir penuh',
    hex: '#ef4444',
    dot: 'bg-red-500',
    text: 'text-red-700',
    badge: 'bg-red-50 text-red-700 ring-red-600/20',
    bar: 'bg-red-500',
  },
};

/** Tampilan tiap status beserta rentang persennya menurut aturan yang berlaku. */
export function statusMeta(rules = DEFAULT_STATUS_RULES) {
  return {
    hijau: { ...STATUS_STYLE.hijau, range: `< ${rules.kuning}%` },
    kuning: { ...STATUS_STYLE.kuning, range: `${rules.kuning}–${rules.merah}%` },
    merah: { ...STATUS_STYLE.merah, range: `≥ ${rules.merah}%` },
  };
}

/**
 * Validasi isian aturan status. Mengembalikan { value, errors } seperti validateRoomInput.
 * Batas kuning 1–99, batas merah lebih besar dari kuning dan paling besar 100.
 */
export function validateStatusRules(input) {
  const errors = {};
  const kuning = Number(input.kuning);
  const merah = Number(input.merah);
  if (!Number.isInteger(kuning) || kuning < 1 || kuning > 99) {
    errors.kuning = 'Batas kuning harus bilangan bulat 1–99.';
  }
  if (!Number.isInteger(merah) || merah < 2 || merah > 100) {
    errors.merah = 'Batas merah harus bilangan bulat 2–100.';
  } else if (!errors.kuning && merah <= kuning) {
    errors.merah = 'Batas merah harus lebih besar dari batas kuning.';
  }
  return { value: { kuning, merah }, errors };
}

export function getOccupancyRatio(room) {
  return room.kapasitas_max > 0 ? room.occupancy / room.kapasitas_max : 0;
}

export function getOccupancyPercent(room) {
  return getOccupancyRatio(room) * 100;
}

export function getOccupancyStatus(room, rules = DEFAULT_STATUS_RULES) {
  const percent = getOccupancyPercent(room);
  if (percent >= rules.merah) return 'merah';
  if (percent >= rules.kuning) return 'kuning';
  return 'hijau';
}

export function isRoomFull(room) {
  return room.occupancy >= room.kapasitas_max;
}

export function formatPercent(value) {
  return `${value.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export function summarizeRooms(rooms, rules = DEFAULT_STATUS_RULES) {
  const byStatus = { hijau: 0, kuning: 0, merah: 0 };
  let totalCapacity = 0;
  let totalOccupancy = 0;
  let ratioSum = 0;

  for (const room of rooms) {
    byStatus[getOccupancyStatus(room, rules)] += 1;
    totalCapacity += room.kapasitas_max;
    totalOccupancy += room.occupancy;
    ratioSum += getOccupancyRatio(room);
  }

  return {
    totalRooms: rooms.length,
    totalCapacity,
    totalOccupancy,
    averagePercent: rooms.length ? (ratioSum / rooms.length) * 100 : 0,
    byStatus,
  };
}

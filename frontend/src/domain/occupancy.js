// Aturan status occupancy ruangan: hijau < 70% <= kuning < 90% <= merah
export const WARNING_PERCENT = 70;
export const CRITICAL_PERCENT = 90;

export const STATUS_ORDER = ['hijau', 'kuning', 'merah'];

// Class Tailwind ditulis lengkap (bukan dirangkai) supaya terdeteksi saat build
export const STATUS_META = {
  hijau: {
    label: 'Hijau',
    description: 'Aman',
    range: `< ${WARNING_PERCENT}%`,
    hex: '#10b981',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    bar: 'bg-emerald-500',
  },
  kuning: {
    label: 'Kuning',
    description: 'Perhatian',
    range: `${WARNING_PERCENT}–${CRITICAL_PERCENT}%`,
    hex: '#f59e0b',
    dot: 'bg-amber-500',
    text: 'text-amber-700',
    badge: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    bar: 'bg-amber-500',
  },
  merah: {
    label: 'Merah',
    description: 'Hampir penuh',
    range: `≥ ${CRITICAL_PERCENT}%`,
    hex: '#ef4444',
    dot: 'bg-red-500',
    text: 'text-red-700',
    badge: 'bg-red-50 text-red-700 ring-red-600/20',
    bar: 'bg-red-500',
  },
};

export function getOccupancyRatio(room) {
  return room.kapasitas_max > 0 ? room.occupancy / room.kapasitas_max : 0;
}

export function getOccupancyPercent(room) {
  return getOccupancyRatio(room) * 100;
}

export function getOccupancyStatus(room) {
  const percent = getOccupancyPercent(room);
  if (percent >= CRITICAL_PERCENT) return 'merah';
  if (percent >= WARNING_PERCENT) return 'kuning';
  return 'hijau';
}

export function isRoomFull(room) {
  return room.occupancy >= room.kapasitas_max;
}

export function formatPercent(value) {
  return `${value.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export function summarizeRooms(rooms) {
  const byStatus = { hijau: 0, kuning: 0, merah: 0 };
  let totalCapacity = 0;
  let totalOccupancy = 0;
  let ratioSum = 0;

  for (const room of rooms) {
    byStatus[getOccupancyStatus(room)] += 1;
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

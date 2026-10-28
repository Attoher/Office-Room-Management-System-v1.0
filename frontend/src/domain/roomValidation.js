import { ROOM_TYPES } from './geometry';

export const MAX_NAME_LENGTH = 60;
export const MAX_CAPACITY = 1000;

/** Kunci pembanding nama ruangan: tidak peka huruf besar/kecil dan spasi berlebih. */
export function toNameKey(name) {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Luas (m²) selalu dihitung dari ukuran di denah. */
export function roomArea(room) {
  return Math.round(room.w * room.h * 100) / 100;
}

/**
 * Validasi informasi ruangan (nama, tipe, kapasitas). Posisi & ukuran divalidasi terpisah
 * oleh geometryError. Mengembalikan { value, errors }; errors kosong bila valid.
 */
export function validateRoomInput(input, { currentOccupancy = 0 } = {}) {
  const errors = {};
  const nama_ruangan = String(input.nama_ruangan ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  const tipe = input.tipe ?? 'ruangan';
  const kapasitas_max = Number(input.kapasitas_max);

  if (!nama_ruangan) errors.nama_ruangan = 'Nama ruangan wajib diisi';
  else if (nama_ruangan.length > MAX_NAME_LENGTH)
    errors.nama_ruangan = `Maksimal ${MAX_NAME_LENGTH} karakter`;

  if (!ROOM_TYPES[tipe]) errors.tipe = 'Tipe ruangan tidak dikenal';

  if (!Number.isInteger(kapasitas_max) || kapasitas_max <= 0)
    errors.kapasitas_max = 'Kapasitas harus bilangan bulat lebih dari 0';
  else if (kapasitas_max > MAX_CAPACITY)
    errors.kapasitas_max = `Kapasitas maksimal ${MAX_CAPACITY}`;
  else if (kapasitas_max < currentOccupancy)
    errors.kapasitas_max = `Tidak boleh lebih kecil dari jumlah orang saat ini (${currentOccupancy})`;

  return { value: { nama_ruangan, tipe, kapasitas_max }, errors };
}

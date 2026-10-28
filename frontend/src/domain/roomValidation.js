export const MAX_NAME_LENGTH = 60;
export const MAX_AREA = 100000;
export const MAX_CAPACITY = 1000;

/** Kunci pembanding nama ruangan: tidak peka huruf besar/kecil dan spasi berlebih. */
export function toNameKey(name) {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Validasi isian form ruangan.
 * Mengembalikan { value, errors }; errors berisi pesan per field (kosong bila valid).
 */
export function validateRoomInput(input, { currentOccupancy = 0 } = {}) {
  const errors = {};
  const nama_ruangan = String(input.nama_ruangan ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  const luas = Number(input.luas);
  const kapasitas_max = Number(input.kapasitas_max);

  if (!nama_ruangan) errors.nama_ruangan = 'Nama ruangan wajib diisi';
  else if (nama_ruangan.length > MAX_NAME_LENGTH)
    errors.nama_ruangan = `Maksimal ${MAX_NAME_LENGTH} karakter`;

  if (!Number.isFinite(luas) || luas <= 0) errors.luas = 'Luas harus lebih dari 0';
  else if (luas > MAX_AREA) errors.luas = `Luas maksimal ${MAX_AREA} m²`;

  if (!Number.isInteger(kapasitas_max) || kapasitas_max <= 0)
    errors.kapasitas_max = 'Kapasitas harus bilangan bulat lebih dari 0';
  else if (kapasitas_max > MAX_CAPACITY)
    errors.kapasitas_max = `Kapasitas maksimal ${MAX_CAPACITY}`;
  else if (kapasitas_max < currentOccupancy)
    errors.kapasitas_max = `Tidak boleh lebih kecil dari jumlah orang saat ini (${currentOccupancy})`;

  return {
    value: { nama_ruangan, luas: Math.round(luas * 100) / 100, kapasitas_max },
    errors,
  };
}

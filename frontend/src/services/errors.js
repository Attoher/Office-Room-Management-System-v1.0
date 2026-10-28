/** Error yang pesannya aman ditampilkan langsung ke pengguna. */
export class AppError extends Error {
  constructor(message, { fieldErrors } = {}) {
    super(message);
    this.name = 'AppError';
    this.fieldErrors = fieldErrors;
  }
}

const FIRESTORE_MESSAGES = {
  'permission-denied': 'Perubahan ditolak oleh aturan database. Periksa kembali isian Anda.',
  unavailable: 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.',
  'deadline-exceeded': 'Server terlalu lama merespons. Coba lagi.',
  'not-found': 'Data tidak ditemukan. Mungkin sudah dihapus.',
  aborted: 'Data sedang diubah oleh pengguna lain. Coba lagi.',
};

export function toAppError(error) {
  if (error instanceof AppError) return error;
  console.error(error);
  return new AppError(FIRESTORE_MESSAGES[error?.code] ?? 'Terjadi kesalahan. Coba lagi.');
}

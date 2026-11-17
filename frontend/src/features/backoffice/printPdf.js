/**
 * Export halaman ke PDF lewat dialog cetak browser (pilih "Simpan sebagai PDF"). Judul dokumen
 * dipakai browser sebagai nama file, jadi diganti sementara selama mencetak.
 */
export function printAsPdf(title) {
  const previous = document.title;
  document.title = title;
  const restore = () => {
    document.title = previous;
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  window.print();
}

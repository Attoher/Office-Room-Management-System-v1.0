# Office Room Management

Aplikasi web untuk memantau jumlah orang di setiap ruangan kantor secara realtime dan mencari jalur tamu yang menghindari ruangan penuh.

React 18 · Vite 5 · Tailwind CSS 3 · Firebase Cloud Firestore

## Fitur

- **Multi kantor**: data tersusun Kantor → Lantai → Ruangan → Pintu dan elemen.
  - Kantor dipilih di header. Pilihan diingat browser dan ikut di URL (`?kantor=ID`).
  - Kantor dikelola dari menu "Kelola kantor": tambah, ubah nama dan alamat, dan hapus (hanya kantor kosong).
  - Semua halaman hanya menampilkan isi kantor yang dipilih, dan nama ruangan cukup unik per kantor.
- **Monitoring**: kartu per ruangan dengan status hijau (< 70%), kuning (70–90%), dan merah (≥ 90%). Tersedia pencarian, filter lantai dan status, ringkasan statistik, serta tombol tambah/kurangi orang. Perubahan dari perangkat lain tampil otomatis.
- **Editor denah (Manajemen)**: denah multi lantai di grid 0,5 m.
  - Gambar ruangan sebagai kotak, lalu geser dan ubah ukurannya dari sudut. Luas dihitung otomatis dari panjang × lebar.
  - Tipe ruangan: Ruangan, Lorong, Tangga, Lift, atau Area luar (taman, parkir, teras: tanpa dinding, tetap bisa dilewati tamu).
  - **Tetangga** terdeteksi otomatis dari dinding bersama. **Pintu** dipasang di dinding bersama (minimal 1,1 m), bisa lebih dari satu per pasangan ruangan, bisa digeser sepanjang dinding, dan arah buka serta engselnya bisa dibalik.
  - Pintu tidak boleh bertabrakan: ada tiang minimal 0,2 m di antara pintu yang segaris, jarak 0,1 m dari ujung dinding, dan daun pintu yang membuka ke ruangan yang sama tidak boleh saling menyapu.
  - Tangga/lift bisa dihubungkan ke tangga/lift di lantai lain.
  - Mode **Diagram**: titik per ruangan dengan garis hanya untuk ruangan yang tersambung pintu, untuk melihat sekilas ruangan mana yang belum punya akses.
  - **Gambar arsitek**: dinding luar tebal dan dinding dalam tipis.
    - Jenis pintu: daun tunggal 0,9 m, daun ganda 1,6 m, geser 1,2 m, dan bukaan tanpa daun 1,0 m.
    - **Jendela** di sisi ruangan, **kolom** (mode Kolom), dan **garis ukuran** yang bisa ditampilkan atau disembunyikan.
  - **Furnitur**: meja kerja, kursi, meja rapat, sofa, resepsionis, lemari, sanitair, tanaman.
    - Bisa digeser dan diputar 90°, dan furnitur baru otomatis menempel ke dinding.
    - Jumlah kursinya dipakai sebagai saran kapasitas ruangan.
  - **DXF (AutoCAD)**:
    - **Export** satu lantai ke DXF R12 (mm) dengan layer `A-RUANG`, `A-DINDING-LUAR`, `A-PINTU`, `A-JENDELA`, `A-KOLOM`, `A-FURNITUR`, `A-TEKS`.
    - **Import** ruangan dari polyline tertutup, nama dari teks di dalamnya, dan pintu dari busur ayunan. Langkahnya: pilih layer, satuan, dan tebal dinding, lalu lihat pratinjau. DWG perlu disimpan sebagai DXF dulu, dan ruangan non-kotak didekati dengan kotak.
- **Jalur tamu**: Dijkstra dengan jarak dalam meter (tengah ruangan → pintu → tengah ruangan), plus hingga 5 jalur alternatif (algoritma Yen).
  - Jalur bisa lintas lantai lewat tangga atau lift.
  - Ruangan penuh dihindari, dan ruangan yang ramai diberi biaya tambahan.
  - Jalur digambar di denah per lantai dan diperbarui otomatis saat occupancy berubah.

## Menjalankan

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

| Perintah | Fungsi |
| --- | --- |
| `npm run build` | Build produksi ke `frontend/dist` |
| `npm test` | Unit test logika domain (Vitest) |
| `npm run lint` | ESLint |
| `npm run format` | Rapikan kode dengan Prettier |
| `npm run seed:demo` | Isi database kosong dengan contoh kantor 2 lantai |

## Struktur

```
firestore.rules              Validasi data di Firestore
firebase.json, .firebaserc   Konfigurasi Firebase CLI (deploy rules)
frontend/scripts/seed-demo.js  Contoh kantor 2 lantai
frontend/src/
  domain/                    Logika murni + unit test
    geometry.js              Dinding bersama, tetangga, pintu & jenisnya, validasi denah
    elements.js              Jendela, kolom, furnitur, dinding luar
    dxf/                     Export & import DXF
    pathfinding.js           Graph berbobot, Dijkstra, k-jalur (Yen)
    occupancy.js             Status & statistik occupancy
    roomValidation.js        Validasi info ruangan, luas
  services/                  Akses Firestore (floor, room, door)
  hooks/useOfficeData.js     Langganan data realtime
  components/floorplan/      Kanvas denah SVG (dipakai editor & jalur tamu)
  components/ui/             Komponen UI bersama (Button, Card, Modal, toast, dll.)
  components/layout/         Header, splash screen, intro
  features/                  monitoring, management (editor denah), pathfinding
```

## Data (Cloud Firestore)

| Koleksi | Isi |
| --- | --- |
| `offices/{id}` | `id`, `nama`, `alamat` |
| `floors/{id}` | `id`, `office_id`, `nama` |
| `rooms/{id}` | `id`, `nama_ruangan`, `nama_key`, `tipe`, `lantai_id`, `x`, `y`, `w`, `h` (meter), `luas` (= w × h), `kapasitas_max`, `occupancy`, `created_at`, `updated_at` |
| `doors/{id}` | `room_from`, `room_to` (selalu `from < to`), `offset`: jarak tengah pintu dari awal dinding bersama (meter), `swing_into`: ruangan tempat daun pintu membuka, `hinge`: `start` atau `end`, `jenis`: `tunggal`, `ganda`, `geser`, atau `bukaan`. Bernilai `null` untuk penghubung tangga/lift antar lantai |
| `elements/{id}` | `jenis` (`jendela`, `kolom`, atau `furnitur`) dan `lantai_id`. Jendela: `room_id`, `sisi`, `offset`, `lebar`. Kolom: `x`, `y`, `w`, `h`. Furnitur: `room_id`, `model`, `x`, `y` (relatif ruangan), `rotasi` |
| `meta/counters` | `rooms`, `floors`, `offices`: ID numerik terakhir |

Aplikasi berjalan tanpa login. `firestore.rules` membatasi bentuk dan rentang data: posisi kelipatan 0,5 m, luas sama dengan panjang × lebar, occupancy di antara 0 dan kapasitas, ID berurutan, pintu satu lantai punya posisi, dan pintu antar lantai hanya antara tangga/lift. Ruangan yang bertumpuk dicegah di aplikasi. Untuk memasang rules:

```bash
npx firebase-tools deploy --only firestore:rules
```

Cara lain: salin isi `firestore.rules` ke Firebase Console → Firestore → Rules, lalu klik Publish.

## Deployment

Frontend di-deploy ke Vercel dengan **Root Directory** `frontend`. Tidak ada environment variable yang perlu diatur.

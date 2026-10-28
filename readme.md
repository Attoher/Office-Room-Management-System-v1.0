# Office Room Management

Aplikasi web untuk memantau jumlah orang di setiap ruangan kantor secara realtime dan mencari jalur tamu yang menghindari ruangan penuh.

React 18 · Vite 5 · Tailwind CSS 3 · Firebase Cloud Firestore

## Fitur

- **Monitoring**: kartu per ruangan dengan status hijau (< 70%), kuning (70–90%), dan merah (≥ 90%). Tersedia pencarian, filter lantai dan status, ringkasan statistik, serta tombol tambah/kurangi orang. Perubahan dari perangkat lain tampil otomatis.
- **Editor denah (Manajemen)**: denah multi lantai di grid 0,5 m.
  - Gambar ruangan sebagai kotak, lalu geser dan ubah ukurannya dari sudut. Luas dihitung otomatis dari panjang × lebar.
  - Tipe ruangan: Ruangan, Lorong, Tangga, atau Lift.
  - **Tetangga** terdeteksi otomatis dari dinding bersama. **Pintu** dipasang di dinding bersama (minimal 1 m) dan bisa digeser sepanjang dinding.
  - Tangga/lift bisa dihubungkan ke tangga/lift di lantai lain.
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
    geometry.js              Dinding bersama, tetangga, pintu, validasi denah
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
| `floors/{id}` | `id`, `nama` |
| `rooms/{id}` | `id`, `nama_ruangan`, `nama_key`, `tipe`, `lantai_id`, `x`, `y`, `w`, `h` (meter), `luas` (= w × h), `kapasitas_max`, `occupancy`, `created_at`, `updated_at` |
| `doors/{from}_{to}` | `room_from`, `room_to` (selalu `from < to`), `offset`: jarak tengah pintu dari awal dinding bersama (meter); `null` untuk penghubung tangga/lift antar lantai |
| `meta/counters` | `rooms`, `floors`: ID numerik terakhir |

Aplikasi berjalan tanpa login. `firestore.rules` membatasi bentuk dan rentang data: posisi kelipatan 0,5 m, luas sama dengan panjang × lebar, occupancy di antara 0 dan kapasitas, ID berurutan, pintu satu lantai punya posisi, dan pintu antar lantai hanya antara tangga/lift. Ruangan yang bertumpuk dicegah di aplikasi. Untuk memasang rules:

```bash
npx firebase-tools deploy --only firestore:rules
```

Cara lain: salin isi `firestore.rules` ke Firebase Console → Firestore → Rules, lalu klik Publish.

## Deployment

Frontend di-deploy ke Vercel dengan **Root Directory** `frontend`. Tidak ada environment variable yang perlu diatur.

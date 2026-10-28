# Office Room Management

Aplikasi web untuk memantau jumlah orang di setiap ruangan kantor secara realtime dan mencari jalur tamu yang menghindari ruangan penuh.

React 18 · Vite 5 · Tailwind CSS 3 · Firebase Cloud Firestore · vis-network

## Fitur

- **Monitoring**: kartu per ruangan dengan status hijau (< 70%), kuning (70–90%), dan merah (≥ 90%). Tersedia pencarian, filter status, ringkasan statistik, dan tombol tambah/kurangi orang. Perubahan dari perangkat lain tampil otomatis.
- **Manajemen**: tambah, ubah, dan hapus ruangan (nama unik tanpa membedakan huruf besar/kecil), serta hubungkan ruangan secara dua arah. Menghapus ruangan ikut menghapus koneksinya.
- **Jalur tamu**: memilih jalur dengan BFS, sehingga jalur terpendek selalu ikut dipertimbangkan. Jalur yang bebas dari ruangan penuh diprioritaskan, lalu jalur dengan skor efisiensi tertinggi. Hasilnya diperbarui otomatis saat occupancy berubah dan ditampilkan di graph interaktif.

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

## Struktur

```
firestore.rules              Validasi data di Firestore
firebase.json, .firebaserc   Konfigurasi Firebase CLI (deploy rules)
frontend/src/
  domain/                    Logika murni + unit test
    occupancy.js             Status & statistik occupancy
    pathfinding.js           Pencarian & penilaian jalur
    roomValidation.js        Validasi isian ruangan
  services/                  Akses Firestore
    firebase.js              Inisialisasi Firebase
    roomService.js           CRUD ruangan & occupancy
    connectionService.js     CRUD koneksi
    errors.js                Pesan error yang ramah pengguna
  hooks/useOfficeData.js     Langganan data realtime
  components/ui/             Komponen UI bersama (Button, Card, Modal, toast, dll.)
  components/layout/         Header, splash screen, intro
  features/                  monitoring, management, pathfinding
```

## Data (Cloud Firestore)

| Koleksi | Isi |
| --- | --- |
| `rooms/{id}` | `id`, `nama_ruangan`, `nama_key` (huruf kecil, untuk cek nama unik), `luas`, `kapasitas_max`, `occupancy`, `created_at`, `updated_at` |
| `connections/{from}_{to}` | `room_from`, `room_to` (selalu `from < to`), `created_at` |
| `meta/counters` | `rooms`: ID numerik ruangan terakhir |

Aplikasi berjalan tanpa login. `firestore.rules` membatasi bentuk dan rentang data: occupancy berada di antara 0 dan kapasitas, ID ruangan berurutan, dan koneksi hanya boleh antara ruangan yang ada. Untuk memasang rules:

```bash
npx firebase-tools deploy --only firestore:rules
```

Cara lain: salin isi `firestore.rules` ke Firebase Console → Firestore → Rules, lalu klik Publish.

## Deployment

Frontend di-deploy ke Vercel dengan **Root Directory** `frontend`. Tidak ada environment variable yang perlu diatur.

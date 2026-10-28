import { useState } from 'react';
import { Activity, Route, Settings2 } from 'lucide-react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

const STORAGE_KEY = 'orm:intro-seen';

const FEATURES = [
  {
    icon: Activity,
    title: 'Monitoring',
    text: 'Pantau jumlah orang di setiap ruangan. Warna hijau, kuning, dan merah menandai tingkat keterisian, dan perubahan dari perangkat lain tampil otomatis.',
  },
  {
    icon: Settings2,
    title: 'Manajemen',
    text: 'Tambah, ubah, dan hapus ruangan, lalu hubungkan ruangan yang bersebelahan.',
  },
  {
    icon: Route,
    title: 'Jalur Tamu',
    text: 'Cari jalur terpendek ke ruangan tujuan yang menghindari ruangan penuh.',
  },
];

// localStorage bisa tidak tersedia (mode privat / diblokir); intro tetap aman ditampilkan
function hasSeenIntro() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function markIntroSeen() {
  try {
    window.localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // abaikan: intro hanya akan muncul lagi di kunjungan berikutnya
  }
}

/** Perkenalan singkat yang hanya muncul pada kunjungan pertama di browser ini. */
export default function IntroDialog() {
  const [open, setOpen] = useState(() => !hasSeenIntro());

  const close = () => {
    markIntroSeen();
    setOpen(false);
  };

  return (
    <Modal
      open={open}
      title="Selamat datang"
      onClose={close}
      footer={
        <Button onClick={close} data-autofocus>
          Mulai
        </Button>
      }
    >
      <p className="text-sm text-slate-600">
        Aplikasi ini membantu mengelola ruangan kantor dan mengarahkan tamu. Ada tiga menu utama:
      </p>
      <ul className="mt-4 space-y-4">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-3">
            <div className="h-fit rounded-lg bg-blue-50 p-2 text-blue-600">
              <Icon className="size-5" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{title}</p>
              <p className="mt-0.5 text-sm text-slate-600">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

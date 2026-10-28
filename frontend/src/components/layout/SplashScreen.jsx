import { Building2 } from 'lucide-react';

/** Layar penuh saat data pertama kali dimuat dari Firestore. */
export default function SplashScreen() {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-slate-50"
      role="status"
      aria-label="Memuat data"
    >
      <div className="relative">
        <div className="absolute inset-0 animate-ping rounded-2xl bg-blue-600/20" aria-hidden />
        <div className="relative rounded-2xl bg-blue-600 p-4 text-white shadow-lg">
          <Building2 className="size-8" aria-hidden />
        </div>
      </div>
      <div className="text-center">
        <p className="text-base font-semibold text-slate-900">Office Room Management</p>
        <p className="mt-1 text-sm text-slate-500">Menyinkronkan data ruangan…</p>
      </div>
      <div className="h-1 w-48 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full w-1/3 animate-loading rounded-full bg-blue-600" />
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { History } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import { VISIT_STATUS_LABEL, startOfDay } from '../../domain/guestVisit';
import { subscribeGuestVisits } from '../../services/guestVisitService';

const formatTime = (date) =>
  date ? date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—';

const STATUS_DOT = {
  aman: 'bg-emerald-500',
  penuh: 'bg-red-500',
  'tidak-ada-jalur': 'bg-slate-400',
};

/** Riwayat tamu hari ini di kantor ini. Klik baris untuk menampilkan jalurnya lagi. */
export default function GuestHistory({ officeId, roomsById, onShowRoute }) {
  const [visits, setVisits] = useState(null);
  const [error, setError] = useState(null);

  useEffect(
    () =>
      subscribeGuestVisits(
        { since: startOfDay() },
        (data) => {
          setVisits(data);
          setError(null);
        },
        setError,
      ),
    [],
  );

  const officeVisits = useMemo(
    () => (visits ?? []).filter((v) => v.office_id === officeId),
    [visits, officeId],
  );

  let body;
  if (error) {
    body = <p className="text-sm text-red-600">Riwayat tidak bisa dimuat: {error.message}</p>;
  } else if (visits === null) {
    body = <p className="text-sm text-slate-500">Memuat riwayat…</p>;
  } else if (officeVisits.length === 0) {
    body = (
      <EmptyState
        icon={History}
        title="Belum ada tamu hari ini"
        description="Isi nama dan instansi tamu, pilih tujuan, lalu klik Catat kunjungan."
      />
    );
  } else {
    body = (
      <ul className="-mx-2 max-h-80 divide-y divide-slate-100 overflow-y-auto">
        {officeVisits.map((visit) => {
          const canShow = roomsById.has(visit.asal_id) && roomsById.has(visit.tujuan_id);
          return (
            <li key={visit.id}>
              <button
                type="button"
                disabled={!canShow}
                onClick={() => onShowRoute(visit.asal_id, visit.tujuan_id)}
                title={canShow ? 'Tampilkan jalurnya lagi' : 'Ruangannya sudah tidak ada'}
                className="flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-slate-50 disabled:cursor-default disabled:hover:bg-transparent"
              >
                <span className="w-11 shrink-0 pt-0.5 text-xs tabular-nums text-slate-500">
                  {formatTime(visit.created_at)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900">
                    {visit.nama}
                    <span className="font-normal text-slate-500"> · {visit.instansi}</span>
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {visit.asal_nama} → {visit.tujuan_nama}
                  </span>
                </span>
                <span
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${STATUS_DOT[visit.status] ?? 'bg-slate-400'}`}
                  title={VISIT_STATUS_LABEL[visit.status]}
                  aria-label={VISIT_STATUS_LABEL[visit.status]}
                />
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Riwayat tamu hari ini"
        description={
          officeVisits.length > 0 ? `${officeVisits.length} tamu tercatat` : 'Kantor yang dibuka'
        }
      />
      <CardBody className="pt-3">{body}</CardBody>
    </Card>
  );
}

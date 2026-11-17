import { describe, expect, it } from 'vitest';
import { matchesVisit, validateGuest, visitsToCsv } from './guestVisit';
import { getOccupancyStatus, statusMeta, validateStatusRules } from './occupancy';

describe('validateGuest', () => {
  it('merapikan nama dan instansi', () => {
    expect(validateGuest({ nama: '  Siti   Aminah ', instansi: ' PT Maju ' })).toEqual({
      value: { nama: 'Siti Aminah', instansi: 'PT Maju' },
      errors: {},
    });
  });

  it('nama dan instansi wajib diisi', () => {
    expect(Object.keys(validateGuest({ nama: ' ', instansi: '' }).errors).sort()).toEqual([
      'instansi',
      'nama',
    ]);
  });
});

describe('aturan status dari back office', () => {
  const room = (occupancy) => ({ occupancy, kapasitas_max: 10 });
  const rules = { kuning: 50, merah: 80 };

  it.each([
    [4, 'hijau'],
    [5, 'kuning'],
    [7, 'kuning'],
    [8, 'merah'],
  ])('%i/10 dengan batas 50/80 → %s', (occupancy, expected) => {
    expect(getOccupancyStatus(room(occupancy), rules)).toBe(expected);
  });

  it('rentang mengikuti batas', () => {
    const meta = statusMeta(rules);
    expect([meta.hijau.range, meta.kuning.range, meta.merah.range]).toEqual([
      '< 50%',
      '50–80%',
      '≥ 80%',
    ]);
  });

  it('merah harus lebih besar dari kuning', () => {
    expect(validateStatusRules({ kuning: '80', merah: '80' }).errors.merah).toBeTruthy();
    expect(validateStatusRules({ kuning: '0', merah: '50' }).errors.kuning).toBeTruthy();
    expect(validateStatusRules({ kuning: '60', merah: '100' }).errors).toEqual({});
  });
});

describe('riwayat tamu', () => {
  const visit = {
    nama: 'Budi',
    instansi: 'Dinas, Kota',
    office_id: 1,
    asal_nama: 'Lobby',
    tujuan_nama: 'Ruang Rapat',
    jarak: 12.34,
    status: 'aman',
    created_at: null,
  };

  it('pencarian mencakup instansi dan ruangan', () => {
    expect(matchesVisit(visit, 'dinas')).toBe(true);
    expect(matchesVisit(visit, 'rapat')).toBe(true);
    expect(matchesVisit(visit, 'gudang')).toBe(false);
  });

  it('CSV memberi tanda kutip pada isian berkoma', () => {
    const csv = visitsToCsv([visit], () => 'Kantor Pusat');
    expect(csv.startsWith('\uFEFFWaktu,')).toBe(true);
    expect(csv.split('\r\n')[1]).toBe(
      '—,Budi,"Dinas, Kota",Kantor Pusat,Lobby,Ruang Rapat,12.3,Jalur aman',
    );
  });
});

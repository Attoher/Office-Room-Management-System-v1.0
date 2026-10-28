import { describe, expect, it } from 'vitest';
import { getOccupancyStatus, summarizeRooms } from './occupancy';
import { toNameKey, validateRoomInput } from './roomValidation';

const room = (occupancy, kapasitas_max) => ({ occupancy, kapasitas_max });

describe('getOccupancyStatus', () => {
  it.each([
    [0, 10, 'hijau'],
    [6, 10, 'hijau'],
    [7, 10, 'kuning'],
    [8, 10, 'kuning'],
    [9, 10, 'merah'],
    [10, 10, 'merah'],
  ])('%i/%i → %s', (occupancy, kapasitas, expected) => {
    expect(getOccupancyStatus(room(occupancy, kapasitas))).toBe(expected);
  });
});

describe('summarizeRooms', () => {
  it('menghitung total dan rata-rata', () => {
    const summary = summarizeRooms([room(5, 10), room(10, 10)]);
    expect(summary).toMatchObject({
      totalRooms: 2,
      totalCapacity: 20,
      totalOccupancy: 15,
      averagePercent: 75,
      byStatus: { hijau: 1, kuning: 0, merah: 1 },
    });
  });

  it('aman untuk daftar kosong', () => {
    expect(summarizeRooms([]).averagePercent).toBe(0);
  });
});

describe('validateRoomInput', () => {
  it('merapikan isian yang valid', () => {
    const { value, errors } = validateRoomInput({
      nama_ruangan: '  Meeting   Room ',
      luas: '25.555',
      kapasitas_max: '8',
    });
    expect(errors).toEqual({});
    expect(value).toEqual({ nama_ruangan: 'Meeting Room', luas: 25.56, kapasitas_max: 8 });
  });

  it('menolak isian kosong dan tidak valid', () => {
    const { errors } = validateRoomInput({ nama_ruangan: ' ', luas: '0', kapasitas_max: '2.5' });
    expect(Object.keys(errors).sort()).toEqual(['kapasitas_max', 'luas', 'nama_ruangan']);
  });

  it('kapasitas tidak boleh di bawah occupancy saat ini', () => {
    const { errors } = validateRoomInput(
      { nama_ruangan: 'A', luas: 10, kapasitas_max: 3 },
      { currentOccupancy: 5 },
    );
    expect(errors.kapasitas_max).toMatch(/saat ini \(5\)/);
  });

  it('toNameKey tidak peka huruf besar dan spasi', () => {
    expect(toNameKey('  Ruang   RAPAT ')).toBe('ruang rapat');
  });
});

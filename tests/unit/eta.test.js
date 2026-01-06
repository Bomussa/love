import { computeEtaMinutes, formatEtaTime } from '../../frontend/src/lib/eta';

describe('ETA Calculation', () => {
  test('ETA with ahead = 0 should return 0', () => {
    expect(computeEtaMinutes(0, 2)).toBe(0);
  });

  test('ETA with ahead = 1, interval=2 should return 2', () => {
    expect(computeEtaMinutes(1, 2)).toBe(2);
  });

  test('ETA with ahead = 5, interval=2 should return 10', () => {
    expect(computeEtaMinutes(5, 2)).toBe(10);
  });

  test('ETA clamps negatives to 0', () => {
    expect(computeEtaMinutes(-3, 2)).toBe(0);
  });

  test('ETA handles non-finite ahead values', () => {
    expect(computeEtaMinutes(NaN, 2)).toBe(0);
    expect(computeEtaMinutes(Infinity, 2)).toBe(0);
  });

  test('ETA handles invalid interval values', () => {
    expect(computeEtaMinutes(5, 0)).toBe(10); // fallback to 2
    expect(computeEtaMinutes(5, -1)).toBe(10); // fallback to 2
    expect(computeEtaMinutes(5, NaN)).toBe(10); // fallback to 2
  });

  test('formatEtaTime formats correctly', () => {
    expect(formatEtaTime(0)).toBe('0:00');
    expect(formatEtaTime(1)).toBe('1:00');
    expect(formatEtaTime(2.5)).toBe('2:30');
    expect(formatEtaTime(10)).toBe('10:00');
  });
});

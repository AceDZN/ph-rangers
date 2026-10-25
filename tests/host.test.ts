import { expect, test } from 'vitest';
import { parseLevelParam } from '../src/host';

test('?level=N is a 1-based level index, ignored when out of range', () => {
  expect(parseLevelParam('?level=1', 6)).toBe(0);
  expect(parseLevelParam('?level=6', 6)).toBe(5);
  expect(parseLevelParam('?level=7', 6)).toBe(null);
  expect(parseLevelParam('?level=0', 6)).toBe(null);
  expect(parseLevelParam('?level=2.5', 6)).toBe(null);
  expect(parseLevelParam('?all', 6)).toBe(null);
  expect(parseLevelParam('?mission=3', 6, 'mission')).toBe(2);
});

import { describe, expect, it } from 'vitest';
import { layoutSegments } from './timelineLayout';
import type { ApplicationSegment } from '../types';

describe('layoutSegments', () => {
  it('keeps explicit rows from colliding when two segments overlap in time', () => {
    const startDate = new Date('2024-01-01T00:00:00.000Z');

    const segments: ApplicationSegment[] = [
      {
        id: 'seg-a',
        applicationId: 'app-a',
        startDate: '2024-01-10',
        endDate: '2024-02-10',
        status: 'planned',
        row: 1,
      },
      {
        id: 'seg-b',
        applicationId: 'app-b',
        startDate: '2024-01-20',
        endDate: '2024-02-20',
        status: 'planned',
        row: 1,
      },
    ];

    const { items } = layoutSegments(segments, startDate, 365);
    const itemA = items.find(item => item.seg.id === 'seg-a');
    const itemB = items.find(item => item.seg.id === 'seg-b');

    expect(itemA).toBeDefined();
    expect(itemB).toBeDefined();
    expect(itemA?.row).toBe(1);
    expect(itemB?.row).toBeGreaterThan(itemA!.row);
  });
});

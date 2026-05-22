import { describe, expect, it } from 'vitest';
import { computeAutoRow, layoutSegments, resolveSegmentConflicts } from './timelineLayout';
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

  it('rechecks moved conflicts so tall explicit rows do not end up overlapping', () => {
    const startDate = new Date('2024-01-01T00:00:00.000Z');

    const segments: ApplicationSegment[] = [
      {
        id: 'seg-0',
        applicationId: 'app-0',
        startDate: '2024-01-11',
        endDate: '2024-01-17',
        status: 'planned',
        row: 2,
        rowSpan: 2,
      },
      {
        id: 'seg-1',
        applicationId: 'app-1',
        startDate: '2024-01-14',
        endDate: '2024-01-22',
        status: 'planned',
        row: 3,
      },
      {
        id: 'seg-2',
        applicationId: 'app-2',
        startDate: '2024-01-12',
        endDate: '2024-01-14',
        status: 'planned',
        row: 1,
      },
      {
        id: 'seg-3',
        applicationId: 'app-3',
        startDate: '2024-01-06',
        endDate: '2024-01-13',
        status: 'planned',
        row: 0,
        rowSpan: 3,
      },
      {
        id: 'seg-4',
        applicationId: 'app-4',
        startDate: '2024-01-06',
        endDate: '2024-01-07',
        status: 'planned',
        row: 3,
        rowSpan: 3,
      },
      {
        id: 'seg-5',
        applicationId: 'app-5',
        startDate: '2024-01-05',
        endDate: '2024-01-07',
        status: 'planned',
        row: 1,
      },
      {
        id: 'seg-6',
        applicationId: 'app-6',
        startDate: '2024-01-04',
        endDate: '2024-01-12',
        status: 'planned',
        row: 3,
      },
      {
        id: 'seg-7',
        applicationId: 'app-7',
        startDate: '2024-01-05',
        endDate: '2024-01-12',
        status: 'planned',
        row: 2,
      },
      {
        id: 'seg-8',
        applicationId: 'app-8',
        startDate: '2024-01-08',
        endDate: '2024-01-13',
        status: 'planned',
        row: 3,
      },
    ];

    const resolved = resolveSegmentConflicts('seg-4', segments);

    for (let i = 0; i < resolved.length; i++) {
      for (let j = i + 1; j < resolved.length; j++) {
        const a = resolved[i];
        const b = resolved[j];
        const rowsOverlap = (a.row ?? 0) < (b.row ?? 0) + (b.rowSpan ?? 1) && (a.row ?? 0) + (a.rowSpan ?? 1) > (b.row ?? 0);
        const timeOverlap = a.startDate < b.endDate && a.endDate > b.startDate;
        expect(rowsOverlap && timeOverlap).toBe(false);
      }
    }
  });

  it('keeps searching past row 20 when auto-placing a new segment', () => {
    const startDate = new Date('2024-01-01T00:00:00.000Z');

    const existingSegments: ApplicationSegment[] = Array.from({ length: 21 }, (_, row) => ({
      id: `seg-${row}`,
      applicationId: `app-${row}`,
      startDate: '2024-01-10',
      endDate: '2024-02-10',
      status: 'planned',
      row,
    }));

    const autoRow = computeAutoRow('2024-01-15', '2024-02-15', existingSegments, startDate, 365);

    expect(autoRow).toBe(21);
  });
});

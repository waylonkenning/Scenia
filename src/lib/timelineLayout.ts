/**
 * Pure layout functions for the Timeline visualiser.
 *
 * All functions here are side-effect-free and receive all required context as
 * explicit parameters so they can be tested independently of the React component.
 */

import { differenceInDays, parseISO, isValid } from 'date-fns';
import { ApplicationSegment, Initiative, Dependency } from '../types';

// ---------------------------------------------------------------------------
// Layout constants — exported so Timeline.tsx can import them
// ---------------------------------------------------------------------------

export const SEG_BAR_HEIGHT = 36;
export const SEG_ROW_HEIGHT = 52;
export const MIN_ROW_HEIGHT = 60;
export const BAR_HEIGHT = 44;
export const BAR_GAP = 4;
export const ROW_PADDING = 8;
export const SEG_ROW_UNIT = SEG_BAR_HEIGHT + BAR_GAP; // 40px: one segment row height + gap

// ---------------------------------------------------------------------------
// Position helpers
// ---------------------------------------------------------------------------

/** Returns the left position of `dateStr` as a percentage of the total timeline width. */
export function getPosition(dateStr: string, startDate: Date, totalDays: number): number {
  try {
    const date = parseISO(dateStr);
    if (!isValid(date)) return 0;
    const daysFromStart = differenceInDays(date, startDate);
    return (daysFromStart / totalDays) * 100;
  } catch {
    return 0;
  }
}

/** Returns the width of a date range as a percentage of the total timeline width (min 0.5%). */
export function getWidth(startStr: string, endStr: string, totalDays: number): number {
  try {
    const start = parseISO(startStr);
    const end = parseISO(endStr);
    if (!isValid(start) || !isValid(end)) return 0.5;
    const days = differenceInDays(end, start);
    return Math.max(0.5, (days / totalDays) * 100);
  } catch {
    return 0.5;
  }
}

// ---------------------------------------------------------------------------
// Segment conflict resolution
// ---------------------------------------------------------------------------

/**
 * After moving `movedId`, push any time-and-row-overlapping segments down to
 * the next available row. Cascades via BFS until all conflicts are resolved.
 */
export function resolveSegmentConflicts(
  movedId: string,
  segments: ApplicationSegment[],
): ApplicationSegment[] {
  const result = segments.map(s => ({ ...s }));
  const queue: string[] = [movedId];
  const processed = new Set<string>();

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (processed.has(currentId)) continue;
    processed.add(currentId);

    const current = result.find(s => s.id === currentId);
    if (!current) continue;

    const currentRow = current.row ?? 0;
    const currentRowSpan = current.rowSpan ?? 1;
    const currentRowEnd = currentRow + currentRowSpan;

    const conflicts = result.filter(s => {
      if (s.id === currentId) return false;
      const sRow = s.row ?? 0;
      const sRowSpan = s.rowSpan ?? 1;
      const rowOverlap = sRow < currentRowEnd && sRow + sRowSpan > currentRow;
      if (!rowOverlap) return false;
      return s.startDate < current.endDate && s.endDate > current.startDate;
    });

    for (const conflict of conflicts) {
      conflict.row = currentRowEnd;
      queue.push(conflict.id);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Dependency-connected group detection
// ---------------------------------------------------------------------------

/**
 * Returns arrays of initiative IDs that are connected (directly or transitively)
 * via intra-asset dependencies. Singletons are omitted (only groups of 2+ returned).
 */
export function getGroupsForAsset(
  assetInitiatives: Initiative[],
  dependencies: Dependency[],
): string[][] {
  const ids = assetInitiatives.map(i => i.id);
  const adj = new Map<string, string[]>();
  ids.forEach(id => adj.set(id, []));

  dependencies.forEach(dep => {
    if (ids.includes(dep.sourceId) && ids.includes(dep.targetId)) {
      adj.get(dep.sourceId)!.push(dep.targetId);
      adj.get(dep.targetId)!.push(dep.sourceId);
    }
  });

  const groups: string[][] = [];
  const visited = new Set<string>();

  ids.forEach(id => {
    if (!visited.has(id)) {
      const group: string[] = [];
      const stack = [id];
      while (stack.length > 0) {
        const u = stack.pop()!;
        if (!visited.has(u)) {
          visited.add(u);
          group.push(u);
          adj.get(u)!.forEach(v => stack.push(v));
        }
      }
      if (group.length > 1) groups.push(group);
    }
  });

  return groups;
}

// ---------------------------------------------------------------------------
// Segment layout
// ---------------------------------------------------------------------------

export interface LayoutSegmentItem {
  seg: ApplicationSegment;
  row: number;
  rowSpan: number;
  top: number;
  height: number;
  left: number;
  width: number;
}

/**
 * Places each segment in a row (using its explicit `row` field, or greedy
 * first-fit for segments without one) and returns pixel geometry for rendering.
 */
export function layoutSegments(
  segments: ApplicationSegment[],
  startDate: Date,
  totalDays: number,
): { items: LayoutSegmentItem[]; height: number } {
  type PlacedItem = {
    seg: ApplicationSegment;
    row: number;
    rowSpan: number;
    left: number;
    right: number;
  };

  const allItems: PlacedItem[] = [];

  const placeSegment = (seg: ApplicationSegment, preferredRow: number) => {
    const left = getPosition(seg.startDate, startDate, totalDays);
    const right = left + getWidth(seg.startDate, seg.endDate, totalDays);
    const span = seg.rowSpan ?? 1;

    let row = preferredRow;
    while (true) {
      const conflicts = allItems.filter(item => {
        const rowOverlap = item.row < row + span && item.row + item.rowSpan > row;
        if (!rowOverlap) return false;
        return !(item.right <= left || item.left >= right);
      });
      if (conflicts.length === 0) break;
      row++;
    }

    allItems.push({ seg, row, rowSpan: span, left, right });
  };

  const explicitSegs = [...segments.filter(s => s.row !== undefined)].sort((a, b) =>
    (a.row! - b.row!) || a.startDate.localeCompare(b.startDate),
  );
  const autoSegs = [...segments.filter(s => s.row === undefined)].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );

  explicitSegs.forEach(seg => placeSegment(seg, seg.row!));
  autoSegs.forEach(seg => placeSegment(seg, 0));

  const maxRowEnd = allItems.reduce((max, item) => Math.max(max, item.row + item.rowSpan), 0);
  const swimlaneHeight =
    maxRowEnd === 0
      ? SEG_ROW_HEIGHT
      : Math.max(SEG_ROW_HEIGHT, ROW_PADDING + maxRowEnd * SEG_ROW_UNIT - BAR_GAP + ROW_PADDING);

  const placedById = new Map(
    allItems.map(({ seg, row, rowSpan, left }) => [seg.id, {
      seg,
      row,
      rowSpan,
      top: ROW_PADDING + row * SEG_ROW_UNIT,
      height: rowSpan * SEG_BAR_HEIGHT + (rowSpan - 1) * BAR_GAP,
      left,
      width: getWidth(seg.startDate, seg.endDate, totalDays),
    }] as const),
  );

  const finalItems: LayoutSegmentItem[] = segments
    .map(seg => placedById.get(seg.id))
    .filter((item): item is LayoutSegmentItem => Boolean(item));

  return { items: finalItems, height: swimlaneHeight };
}

// ---------------------------------------------------------------------------
// Auto-row computation for new segments
// ---------------------------------------------------------------------------

/** Returns the first row with no time-conflict for a new segment. */
export function computeAutoRow(
  newStart: string,
  newEnd: string,
  existingSegments: ApplicationSegment[],
  startDate: Date,
  totalDays: number,
): number {
  const { items } = layoutSegments(existingSegments, startDate, totalDays);
  const newLeft = getPosition(newStart, startDate, totalDays);
  const newRight = newLeft + getWidth(newStart, newEnd, totalDays);
  for (let row = 0; row <= 20; row++) {
    const conflict = items.some(item => {
      const rowOverlap = item.row < row + 1 && item.row + item.rowSpan > row;
      if (!rowOverlap) return false;
      return !(item.left + item.width <= newLeft || item.left >= newRight);
    });
    if (!conflict) return row;
  }
  return 0;
}

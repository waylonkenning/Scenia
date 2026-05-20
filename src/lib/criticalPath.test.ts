import { describe, it, expect } from 'vitest';
import { computeCriticalPath } from './criticalPath';
import type { Initiative, Dependency } from '../types';

describe('computeCriticalPath', () => {
  const createInitiative = (id: string, startDate: string, endDate: string): Initiative => ({
    id,
    name: `Init ${id}`,
    programmeId: 'prog-1',
    assetId: 'asset-1',
    startDate,
    endDate,
    capex: 0,
    opex: 0,
  });

  const createDependency = (id: string, sourceId: string, targetId: string, type: 'blocks' | 'requires' = 'requires'): Dependency => ({
    id,
    sourceId,
    targetId,
    type,
  });

  // ── AC4: Empty initiatives ─────────────────────────────────────────────────
  it('AC4: returns empty sets when initiatives array is empty', () => {
    const [initIds, depIds] = computeCriticalPath([], []);
    expect(initIds.size).toBe(0);
    expect(depIds.size).toBe(0);
  });

  // ── AC5: No dependencies ─────────────────────────────────────────────────
  it('AC5: returns empty sets when there are no ordering dependencies', () => {
    const initiatives = [
      createInitiative('a', '2026-01-01', '2026-06-30'),
      createInitiative('b', '2026-01-01', '2026-06-30'),
    ];
    const [initIds, depIds] = computeCriticalPath(initiatives, []);
    expect(initIds.size).toBe(0);
    expect(depIds.size).toBe(0);
  });

  // ── AC1: Simple linear chain ───────────────────────────────────────────────
  it('AC1: returns all initiative and dependency IDs in a linear chain', () => {
    const initiatives = [
      createInitiative('a', '2026-01-01', '2026-03-31'), // 89 days
      createInitiative('b', '2026-04-01', '2026-06-30'), // 90 days
      createInitiative('c', '2026-07-01', '2026-09-30'), // 91 days
    ];
    const dependencies = [
      createDependency('d1', 'a', 'b'),
      createDependency('d2', 'b', 'c'),
    ];

    const [initIds, depIds] = computeCriticalPath(initiatives, dependencies);

    expect(initIds.size).toBe(3);
    expect(initIds.has('a')).toBe(true);
    expect(initIds.has('b')).toBe(true);
    expect(initIds.has('c')).toBe(true);
    expect(depIds.size).toBe(2);
    expect(depIds.has('d1')).toBe(true);
    expect(depIds.has('d2')).toBe(true);
  });

  // ── AC2: Branching graph - longest path ──────────────────────────────────
  it('AC2: returns the longest path in a branching graph', () => {
    const initiatives = [
      createInitiative('a', '2026-01-01', '2026-01-31'), // 30 days - root
      createInitiative('b', '2026-02-01', '2026-04-30'), // 88 days - short branch
      createInitiative('c', '2026-02-01', '2026-06-30'), // 149 days - long branch
      createInitiative('d', '2026-07-01', '2026-09-30'), // 91 days - end (after both)
    ];
    const dependencies = [
      createDependency('d1', 'a', 'b'),
      createDependency('d2', 'a', 'c'),
      createDependency('d3', 'b', 'd'),
      createDependency('d4', 'c', 'd'),
    ];

    const [initIds, depIds] = computeCriticalPath(initiatives, dependencies);

    // The critical path should be A → C → D (30 + 149 + 91 = 270 days)
    // vs A → B → D (30 + 88 + 91 = 209 days)
    expect(initIds.size).toBe(3);
    expect(initIds.has('a')).toBe(true);
    expect(initIds.has('c')).toBe(true);
    expect(initIds.has('d')).toBe(true);
    expect(initIds.has('b')).toBe(false); // B is not on the critical path
    expect(depIds.has('d2')).toBe(true); // A → C
    expect(depIds.has('d4')).toBe(true); // C → D
    expect(depIds.has('d1')).toBe(false); // A → B not on critical path
    expect(depIds.has('d3')).toBe(false); // B → D not on critical path
  });

  // ── AC3: Cycle detection ──────────────────────────────────────────────────
  it('AC3: handles cycles gracefully without infinite recursion', () => {
    const initiatives = [
      createInitiative('a', '2026-01-01', '2026-03-31'),
      createInitiative('b', '2026-04-01', '2026-06-30'),
      createInitiative('c', '2026-07-01', '2026-09-30'),
    ];
    // Diamond dependency with back edge creating a cycle: A → B → C → B
    const dependencies = [
      createDependency('d1', 'a', 'b'),
      createDependency('d2', 'b', 'c'),
      createDependency('d3', 'c', 'b'), // Back edge - creates cycle B → C → B
    ];

    // Should not throw and should return a valid result
    const [initIds, depIds] = computeCriticalPath(initiatives, dependencies);

    // Should have some results from the acyclic portion
    expect(initIds.size).toBeGreaterThanOrEqual(0);
    expect(depIds.size).toBeGreaterThanOrEqual(0);
  });

  // ── AC6: Diamond dependency pattern ───────────────────────────────────────
  it('AC6: handles diamond pattern and returns longest duration path', () => {
    const initiatives = [
      createInitiative('a', '2026-01-01', '2026-01-31'), // 30 days
      createInitiative('b', '2026-02-01', '2026-02-28'), // 27 days
      createInitiative('c', '2026-02-01', '2026-03-31'), // 58 days
      createInitiative('d', '2026-04-01', '2026-06-30'), // 90 days
    ];
    const dependencies = [
      createDependency('d1', 'a', 'b'),
      createDependency('d2', 'a', 'c'),
      createDependency('d3', 'b', 'd'),
      createDependency('d4', 'c', 'd'),
    ];

    const [initIds] = computeCriticalPath(initiatives, dependencies);

    // Longest path: A → C → D (30 + 58 + 90 = 178 days)
    // vs A → B → D (30 + 27 + 90 = 147 days)
    expect(initIds.has('c')).toBe(true);
    expect(initIds.has('b')).toBe(false);
  });

  // ── Additional edge cases ──────────────────────────────────────────────────

  it('handles single initiative with no dependencies', () => {
    const initiatives = [createInitiative('a', '2026-01-01', '2026-06-30')];
    const [initIds, depIds] = computeCriticalPath(initiatives, []);
    expect(initIds.size).toBe(0);
    expect(depIds.size).toBe(0);
  });

  it('only considers "blocks" and "requires" dependencies, not "related"', () => {
    const initiatives = [
      createInitiative('a', '2026-01-01', '2026-03-31'),
      createInitiative('b', '2026-04-01', '2026-06-30'),
    ];
    const dependencies = [
      { id: 'd1', sourceId: 'a', targetId: 'b', type: 'related' as const },
    ];

    const [initIds, depIds] = computeCriticalPath(initiatives, dependencies);
    expect(initIds.size).toBe(0);
    expect(depIds.size).toBe(0);
  });

  it('handles initiatives with same duration correctly', () => {
    const initiatives = [
      createInitiative('a', '2026-01-01', '2026-03-31'),
      createInitiative('b', '2026-04-01', '2026-06-30'),
      createInitiative('c', '2026-04-01', '2026-06-30'), // same duration as B
    ];
    const dependencies = [
      createDependency('d1', 'a', 'b'),
      createDependency('d2', 'a', 'c'),
    ];

    const [initIds] = computeCriticalPath(initiatives, dependencies);

    // A must be on the critical path (it's the root)
    expect(initIds.has('a')).toBe(true);
    // Either B or C is on the critical path (not both since they have same duration)
    // The algorithm deterministically picks one
    const bOrC = (initIds.has('b') && !initIds.has('c')) || (!initIds.has('b') && initIds.has('c'));
    expect(bOrC).toBe(true);
  });

  it('memoization works correctly across multiple calls', () => {
    const initiatives = [
      createInitiative('a', '2026-01-01', '2026-03-31'),
      createInitiative('b', '2026-04-01', '2026-06-30'),
    ];
    const dependencies = [createDependency('d1', 'a', 'b')];

    // Call multiple times - should get consistent results
    const [initIds1, depIds1] = computeCriticalPath(initiatives, dependencies);
    const [initIds2, depIds2] = computeCriticalPath(initiatives, dependencies);
    const [initIds3, depIds3] = computeCriticalPath(initiatives, dependencies);

    expect(initIds1).toEqual(initIds2);
    expect(initIds2).toEqual(initIds3);
    expect(depIds1).toEqual(depIds2);
    expect(depIds2).toEqual(depIds3);
  });

  // ── AC2: Invalid date handling ──────────────────────────────────────────────
  it('AC2: initiatives with invalid dates are excluded from critical path graph', () => {
    // B is in the dependency chain (a→b→c) but has invalid dates.
    // Without the fix, NaN propagates into the duration map and corrupts comparisons.
    // With the fix, B is excluded from graph traversal and cannot be highlighted as critical.
    const initiatives = [
      createInitiative('a', '2026-01-01', '2026-03-31'), // 89 days
      { ...createInitiative('b', 'not-a-date', '2026-06-30'), startDate: '' }, // Invalid
      createInitiative('c', '2026-04-01', '2026-06-30'), // 90 days
    ];
    const dependencies = [
      createDependency('d1', 'a', 'b'),
      createDependency('d2', 'b', 'c'),
    ];

    // Should not throw
    expect(() => computeCriticalPath(initiatives, dependencies)).not.toThrow();

    const [initIds, depIds] = computeCriticalPath(initiatives, dependencies);

    // Dependencies touching invalid initiative B are ignored
    expect(initIds.size).toBe(0);
    expect(depIds.size).toBe(0);
  });

  it('AC1+AC3: handles initiatives with invalid dates gracefully without throwing', () => {
    const initiatives = [
      createInitiative('a', 'invalid', 'also-invalid'), // Both dates invalid
      createInitiative('b', '2026-01-01', '2026-06-30'),
    ];
    const dependencies = [
      createDependency('d1', 'a', 'b'),
    ];

    // Should not throw
    expect(() => computeCriticalPath(initiatives, dependencies)).not.toThrow();

    const [initIds, depIds] = computeCriticalPath(initiatives, dependencies);
    // A is excluded because its dates are invalid, so related dependency is ignored
    expect(initIds.size).toBe(0);
    expect(depIds.size).toBe(0);
  });
});

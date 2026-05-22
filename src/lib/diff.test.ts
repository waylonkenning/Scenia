import { describe, expect, it } from 'vitest';
import { computeDiff } from './diff';
import type { Version } from '../types';

function makeVersion(overrides: Partial<Version['data']> = {}): Version {
  return {
    id: 'ver-base',
    name: 'Baseline',
    timestamp: '2026-05-22T00:00:00.000Z',
    data: {
      assets: [],
      applications: [],
      applicationSegments: [],
      initiatives: [],
      milestones: [],
      programmes: [],
      strategies: [],
      dependencies: [],
      assetCategories: [],
      timelineSettings: {
        startDate: '2026-01-01',
        monthsToShow: 12,
        budgetVisualisation: 'off',
        descriptionDisplay: 'off',
        emptyRowDisplay: 'show',
        snapToPeriod: 'off',
        conflictDetection: 'on',
        showRelationships: 'on',
        criticalPath: 'off',
        showResources: 'off',
        display: 'both',
      },
      resources: [],
      applicationStatuses: [],
      dtsPhases: [],
      ...overrides,
    },
  };
}

describe('computeDiff', () => {
  it('reports asset changes as workspace changes', () => {
    const base = makeVersion({
      assets: [{ id: 'asset-1', name: 'Core Platform', categoryId: 'cat-1' }],
    });
    const current = {
      ...base.data,
      assets: [{ id: 'asset-1', name: 'Core Platform v2', categoryId: 'cat-1' }],
    };

    const diff = computeDiff(base, current);

    expect(diff.hasChanges).toBe(true);
    expect((diff as any).assets.added).toEqual([]);
    expect((diff as any).assets.removed).toEqual([]);
    expect((diff as any).assets.modified).toEqual([
      {
        name: 'Core Platform v2',
        changes: ['Renamed from "Core Platform" to "Core Platform v2"'],
      },
    ]);
  });

  it('reports programme changes as workspace changes', () => {
    const base = makeVersion({
      programmes: [{ id: 'prog-1', name: 'Delivery', color: 'blue' }],
    });
    const current = {
      ...base.data,
      programmes: [{ id: 'prog-1', name: 'Delivery Plus', color: 'blue' }],
    };

    const diff = computeDiff(base, current);

    expect(diff.hasChanges).toBe(true);
    expect((diff as any).programmes.modified).toEqual([
      {
        name: 'Delivery Plus',
        changes: ['Renamed from "Delivery" to "Delivery Plus"'],
      },
    ]);
  });

  it('reports strategy changes as workspace changes', () => {
    const base = makeVersion({
      strategies: [{ id: 'strat-1', name: 'Modernise', color: 'green' }],
    });
    const current = {
      ...base.data,
      strategies: [{ id: 'strat-1', name: 'Modernise Fast', color: 'green' }],
    };

    const diff = computeDiff(base, current);

    expect(diff.hasChanges).toBe(true);
    expect((diff as any).strategies.modified).toEqual([
      {
        name: 'Modernise Fast',
        changes: ['Renamed from "Modernise" to "Modernise Fast"'],
      },
    ]);
  });
});

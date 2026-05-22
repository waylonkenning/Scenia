import { describe, expect, it } from 'vitest';
import { isWorkspaceEmpty } from './workspaceState';

describe('isWorkspaceEmpty', () => {
  it('treats a brand new workspace as empty', () => {
    expect(
      isWorkspaceEmpty({
        assets: [],
        applications: [],
        applicationSegments: [],
        initiatives: [],
        milestones: [],
        programmes: [],
        strategies: [],
        dependencies: [],
        assetCategories: [],
        resources: [],
        applicationStatuses: [],
        dtsPhases: [],
      }),
    ).toBe(true);
  });

  it('treats any persisted user data as non-empty', () => {
    expect(
      isWorkspaceEmpty({
        assets: [],
        applications: [],
        applicationSegments: [],
        initiatives: [],
        milestones: [{ id: 'm1' }],
        programmes: [],
        strategies: [],
        dependencies: [],
        assetCategories: [],
        resources: [],
        applicationStatuses: [],
        dtsPhases: [],
      }),
    ).toBe(false);
  });

  it('does not rely only on assets and initiatives when other tables contain data', () => {
    expect(
      isWorkspaceEmpty({
        assets: [],
        applications: [{ id: 'app-1' }],
        applicationSegments: [],
        initiatives: [],
        milestones: [],
        programmes: [],
        strategies: [],
        dependencies: [],
        assetCategories: [],
        resources: [],
        applicationStatuses: [],
        dtsPhases: [],
      }),
    ).toBe(false);
  });
});

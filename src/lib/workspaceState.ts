type WorkspaceContent = {
  assets: unknown[];
  applications?: unknown[];
  applicationSegments?: unknown[];
  initiatives: unknown[];
  milestones: unknown[];
  programmes: unknown[];
  strategies: unknown[];
  dependencies: unknown[];
  assetCategories: unknown[];
  resources?: unknown[];
  applicationStatuses?: unknown[];
  dtsPhases?: unknown[];
};

const EMPTY_ARRAY: readonly unknown[] = [];

/**
 * Returns true only when the workspace has no user-authored data at all.
 *
 * Settings and version history are intentionally ignored here because they are
 * metadata, not evidence that the workspace has been started.
 */
export function isWorkspaceEmpty(data: WorkspaceContent): boolean {
  const buckets = [
    data.assets,
    data.applications ?? EMPTY_ARRAY,
    data.applicationSegments ?? EMPTY_ARRAY,
    data.initiatives,
    data.milestones,
    data.programmes,
    data.strategies,
    data.dependencies,
    data.assetCategories,
    data.resources ?? EMPTY_ARRAY,
    data.applicationStatuses ?? EMPTY_ARRAY,
    data.dtsPhases ?? EMPTY_ARRAY,
  ];

  return buckets.every(bucket => bucket.length === 0);
}

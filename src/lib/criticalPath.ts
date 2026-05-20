import { Initiative, Dependency } from '../types';

/**
 * Computes the critical path through the dependency graph.
 *
 * The critical path is the longest chain of initiatives connected by
 * 'blocks' or 'requires' dependencies, measured by total calendar duration.
 *
 * Returns a tuple of:
 *   - Set of initiative IDs on the critical path
 *   - Set of dependency IDs on the critical path
 */
export function computeCriticalPath(
  initiatives: Initiative[],
  dependencies: Dependency[],
): [Set<string>, Set<string>] {
  // Only ordering constraints count for critical path
  const ordering = dependencies.filter(d => d.type === 'blocks' || d.type === 'requires');

  if (ordering.length === 0 || initiatives.length === 0) {
    return [new Set(), new Set()];
  }

  // Duration in days for each initiative
  // Skip initiatives with invalid dates - they won't be included in critical path
  const durationOf = new Map<string, number>();
  for (const init of initiatives) {
    const start = new Date(init.startDate).getTime();
    const end = new Date(init.endDate).getTime();

    // Skip if dates are invalid (NaN)
    if (isNaN(start) || isNaN(end)) {
      continue;
    }

    const days = Math.max(1, Math.round((end - start) / 86_400_000));
    durationOf.set(init.id, days);
  }

  // Build successor list only from valid initiatives: successors[id] = [{depId, targetId}]
  const successors = new Map<string, Array<{ depId: string; targetId: string }>>();
  // Build predecessor set to find roots (nodes with no incoming ordering edges)
  const hasIncoming = new Set<string>();

  for (const dep of ordering) {
    if (!durationOf.has(dep.sourceId) || !durationOf.has(dep.targetId)) {
      continue;
    }

    if (!successors.has(dep.sourceId)) successors.set(dep.sourceId, []);
    successors.get(dep.sourceId)!.push({ depId: dep.id, targetId: dep.targetId });
    hasIncoming.add(dep.targetId);
  }

  // All valid initiative IDs involved in ordering deps
  const involved = new Set<string>();
  for (const [sourceId, edges] of successors) {
    involved.add(sourceId);
    for (const { targetId } of edges) {
      involved.add(targetId);
    }
  }

  // Roots: involved nodes with no incoming edges
  const roots = [...involved].filter(id => !hasIncoming.has(id));

  // DFS with memoization: returns [longestPathDays, path]
  // path = [{initId, depId | null}] starting from this node
  type PathNode = { initId: string; depId: string | null };
  const memo = new Map<string, { days: number; path: PathNode[] }>();
  const visiting = new Set<string>(); // cycle detection

  function longestFrom(id: string): { days: number; path: PathNode[] } {
    if (memo.has(id)) return memo.get(id)!;
    // Cycle detected — treat this node as a dead end to avoid infinite recursion
    if (visiting.has(id)) return { days: 0, path: [] };
    visiting.add(id);

    const myDays = durationOf.get(id) ?? 0;
    const children = successors.get(id) ?? [];

    if (children.length === 0) {
      const result = { days: myDays, path: [{ initId: id, depId: null }] };
      memo.set(id, result);
      return result;
    }

    let best: { days: number; path: PathNode[] } = { days: 0, path: [] };
    for (const { depId, targetId } of children) {
      const child = longestFrom(targetId);
      const total = myDays + child.days;
      if (total > best.days) {
        best = { days: total, path: [{ initId: id, depId: null }, ...child.path.map((n, i) => i === 0 ? { initId: n.initId, depId } : n)] };
      }
    }

    visiting.delete(id);
    memo.set(id, best);
    return best;
  }

  // Find the overall longest path across all roots
  let globalBest: { days: number; path: PathNode[] } = { days: 0, path: [] };
  for (const root of roots) {
    const candidate = longestFrom(root);
    if (candidate.days > globalBest.days) {
      globalBest = candidate;
    }
  }

  const initIds = new Set(globalBest.path.map(n => n.initId));
  const depIds = new Set(globalBest.path.flatMap(n => n.depId ? [n.depId] : []));

  return [initIds, depIds];
}

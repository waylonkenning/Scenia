import { Version } from '../types';

export type DiffResult = {
  assets: EntityDiff;
  programmes: EntityDiff;
  strategies: EntityDiff;
  initiatives: EntityDiff;
  dependencies: EntityDiff;
  milestones: EntityDiff;
  hasChanges: boolean;
};

type EntityDiff = {
  added: string[];
  removed: string[];
  modified: { name: string; changes: string[] }[];
};

function compareEntities<T extends { id: string }>(
  base: T[],
  curr: T[],
  getDisplayName: (item: T) => string,
  getChanges: (b: T, c: T) => string[]
): EntityDiff {
  const added = curr.filter(ci => !base.some(bi => bi.id === ci.id)).map(i => getDisplayName(i));
  const removed = base.filter(bi => !curr.some(ci => ci.id === bi.id)).map(i => getDisplayName(i));
  const modified: { name: string; changes: string[] }[] = [];

  curr.forEach(ci => {
    const bi = base.find(b => b.id === ci.id);
    if (bi) {
      const changes = getChanges(bi, ci);
      if (changes.length > 0) modified.push({ name: getDisplayName(ci), changes });
    }
  });

  return { added, removed, modified };
}

const getAssetCategoryName = (versionData: Version['data'], categoryId: string | undefined) =>
  versionData.assetCategories.find(category => category.id === categoryId)?.name || 'Uncategorised';

export function computeDiff(baseVersion: Version, currentData: Version['data']): DiffResult {
  const assets = compareEntities(
    baseVersion.data.assets,
    currentData.assets,
    (asset) => asset.name,
    (b, c) => {
      const changes: string[] = [];
      if (b.name !== c.name) changes.push(`Renamed from "${b.name}" to "${c.name}"`);
      if (b.categoryId !== c.categoryId) {
        const oldCategory = getAssetCategoryName(baseVersion.data, b.categoryId);
        const newCategory = getAssetCategoryName(currentData, c.categoryId);
        changes.push(`Category: ${oldCategory} → ${newCategory}`);
      }
      if ((b.maturity ?? null) !== (c.maturity ?? null)) {
        changes.push(`Maturity: ${b.maturity ?? 'Unrated'} → ${c.maturity ?? 'Unrated'}`);
      }
      if ((b.dtsAdoptionStatus ?? null) !== (c.dtsAdoptionStatus ?? null)) {
        changes.push(`DTS adoption status: ${b.dtsAdoptionStatus ?? 'Unset'} → ${c.dtsAdoptionStatus ?? 'Unset'}`);
      }
      return changes;
    }
  );

  const programmes = compareEntities(
    baseVersion.data.programmes,
    currentData.programmes,
    (programme) => programme.name,
    (b, c) => {
      const changes: string[] = [];
      if (b.name !== c.name) changes.push(`Renamed from "${b.name}" to "${c.name}"`);
      if (b.color !== c.color) changes.push(`Color: ${b.color} → ${c.color}`);
      return changes;
    }
  );

  const strategies = compareEntities(
    baseVersion.data.strategies,
    currentData.strategies,
    (strategy) => strategy.name,
    (b, c) => {
      const changes: string[] = [];
      if (b.name !== c.name) changes.push(`Renamed from "${b.name}" to "${c.name}"`);
      if (b.color !== c.color) changes.push(`Color: ${b.color} → ${c.color}`);
      return changes;
    }
  );

  const initiatives = compareEntities(
    baseVersion.data.initiatives,
    currentData.initiatives,
    (i) => i.name,
    (b, c) => {
      const changes: string[] = [];
      if (b.name !== c.name) changes.push(`Renamed from "${b.name}" to "${c.name}"`);
      if (b.startDate !== c.startDate) changes.push(`Start date: ${b.startDate} → ${c.startDate}`);
      if (b.endDate !== c.endDate) changes.push(`End date: ${b.endDate} → ${c.endDate}`);
      if (b.capex !== c.capex) changes.push(`CapEx: $${(b.capex || 0).toLocaleString()} → $${(c.capex || 0).toLocaleString()}`);
      if (b.opex !== c.opex) changes.push(`OpEx: $${(b.opex || 0).toLocaleString()} → $${(c.opex || 0).toLocaleString()}`);
      if (b.assetId !== c.assetId) {
        const oldAsset = baseVersion.data.assets.find(a => a.id === b.assetId)?.name || 'Unknown';
        const newAsset = currentData.assets.find(a => a.id === c.assetId)?.name || 'Unknown';
        changes.push(`Moved from Asset "${oldAsset}" to "${newAsset}"`);
      }
      return changes;
    }
  );

  const dependencies = compareEntities(
    baseVersion.data.dependencies,
    currentData.dependencies,
    (d) => {
      const s = currentData.initiatives.find(i => i.id === d.sourceId)?.name
        || baseVersion.data.initiatives.find(i => i.id === d.sourceId)?.name
        || 'Unknown';
      const t = currentData.initiatives.find(i => i.id === d.targetId)?.name
        || baseVersion.data.initiatives.find(i => i.id === d.targetId)?.name
        || 'Unknown';
      return `${s} → ${t}`;
    },
    (b, c) => {
      const changes: string[] = [];
      if (b.type !== c.type) changes.push(`Type: ${b.type} → ${c.type}`);
      if (b.sourceId !== c.sourceId || b.targetId !== c.targetId) changes.push('Endpoints reconnected');
      return changes;
    }
  );

  const milestones = compareEntities(
    baseVersion.data.milestones,
    currentData.milestones,
    (m) => m.name,
    (b, c) => {
      const changes: string[] = [];
      if (b.name !== c.name) changes.push(`Renamed to "${c.name}"`);
      if (b.date !== c.date) changes.push(`Date: ${b.date} → ${c.date}`);
      if (b.type !== c.type) changes.push(`Type: ${b.type} → ${c.type}`);
      return changes;
    }
  );

  const hasChanges =
    assets.added.length > 0 || assets.removed.length > 0 || assets.modified.length > 0 ||
    programmes.added.length > 0 || programmes.removed.length > 0 || programmes.modified.length > 0 ||
    strategies.added.length > 0 || strategies.removed.length > 0 || strategies.modified.length > 0 ||
    initiatives.added.length > 0 || initiatives.removed.length > 0 || initiatives.modified.length > 0 ||
    dependencies.added.length > 0 || dependencies.removed.length > 0 || dependencies.modified.length > 0 ||
    milestones.added.length > 0 || milestones.removed.length > 0 || milestones.modified.length > 0;

  return { assets, programmes, strategies, initiatives, dependencies, milestones, hasChanges };
}

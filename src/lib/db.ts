import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Asset, Application, ApplicationSegment, ApplicationStatus, DtsPhaseRecord, Initiative, Milestone, Programme, Strategy, Dependency, AssetCategory, TimelineSettings, Version, Resource } from '../types';
import { createSerialAsyncRunner } from './serialAsync';

interface ITMapDB extends DBSchema {
  assets: {
    key: string;
    value: Asset;
  };
  applications: {
    key: string;
    value: Application;
  };
  applicationSegments: {
    key: string;
    value: ApplicationSegment;
  };
  initiatives: {
    key: string;
    value: Initiative;
  };
  milestones: {
    key: string;
    value: Milestone;
  };
  programmes: {
    key: string;
    value: Programme;
  };
  strategies: {
    key: string;
    value: Strategy;
  };
  dependencies: {
    key: string;
    value: Dependency;
  };
  assetCategories: {
    key: string;
    value: AssetCategory;
  };
  settings: {
    key: string;
    value: TimelineSettings;
  };
  versions: {
    key: string;
    value: Version;
  };
  resources: {
    key: string;
    value: Resource;
  };
  applicationStatuses: {
    key: string;
    value: ApplicationStatus;
  };
  dtsPhases: {
    key: string;
    value: DtsPhaseRecord;
  };
}

const DB_NAME = 'it-initiative-visualiser';
const DB_VERSION = 13;

let dbPromise: Promise<IDBPDatabase<ITMapDB>>;

export const initDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<ITMapDB>(DB_NAME, DB_VERSION, {
      async upgrade(db, oldVersion, _newVersion, tx) {
        if (!db.objectStoreNames.contains('assets')) {
          db.createObjectStore('assets', { keyPath: 'id' });
        }
        if (oldVersion < 2 && !db.objectStoreNames.contains('initiatives')) {
          db.createObjectStore('initiatives', { keyPath: 'id' });
        }
        if (oldVersion < 3 && !db.objectStoreNames.contains('milestones')) {
          db.createObjectStore('milestones', { keyPath: 'id' });
        }
        if (oldVersion < 4 && !db.objectStoreNames.contains('programmes')) {
          db.createObjectStore('programmes', { keyPath: 'id' });
          db.createObjectStore('strategies', { keyPath: 'id' });
          db.createObjectStore('dependencies', { keyPath: 'id' });
          db.createObjectStore('assetCategories', { keyPath: 'id' });
        }
        if (oldVersion < 5 && !db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
        if (oldVersion < 6 && !db.objectStoreNames.contains('versions')) {
          db.createObjectStore('versions', { keyPath: 'id' });
        }
        if (oldVersion < 7 && !db.objectStoreNames.contains('resources')) {
          db.createObjectStore('resources', { keyPath: 'id' });
        }
        if (oldVersion < 8 && !db.objectStoreNames.contains('applications')) {
          db.createObjectStore('applications', { keyPath: 'id' });
        }
        if (oldVersion < 9 && !db.objectStoreNames.contains('applicationSegments')) {
          db.createObjectStore('applicationSegments', { keyPath: 'id' });
        }
        if (oldVersion < 10 && !db.objectStoreNames.contains('applicationStatuses')) {
          db.createObjectStore('applicationStatuses', { keyPath: 'id' });
        }
        if (oldVersion < 11) {
          // Migrate assetId-based segments to Application records + applicationId.
          // Segments that already have applicationId are left untouched.
          const allSegments = await tx.objectStore('applicationSegments').getAll();
          const allAssets = await tx.objectStore('assets').getAll();
          const assetMap = new Map(allAssets.map((a: any) => [a.id, a]));

          // Build a map from "assetId|label" → generated applicationId so that
          // segments sharing the same asset+label resolve to the same Application.
          const appKeyToId = new Map<string, string>();
          let counter = 0;

          for (const seg of allSegments) {
            if ((seg as any).assetId && !(seg as any).applicationId) {
              const assetId: string = (seg as any).assetId;
              const label: string = (seg as any).label ?? '';
              const key = `${assetId}|${label}`;
              if (!appKeyToId.has(key)) {
                const asset = assetMap.get(assetId) as any;
                const appName = label || asset?.name || assetId;
                const appId = `app-migrated-${assetId}-${counter++}`;
                appKeyToId.set(key, appId);
                await tx.objectStore('applications').add({ id: appId, assetId, name: appName });
              }
            }
          }

          // Rewrite each assetId-based segment to use applicationId.
          for (const seg of allSegments) {
            if ((seg as any).assetId && !(seg as any).applicationId) {
              const key = `${(seg as any).assetId}|${(seg as any).label ?? ''}`;
              const applicationId = appKeyToId.get(key);
              if (applicationId) {
                const { assetId: _a, label: _l, ...rest } = seg as any;
                await tx.objectStore('applicationSegments').put({ ...rest, applicationId });
              }
            }
          }
        }
        if (oldVersion < 12) {
          // Migrate single budget field to capex/opex split.
          // Existing budget value moves to capex; opex defaults to 0.
          const allInitiatives = await tx.objectStore('initiatives').getAll();
          for (const init of allInitiatives) {
            if ((init as any).budget !== undefined && (init as any).capex === undefined) {
              const { budget, ...rest } = init as any;
              await tx.objectStore('initiatives').put({ ...rest, capex: Number(budget) || 0, opex: 0 });
            }
          }
        }
        if (oldVersion < 13) {
          if (!db.objectStoreNames.contains('dtsPhases')) {
            db.createObjectStore('dtsPhases', { keyPath: 'id' });
          }
          // Seed default phases for existing DTS workspaces (those with DTS assets).
          const allAssets = await tx.objectStore('assets').getAll();
          const hasDts = allAssets.some((a: any) => a.alias?.startsWith('DTS.'));
          if (hasDts) {
            const defaults: DtsPhaseRecord[] = [
              { id: 'phase-1',     name: 'Phase 1 — Register & Expose',  color: 'bg-blue-500' },
              { id: 'phase-2',     name: 'Phase 2 — Integrate DPI',       color: 'bg-violet-500' },
              { id: 'phase-3',     name: 'Phase 3 — AI & Legacy Exit',    color: 'bg-emerald-500' },
              { id: 'back-office', name: 'Back-Office Consolidation',      color: 'bg-amber-500' },
              { id: 'not-dts',     name: 'Not DTS',                        color: 'bg-slate-400' },
            ];
            for (const phase of defaults) {
              await tx.objectStore('dtsPhases').put(phase);
            }
          }
        }
      },
    });
  }
  return dbPromise;
};

export const getAppData = async () => {
  const db = await initDB();
  const assets = await db.getAll('assets');
  const applications = db.objectStoreNames.contains('applications') ? await db.getAll('applications') : [];
  const applicationSegments = db.objectStoreNames.contains('applicationSegments') ? await db.getAll('applicationSegments') : [];
  const initiatives = await db.getAll('initiatives');
  const milestones = await db.getAll('milestones');
  const programmes = await db.getAll('programmes');
  const strategies = await db.getAll('strategies');
  const dependencies = await db.getAll('dependencies');
  const assetCategories = await db.getAll('assetCategories');
  const resources = db.objectStoreNames.contains('resources') ? await db.getAll('resources') : [];
  const applicationStatuses = db.objectStoreNames.contains('applicationStatuses') ? await db.getAll('applicationStatuses') : [];
  const dtsPhases = db.objectStoreNames.contains('dtsPhases') ? await db.getAll('dtsPhases') : [];

  // Settings is not a standard list of entities, it's just one config object
  let settingsFromDb = null;
  if (db.objectStoreNames.contains('settings')) {
    settingsFromDb = await db.get('settings', 'timelineSettings');
  }
  const timelineSettings = settingsFromDb || { startYear: 2026, monthsToShow: 36, sidebarWidth: 256 };

  return {
    assets,
    applications,
    applicationSegments,
    initiatives,
    milestones,
    programmes,
    strategies,
    dependencies,
    assetCategories,
    timelineSettings,
    resources,
    applicationStatuses,
    dtsPhases,
  };
};

const saveAppDataImpl = async (data: {
  assets: Asset[];
  applications: Application[];
  applicationSegments: ApplicationSegment[];
  initiatives: Initiative[];
  milestones: Milestone[];
  programmes: Programme[];
  strategies: Strategy[];
  dependencies: Dependency[];
  assetCategories: AssetCategory[];
  timelineSettings: TimelineSettings;
  resources: Resource[];
  applicationStatuses: ApplicationStatus[];
  versions?: Version[];
  dtsPhases?: DtsPhaseRecord[];
}) => {
  const db = await initDB();
  const stores: ("assets" | "applications" | "applicationSegments" | "applicationStatuses" | "dtsPhases" | "initiatives" | "milestones" | "programmes" | "strategies" | "dependencies" | "assetCategories" | "settings" | "resources" | "versions")[] = [
    'assets', 'initiatives', 'milestones', 'programmes', 'strategies', 'dependencies', 'assetCategories'
  ];
  if (db.objectStoreNames.contains('settings')) {
    stores.push('settings');
  }
  if (db.objectStoreNames.contains('resources')) {
    stores.push('resources');
  }
  if (db.objectStoreNames.contains('applications')) {
    stores.push('applications');
  }
  if (db.objectStoreNames.contains('applicationSegments')) {
    stores.push('applicationSegments');
  }
  if (db.objectStoreNames.contains('applicationStatuses')) {
    stores.push('applicationStatuses');
  }
  if (db.objectStoreNames.contains('dtsPhases')) {
    stores.push('dtsPhases');
  }
  if (data.versions && db.objectStoreNames.contains('versions')) {
    stores.push('versions');
  }
  const tx = db.transaction(stores, 'readwrite');

  let transactionError: Error | null = null;
  tx.onerror = () => {
    transactionError = new Error(tx.error?.message || 'Transaction failed');
  };

  try {
    // Queue all clears and adds in a single batch without intermediate awaits.
    // Awaiting between operations risks the transaction auto-committing before
    // all adds are queued, which would leave the stores empty.
    const allPromises: Promise<unknown>[] = [
      tx.objectStore('assets').clear(),
      tx.objectStore('initiatives').clear(),
      tx.objectStore('milestones').clear(),
      tx.objectStore('programmes').clear(),
      tx.objectStore('strategies').clear(),
      tx.objectStore('dependencies').clear(),
      tx.objectStore('assetCategories').clear(),
      ...data.assets.map(item => tx.objectStore('assets').put(item)),
      ...data.initiatives.map(item => tx.objectStore('initiatives').put(item)),
      ...data.milestones.map(item => tx.objectStore('milestones').put(item)),
      ...data.programmes.map(item => tx.objectStore('programmes').put(item)),
      ...data.strategies.map(item => tx.objectStore('strategies').put(item)),
      ...data.dependencies.map(item => tx.objectStore('dependencies').put(item)),
      ...data.assetCategories.map(item => tx.objectStore('assetCategories').put(item)),
    ];
    if (db.objectStoreNames.contains('settings')) {
      allPromises.push(tx.objectStore('settings').clear());
      allPromises.push(tx.objectStore('settings').put(data.timelineSettings, 'timelineSettings'));
    }
    if (db.objectStoreNames.contains('resources')) {
      allPromises.push(tx.objectStore('resources').clear());
      (data.resources || []).forEach(item => allPromises.push(tx.objectStore('resources').put(item)));
    }
    if (db.objectStoreNames.contains('applications')) {
      allPromises.push(tx.objectStore('applications').clear());
      (data.applications || []).forEach(item => allPromises.push(tx.objectStore('applications').put(item)));
    }
    if (db.objectStoreNames.contains('applicationSegments')) {
      allPromises.push(tx.objectStore('applicationSegments').clear());
      (data.applicationSegments || []).forEach(item => allPromises.push(tx.objectStore('applicationSegments').put(item)));
    }
    if (db.objectStoreNames.contains('applicationStatuses')) {
      allPromises.push(tx.objectStore('applicationStatuses').clear());
      (data.applicationStatuses || []).forEach(item => allPromises.push(tx.objectStore('applicationStatuses').put(item)));
    }
    if (db.objectStoreNames.contains('dtsPhases')) {
      allPromises.push(tx.objectStore('dtsPhases').clear());
      (data.dtsPhases || []).forEach(item => allPromises.push(tx.objectStore('dtsPhases').put(item)));
    }
    if (data.versions && db.objectStoreNames.contains('versions')) {
      allPromises.push(tx.objectStore('versions').clear());
      data.versions.forEach(v => allPromises.push(tx.objectStore('versions').put(v)));
    }

    await Promise.all(allPromises);

    await tx.done;

    // Check for transaction errors that may not have thrown
    if (transactionError) {
      throw transactionError;
    }
  } catch (error) {
    // Abort the transaction on any error to prevent partial writes
    tx.abort();
    throw error;
  }
};

export const saveAppData = createSerialAsyncRunner(saveAppDataImpl);

// Versions helper functions
export const saveVersion = async (version: Version) => {
  const db = await initDB();
  await db.put('versions', version);
};

export const getAllVersions = async () => {
  const db = await initDB();
  return db.getAll('versions');
};

export const deleteVersion = async (id: string) => {
  const db = await initDB();
  await db.delete('versions', id);
};

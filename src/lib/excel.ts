import * as XLSX from 'xlsx';
import { Asset, Application, ApplicationSegment, ApplicationStatus, Initiative, Milestone, Programme, Strategy, Dependency, AssetCategory, DtsAdoptionStatus, TimelineSettings, Resource, Version, DtsPhaseRecord } from '../types';

interface AppData {
  assets: Asset[];
  applications?: Application[];
  applicationSegments?: ApplicationSegment[];
  applicationStatuses?: ApplicationStatus[];
  initiatives: Initiative[];
  milestones: Milestone[];
  programmes: Programme[];
  strategies: Strategy[];
  dependencies: Dependency[];
  assetCategories: AssetCategory[];
  timelineSettings?: TimelineSettings;
  resources?: Resource[];
  versions?: Version[];
  dtsPhases?: DtsPhaseRecord[];
}


const ALLOWED_MONTHS_TO_SHOW: TimelineSettings['monthsToShow'][] = [3, 6, 12, 24, 36];

const sanitizeTimelineSettings = (raw: unknown): TimelineSettings | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;

  const candidate = raw as Partial<TimelineSettings>;
  const startDate = typeof candidate.startDate === 'string' ? candidate.startDate.trim() : '';
  const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(startDate) && !Number.isNaN(Date.parse(startDate));

  const parsedMonths = Number((candidate as any).monthsToShow);
  const monthsToShow = ALLOWED_MONTHS_TO_SHOW.includes(parsedMonths as TimelineSettings['monthsToShow'])
    ? (parsedMonths as TimelineSettings['monthsToShow'])
    : undefined;

  if (!isIsoDate || !monthsToShow) return undefined;

  return {
    ...candidate,
    startDate,
    monthsToShow,
  } as TimelineSettings;
};

const DTS_ADOPTION_STATUS_LABEL: Record<DtsAdoptionStatus, string> = {
  'not-started':    'Not Started',
  'scoping':        'Scoping',
  'in-delivery':    'In Delivery',
  'adopted':        'Adopted',
  'decommissioning':'Decommissioning Incumbent',
  'not-applicable': 'Not Applicable',
};

export const exportToExcel = (data: AppData) => {
  const wb = XLSX.utils.book_new();

  // Helper to add versionId to a list of items
  const withVersion = <T>(items: T[], versionId: string = ''): (T & { versionId: string })[] => {
    return items.map(item => ({ ...item, versionId }));
  };

  // Helper to flatten current + all versions into a single list
  const flatten = <T>(current: T[] | undefined, key: keyof Version['data']): (T & { versionId: string })[] => {
    const list = withVersion(current || []);
    (data.versions || []).forEach(v => {
      const vItems = (v.data[key] as T[]) || [];
      list.push(...withVersion(vItems, v.id));
    });

    // Special handling for Initiative.resourceIds — convert array to string
    if (key === 'initiatives') {
      return list.map(item => {
        if ((item as any).resourceIds && Array.isArray((item as any).resourceIds)) {
          return {
            ...item,
            resourceIds: (item as any).resourceIds.join(', ')
          };
        }
        return item;
      });
    }

    return list;
  };

  // 1. Initiatives
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flatten(data.initiatives, 'initiatives')), 'Initiatives');

  // 2. Assets
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flatten(data.assets, 'assets')), 'Assets');

  // 3. Asset Categories
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flatten(data.assetCategories, 'assetCategories')), 'AssetCategories');

  // 4. Programmes
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flatten(data.programmes, 'programmes')), 'Programmes');

  // 5. Strategies
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flatten(data.strategies, 'strategies')), 'Strategies');

  // 6. Milestones
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flatten(data.milestones, 'milestones')), 'Milestones');

  // 7. Dependencies
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flatten(data.dependencies, 'dependencies')), 'Dependencies');

  // 8. Applications
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flatten(data.applications, 'applications')), 'Applications');

  // 9. Application Segments
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flatten(data.applicationSegments, 'applicationSegments')), 'ApplicationSegments');

  // 10. Application Statuses
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flatten(data.applicationStatuses, 'applicationStatuses')), 'ApplicationStatuses');

  // 11. Resources
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flatten(data.resources, 'resources')), 'Resources');

  // 12. DTS Phases
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flatten(data.dtsPhases, 'dtsPhases')), 'DtsPhases');

  // 13. Timeline Settings (versioned)
  const settingsList = [];
  if (data.timelineSettings) settingsList.push({ ...data.timelineSettings, versionId: '' });
  (data.versions || []).forEach(v => {
    if (v.data.timelineSettings) settingsList.push({ ...v.data.timelineSettings, versionId: v.id });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(settingsList), 'TimelineSettings');

  // 14. Versions (Metadata)
  const versionsMetadata = (data.versions || []).map(v => ({
    id: v.id,
    name: v.name,
    timestamp: v.timestamp,
    description: v.description || '',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(versionsMetadata), 'Versions');

  // 15. DTS Summary — only for workspaces that have DTS assets (alias starts with "DTS.")
  // Note: DTS Summary is a presentation sheet for CURRENT data only
  const dtsAssets = data.assets.filter(a => typeof a.alias === 'string' && a.alias.startsWith('DTS.'));
  if (dtsAssets.length > 0) {
    const activeInitiatives = data.initiatives.filter(i => !i.isPlaceholder);
    const dtsSummaryRows = dtsAssets
      .sort((a, b) => {
        const catA = data.assetCategories.find(c => c.id === a.categoryId);
        const catB = data.assetCategories.find(c => c.id === b.categoryId);
        const orderA = catA?.order ?? 999;
        const orderB = catB?.order ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        return (a.alias ?? '').localeCompare(b.alias ?? '');
      })
      .map(asset => {
        const category = data.assetCategories.find(c => c.id === asset.categoryId);
        const assetInits = activeInitiatives.filter(i => i.assetId === asset.id);
        const totalCapex = assetInits.reduce((sum, i) => sum + (i.capex || 0), 0);
        const totalOpex = assetInits.reduce((sum, i) => sum + (i.opex || 0), 0);
        return {
          'Layer': category?.name ?? '',
          'Asset Name': asset.name,
          'Alias': asset.alias ?? '',
          'Adoption Status': asset.dtsAdoptionStatus
            ? DTS_ADOPTION_STATUS_LABEL[asset.dtsAdoptionStatus] ?? asset.dtsAdoptionStatus
            : '',
          'Initiative Count': assetInits.length,
          'Total CapEx ($)': totalCapex,
          'Total OpEx ($)': totalOpex,
        };
      });

    const clusterName = data.timelineSettings?.clusterName;
    let dtsSummaryWs: XLSX.WorkSheet;
    if (clusterName) {
      // Add cluster name as a metadata header row, then a blank row, then the data
      dtsSummaryWs = XLSX.utils.aoa_to_sheet([
        ['Cluster', clusterName],
        [],
        ['Layer', 'Asset Name', 'Alias', 'Adoption Status', 'Initiative Count', 'Total CapEx ($)', 'Total OpEx ($)'],
        ...dtsSummaryRows.map(r => [r['Layer'], r['Asset Name'], r['Alias'], r['Adoption Status'], r['Initiative Count'], r['Total CapEx ($)'], r['Total OpEx ($)']]),
      ]);
    } else {
      dtsSummaryWs = XLSX.utils.json_to_sheet(dtsSummaryRows);
    }
    XLSX.utils.book_append_sheet(wb, dtsSummaryWs, 'DTS Summary');
  }

  // Write file
  XLSX.writeFile(wb, `it-roadmap-${new Date().toISOString().split('T')[0]}.xlsx`);
};

export const importFromExcel = async (file: File): Promise<Partial<AppData>> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        
        const result: Partial<AppData> = {
          versions: []
        };

        // Helper to safely get sheet data
        const getSheetData = <T>(name: string): T[] => {
          const ws = wb.Sheets[name];
          if (!ws) return [];
          return XLSX.utils.sheet_to_json(ws);
        };

        // Read all sheets into raw arrays
        const raw = {
          initiatives: getSheetData<any>('Initiatives'),
          assets: getSheetData<any>('Assets'),
          assetCategories: getSheetData<any>('AssetCategories'),
          programmes: getSheetData<any>('Programmes'),
          strategies: getSheetData<any>('Strategies'),
          milestones: getSheetData<any>('Milestones'),
          dependencies: getSheetData<any>('Dependencies'),
          applications: getSheetData<any>('Applications'),
          applicationSegments: getSheetData<any>('ApplicationSegments'),
          applicationStatuses: getSheetData<any>('ApplicationStatuses'),
          resources: getSheetData<any>('Resources'),
          dtsPhases: getSheetData<any>('DtsPhases'),
          timelineSettings: getSheetData<any>('TimelineSettings'),
          versions: getSheetData<any>('Versions'),
        };

        // Separate current data from versioned data
        const split = <T>(list: (T & { versionId?: string })[]): { current: T[], byVersion: Record<string, T[]> } => {
          const current: T[] = [];
          const byVersion: Record<string, T[]> = {};
          list.forEach(item => {
            const { versionId, ...rest } = item;
            if (!versionId) {
              current.push(rest as T);
            } else {
              if (!byVersion[versionId]) byVersion[versionId] = [];
              byVersion[versionId].push(rest as T);
            }
          });
          return { current, byVersion };
        };

        const initsSplit = split<Initiative>(raw.initiatives);
        result.initiatives = initsSplit.current.map(init => ({
          ...init,
          capex: Number(init.capex) || Number((init as any).budget) || 0,
          opex: Number(init.opex) || 0,
          resourceIds: typeof (init as any).resourceIds === 'string' 
            ? (init as any).resourceIds.split(',').map((s: string) => s.trim()).filter(Boolean)
            : init.resourceIds,
        }));

        const assetsSplit = split<Asset>(raw.assets);
        result.assets = assetsSplit.current;

        const catSplit = split<AssetCategory>(raw.assetCategories);
        result.assetCategories = catSplit.current;

        const progSplit = split<Programme>(raw.programmes);
        result.programmes = progSplit.current;

        const stratSplit = split<Strategy>(raw.strategies);
        result.strategies = stratSplit.current;

        const mileSplit = split<Milestone>(raw.milestones);
        result.milestones = mileSplit.current;

        const depSplit = split<Dependency>(raw.dependencies);
        result.dependencies = depSplit.current;

        const appSplit = split<Application>(raw.applications);
        result.applications = appSplit.current;

        const segSplit = split<ApplicationSegment>(raw.applicationSegments);
        result.applicationSegments = segSplit.current;

        const statSplit = split<ApplicationStatus>(raw.applicationStatuses);
        result.applicationStatuses = statSplit.current;

        const resSplit = split<Resource>(raw.resources);
        result.resources = resSplit.current;

        const dtsPhaseSplit = split<DtsPhaseRecord>(raw.dtsPhases);
        result.dtsPhases = dtsPhaseSplit.current;

        const settingsSplit = split<TimelineSettings>(raw.timelineSettings);
        result.timelineSettings = sanitizeTimelineSettings(settingsSplit.current[0]);

        // Reconstruct versions
        if (raw.versions.length > 0) {
          result.versions = raw.versions.map((v: any) => {
            const vid = v.id;
            return {
              id: vid,
              name: v.name,
              timestamp: v.timestamp,
              description: v.description,
              data: {
                initiatives: (initsSplit.byVersion[vid] || []).map(init => ({
                  ...init,
                  capex: Number(init.capex) || Number((init as any).budget) || 0,
                  opex: Number(init.opex) || 0,
                  resourceIds: typeof (init as any).resourceIds === 'string' 
                    ? (init as any).resourceIds.split(',').map((s: string) => s.trim()).filter(Boolean)
                    : init.resourceIds,
                })),
                assets: assetsSplit.byVersion[vid] || [],
                assetCategories: catSplit.byVersion[vid] || [],
                programmes: progSplit.byVersion[vid] || [],
                strategies: stratSplit.byVersion[vid] || [],
                milestones: mileSplit.byVersion[vid] || [],
                dependencies: depSplit.byVersion[vid] || [],
                applications: appSplit.byVersion[vid] || [],
                applicationSegments: segSplit.byVersion[vid] || [],
                applicationStatuses: statSplit.byVersion[vid] || [],
                resources: resSplit.byVersion[vid] || [],
                dtsPhases: dtsPhaseSplit.byVersion[vid] || [],
                timelineSettings: sanitizeTimelineSettings(settingsSplit.byVersion[vid]?.[0]) || {},
              }
            };
          });
        }

        resolve(result);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};


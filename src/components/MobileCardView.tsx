import React, { useState } from 'react';
import { Asset, Initiative, Programme, Strategy, Dependency, AssetCategory, TimelineSettings, Resource, DtsAdoptionStatus, DtsPhaseRecord } from '../types';
import { ChevronDown, ChevronRight, AlertTriangle, DollarSign, AlignLeft, GitBranch } from 'lucide-react';
import { InitiativePanel } from './InitiativePanel';

interface MobileCardViewProps {
  assets: Asset[];
  initiatives: Initiative[];
  programmes: Programme[];
  strategies: Strategy[];
  dependencies: Dependency[];
  assetCategories: AssetCategory[];
  settings: TimelineSettings;
  resources?: Resource[];
  dtsPhases?: DtsPhaseRecord[];
  onSaveInitiative: (initiative: Initiative) => void;
  onDeleteInitiative?: (initiative: Initiative) => void;
  onOpenSettings: () => void;
}

type BucketMode = 'timeline' | 'quarter' | 'year' | 'programme' | 'strategy' | 'dts-phase';

// ── Date helpers ──────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-NZ', { month: 'short', year: 'numeric' });
}

function getTimelineBucket(initiative: Initiative): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(initiative.startDate);
  const end = new Date(initiative.endDate);
  const sixtyDays = new Date(today);
  sixtyDays.setDate(today.getDate() + 60);

  if (end < today) return 'Completed';
  if (start <= today && end >= today) return 'Now';
  if (start <= sixtyDays) return 'Starting soon';
  return 'Upcoming';
}

const TIMELINE_BUCKET_ORDER = ['Now', 'Starting soon', 'Upcoming', 'Completed'];

function getQuarterBucket(initiative: Initiative): string {
  const d = new Date(initiative.startDate);
  const q = Math.ceil((d.getMonth() + 1) / 3);
  return `Q${q} ${d.getFullYear()}`;
}

function getYearBucket(initiative: Initiative): string {
  return String(new Date(initiative.startDate).getFullYear());
}

function bucketInitiatives(
  initiatives: Initiative[],
  mode: BucketMode,
  programmes: Programme[],
  strategies: Strategy[],
  dtsPhaseLabels: Record<string, string> = {},
): Map<string, Initiative[]> {
  const map = new Map<string, Initiative[]>();

  const add = (key: string, init: Initiative) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(init);
  };

  for (const init of initiatives) {
    let key: string;
    if (mode === 'timeline') {
      key = getTimelineBucket(init);
    } else if (mode === 'quarter') {
      key = getQuarterBucket(init);
    } else if (mode === 'year') {
      key = getYearBucket(init);
    } else if (mode === 'programme') {
      const prog = programmes.find(p => p.id === init.programmeId);
      key = prog?.name ?? 'No programme';
    } else if (mode === 'dts-phase') {
      key = (init.dtsPhase && dtsPhaseLabels[init.dtsPhase]) ?? 'No DTS Phase';
    } else {
      const strat = strategies.find(s => s.id === init.strategyId);
      key = strat?.name ?? 'No strategy';
    }
    add(key, init);
  }

  // Sort initiatives within each bucket by start date
  for (const [, inits] of map) {
    inits.sort((a, b) => a.startDate.localeCompare(b.startDate));
  }

  // Return buckets in a meaningful order
  if (mode === 'timeline') {
    const ordered = new Map<string, Initiative[]>();
    for (const label of TIMELINE_BUCKET_ORDER) {
      if (map.has(label)) ordered.set(label, map.get(label)!);
    }
    return ordered;
  }

  // For quarter/year: sort keys chronologically
  if (mode === 'quarter' || mode === 'year') {
    return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
  }

  return map;
}


function conflictCount(assetInitiatives: Initiative[]): number {
  let count = 0;
  for (let i = 0; i < assetInitiatives.length; i++) {
    for (let j = i + 1; j < assetInitiatives.length; j++) {
      const a = assetInitiatives[i];
      const b = assetInitiatives[j];
      if (a.startDate < b.endDate && a.endDate > b.startDate) count++;
    }
  }
  return count;
}


const DTS_ADOPTION_STATUS_LABEL: Record<DtsAdoptionStatus, string> = {
  'not-started':    'Not Started',
  'scoping':        'Scoping',
  'in-delivery':    'In Delivery',
  'adopted':        'Adopted',
  'decommissioning':'Decommissioning',
  'not-applicable': 'N/A',
};

const DTS_ADOPTION_STATUS_STYLE: Record<DtsAdoptionStatus, string> = {
  'not-started':    'bg-slate-100 text-slate-500',
  'scoping':        'bg-yellow-50 text-yellow-700',
  'in-delivery':    'bg-blue-50 text-blue-700',
  'adopted':        'bg-green-50 text-green-700',
  'decommissioning':'bg-orange-50 text-orange-700',
  'not-applicable': 'bg-slate-50 text-slate-400',
};

// ── Programme colour dot ──────────────────────────────────────────────────────

function ProgrammeDot({ colorClass }: { colorClass: string }) {
  return <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${colorClass}`} />;
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  planned:   'bg-slate-100 text-slate-500',
  active:    'bg-blue-50 text-blue-600',
  done:      'bg-green-50 text-green-600',
  cancelled: 'bg-red-50 text-red-500',
};

const STATUS_LABELS: Record<string, string> = {
  planned: 'Planned', active: 'Active', done: 'Done', cancelled: 'Cancelled',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${STATUS_STYLES[status] ?? STATUS_STYLES.planned}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ── Owner initials ────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

// ── Initiative row ────────────────────────────────────────────────────────────

const InitiativeRow: React.FC<{
  initiative: Initiative;
  programmes: Programme[];
  resources: Resource[];
  settings: TimelineSettings;
  dependencies: Dependency[];
  allInitiatives: Initiative[];
  dtsPhaseLabels: Record<string, string>;
  onClick: () => void;
}> = ({
  initiative,
  programmes,
  resources,
  settings,
  dependencies,
  allInitiatives,
  dtsPhaseLabels,
  onClick,
}) => {
  const prog = programmes.find(p => p.id === initiative.programmeId);
  const dateRange = `${formatDate(initiative.startDate)} → ${formatDate(initiative.endDate)}`;

  const ownerResource = resources.find(r => r.id === initiative.ownerId);
  const ownerLabel = ownerResource?.name ?? initiative.owner ?? null;
  const ownerInitials = ownerLabel ? getInitials(ownerLabel) : null;

  const hasProgress = typeof initiative.progress === 'number' && initiative.progress > 0;

  const showDescription = settings.descriptionDisplay === 'on' && !!initiative.description;
  const totalBudget = (initiative.capex || 0) + (initiative.opex || 0);
  const showBudget = settings.budgetVisualisation !== 'off' && totalBudget > 0;
  const showRelationships = settings.showRelationships === 'on';

  const relatedDeps = showRelationships
    ? dependencies.filter(d => d.sourceId === initiative.id || d.targetId === initiative.id)
    : [];

  const DEP_LABELS: Record<string, string> = { blocks: 'blocks', requires: 'requires', related: 'related to' };

  return (
    <button
      data-testid={`initiative-row-${initiative.id}`}
      onClick={onClick}
      className="w-full text-left px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 active:bg-slate-100 transition-colors flex items-start gap-3"
    >
      {prog && <div className={`w-1 self-stretch rounded-full flex-shrink-0 mt-0.5 ${prog.color}`} />}
      <div className="flex-1 min-w-0">
        {/* Name + owner */}
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium text-slate-800 truncate flex-1 ${initiative.status === 'cancelled' ? 'line-through text-slate-400' : ''}`}>
            {initiative.name}
          </span>
          {ownerInitials && (
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-200 text-slate-600 text-[9px] font-bold flex items-center justify-center">
              {ownerInitials}
            </span>
          )}
        </div>
        {/* Date + status */}
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-slate-500 flex-1">{dateRange}</span>
          {initiative.status && initiative.status !== 'planned' && (
            <StatusBadge status={initiative.status} />
          )}
        </div>
        {/* Progress bar */}
        {hasProgress && (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-400 rounded-full"
                style={{ width: `${initiative.progress}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 flex-shrink-0">{initiative.progress}%</span>
          </div>
        )}
        {/* Programme name */}
        {prog && <div className="text-xs text-slate-400 mt-0.5">{prog.name}</div>}
        {/* DTS Phase label */}
        {initiative.dtsPhase && dtsPhaseLabels[initiative.dtsPhase] && (
          <div
            data-testid={`initiative-phase-label-${initiative.id}`}
            className="text-[10px] text-indigo-500 font-medium mt-0.5"
          >
            {dtsPhaseLabels[initiative.dtsPhase]}
          </div>
        )}
        {/* Description */}
        {showDescription && (
          <div data-testid={`initiative-description-${initiative.id}`} className="mt-1.5 flex items-start gap-1">
            <AlignLeft size={10} className="text-slate-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-slate-500 line-clamp-3">{initiative.description}</p>
          </div>
        )}
        {/* Budget */}
        {showBudget && (
          <div data-testid={`initiative-budget-${initiative.id}`} className="mt-1 flex items-center gap-1">
            <DollarSign size={10} className="text-slate-400 flex-shrink-0" />
            <span className="text-xs text-slate-500">
              {(initiative.capex || 0) > 0 && `CapEx ${(initiative.capex || 0).toLocaleString('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 })}`}
              {(initiative.capex || 0) > 0 && (initiative.opex || 0) > 0 && ' · '}
              {(initiative.opex || 0) > 0 && `OpEx ${(initiative.opex || 0).toLocaleString('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 })}`}
            </span>
          </div>
        )}
        {/* Relationships */}
        {relatedDeps.length > 0 && (
          <div data-testid={`initiative-relationships-${initiative.id}`} className="mt-1.5 flex items-start gap-1">
            <GitBranch size={10} className="text-slate-400 mt-0.5 flex-shrink-0" />
            <div className="flex flex-col gap-0.5">
              {relatedDeps.map(dep => {
                const isSource = dep.sourceId === initiative.id;
                const otherId = isSource ? dep.targetId : dep.sourceId;
                const other = allInitiatives.find(i => i.id === otherId);
                if (!other) return null;
                const label = isSource ? DEP_LABELS[dep.type] ?? dep.type : `depended on by`;
                return (
                  <span key={dep.id} className="text-xs text-slate-500">
                    <span className="text-slate-400">{label}</span>{' '}
                    <span className="font-medium text-slate-600">{other.name}</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </button>
  );
}

// ── Bucket section ────────────────────────────────────────────────────────────

const BucketSection: React.FC<{
  label: string;
  initiatives: Initiative[];
  programmes: Programme[];
  resources: Resource[];
  settings: TimelineSettings;
  dependencies: Dependency[];
  allInitiatives: Initiative[];
  dtsPhaseLabels: Record<string, string>;
  onSelectInitiative: (i: Initiative) => void;
}> = ({
  label,
  initiatives,
  programmes,
  resources,
  settings,
  dependencies,
  allInitiatives,
  dtsPhaseLabels,
  onSelectInitiative,
}) => {
  const [expanded, setExpanded] = useState(true);

  return (
    <div>
      <button
        className="w-full flex items-center gap-2 px-4 py-1.5 bg-slate-50 border-b border-slate-100 text-left"
        onClick={() => setExpanded(e => !e)}
      >
        {expanded ? <ChevronDown size={12} className="text-slate-400" /> : <ChevronRight size={12} className="text-slate-400" />}
        <span data-testid={`bucket-label-${label}`} className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {label}
        </span>
        <span className="ml-auto text-xs text-slate-400">{initiatives.length}</span>
      </button>
      {expanded && initiatives.map(init => (
        <InitiativeRow
          key={init.id}
          initiative={init}
          programmes={programmes}
          resources={resources}
          settings={settings}
          dependencies={dependencies}
          allInitiatives={allInitiatives}
          dtsPhaseLabels={dtsPhaseLabels}
          onClick={() => onSelectInitiative(init)}
        />
      ))}
    </div>
  );
}

// ── Asset card ────────────────────────────────────────────────────────────────

const AssetCard: React.FC<{
  asset: Asset;
  initiatives: Initiative[];
  totalInitiativeCount: number;
  programmes: Programme[];
  strategies: Strategy[];
  dependencies: Dependency[];
  resources: Resource[];
  settings: TimelineSettings;
  allInitiatives: Initiative[];
  bucketMode: BucketMode;
  dtsPhaseLabels: Record<string, string>;
  onSelectInitiative: (i: Initiative) => void;
  onOpenSettings?: () => void;
}> = ({
  asset,
  initiatives,
  totalInitiativeCount,
  programmes,
  strategies,
  dependencies,
  resources,
  settings,
  allInitiatives,
  bucketMode,
  dtsPhaseLabels,
  onSelectInitiative,
  onOpenSettings,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const conflicts = settings.conflictDetection !== 'off' ? conflictCount(initiatives) : 0;
  const activeCount = initiatives.filter(i => {
    const today = new Date();
    return new Date(i.startDate) <= today && new Date(i.endDate) >= today;
  }).length;

  const buckets = bucketInitiatives(initiatives, bucketMode, programmes, strategies, dtsPhaseLabels);

  // Determine a representative colour: first initiative's programme colour
  const firstProg = initiatives.length > 0
    ? programmes.find(p => p.id === initiatives[0].programmeId)
    : undefined;

  return (
    <div data-testid={`asset-card-${asset.id}`} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Card header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-100 text-left"
        onClick={() => setCollapsed(c => !c)}
      >
        {firstProg
          ? <ProgrammeDot colorClass={firstProg.color} />
          : <span className="w-2.5 h-2.5 rounded-full bg-slate-300 flex-shrink-0" />
        }
        <span className="flex-1 text-sm font-semibold text-slate-800 truncate">{asset.name}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
        {settings.showDtsAdoptionStatus === 'on' && asset.dtsAdoptionStatus && (
          <span
            data-testid={`mobile-adoption-badge-${asset.id}`}
            className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${DTS_ADOPTION_STATUS_STYLE[asset.dtsAdoptionStatus]}`}
          >
            {DTS_ADOPTION_STATUS_LABEL[asset.dtsAdoptionStatus]}
          </span>
        )}
          {conflicts > 0 && (
            <span
              data-testid={`conflict-badge-${asset.id}`}
              className="flex items-center gap-1 text-xs text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5"
            >
              <AlertTriangle size={10} />
              {conflicts} conflict{conflicts !== 1 ? 's' : ''}
            </span>
          )}
          {activeCount > 0 && (
            <span className="text-xs text-slate-400">{activeCount} active</span>
          )}
          {collapsed
            ? <ChevronRight size={14} className="text-slate-400" />
            : <ChevronDown size={14} className="text-slate-400" />
          }
        </div>
      </button>

      {/* Card body */}
      {!collapsed && (
        initiatives.length === 0 ? (
          totalInitiativeCount > 0 ? (
            <div data-testid="card-initiatives-filtered" className="px-4 py-3 text-sm text-slate-400 italic">
              {totalInitiativeCount} initiative{totalInitiativeCount !== 1 ? 's' : ''} hidden by{' '}
              <button
                data-testid="card-filter-link"
                onClick={onOpenSettings}
                className="underline text-blue-400 hover:text-blue-600"
              >
                filters
              </button>
            </div>
          ) : (
            <div data-testid="card-no-initiatives" className="px-4 py-3 text-sm text-slate-400 italic">
              No initiatives
            </div>
          )
        ) : (
          <div>
            {[...buckets.entries()].map(([label, inits]) => (
              <BucketSection
                key={label}
                label={label}
                initiatives={inits}
                programmes={programmes}
                resources={resources}
                settings={settings}
                dependencies={dependencies}
                allInitiatives={allInitiatives}
                dtsPhaseLabels={dtsPhaseLabels}
                onSelectInitiative={onSelectInitiative}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function MobileCardView({
  assets,
  initiatives,
  programmes,
  strategies,
  dependencies,
  assetCategories,
  settings,
  resources = [],
  dtsPhases = [],
  onSaveInitiative,
  onDeleteInitiative,
  onOpenSettings,
}: MobileCardViewProps) {
  const [selectedInitiative, setSelectedInitiative] = useState<Initiative | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const bucketMode: BucketMode = settings.mobileBucketMode ?? 'timeline';

  const dtsPhaseLabels: Record<string, string> = Object.fromEntries(
    (dtsPhases.length > 0 ? dtsPhases : [
      { id: 'phase-1',     name: 'Phase 1 — Register & Expose' },
      { id: 'phase-2',     name: 'Phase 2 — Integrate DPI' },
      { id: 'phase-3',     name: 'Phase 3 — AI & Legacy Exit' },
      { id: 'back-office', name: 'Back-Office Consolidation' },
      { id: 'not-dts',     name: 'Not DTS' },
    ]).map(p => [p.id, p.name])
  );

  // Filter initiatives to the window defined by startDate + monthsToShow
  const windowStart = new Date(settings.startDate);
  windowStart.setHours(0, 0, 0, 0);
  const windowEnd = new Date(windowStart);
  windowEnd.setMonth(windowEnd.getMonth() + settings.monthsToShow);

  const visibleInitiatives = initiatives.filter(i => {
    const start = new Date(i.startDate);
    const end = new Date(i.endDate);
    // Must start on or after windowStart, and end on or before windowEnd
    return start >= windowStart && end <= windowEnd;
  });

  // Group assets by category, preserving category order
  const sortedCategories = [...assetCategories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const assetsByCategory = sortedCategories.map(cat => ({
    category: cat,
    assets: assets.filter(a => a.categoryId === cat.id),
  })).filter(g => g.assets.length > 0);

  // Assets with no category
  const uncategorised = assets.filter(a => !assetCategories.find(c => c.id === a.categoryId));

  const handleSelectInitiative = (initiative: Initiative) => {
    setSelectedInitiative(initiative);
    setIsPanelOpen(true);
  };

  const handleSave = (initiative: Initiative) => {
    onSaveInitiative(initiative);
    setIsPanelOpen(false);
  };

  const handleDelete = onDeleteInitiative
    ? (initiative: Initiative) => {
        onDeleteInitiative(initiative);
        setIsPanelOpen(false);
      }
    : undefined;

  return (
    <>
      <div
        data-testid="mobile-card-view"
        className="flex-1 overflow-y-auto bg-slate-100 p-3 pb-20 space-y-3"
      >
        {assetsByCategory.map(({ category, assets: catAssets }) => (
          <div key={category.id}>
            <div
              data-testid={`card-category-header-${category.id}`}
              className="flex items-center gap-2 px-1 py-2"
            >
              <div className="flex-1 h-px bg-slate-300" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                {category.name} ({catAssets.length})
              </span>
              <div className="flex-1 h-px bg-slate-300" />
            </div>
            <div className="space-y-2">
              {catAssets.map(asset => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  initiatives={visibleInitiatives.filter(i => i.assetId === asset.id)}
                  totalInitiativeCount={initiatives.filter(i => i.assetId === asset.id).length}
                  programmes={programmes}
                  strategies={strategies}
                  dependencies={dependencies}
                  resources={resources}
                  settings={settings}
                  allInitiatives={initiatives}
                  bucketMode={bucketMode}
                  dtsPhaseLabels={dtsPhaseLabels}
                  onSelectInitiative={handleSelectInitiative}
                  onOpenSettings={onOpenSettings}
                />
              ))}
            </div>
          </div>
        ))}

        {uncategorised.length > 0 && (
          <div className="space-y-2">
            {uncategorised.map(asset => (
              <AssetCard
                key={asset.id}
                asset={asset}
                initiatives={visibleInitiatives.filter(i => i.assetId === asset.id)}
                totalInitiativeCount={initiatives.filter(i => i.assetId === asset.id).length}
                programmes={programmes}
                strategies={strategies}
                dependencies={dependencies}
                resources={resources}
                settings={settings}
                allInitiatives={initiatives}
                bucketMode={bucketMode}
                dtsPhaseLabels={dtsPhaseLabels}
                onSelectInitiative={handleSelectInitiative}
                onOpenSettings={onOpenSettings}
              />
            ))}
          </div>
        )}
      </div>

      <InitiativePanel
        initiative={selectedInitiative}
        assets={assets}
        programmes={programmes}
        strategies={strategies}
        dependencies={dependencies}
        initiatives={initiatives}
        resources={resources}
        dtsPhases={dtsPhases}
        onClose={() => setIsPanelOpen(false)}
        onSave={handleSave}
        onDelete={handleDelete}
        isOpen={isPanelOpen}
      />
    </>
  );
}

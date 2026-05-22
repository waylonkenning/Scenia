import React, { useState, useEffect } from 'react';
import { Asset, Initiative, Dependency, Milestone, Version, Programme, Strategy, AssetCategory, Resource, DtsAdoptionStatus, DtsPhase, DtsPhaseRecord } from '../types';
import { getAllVersions } from '../lib/db';
import { computeDiff, DiffResult } from '../lib/diff';
import { History, DollarSign, GitBranch, Users, ChevronLeft, Grid, Download } from 'lucide-react';
import { MaturityHeatmap } from './MaturityHeatmap';
import { AssetPanel } from './AssetPanel';
import { cn } from '../lib/utils';

interface ReportsViewProps {
  assets: Asset[];
  initiatives: Initiative[];
  milestones: Milestone[];
  dependencies: Dependency[];
  currentData: Version['data'];
  programmes: Programme[];
  strategies: Strategy[];
  assetCategories: AssetCategory[];
  resources?: Resource[];
  dtsPhases?: DtsPhaseRecord[];
  onSaveAsset?: (asset: Asset) => void;
  onNavigateToAsset?: (assetId: string, assetName: string) => void;
}

type ReportSlug = 'version-history' | 'budget' | 'initiatives-dependencies' | 'capacity' | 'maturity-heatmap' | 'dts-alignment';


function startsWithPrefix(value: unknown, prefix: string): boolean {
  return typeof value === 'string' && value.startsWith(prefix);
}


function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      data-testid="report-back-btn"
      onClick={onBack}
      className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-4"
    >
      <ChevronLeft size={16} />
      All Reports
    </button>
  );
}

const fmt = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}m` : n >= 1_000 ? `$${Math.round(n / 1_000)}k` : `$${n.toLocaleString()}`;

function BudgetBar({ total, max, color }: { total: number; max: number; color?: string }) {
  return (
    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color ?? 'bg-blue-500'}`} style={{ width: `${max > 0 ? Math.round((total / max) * 100) : 0}%` }} />
    </div>
  );
}

function BudgetSection({ testId, title, rows, max }: { testId: string; title: string; rows: { id: string; name: string; capex: number; opex: number; total: number; color?: string }[]; max: number }) {
  return (
    <div data-testid={testId} className="space-y-2">
      <div className="flex items-center gap-3">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider w-44 flex-shrink-0">{title}</h3>
        <div className="flex-1" />
        <span className="text-xs font-semibold text-blue-500 w-16 text-right flex-shrink-0">CapEx</span>
        <span className="text-xs font-semibold text-amber-500 w-16 text-right flex-shrink-0">OpEx</span>
        <span className="text-xs font-semibold text-slate-500 w-16 text-right flex-shrink-0">Total</span>
      </div>
      {rows.map(row => (
        <div key={row.id} data-testid={`budget-row-${testId.replace('budget-by-', '')}-${row.id}`} className="flex items-center gap-3">
          <span className="text-sm text-slate-700 w-44 truncate flex-shrink-0">{row.name}</span>
          <BudgetBar total={row.total} max={max} color={row.color} />
          <span data-testid="row-capex" className="text-xs text-blue-600 w-16 text-right flex-shrink-0">{fmt(row.capex)}</span>
          <span data-testid="row-opex" className="text-xs text-amber-600 w-16 text-right flex-shrink-0">{fmt(row.opex)}</span>
          <span data-testid="row-total" className="text-sm font-semibold text-slate-800 w-16 text-right flex-shrink-0">{fmt(row.total)}</span>
        </div>
      ))}
    </div>
  );
}

function depSentence(dep: Dependency, src: Initiative, tgt: Initiative, perspectiveId: string): string {
  const isSource = src.id === perspectiveId;
  if (dep.type === 'blocks') {
    if (isSource) return `Blocking: ${src.name} must finish before ${tgt.name} can start.`;
    return `Blocked: ${tgt.name} can't start until ${src.name} has finished.`;
  }
  if (dep.type === 'requires') {
    if (isSource) return `Required: ${src.name} requires ${tgt.name} to start first.`;
    return `Required by: ${tgt.name} must start first before ${src.name}.`;
  }
  return `${src.name} and ${tgt.name} are related.`;
}

const DTS_STATUS_BG: Record<DtsAdoptionStatus, string> = {
  'not-started':    'bg-slate-100 border-slate-200',
  'scoping':        'bg-yellow-50 border-yellow-200',
  'in-delivery':    'bg-blue-50 border-blue-200',
  'adopted':        'bg-emerald-50 border-emerald-200',
  'decommissioning':'bg-orange-50 border-orange-200',
  'not-applicable': 'bg-slate-50 border-slate-100',
};

const DTS_STATUS_BADGE: Record<DtsAdoptionStatus, string> = {
  'not-started':    'bg-slate-200 text-slate-600',
  'scoping':        'bg-yellow-100 text-yellow-700',
  'in-delivery':    'bg-blue-100 text-blue-700',
  'adopted':        'bg-emerald-100 text-emerald-700',
  'decommissioning':'bg-orange-100 text-orange-700',
  'not-applicable': 'bg-slate-100 text-slate-400',
};

const DTS_STATUS_LABEL: Record<DtsAdoptionStatus, string> = {
  'not-started':    'Not Started',
  'scoping':        'Scoping',
  'in-delivery':    'In Delivery',
  'adopted':        'Adopted',
  'decommissioning':'Decommissioning',
  'not-applicable': 'N/A',
};

export function ReportsView({ assets, initiatives, milestones, dependencies, currentData, programmes, strategies, assetCategories, resources = [], dtsPhases = [], onSaveAsset, onNavigateToAsset }: ReportsViewProps) {
  const [selectedReport, setSelectedReport] = useState<ReportSlug | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assetPanelOpen, setAssetPanelOpen] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [versionsError, setVersionsError] = useState<string | null>(() =>
    typeof localStorage !== 'undefined' && localStorage.getItem('scenia-test-versions-fail') === 'true'
      ? 'Failed to load saved versions. Please try reloading.'
      : null
  );

  useEffect(() => {
    if (versionsError) return;
    getAllVersions().then(loaded => {
      const sorted = loaded.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      setVersions(sorted);
    }).catch(() => {
      setVersionsError('Failed to load saved versions. Please try reloading.');
    });
  }, [versionsError]);

  const handleRunDiff = () => {
    const base = versions.find(v => v.id === selectedVersionId);
    if (!base) return;
    setDiffResult(computeDiff(base, currentData));
  };

  const hasDtsAssets = assets.some(a => startsWithPrefix(a.alias, 'DTS.'));

  const cards: { slug: ReportSlug; icon: React.ReactNode; title: string; description: string }[] = [
    {
      slug: 'version-history',
      icon: <History size={28} className="text-indigo-500" />,
      title: 'Version History',
      description: 'Compare the current plan against a saved version to see what has changed.',
    },
    {
      slug: 'budget',
      icon: <DollarSign size={28} className="text-emerald-500" />,
      title: 'Budget Report',
      description: 'See total spend broken down by programme, strategy, and category.',
    },
    {
      slug: 'initiatives-dependencies',
      icon: <GitBranch size={28} className="text-blue-500" />,
      title: 'Initiatives & Dependencies',
      description: 'Review every initiative and its upstream or downstream dependencies.',
    },
    {
      slug: 'capacity',
      icon: <Users size={28} className="text-amber-500" />,
      title: 'Capacity & Resources',
      description: 'See how many initiatives each resource is assigned to across the portfolio.',
    },
    {
      slug: 'maturity-heatmap',
      icon: <Grid size={28} className="text-rose-500" />,
      title: 'Maturity Heatmap',
      description: 'View all IT assets arranged by capability group and coloured by their maturity level.',
    },
    ...(hasDtsAssets ? [{
      slug: 'dts-alignment' as ReportSlug,
      icon: <Grid size={28} className="text-indigo-500" />,
      title: 'DTS Alignment',
      description: 'View your agency\'s alignment to the NZ Digital Target State — all 20 DTS assets coloured by adoption status.',
    }] : []),
  ];

  // ── Home screen ──────────────────────────────────────────────────────────────
  if (selectedReport === null) {
    return (
      <div data-testid="reports-view" className="h-full overflow-y-auto p-6 bg-slate-50">
        <div data-testid="reports-home" className="max-w-3xl mx-auto">
          <h1 className="text-xl font-bold text-slate-800 mb-6">Reports</h1>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {cards.map(({ slug, icon, title, description }) => (
              <button
                key={slug}
                data-testid={`report-card-${slug}`}
                onClick={() => setSelectedReport(slug)}
                className="text-left bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:border-blue-300 hover:shadow-md transition-all group"
              >
                <div className="mb-3">{icon}</div>
                <h2 className="text-base font-semibold text-slate-800 mb-1 group-hover:text-blue-700">{title}</h2>
                <p className="text-sm text-slate-500">{description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Version History ──────────────────────────────────────────────────────────
  if (selectedReport === 'version-history') {
    return (
      <div data-testid="report-view-version-history" className="h-full overflow-y-auto p-6 bg-slate-50">
        <div className="max-w-3xl mx-auto">
          <BackButton onBack={() => setSelectedReport(null)} />
          <div data-testid="report-history-diff" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-800">History Differences</h2>
            </div>
            <div className="p-4">
              {versionsError ? (
                <p data-testid="versions-load-error" className="text-sm text-red-500">{versionsError}</p>
              ) : versions.length === 0 ? (
                <p className="text-sm text-slate-400">No saved versions</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <select
                      data-testid="version-select"
                      value={selectedVersionId}
                      onChange={e => { setSelectedVersionId(e.target.value); setDiffResult(null); }}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select a version…</option>
                      {versions.map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleRunDiff}
                      disabled={!selectedVersionId}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-40"
                    >
                      Run Difference Report
                    </button>
                  </div>

                  {diffResult && (
                    <div data-testid="diff-result" className="mt-4 space-y-4">
                      {!diffResult.hasChanges ? (
                        <p className="text-sm text-slate-500 text-center py-4">No changes detected — this version matches the current state.</p>
                      ) : (
                        <>
                          {(diffResult.assets.added.length > 0 || diffResult.assets.removed.length > 0 || diffResult.assets.modified.length > 0) && (
                            <div>
                              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Assets</h4>
                              <div className="space-y-2">
                                {diffResult.assets.added.map((name, i) => (
                                  <div key={`asset-add-${i}`} className="flex gap-2 items-start text-sm p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                                    <span className="text-[10px] font-bold bg-emerald-500 text-white px-1.5 py-0.5 rounded uppercase">Added</span>
                                    <span className="text-emerald-900">{name}</span>
                                  </div>
                                ))}
                                {diffResult.assets.removed.map((name, i) => (
                                  <div key={`asset-rem-${i}`} className="flex gap-2 items-start text-sm p-2 bg-red-50 rounded-lg border border-red-100">
                                    <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded uppercase">Removed</span>
                                    <span className="text-red-900 line-through">{name}</span>
                                  </div>
                                ))}
                                {diffResult.assets.modified.map((item, i) => (
                                  <div key={`asset-mod-${i}`} className="p-2 bg-amber-50 rounded-lg border border-amber-100 text-sm">
                                    <div className="flex gap-2 items-start mb-1">
                                      <span className="text-[10px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded uppercase">Changed</span>
                                      <span className="font-medium text-amber-900">{item.name}</span>
                                    </div>
                                    <ul className="ml-14 space-y-0.5">
                                      {item.changes.map((c, ci) => (
                                        <li key={ci} className="text-xs text-amber-700">• {c}</li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {(diffResult.programmes.added.length > 0 || diffResult.programmes.removed.length > 0 || diffResult.programmes.modified.length > 0) && (
                            <div>
                              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Programmes</h4>
                              <div className="space-y-2">
                                {diffResult.programmes.added.map((name, i) => (
                                  <div key={`programme-add-${i}`} className="flex gap-2 items-start text-sm p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                                    <span className="text-[10px] font-bold bg-emerald-500 text-white px-1.5 py-0.5 rounded uppercase">Added</span>
                                    <span className="text-emerald-900">{name}</span>
                                  </div>
                                ))}
                                {diffResult.programmes.removed.map((name, i) => (
                                  <div key={`programme-rem-${i}`} className="flex gap-2 items-start text-sm p-2 bg-red-50 rounded-lg border border-red-100">
                                    <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded uppercase">Removed</span>
                                    <span className="text-red-900 line-through">{name}</span>
                                  </div>
                                ))}
                                {diffResult.programmes.modified.map((item, i) => (
                                  <div key={`programme-mod-${i}`} className="p-2 bg-amber-50 rounded-lg border border-amber-100 text-sm">
                                    <div className="flex gap-2 items-start mb-1">
                                      <span className="text-[10px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded uppercase">Changed</span>
                                      <span className="font-medium text-amber-900">{item.name}</span>
                                    </div>
                                    <ul className="ml-14 space-y-0.5">
                                      {item.changes.map((c, ci) => (
                                        <li key={ci} className="text-xs text-amber-700">• {c}</li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {(diffResult.strategies.added.length > 0 || diffResult.strategies.removed.length > 0 || diffResult.strategies.modified.length > 0) && (
                            <div>
                              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Strategies</h4>
                              <div className="space-y-2">
                                {diffResult.strategies.added.map((name, i) => (
                                  <div key={`strategy-add-${i}`} className="flex gap-2 items-start text-sm p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                                    <span className="text-[10px] font-bold bg-emerald-500 text-white px-1.5 py-0.5 rounded uppercase">Added</span>
                                    <span className="text-emerald-900">{name}</span>
                                  </div>
                                ))}
                                {diffResult.strategies.removed.map((name, i) => (
                                  <div key={`strategy-rem-${i}`} className="flex gap-2 items-start text-sm p-2 bg-red-50 rounded-lg border border-red-100">
                                    <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded uppercase">Removed</span>
                                    <span className="text-red-900 line-through">{name}</span>
                                  </div>
                                ))}
                                {diffResult.strategies.modified.map((item, i) => (
                                  <div key={`strategy-mod-${i}`} className="p-2 bg-amber-50 rounded-lg border border-amber-100 text-sm">
                                    <div className="flex gap-2 items-start mb-1">
                                      <span className="text-[10px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded uppercase">Changed</span>
                                      <span className="font-medium text-amber-900">{item.name}</span>
                                    </div>
                                    <ul className="ml-14 space-y-0.5">
                                      {item.changes.map((c, ci) => (
                                        <li key={ci} className="text-xs text-amber-700">• {c}</li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {(diffResult.initiatives.added.length > 0 || diffResult.initiatives.removed.length > 0 || diffResult.initiatives.modified.length > 0) && (
                            <div>
                              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Initiatives</h4>
                              <div className="space-y-2">
                                {diffResult.initiatives.added.map((name, i) => (
                                  <div key={`add-${i}`} className="flex gap-2 items-start text-sm p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                                    <span className="text-[10px] font-bold bg-emerald-500 text-white px-1.5 py-0.5 rounded uppercase">Added</span>
                                    <span className="text-emerald-900">{name}</span>
                                  </div>
                                ))}
                                {diffResult.initiatives.removed.map((name, i) => (
                                  <div key={`rem-${i}`} className="flex gap-2 items-start text-sm p-2 bg-red-50 rounded-lg border border-red-100">
                                    <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded uppercase">Removed</span>
                                    <span className="text-red-900 line-through">{name}</span>
                                  </div>
                                ))}
                                {diffResult.initiatives.modified.map((item, i) => (
                                  <div key={`mod-${i}`} className="p-2 bg-amber-50 rounded-lg border border-amber-100 text-sm">
                                    <div className="flex gap-2 items-start mb-1">
                                      <span className="text-[10px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded uppercase">Changed</span>
                                      <span className="font-medium text-amber-900">{item.name}</span>
                                    </div>
                                    <ul className="ml-14 space-y-0.5">
                                      {item.changes.map((c, ci) => (
                                        <li key={ci} className="text-xs text-amber-700">• {c}</li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {(diffResult.dependencies.added.length > 0 || diffResult.dependencies.removed.length > 0 || diffResult.dependencies.modified.length > 0) && (
                            <div>
                              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Relationships</h4>
                              <div className="space-y-2">
                                {diffResult.dependencies.added.map((name, i) => (
                                  <div key={i} className="flex gap-2 items-start text-sm p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                                    <span className="text-[10px] font-bold bg-emerald-500 text-white px-1.5 py-0.5 rounded uppercase">Added</span>
                                    <span className="text-emerald-900">{name}</span>
                                  </div>
                                ))}
                                {diffResult.dependencies.removed.map((name, i) => (
                                  <div key={i} className="flex gap-2 items-start text-sm p-2 bg-red-50 rounded-lg border border-red-100">
                                    <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded uppercase">Removed</span>
                                    <span className="text-red-900 line-through">{name}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {(diffResult.milestones.added.length > 0 || diffResult.milestones.removed.length > 0 || diffResult.milestones.modified.length > 0) && (
                            <div>
                              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Milestones</h4>
                              <div className="space-y-2">
                                {diffResult.milestones.added.map((name, i) => (
                                  <div key={i} className="flex gap-2 items-start text-sm p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                                    <span className="text-[10px] font-bold bg-emerald-500 text-white px-1.5 py-0.5 rounded uppercase">Added</span>
                                    <span className="text-emerald-900">{name}</span>
                                  </div>
                                ))}
                                {diffResult.milestones.removed.map((name, i) => (
                                  <div key={i} className="flex gap-2 items-start text-sm p-2 bg-red-50 rounded-lg border border-red-100">
                                    <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded uppercase">Removed</span>
                                    <span className="text-red-900 line-through">{name}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Budget Report ────────────────────────────────────────────────────────────
  if (selectedReport === 'budget') {
    const realInitiatives = initiatives.filter(i => !i.isPlaceholder);
    const capexOf = (inits: typeof realInitiatives) => inits.reduce((sum, i) => sum + (i.capex || 0), 0);
    const opexOf  = (inits: typeof realInitiatives) => inits.reduce((sum, i) => sum + (i.opex  || 0), 0);
    const totalOf = (inits: typeof realInitiatives) => capexOf(inits) + opexOf(inits);
    const grandCapex = capexOf(realInitiatives);
    const grandOpex  = opexOf(realInitiatives);
    const grandTotal = grandCapex + grandOpex;

    const byProgramme = programmes
      .map(p => {
        const inits = realInitiatives.filter(i => i.programmeId === p.id);
        return { id: p.id, name: p.name, color: p.color, capex: capexOf(inits), opex: opexOf(inits), total: totalOf(inits) };
      })
      .filter(r => r.total > 0).sort((a, b) => b.total - a.total);

    const byStrategy = strategies
      .map(s => {
        const inits = realInitiatives.filter(i => i.strategyId === s.id);
        return { id: s.id, name: s.name, color: s.color, capex: capexOf(inits), opex: opexOf(inits), total: totalOf(inits) };
      })
      .filter(r => r.total > 0).sort((a, b) => b.total - a.total);

    const byCategory = assetCategories
      .map(c => {
        const catAssets = assets.filter(a => a.categoryId === c.id).map(a => a.id);
        const inits = realInitiatives.filter(i => catAssets.includes(i.assetId));
        return { id: c.id, name: c.name, capex: capexOf(inits), opex: opexOf(inits), total: totalOf(inits) };
      })
      .filter(r => r.total > 0).sort((a, b) => b.total - a.total);

    const DTS_PHASE_DEFS: { id: DtsPhase; name: string }[] = dtsPhases.length > 0
      ? dtsPhases.map(p => ({ id: p.id, name: p.name }))
      : [
          { id: 'phase-1',     name: 'Phase 1 — Register & Expose' },
          { id: 'phase-2',     name: 'Phase 2 — Integrate DPI' },
          { id: 'phase-3',     name: 'Phase 3 — AI & Legacy Exit' },
          { id: 'back-office', name: 'Back-Office Consolidation' },
          { id: 'not-dts',     name: 'Not DTS' },
        ];

    const byDtsPhase = hasDtsAssets
      ? DTS_PHASE_DEFS
          .map(p => {
            const inits = realInitiatives.filter(i => i.dtsPhase === p.id);
            return { id: p.id, name: p.name, capex: capexOf(inits), opex: opexOf(inits), total: totalOf(inits) };
          })
          .filter(r => r.total > 0)
      : [];

    return (
      <div data-testid="report-view-budget" className="h-full overflow-y-auto p-6 bg-slate-50">
        <div className="max-w-3xl mx-auto">
          <BackButton onBack={() => setSelectedReport(null)} />
          <div data-testid="report-budget-summary" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800">Budget Summary</h2>
              <div className="flex items-center gap-3 text-sm">
                <span data-testid="budget-grand-total-capex" className="text-blue-600"><span className="font-medium">CapEx</span> {fmt(grandCapex)}</span>
                <span data-testid="budget-grand-total-opex" className="text-amber-600"><span className="font-medium">OpEx</span> {fmt(grandOpex)}</span>
                <span data-testid="budget-grand-total" className="font-bold text-slate-700">{fmt(grandTotal)} total</span>
              </div>
            </div>
            <div className="p-4 space-y-6">
              <BudgetSection testId="budget-by-programme" title="By Programme" rows={byProgramme} max={byProgramme[0]?.total ?? 0} />
              <BudgetSection testId="budget-by-strategy" title="By Strategy" rows={byStrategy} max={byStrategy[0]?.total ?? 0} />
              <BudgetSection testId="budget-by-category" title="By Category" rows={byCategory} max={byCategory[0]?.total ?? 0} />
              {hasDtsAssets && byDtsPhase.length > 0 && (
                <BudgetSection testId="budget-by-dts-phase" title="By DTS Phase" rows={byDtsPhase} max={byDtsPhase[0]?.total ?? 0} />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Initiatives & Dependencies ───────────────────────────────────────────────
  if (selectedReport === 'initiatives-dependencies') {
    const milestoneDeps = dependencies.filter(d => d.sourceType === 'milestone');

    return (
      <div data-testid="report-view-initiatives-dependencies" className="h-full overflow-y-auto p-6 bg-slate-50">
        <div className="max-w-3xl mx-auto space-y-6">
          <BackButton onBack={() => setSelectedReport(null)} />
          <div data-testid="report-dependencies">
            <h2 className="text-base font-semibold text-slate-800 mb-4">Initiatives &amp; Dependencies</h2>
            {assets.map(asset => {
              const assetInitiatives = initiatives.filter(i => i.assetId === asset.id && !i.isPlaceholder);
              if (assetInitiatives.length === 0) return null;
              return (
                <section key={asset.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-4">
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                    <h3 className="text-sm font-semibold text-slate-700">{asset.name}</h3>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {assetInitiatives.map(init => {
                      const related = dependencies.filter(d => d.sourceId === init.id || d.targetId === init.id);
                      return (
                        <li key={init.id} className="px-4 py-3">
                          <p className="text-sm font-medium text-slate-800 mb-1">{init.name}</p>
                          {related.length === 0 ? (
                            <p className="text-xs text-slate-400">No dependencies</p>
                          ) : (
                            <ul className="space-y-0.5">
                              {related.map(dep => {
                                const src = initiatives.find(i => i.id === dep.sourceId);
                                const tgt = initiatives.find(i => i.id === dep.targetId);
                                if (!src || !tgt) return null;
                                return (
                                  <li key={dep.id} className="text-xs text-slate-600">
                                    {depSentence(dep, src, tgt, init.id)}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>

          {milestoneDeps.length > 0 && (
            <div data-testid="report-milestone-dependencies" className="space-y-4">
              <h2 className="text-base font-semibold text-slate-800">Milestone Dependencies</h2>
              <ul className="space-y-2">
                {milestoneDeps.map(dep => {
                  const mile = milestones.find(m => m.id === dep.sourceId);
                  const tgt = initiatives.find(i => i.id === dep.targetId);
                  if (!mile || !tgt) return null;
                  return (
                    <li key={dep.id} className="text-xs text-slate-600 flex items-start gap-2">
                      <span className="font-semibold text-slate-700">{mile.name}</span>
                      <span>→</span>
                      <span>{tgt.name} requires this milestone to be reached first.</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Maturity Heatmap ─────────────────────────────────────────────────────────
  if (selectedReport === 'maturity-heatmap') {
    const handleTileClick = (asset: Asset) => {
      setSelectedAsset(asset);
      setAssetPanelOpen(true);
    };
    const handleAssetSave = (updatedAsset: Asset) => {
      onSaveAsset?.(updatedAsset);
      setAssetPanelOpen(false);
      setSelectedAsset(null);
    };
    const handleAssetPanelClose = () => {
      setAssetPanelOpen(false);
      setSelectedAsset(null);
    };
    return (
      <div className="h-full overflow-y-auto p-6 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <BackButton onBack={() => setSelectedReport(null)} />
          <MaturityHeatmap
            assets={assets}
            assetCategories={assetCategories}
            onTileClick={handleTileClick}
          />
        </div>
        <AssetPanel
          asset={selectedAsset}
          assetCategories={assetCategories}
          isOpen={assetPanelOpen}
          onClose={handleAssetPanelClose}
          onSave={handleAssetSave}
        />
      </div>
    );
  }

  // ── DTS Alignment Coverage ───────────────────────────────────────────────────
  if (selectedReport === 'dts-alignment') {
    const dtsCategories = assetCategories
      .filter(c => startsWithPrefix(c.id, 'cat-dts-'))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    return (
      <div data-testid="report-view-dts-alignment" className="h-full overflow-y-auto p-6 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <BackButton onBack={() => setSelectedReport(null)} />
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold text-slate-800">DTS Alignment Coverage</h1>
              <p className="text-sm text-slate-500 mt-1">
                Agency alignment to the NZ Digital Target State — 20 assets across 6 layers
              </p>
            </div>
            <button
              data-testid="dts-alignment-export-btn"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors shrink-0"
            >
              <Download size={13} />
              Export
            </button>
          </div>

          <div className="space-y-6">
            {dtsCategories.map(cat => {
              const layerAssets = assets
                .filter(a => a.categoryId === cat.id && startsWithPrefix(a.alias, 'DTS.'))
                .sort((a, b) => (a.alias ?? '').localeCompare(b.alias ?? ''));
              return (
                <div key={cat.id} data-testid={`dts-alignment-layer-${cat.id}`}>
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{cat.name}</h2>
                  {layerAssets.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">No assets defined for this layer.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {layerAssets.map(asset => {
                        const status = asset.dtsAdoptionStatus;
                        const assetInits = initiatives.filter(
                          i => i.assetId === asset.id && i.status !== 'cancelled'
                        );
                        const totalBudget = assetInits.reduce((s, i) => s + (i.capex ?? 0) + (i.opex ?? 0), 0);
                        return (
                          <button
                            key={asset.id}
                            data-testid={`dts-alignment-tile-${asset.id}`}
                            data-status={status ?? ''}
                            onClick={() => onNavigateToAsset?.(asset.id, asset.name)}
                            className={cn(
                              'text-left p-3 rounded-lg border transition-all hover:shadow-md group',
                              status ? DTS_STATUS_BG[status] : 'bg-white border-slate-200'
                            )}
                          >
                            <div className="text-[10px] font-mono text-slate-400 mb-1">{asset.alias}</div>
                            <div className="text-xs font-semibold text-slate-800 leading-snug mb-2 group-hover:text-blue-700">
                              {asset.name}
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-500">
                              <span data-testid="tile-initiative-count">
                                {assetInits.length} {assetInits.length === 1 ? 'initiative' : 'initiatives'}
                              </span>
                              <span data-testid="tile-budget">{fmt(totalBudget)}</span>
                            </div>
                            {status && (
                              <div className={cn(
                                'mt-2 text-[9px] font-semibold px-1.5 py-0.5 rounded-full inline-block',
                                DTS_STATUS_BADGE[status]
                              )}>
                                {DTS_STATUS_LABEL[status]}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Capacity & Resources ─────────────────────────────────────────────────────
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-NZ', { month: 'short', year: 'numeric' });
  const realInitiatives = initiatives.filter(i => !i.isPlaceholder);
  const assignmentsFor = (resourceId: string) =>
    realInitiatives.filter(i => i.ownerId === resourceId || (i.resourceIds ?? []).includes(resourceId));

  return (
    <div data-testid="report-view-capacity" className="h-full overflow-y-auto p-6 bg-slate-50">
      <div className="max-w-3xl mx-auto">
        <BackButton onBack={() => setSelectedReport(null)} />
        <div data-testid="capacity-report" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-800">Capacity Report</h2>
          </div>
          <div className="p-4">
            {resources.length === 0 ? (
              <p data-testid="capacity-no-resources" className="text-sm text-slate-400">
                No resources defined. Add resources in Data Manager → Resources to track capacity.
              </p>
            ) : (
              <div className="space-y-4">
                {resources.map(resource => {
                  const assigned = assignmentsFor(resource.id);
                  return (
                    <div key={resource.id} data-testid="capacity-resource-row" className="border border-slate-100 rounded-lg overflow-hidden">
                      <div data-testid={`capacity-resource-row-${resource.id}`} className="px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="text-sm font-semibold text-slate-800">{resource.name}</span>
                            {resource.role && <span className="ml-2 text-xs text-slate-400">({resource.role})</span>}
                          </div>
                          <span
                            data-testid="capacity-assignment-count"
                            className={`text-xs font-bold px-2 py-0.5 rounded-full ${assigned.length === 0 ? 'bg-slate-100 text-slate-400' : assigned.length >= 3 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}
                          >
                            {assigned.length}
                          </span>
                        </div>
                        {assigned.length === 0 ? (
                          <p data-testid="capacity-no-assignments" className="text-xs text-slate-400 italic">No initiatives assigned</p>
                        ) : (
                          <ul className="space-y-1">
                            {assigned.map(init => (
                              <li key={init.id} className="flex items-center gap-2 text-xs text-slate-600">
                                {init.ownerId === resource.id && (
                                  <span className="text-[10px] font-bold bg-slate-200 text-slate-600 px-1 rounded uppercase">Owner</span>
                                )}
                                <span className="font-medium text-slate-700">{init.name}</span>
                                <span className="text-slate-400">{fmtDate(init.startDate)} → {fmtDate(init.endDate)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

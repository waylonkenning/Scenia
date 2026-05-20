import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useMediaQuery } from '../lib/useMediaQuery';
import { Asset, Application, ApplicationSegment, ApplicationStatus, DtsPhaseRecord, Initiative, Milestone, Programme, Strategy, Dependency, AssetCategory, TimelineSettings, Resource } from '../types';
import { differenceInDays, format, parseISO, addQuarters, getYear, getQuarter, addDays, startOfMonth, lastDayOfMonth, addMonths, addWeeks } from 'date-fns';
import { cn, reorder } from '../lib/utils';
import { AlertTriangle, Star, Info, ChevronRight, ChevronDown, ChevronUp, Boxes, Trash2 } from 'lucide-react';
import { geanzAreas, GEANZ_CATEGORY_ID, GEANZ_TO_DTS_MAP, GeanzArea } from '../lib/geanzCatalogue';
import { InitiativePanel } from './InitiativePanel';
import { InitiativeBar } from './InitiativeBar';
import { ApplicationSegmentPanel } from './ApplicationSegmentPanel';
import { DependencyPanel } from './DependencyPanel';
import { ArrowDisambiguator } from './ArrowDisambiguator';
import { computeCriticalPath } from '../lib/criticalPath';
import {
  MIN_ROW_HEIGHT,
  BAR_HEIGHT,
  BAR_GAP,
  ROW_PADDING,
  SEG_ROW_UNIT,
  getPosition as tlGetPosition,
  getWidth as tlGetWidth,
  resolveSegmentConflicts,
  getGroupsForAsset as tlGetGroupsForAsset,
  layoutSegments as tlLayoutSegments,
  computeAutoRow as tlComputeAutoRow,
} from '../lib/timelineLayout';

interface TimelineProps {
  assets: Asset[];
  applications?: Application[];
  initiatives: Initiative[];
  milestones: Milestone[];
  programmes: Programme[];
  strategies: Strategy[];
  dependencies: Dependency[];
  assetCategories: AssetCategory[];
  resources?: Resource[];
  settings: TimelineSettings;
  onUpdateInitiative?: (initiative: Initiative) => void;
  onAddInitiative?: (initiative: Initiative) => void;
  onUpdateAssets?: (assets: Asset[]) => void;
  onUpdateDependencies?: (dependencies: Dependency[]) => void;
  onUpdateMilestone?: (milestone: Milestone) => void;
  onDeleteInitiative?: (initiative: Initiative) => void;
  onUpdateSettings?: (settings: TimelineSettings) => void;
  searchQuery?: string;
  applicationSegments?: ApplicationSegment[];
  onSaveApplicationSegment?: (segment: ApplicationSegment) => void;
  onDeleteApplicationSegment?: (segment: ApplicationSegment) => void;
  onUpdateApplicationSegments?: (segments: ApplicationSegment[]) => void;
  applicationStatuses?: ApplicationStatus[];
  dtsPhases?: DtsPhaseRecord[];
  onDeleteAsset?: (assetId: string) => void;
  onBulkDeleteAssets?: (assetIds: string[]) => void;
  onAddAssets?: (assets: Asset[]) => void;
}

const SIDEBAR_WIDTH_DESKTOP = 256; // 16rem
const SIDEBAR_WIDTH_MOBILE = 120; // 7.5rem


export function Timeline({ assets, applications = [], initiatives, milestones, programmes, strategies, dependencies, assetCategories, resources = [], settings, onAddInitiative, onUpdateInitiative, onUpdateAssets, onUpdateDependencies, onUpdateMilestone, onDeleteInitiative, onUpdateSettings, searchQuery, applicationSegments: applicationSegmentsProp = [], onSaveApplicationSegment, onDeleteApplicationSegment, onUpdateApplicationSegments, applicationStatuses = [], dtsPhases = [], onDeleteAsset, onBulkDeleteAssets, onAddAssets }: TimelineProps) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const SIDEBAR_WIDTH = isMobile ? SIDEBAR_WIDTH_MOBILE : SIDEBAR_WIDTH_DESKTOP;

  const colorBy = settings.colorBy || 'programme';

  const STATUS_COLORS: Record<string, string> = {
    planned: 'bg-slate-400',
    active: 'bg-blue-500',
    done: 'bg-emerald-500',
    cancelled: 'bg-red-400',
  };

  const SEGMENT_COLORS: Record<string, string> = {};
  const SEGMENT_LABELS: Record<string, string> = {};
  (applicationStatuses ?? []).forEach(s => {
    SEGMENT_COLORS[s.id] = s.color;
    SEGMENT_LABELS[s.id] = s.name;
  });
  const STATUS_LABELS: Record<string, string> = {
    planned: 'Planned',
    active: 'Active',
    done: 'Done',
    cancelled: 'Cancelled',
  };
  const normalizeInitiativeStatus = (status: Initiative['status'] | string | undefined): Initiative['status'] => {
    return Object.hasOwn(STATUS_LABELS, status ?? '') ? (status as Initiative['status']) : 'planned';
  };
  const RAG_COLORS: Record<string, string> = {
    green: 'bg-green-500',
    amber: 'bg-amber-400',
    red: 'bg-red-500',
    none: 'bg-slate-300',
  };
  const RAG_LABELS: Record<string, string> = {
    green: 'Green',
    amber: 'Amber',
    red: 'Red',
  };

  // ── Stable lookup maps (O(1) instead of O(N) .find() per initiative) ─────
  const programmeMap = useMemo(() => new Map(programmes.map(p => [p.id, p])), [programmes]);
  const strategyMap  = useMemo(() => new Map(strategies.map(s => [s.id, s])), [strategies]);
  const initiativeAssetIdMap = useMemo(
    () => new Map(initiatives.map(init => [init.id, init.assetId])),
    [initiatives]
  );

  // ── Shared colour + subtitle helpers (single source of truth) ────────────
  const dtsPhaseMap = useMemo(() => new Map(dtsPhases.map(p => [p.id, p])), [dtsPhases]);

  function getInitiativeColor(init: Initiative, prog: Programme | undefined, strat: Strategy | undefined): string {
    if (colorBy === 'rag')       return RAG_COLORS[init.ragStatus || 'none'];
    if (colorBy === 'status')    return STATUS_COLORS[normalizeInitiativeStatus(init.status)];
    if (colorBy === 'dts-phase') return dtsPhaseMap.get(init.dtsPhase as string)?.color || 'bg-slate-400';
    if (colorBy === 'programme') return prog?.color || 'bg-slate-500';
    return strat?.color || 'bg-slate-400';
  }

  function getInitiativeSubtitle(
    init: Initiative,
    prog: Programme | undefined,
    strat: Strategy | undefined,
    isGroup?: boolean,
    groupProgrammeNames?: string,
    groupStrategyNames?: string,
  ): string | undefined {
    if (colorBy === 'rag')       return init.ragStatus ? RAG_LABELS[init.ragStatus] : undefined;
    if (colorBy === 'status')    return STATUS_LABELS[normalizeInitiativeStatus(init.status)];
    if (colorBy === 'dts-phase') return dtsPhaseMap.get(init.dtsPhase as string)?.name;
    if (isGroup)                 return colorBy === 'programme' ? groupProgrammeNames : groupStrategyNames;
    return colorBy === 'programme' ? prog?.name : strat?.name;
  }

  const [selectedInitiativeId, setSelectedInitiativeId] = useState<string | null>(null);
  const [initiativePanelId, setInitiativePanelId] = useState<string | null>(null); // separate from selectedInitiativeId — panel only opens when this is set
  const [selectedDependencyId, setSelectedDependencyId] = useState<string | null>(null);
  const [disambiguateAt, setDisambiguateAt] = useState<{ x: number; y: number; candidates: Dependency[] } | null>(null);

  // GEANZ catalogue state
  type PendingConfirm =
    | { type: 'delete-asset'; assetId: string; assetName: string; hasLinkedData: boolean }
    | { type: 'remove-area'; areaAlias: string; areaName: string; assetCount: number };
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  const geanzAssetAliases = useMemo(() => new Set(
    geanzAreas.flatMap(area => area.assets.map(asset => asset.alias))
  ), []);
  const isGeanzCatalogueEnabled = settings.showGeanzCatalogue !== false;

  const isGeanzCatalogueAsset = (asset: Asset): boolean => {
    if (!asset.alias) return false;
    return isGeanzCatalogueEnabled && geanzAssetAliases.has(asset.alias) && asset.categoryId === GEANZ_CATEGORY_ID;
  };

  // Separate canonical GEANZ catalogue assets from user assets
  const geanzAssets = useMemo(
    () => assets.filter(isGeanzCatalogueAsset),
    [assets, geanzAssetAliases, isGeanzCatalogueEnabled]
  );
  const geanzAssetsByArea = useMemo(() => {
    const map: Record<string, Asset[]> = {};
    geanzAssets.forEach(a => {
      const m = a.alias!.match(/^(TAP\.\d+)/);
      if (m) {
        if (!map[m[1]]) map[m[1]] = [];
        map[m[1]].push(a);
      }
    });
    return map;
  }, [geanzAssets]);
  const depSegmentsRef = useRef<Map<string, number[][]>>(new Map()); // depId → [[x1,y1,x2,y2], ...]
  const isDraggingRef = useRef(false);
  const milestoneDepDirectRef = useRef(false); // true when direct listener is handling milestone dep creation
  const [labelTooltip, setLabelTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const labelTooltipTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [resizing, setResizing] = useState<{ id: string; edge: 'start' | 'end'; initialX: number; initialDate: string } | null>(null);
  const [moving, setMoving] = useState<{ id: string; initialX: number; initialY: number; initialStart: string; initialEnd: string } | null>(null);
  const [movingMilestone, setMovingMilestone] = useState<{ id: string; initialX: number; initialY: number; initialDate: string } | null>(null);
  const [movingDependency, setMovingDependency] = useState<{ id: string; initialX: number; initialOffset: number } | null>(null);
  const [localSegments, setLocalSegments] = useState<ApplicationSegment[]>(applicationSegmentsProp);
  const [movingSegment, setMovingSegment] = useState<{ id: string; initialX: number; initialY: number; initialRow: number; initialStart: string; initialEnd: string } | null>(null);
  const [resizingSegment, setResizingSegment] = useState<{ id: string; edge: 'start' | 'end'; initialX: number; initialDate: string } | null>(null);
  const [resizingSegmentVertical, setResizingSegmentVertical] = useState<{ id: string; initialY: number; initialRowSpan: number } | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [creatingSegmentParams, setCreatingSegmentParams] = useState<{ id: string; assetId: string; startDate: string; endDate: string; row: number } | null>(null);
  const [segmentPanelId, setSegmentPanelId] = useState<string | null>(null); // separate from selectedSegmentId — panel only opens when this is set
  const [drawingDependency, setDrawingDependency] = useState<{
    sourceId: string;
    sourceType: 'initiative' | 'milestone' | 'segment';
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const [draggingCategory, setDraggingCategory] = useState<string | null>(null);
  const [draggingAssetId, setDraggingAssetId] = useState<string | null>(null);
  const [legendExpanded, setLegendExpanded] = useState<boolean>(() => {
    try { return localStorage.getItem('scenia_legend_expanded') !== 'false'; } catch { return true; }
  });
  const [legendNow, setLegendNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setLegendNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(() => {
    try {
      const saved = sessionStorage.getItem('scenia_collapsed_categories');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  const toggleCategory = (catId: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      sessionStorage.setItem('scenia_collapsed_categories', JSON.stringify([...next]));
      return next;
    });
  };

  const [creatingInitiativeParams, setCreatingInitiativeParams] = useState<{ id: string, assetId: string, startDate: string, endDate: string } | null>(null);

  const [initiativePositions, setInitiativePositions] = useState<Map<string, { x: number; y: number; width: number; height: number }>>(new Map());
  const [milestonePositions, setMilestonePositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [segmentPositions, setSegmentPositions] = useState<Map<string, { x: number; y: number; width: number; height: number }>>(new Map());
  const segmentDepDirectRef = useRef(false);
  const lastStableLayouts = useRef<Map<string, { items: any[]; height: number }>>(new Map());

  const timelineRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize category order
  useEffect(() => {
    const categories = assetCategories.sort((a, b) => (a.order || 0) - (b.order || 0)).map(c => c.id);
    setCategoryOrder(prev => {
      if (prev.length === 0) return categories;
      const newOrder = [...prev];
      categories.forEach(catId => {
        if (!newOrder.includes(catId)) newOrder.push(catId);
      });
      return newOrder.filter(id => categories.includes(id));
    });
  }, [assetCategories]);

  const [criticalPathInitIds, criticalPathDepIds] = useMemo(() => {
    if ((settings.criticalPath || 'off') !== 'on') return [new Set<string>(), new Set<string>()];
    return computeCriticalPath(initiatives, dependencies);
  }, [initiatives, dependencies, settings.criticalPath]);

  const toSearchString = (value: unknown) => String(value ?? '').toLowerCase();

  const filteredInitiatives = useMemo(() => {
    if (!searchQuery) return initiatives;
    const query = searchQuery.toLowerCase();
    return initiatives.filter(init => {
      const matchName = toSearchString(init.name).includes(query);
      const matchDesc = toSearchString(init.description).includes(query);

      const asset = assets.find(a => a.id === init.assetId);
      const matchAsset = toSearchString(asset?.name).includes(query);

      const programme = programmes.find(p => p.id === init.programmeId);
      const matchProg = toSearchString(programme?.name).includes(query);

      const strategy = strategies.find(s => s.id === init.strategyId);
      const matchStrat = toSearchString(strategy?.name).includes(query);

      return matchName || matchDesc || matchAsset || matchProg || matchStrat;
    });
  }, [initiatives, searchQuery, assets, programmes, strategies]);

  // Group assets by category ID — canonical GEANZ assets are rendered separately
  const assetsByCategory = useMemo<Record<string, Asset[]>>(() => {
    const grouped: Record<string, Asset[]> = {};
    assets.forEach(a => {
      // Canonical GEANZ assets are rendered in the dedicated GEANZ section, not here
      if (isGeanzCatalogueAsset(a)) return;

      // Hide assets with no matching initiatives when searching
      if (searchQuery) {
        const hasMatchingInitiative = filteredInitiatives.some(i => i.assetId === a.id);
        if (!hasMatchingInitiative) return;
      }

      const catId = a.categoryId || 'uncategorized';
      if (!grouped[catId]) grouped[catId] = [];
      grouped[catId].push(a);
    });
    return grouped;
  }, [assets, searchQuery, filteredInitiatives, isGeanzCatalogueEnabled]);

  const sortedCategoryIds = useMemo(() => {
    const categoryIds = Object.keys(assetsByCategory);
    return [...categoryIds].sort((a, b) => {
      const indexA = categoryOrder.indexOf(a);
      const indexB = categoryOrder.indexOf(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [assetsByCategory, categoryOrder]);

  // Drag and drop for assets
  const handleAssetDragStart = (e: React.DragEvent, assetId: string) => {
    setDraggingAssetId(assetId);
    e.dataTransfer.setData('text/plain', assetId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleAssetDragOver = (e: React.DragEvent, targetAsset: Asset) => {
    e.preventDefault();
    if (draggingAssetId && draggingAssetId !== targetAsset.id && onUpdateAssets) {
      const draggingAsset = assets.find(a => a.id === draggingAssetId);
      if (draggingAsset && draggingAsset.categoryId === targetAsset.categoryId) {
        const oldIndex = assets.findIndex(a => a.id === draggingAssetId);
        const newIndex = assets.findIndex(a => a.id === targetAsset.id);

        if (oldIndex !== -1 && newIndex !== -1) {
          onUpdateAssets(reorder(assets, oldIndex, newIndex));
        }
      }
    }
  };

  const handleAssetDragEnd = () => {
    setDraggingAssetId(null);
  };

  // Container width for dynamic column sizing
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width - SIDEBAR_WIDTH);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [SIDEBAR_WIDTH]);

  // Local state for dragging operations
  const [localInitiatives, setLocalInitiatives] = useState<Initiative[]>(filteredInitiatives);
  const [localMilestones, setLocalMilestones] = useState<Milestone[]>(milestones);

  useEffect(() => {
    if (!resizing && !moving) {
      setLocalInitiatives(filteredInitiatives);
    }
  }, [filteredInitiatives, resizing, moving]);

  useEffect(() => {
    if (!movingSegment && !resizingSegment && !resizingSegmentVertical) {
      setLocalSegments(applicationSegmentsProp);
    }
  }, [applicationSegmentsProp, movingSegment, resizingSegment, resizingSegmentVertical]);

  useEffect(() => {
    if (!movingMilestone) {
      setLocalMilestones(milestones);
    }
  }, [milestones, movingMilestone]);

  // Generate time columns based on monthsToShow and latest data point
  const timeColumns = useMemo<{ date: Date; endDate: Date; label: string; sublabel: string }[]>(() => {
    const cols: { date: Date; endDate: Date; label: string; sublabel: string }[] = [];
    const ms = settings.monthsToShow || 36;
    const timelineStart = parseISO(settings.startDate);

    // Find the latest end date among all initiatives and milestones to ensure the grid covers it
    let maxEndDate = timelineStart;
    if (localInitiatives.length > 0 || milestones.length > 0) {
      const initDates = localInitiatives.map(i => new Date(i.endDate).getTime()).filter(t => !isNaN(t));
      const mileDates = milestones.map(m => new Date(m.date).getTime()).filter(t => !isNaN(t));
      const maxTime = Math.max(...initDates, ...mileDates, timelineStart.getTime());
      maxEndDate = new Date(maxTime);
    }

    // minTimelineEnd ensures we AT LEAST render the requested duration (3/6/12/24/36 months)
    const minTimelineEnd = addMonths(timelineStart, ms);
    const uncappedTimelineEnd = maxEndDate > minTimelineEnd ? maxEndDate : minTimelineEnd;

    // Cap timeline horizon to prevent rendering unbounded columns from malformed or malicious dates
    const MAX_TIMELINE_MONTHS = 120;
    const maxTimelineEnd = addMonths(timelineStart, MAX_TIMELINE_MONTHS);
    const timelineEnd = uncappedTimelineEnd > maxTimelineEnd ? maxTimelineEnd : uncappedTimelineEnd;

    if (ms === 3) {
      // Weekly columns — snap to the Monday of the week containing timelineStart
      let d = new Date(timelineStart);
      const dow = d.getDay(); // 0=Sun, 1=Mon … 6=Sat
      const daysToMonday = dow === 0 ? -6 : 1 - dow;
      d.setDate(d.getDate() + daysToMonday);
      let i = 0;
      while (d < timelineEnd || i < 12) { // Guarantee at least 12 columns
        cols.push({ date: d, endDate: addWeeks(d, 1), label: format(d, 'dd MMM'), sublabel: `Wk ${i + 1}` });
        d = addWeeks(d, 1);
        i++;
      }
    } else if (ms === 6) {
      // Half-month columns
      let i = 0;
      let d = timelineStart;
      while (d < timelineEnd || i < 12) {
        const monthIdx = Math.floor(i / 2);
        const isSecondHalf = i % 2 === 1;
        const monthStart = addMonths(timelineStart, monthIdx);
        const currentD = isSecondHalf ? addDays(monthStart, 15) : monthStart;
        const nextD = isSecondHalf ? addMonths(timelineStart, monthIdx + 1) : addDays(monthStart, 15);
        cols.push({ date: currentD, endDate: nextD, label: format(currentD, 'MMM yyyy'), sublabel: isSecondHalf ? '16-end' : '1-15' });
        d = nextD;
        i++;
      }
    } else if (ms === 12) {
      // Monthly columns
      let d = timelineStart;
      let i = 0;
      while (d < timelineEnd || i < 12) {
        cols.push({ date: d, endDate: addMonths(d, 1), label: format(d, 'yyyy'), sublabel: format(d, 'MMM') });
        d = addMonths(d, 1);
        i++;
      }
    } else if (ms === 24) {
      // Quarterly columns
      let d = timelineStart;
      let i = 0;
      while (d < timelineEnd || i < 8) {
        cols.push({ date: d, endDate: addQuarters(d, 1), label: `${getYear(d)}`, sublabel: `Q${getQuarter(d)}` });
        d = addQuarters(d, 1);
        i++;
      }
    } else {
      // 36 months = Quarterly columns
      let d = timelineStart;
      let i = 0;
      while (d < timelineEnd || i < 12) {
        cols.push({ date: d, endDate: addQuarters(d, 1), label: `${getYear(d)}`, sublabel: `Q${getQuarter(d)}` });
        d = addQuarters(d, 1);
        i++;
      }
    }
    return cols;
  }, [settings.startDate, settings.monthsToShow, localInitiatives, milestones]);

  // These are computed before any early return so that hook calls below are unconditional.
  // timeColumns is always non-empty (the useMemo guarantees at least 8–12 columns), so the
  // fallback values here are defensive only and will never be reached in practice.
  const startDate = timeColumns.length > 0 ? timeColumns[0].date : new Date();
  const endDate = timeColumns.length > 0 ? timeColumns[timeColumns.length - 1].endDate : new Date();
  const totalDays = Math.max(1, differenceInDays(endDate, startDate));
  const zoom = settings.columnZoom ?? 1.0;
  const totalWidth = Math.max(containerWidth, timeColumns.length * 80 * zoom); // Min 80px per column, scaled by zoom
  const columnWidth = timeColumns.length > 0 ? totalWidth / timeColumns.length : 80;

  // Convenience closures so existing call sites don't need to pass startDate/totalDays explicitly.
  const getPosition = (dateStr: string) => tlGetPosition(dateStr, startDate, totalDays);
  const getWidth = (startStr: string, endStr: string) => tlGetWidth(startStr, endStr, totalDays);

  // Clear selection on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedInitiativeId(null);
        setSelectedSegmentId(null);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleRowDoubleClick = (e: React.MouseEvent, assetId: string) => {
    // Avoid triggering if clicking on an existing initiative or milestone
    if ((e.target as HTMLElement).closest('[data-initiative-id]') || (e.target as HTMLElement).closest('[data-milestone-id]')) return;

    const offsetX = e.nativeEvent.offsetX;
    const percentage = (offsetX / totalWidth) * 100;
    const daysFromStart = Math.round((percentage / 100) * totalDays);
    const calculatedStartDate = format(addDays(startDate, daysFromStart), 'yyyy-MM-dd');
    const calculatedEndDate = format(addDays(startDate, daysFromStart + 90), 'yyyy-MM-dd'); // 90 days default duration

    setCreatingInitiativeParams({
      id: crypto.randomUUID(),
      assetId,
      startDate: calculatedStartDate,
      endDate: calculatedEndDate
    });
  };

  const handleResizeStart = (e: React.MouseEvent, id: string, edge: 'start' | 'end', initialDate: string) => {
    e.stopPropagation();
    e.preventDefault();
    isDraggingRef.current = false;
    setResizing({ id, edge, initialX: e.clientX, initialDate });
  };

  const handleMilestoneMouseDown = (e: React.MouseEvent, mile: Milestone) => {
    e.stopPropagation();
    e.preventDefault();
    isDraggingRef.current = false;
    const initialX = e.clientX;
    const initialY = e.clientY;

    // Add direct window listeners immediately (avoids timing gap before React/useEffect commits)
    // These handle the first mousemove events to decide gesture direction.
    let gestureDecided = false;

    const handleGestureMove = (mv: MouseEvent) => {
      if (gestureDecided) return;
      const deltaY = mv.clientY - initialY;
      const deltaX = mv.clientX - initialX;
      // If dragging downward by threshold: switch to dep drawing
      if (settings.showRelationships !== 'off' && deltaY > 10 && deltaY > Math.abs(deltaX)) {
        gestureDecided = true;
        window.removeEventListener('mousemove', handleGestureMove);
        window.removeEventListener('mouseup', handleGestureUp);
        if (containerRef.current) {
          const containerRect = containerRef.current.getBoundingClientRect();
          const milePos = milestonePositions.get(mile.id);
          const startX = milePos ? milePos.x : initialX - containerRect.left;
          const startY = milePos ? milePos.y : initialY - containerRect.top;
          // Set React state for the visual arrow
          setDrawingDependency({
            sourceId: mile.id,
            sourceType: 'milestone',
            startX,
            startY,
            currentX: mv.clientX - containerRect.left,
            currentY: mv.clientY - containerRect.top,
          });
          // Add direct listeners so dep creation doesn't depend on useEffect timing.
          // Guard against double-creation if useEffect also fires on same mouseup.
          milestoneDepDirectRef.current = true;
          const handleDepMove = (dmv: MouseEvent) => {
            if (!containerRef.current) return;
            const cr = containerRef.current.getBoundingClientRect();
            setDrawingDependency(prev => prev ? { ...prev, currentX: dmv.clientX - cr.left, currentY: dmv.clientY - cr.top } : null);
          };
          const handleDepUp = (dup: MouseEvent) => {
            window.removeEventListener('mousemove', handleDepMove);
            window.removeEventListener('mouseup', handleDepUp);
            milestoneDepDirectRef.current = false;
            setDrawingDependency(null);
            if (!onUpdateDependencies) return;
            let targetId: string | null = null;
            // elementsFromPoint only works within the viewport; use it first
            const els = document.elementsFromPoint(dup.clientX, dup.clientY);
            for (const el of els) {
              const id = el.getAttribute('data-initiative-id') ?? el.closest('[data-initiative-id]')?.getAttribute('data-initiative-id');
              if (id) { targetId = id; break; }
            }
            // Fallback: scan all initiative elements by bounding rect (handles off-viewport drops)
            if (!targetId) {
              for (const el of document.querySelectorAll('[data-initiative-id]')) {
                const r = el.getBoundingClientRect();
                if (dup.clientX >= r.left && dup.clientX <= r.right && dup.clientY >= r.top && dup.clientY <= r.bottom) {
                  targetId = el.getAttribute('data-initiative-id');
                  if (targetId) break;
                }
              }
            }
            if (targetId && targetId !== mile.id) {
              onUpdateDependencies([...dependencies, {
                id: `dep-${Date.now()}`,
                sourceId: mile.id,
                sourceType: 'milestone',
                targetId,
                type: 'requires'
              }]);
            }
          };
          window.addEventListener('mousemove', handleDepMove);
          window.addEventListener('mouseup', handleDepUp);
        }
      } else if (Math.abs(deltaX) > 5 || (deltaY < 0 && Math.abs(deltaY) > 5)) {
        // Horizontal or upward drag: commit to milestone moving
        gestureDecided = true;
        window.removeEventListener('mousemove', handleGestureMove);
        window.removeEventListener('mouseup', handleGestureUp);
        setMovingMilestone({ id: mile.id, initialX, initialY, initialDate: mile.date });
      }
    };

    const handleGestureUp = () => {
      gestureDecided = true;
      window.removeEventListener('mousemove', handleGestureMove);
      window.removeEventListener('mouseup', handleGestureUp);
    };

    window.addEventListener('mousemove', handleGestureMove);
    window.addEventListener('mouseup', handleGestureUp);
  };


  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (resizing) {
        const deltaX = e.clientX - resizing.initialX;
        if (Math.abs(deltaX) > 3) {
          isDraggingRef.current = true;
        }
        const deltaDays = Math.round((deltaX / totalWidth) * totalDays);

        const initiative = localInitiatives.find(i => i.id === resizing.id);
        if (!initiative) return;

        const rawNewDate = addDays(parseISO(resizing.initialDate), deltaDays);
        let snappedDate = rawNewDate;
        if (settings.snapToPeriod === 'month') {
          snappedDate = resizing.edge === 'start' ? startOfMonth(rawNewDate) : lastDayOfMonth(rawNewDate);
        }
        const newDate = format(snappedDate, 'yyyy-MM-dd');

        const updatedInitiatives = localInitiatives.map(i => {
          if (i.id === resizing.id) {
            const updated = { ...i };
            if (resizing.edge === 'start') {
              if (newDate < i.endDate) updated.startDate = newDate;
            } else {
              if (newDate > i.startDate) updated.endDate = newDate;
            }
            return updated;
          }
          return i;
        });

        setLocalInitiatives(updatedInitiatives);
      } else if (moving) {
        const deltaX = e.clientX - moving.initialX;
        const deltaY = e.clientY - moving.initialY;

        // Mark as dragging if coordinates moved more than a few pixels
        if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
          isDraggingRef.current = true; // Assuming isDraggingRef is defined elsewhere
        }
        e.preventDefault();

        // If we moved vertically more than 30px, switch to drawing dependency
        if (settings.showRelationships !== 'off' && !drawingDependency && Math.abs(deltaY) > 30) {
          const sourcePos = initiativePositions.get(moving.id);
          if (sourcePos && containerRef.current) {
            const containerRect = containerRef.current.getBoundingClientRect();
            const startX = sourcePos.x + sourcePos.width / 2;
            const startY = sourcePos.y + sourcePos.height / 2;

            setDrawingDependency({
              sourceId: moving.id,
              sourceType: 'initiative',
              startX,
              startY,
              currentX: e.clientX - containerRect.left,
              currentY: e.clientY - containerRect.top
            });
            setMoving(null);
            return;
          }
        }

        // Only update dates if we moved horizontally more than 5px
        if (Math.abs(deltaX) > 5) {
          const deltaDays = Math.round((deltaX / totalWidth) * totalDays);
          const updatedInitiatives = localInitiatives.map(i => {
            if (i.id === moving.id) {
              const rawStart = addDays(parseISO(moving.initialStart), deltaDays);
              const snappedStart = settings.snapToPeriod === 'month' ? startOfMonth(rawStart) : rawStart;
              const actualDeltaDays = differenceInDays(snappedStart, parseISO(moving.initialStart));
              const rawEnd = addDays(parseISO(moving.initialEnd), actualDeltaDays);
              const snappedEnd = settings.snapToPeriod === 'month' ? lastDayOfMonth(rawEnd) : rawEnd;

              return {
                ...i,
                startDate: format(snappedStart, 'yyyy-MM-dd'),
                endDate: format(snappedEnd, 'yyyy-MM-dd'),
              };
            }
            return i;
          });
          setLocalInitiatives(updatedInitiatives);
        }
      } else if (movingMilestone) {
        const deltaY = e.clientY - movingMilestone.initialY;
        const deltaX = e.clientX - movingMilestone.initialX;
        // If dragging downward more than 10px and more than horizontal movement, switch to dependency drawing
        if (settings.showRelationships !== 'off' && deltaY > 10 && deltaY > Math.abs(deltaX)) {
          const milePos = milestonePositions.get(movingMilestone.id);
          if (milePos && containerRef.current) {
            const containerRect = containerRef.current.getBoundingClientRect();
            setDrawingDependency({
              sourceId: movingMilestone.id,
              sourceType: 'milestone',
              startX: milePos.x,
              startY: milePos.y,
              currentX: e.clientX - containerRect.left,
              currentY: e.clientY - containerRect.top,
            });
            setMovingMilestone(null);
            return;
          }
        }
        const deltaDays = Math.round((deltaX / totalWidth) * totalDays);
        const rawNewDate = addDays(parseISO(movingMilestone.initialDate), deltaDays);
        const snappedDate = settings.snapToPeriod === 'month' ? startOfMonth(rawNewDate) : rawNewDate;
        const newDate = format(snappedDate, 'yyyy-MM-dd');

        const updatedMilestones = localMilestones.map(m => {
          if (m.id === movingMilestone.id) {
            return { ...m, date: newDate };
          }
          return m;
        });
        setLocalMilestones(updatedMilestones);
      } else if (drawingDependency) {
        if (containerRef.current) {
          const containerRect = containerRef.current.getBoundingClientRect();
          setDrawingDependency({
            ...drawingDependency,
            currentX: e.clientX - containerRect.left,
            currentY: e.clientY - containerRect.top
          });
        }
      } else if (movingDependency) {
        const deltaX = e.clientX - movingDependency.initialX;
        if (Math.abs(deltaX) > 3) {
          isDraggingRef.current = true;
        }
        const newOffset = movingDependency.initialOffset + deltaX;

        if (onUpdateDependencies) {
          onUpdateDependencies(dependencies.map(d =>
            d.id === movingDependency.id ? { ...d, midXOffset: newOffset } : d
          ));
        }
      } else if (resizingSegmentVertical) {
        const deltaY = e.clientY - resizingSegmentVertical.initialY;
        if (Math.abs(deltaY) > 3) isDraggingRef.current = true;
        const deltaRows = Math.round(deltaY / SEG_ROW_UNIT);
        const newRowSpan = Math.max(1, resizingSegmentVertical.initialRowSpan + deltaRows);
        setLocalSegments(localSegments.map(s =>
          s.id === resizingSegmentVertical.id ? { ...s, rowSpan: newRowSpan } : s
        ));
      } else if (resizingSegment) {
        const deltaX = e.clientX - resizingSegment.initialX;
        if (Math.abs(deltaX) > 3) isDraggingRef.current = true;
        const deltaDays = Math.round((deltaX / totalWidth) * totalDays);
        const seg = localSegments.find(s => s.id === resizingSegment.id);
        if (!seg) return;
        const rawNewDate = addDays(parseISO(resizingSegment.initialDate), deltaDays);
        const snappedDate = settings.snapToPeriod === 'month'
          ? (resizingSegment.edge === 'start' ? startOfMonth(rawNewDate) : lastDayOfMonth(rawNewDate))
          : rawNewDate;
        const newDate = format(snappedDate, 'yyyy-MM-dd');
        setLocalSegments(localSegments.map(s => {
          if (s.id !== resizingSegment.id) return s;
          if (resizingSegment.edge === 'start') return newDate < s.endDate ? { ...s, startDate: newDate } : s;
          return newDate > s.startDate ? { ...s, endDate: newDate } : s;
        }));
      } else if (movingSegment) {
        const deltaX = e.clientX - movingSegment.initialX;
        const deltaY = e.clientY - movingSegment.initialY;
        if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) isDraggingRef.current = true;
        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 5) {
          // Vertical drag — move only the dragged segment; resolve conflicts on mouseup
          const deltaRows = Math.round(deltaY / SEG_ROW_UNIT);
          const newRow = Math.max(0, movingSegment.initialRow + deltaRows);
          setLocalSegments(localSegments.map(s => s.id === movingSegment.id ? { ...s, row: newRow } : s));
        } else if (Math.abs(deltaX) > 5) {
          // Horizontal drag — move dates
          const deltaDays = Math.round((deltaX / totalWidth) * totalDays);
          setLocalSegments(localSegments.map(s => {
            if (s.id !== movingSegment.id) return s;
            const rawStart = addDays(parseISO(movingSegment.initialStart), deltaDays);
            const snappedStart = settings.snapToPeriod === 'month' ? startOfMonth(rawStart) : rawStart;
            const actualDelta = differenceInDays(snappedStart, parseISO(movingSegment.initialStart));
            const rawEnd = addDays(parseISO(movingSegment.initialEnd), actualDelta);
            const snappedEnd = settings.snapToPeriod === 'month' ? lastDayOfMonth(rawEnd) : rawEnd;
            return { ...s, startDate: format(snappedStart, 'yyyy-MM-dd'), endDate: format(snappedEnd, 'yyyy-MM-dd') };
          }));
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (resizing && onUpdateInitiative) {
        const updated = localInitiatives.find(i => i.id === resizing.id);
        if (updated) onUpdateInitiative(updated);
      } else if (moving && onUpdateInitiative) {
        const updated = localInitiatives.find(i => i.id === moving.id);
        if (updated) onUpdateInitiative(updated);
      } else if (movingMilestone && onUpdateMilestone) {
        const updated = localMilestones.find(m => m.id === movingMilestone.id);
        if (updated) onUpdateMilestone(updated);
      } else if (movingDependency && onUpdateDependencies) {
        const updated = dependencies.find(d => d.id === movingDependency.id);
        if (updated) onUpdateDependencies([...dependencies]); // Trigger save
      } else if (drawingDependency && onUpdateDependencies && !milestoneDepDirectRef.current && !segmentDepDirectRef.current) {
        // Only handle here if no direct listeners are already handling it
        // Find if we released over an initiative or segment
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        let targetId: string | null = null;
        let targetType: 'initiative' | 'segment' = 'initiative';
        for (const el of elements) {
          const initId = el.getAttribute('data-initiative-id') ?? el.closest('[data-initiative-id]')?.getAttribute('data-initiative-id');
          if (initId) { targetId = initId; targetType = 'initiative'; break; }
          // Also check for segment targets (only when source is not a segment)
          if (drawingDependency.sourceType !== 'segment') {
            const segId = el.getAttribute('data-segment-id') ?? el.closest('[data-segment-id]')?.getAttribute('data-segment-id');
            if (segId) { targetId = segId; targetType = 'segment'; break; }
          }
        }
        // Fallback: scan by bounding rect
        if (!targetId) {
          for (const el of document.querySelectorAll('[data-initiative-id]')) {
            const r = el.getBoundingClientRect();
            if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
              targetId = el.getAttribute('data-initiative-id');
              if (targetId) { targetType = 'initiative'; break; }
            }
          }
        }
        if (!targetId && drawingDependency.sourceType !== 'segment') {
          for (const el of document.querySelectorAll('[data-segment-id]')) {
            const r = el.getBoundingClientRect();
            if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
              targetId = el.getAttribute('data-segment-id');
              if (targetId) { targetType = 'segment'; break; }
            }
          }
        }

        if (targetId && targetId !== drawingDependency.sourceId) {
          const newDependency: Dependency = {
            id: `dep-${Date.now()}`,
            sourceId: drawingDependency.sourceId,
            sourceType: drawingDependency.sourceType,
            targetId: targetId,
            targetType: targetType === 'segment' ? 'segment' : undefined,
            type: 'requires'
          };
          onUpdateDependencies([...dependencies, newDependency]);
        }
      }
      if (resizingSegmentVertical && onSaveApplicationSegment) {
        const updated = localSegments.find(s => s.id === resizingSegmentVertical.id);
        if (updated) onSaveApplicationSegment(updated);
      } else if (resizingSegment && onSaveApplicationSegment) {
        const updated = localSegments.find(s => s.id === resizingSegment.id);
        if (updated) onSaveApplicationSegment(updated);
      } else if (movingSegment) {
        // Only save/resolve if an actual drag occurred — a bare click must not trigger conflict resolution
        if (isDraggingRef.current) {
          const updated = localSegments.find(s => s.id === movingSegment.id);
          if (updated) {
            // Assign a persistent row to the moved segment so conflict resolution anchors it
            const movedWithRow = { ...updated, row: updated.row ?? 0 };
            const segmentsWithRow = localSegments.map(s => s.id === movingSegment.id ? movedWithRow : s);
            const resolved = resolveSegmentConflicts(movingSegment.id, segmentsWithRow);
            const changed = resolved.filter((s, i) => s.row !== segmentsWithRow[i]?.row || s.id === movingSegment.id);
            if (changed.length > 1 && onUpdateApplicationSegments) {
              setLocalSegments(resolved);
              onUpdateApplicationSegments(resolved);
            } else if (onSaveApplicationSegment) {
              onSaveApplicationSegment(updated);
            }
          }
        }
      }
      setResizing(null);
      setMoving(null);
      setMovingMilestone(null);
      setMovingDependency(null);
      setDrawingDependency(null);
      setDraggingCategory(null);
      setResizingSegment(null);
      setResizingSegmentVertical(null);
      setMovingSegment(null);
    };

    if (resizing || moving || movingMilestone || drawingDependency || movingDependency || resizingSegment || resizingSegmentVertical || movingSegment) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing, moving, movingMilestone, drawingDependency, movingDependency, resizingSegment, resizingSegmentVertical, movingSegment, localInitiatives, localMilestones, localSegments, totalWidth, totalDays, onUpdateInitiative, onUpdateDependencies, onUpdateMilestone, onSaveApplicationSegment, onUpdateApplicationSegments, dependencies, initiativePositions, milestonePositions, segmentPositions, settings.showRelationships, settings.snapToPeriod]);

  const handleCategoryDragStart = (e: React.DragEvent, category: string) => {
    setDraggingCategory(category);
    e.dataTransfer.setData('text/plain', category);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleCategoryDragOver = (e: React.DragEvent, category: string) => {
    e.preventDefault();
    if (draggingCategory && draggingCategory !== category) {
      const newOrder = [...categoryOrder];
      const oldIndex = newOrder.indexOf(draggingCategory);
      const newIndex = newOrder.indexOf(category);
      if (oldIndex !== -1 && newIndex !== -1) {
        newOrder.splice(oldIndex, 1);
        newOrder.splice(newIndex, 0, draggingCategory);
        setCategoryOrder(newOrder);
      }
    }
  };

  const handleCategoryDragEnd = () => {
    setDraggingCategory(null);
  };


  const layoutAsset = (assetInitiatives: Initiative[]) => {
    const groups = getGroupsForAsset(assetInitiatives);
    const collapsedGroups = groups.filter(g => settings.collapsedGroups?.includes(g.sort().join('|')));
    const collapsedGroupIds = new Set(collapsedGroups.flat());

    const entities: any[] = [];
    
    // Collapsed groups become a single layout entity
    collapsedGroups.forEach(group => {
      const gInits = assetInitiatives.filter(i => group.includes(i.id));
      const groupId = group.sort().join('|');
      
      const minStart = gInits.reduce((m, i) => i.startDate < m ? i.startDate : m, gInits[0].startDate);
      const maxEnd = gInits.reduce((m, i) => i.endDate > m ? i.endDate : m, gInits[0].endDate);
      const totalCapex = gInits.reduce((sum, i) => sum + (i.capex || 0), 0);
      const totalOpex = gInits.reduce((sum, i) => sum + (i.opex || 0), 0);
      const groupDescription = [...gInits].sort((a, b) => (a.startDate || '').localeCompare(b.startDate || '')).map(i => i.name).filter(Boolean).map(n => `• ${n}`).join('\n');

      const groupProgrammeIds = Array.from(new Set(gInits.map(i => i.programmeId)));
      const groupProgrammeNames = groupProgrammeIds
        .map(id => programmes.find(p => p.id === id)?.name)
        .filter(Boolean)
        .sort()
        .join(' + ');

      const groupStrategyIds = Array.from(new Set(gInits.map(i => i.strategyId).filter(Boolean)));
      const groupStrategyNames = groupStrategyIds
        .map(id => strategies.find(s => s.id === id)?.name)
        .filter(Boolean)
        .sort()
        .join(' + ');

      entities.push({
        init: {
          ...gInits[0],
          id: groupId,
          name: `${group.length} Connected Initiatives`,
          capex: totalCapex,
          opex: totalOpex,
          description: groupDescription,
          startDate: minStart,
          endDate: maxEnd
        },
        isGroup: true,
        groupIds: group,
        groupProgrammeNames,
        groupStrategyNames
      });
    });

    // Individual initiatives not in collapsed groups
    assetInitiatives.forEach(init => {
      if (!collapsedGroupIds.has(init.id)) {
        entities.push({ init });
      }
    });

    const sorted = entities.sort((a, b) => (a.init.startDate || '').localeCompare(b.init.startDate || ''));
    const finalItems: any[] = [];
    const placedRects: any[] = [];

    const assetInitiativeIds = new Set(assetInitiatives.map(i => i.id));
    const intraAssetDependencies = new Set<string>();
    dependencies.forEach(dep => {
      if (!assetInitiativeIds.has(dep.sourceId) || !assetInitiativeIds.has(dep.targetId)) return;
      const pairKey = dep.sourceId < dep.targetId
        ? `${dep.sourceId}|${dep.targetId}`
        : `${dep.targetId}|${dep.sourceId}`;
      intraAssetDependencies.add(pairKey);
    });

    const hasIntraAssetDependencies = intraAssetDependencies.size > 0;
    const dynamicGap = hasIntraAssetDependencies ? 32 : BAR_GAP;

    sorted.forEach(entity => {
      const { init, isGroup, groupIds, groupProgrammeNames, groupStrategyNames } = entity;
      const left = getPosition(init.startDate);
      const width = getWidth(init.startDate, init.endDate);
      const right = left + width;

      let budgetHeight = BAR_HEIGHT;
      const totalBudget = (init.capex || 0) + (init.opex || 0);
      if (settings.budgetVisualisation === 'bar-height' && totalBudget) {
        budgetHeight = Math.min(120, BAR_HEIGHT + (totalBudget / 15000));
      }

      let descHeight = BAR_HEIGHT;
      if (settings.descriptionDisplay === 'on' && init.description) {
        const subtitle = isGroup ? (groupProgrammeNames || groupStrategyNames) : (init.programmeId || init.strategyId);
        const baseHeight = subtitle ? 48 : 32;
        const charsPerLine = Math.max(20, Math.floor(width * 4));
        const lines = Math.ceil(init.description.length / charsPerLine);
        const clampedLines = isGroup ? lines : Math.min(3, lines);
        descHeight = Math.max(BAR_HEIGHT, baseHeight + clampedLines * 12 + 9);
      }

      const height = Math.max(budgetHeight, descHeight, BAR_HEIGHT);

      let top = ROW_PADDING;
      const candidateTops = [ROW_PADDING];
      placedRects.forEach(r => candidateTops.push(r.bottom + dynamicGap));
      candidateTops.sort((a, b) => a - b);

      for (const candidateTop of candidateTops) {
        const candidateBottom = candidateTop + height;
        let overlaps = false;
        for (const rect of placedRects) {
          const entityIds = isGroup ? groupIds : [init.id];
          const targetIds = rect.isGroup ? rect.groupIds : [rect.id];
          
          const hasDep = entityIds.some(entityId =>
            targetIds.some(targetId => {
              const pairKey = entityId < targetId
                ? `${entityId}|${targetId}`
                : `${targetId}|${entityId}`;
              return intraAssetDependencies.has(pairKey);
            })
          );

          const xOverlap = hasDep || !(rect.end <= left || rect.start >= right);
          const yOverlap = !(rect.bottom <= candidateTop || rect.top >= candidateBottom);
          if (xOverlap && yOverlap) {
            overlaps = true;
            break;
          }
        }
        if (!overlaps) {
          top = candidateTop;
          break;
        }
      }

      finalItems.push({ init, top, height, left, width, isGroup, groupIds, groupProgrammeNames, groupStrategyNames });
      placedRects.push({ id: init.id, isGroup, groupIds, start: left, end: right, top, bottom: top + height });
    });

    let contentHeight = MIN_ROW_HEIGHT;
    if (finalItems.length > 0) {
      const maxBottom = finalItems.reduce((max, i) => Math.max(max, i.top + i.height), 0);
      contentHeight = Math.max(MIN_ROW_HEIGHT, maxBottom + ROW_PADDING);
      
      const contentTop = Math.min(...finalItems.map(i => i.top));
      const contentBottom = Math.max(...finalItems.map(i => i.top + i.height));
      const contentSpan = contentBottom - contentTop;
      const offset = (contentHeight - contentSpan) / 2 - contentTop;
      finalItems.forEach(item => { item.top += offset; });
    }

    return { items: finalItems, height: contentHeight };
  };

  // Closures delegating to pure functions in ../lib/timelineLayout
  const layoutSegments = (segments: ApplicationSegment[]) =>
    tlLayoutSegments(segments, startDate, totalDays);
  const computeAutoRow = (newStart: string, newEnd: string, existingSegments: ApplicationSegment[]) =>
    tlComputeAutoRow(newStart, newEnd, existingSegments, startDate, totalDays);

  // Move a segment up or down one row, cascading conflicts if needed
  const handleSegmentDepMouseDown = (e: React.MouseEvent, segId: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!onUpdateDependencies || settings.showRelationships === 'off') return;
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    // Try cached position first; fall back to the DOM element's own position
    const segPos = segmentPositions.get(segId);
    const segEl = containerRef.current.querySelector(`[data-segment-id="${segId}"]`);
    let startX: number, startY: number;
    if (segPos) {
      startX = segPos.x + segPos.width / 2;
      startY = segPos.y + segPos.height / 2;
    } else if (segEl) {
      const r = segEl.getBoundingClientRect();
      startX = r.left + r.width / 2 - containerRect.left;
      startY = r.top + r.height / 2 - containerRect.top;
    } else {
      startX = e.clientX - containerRect.left;
      startY = e.clientY - containerRect.top;
    }
    setDrawingDependency({
      sourceId: segId,
      sourceType: 'segment',
      startX,
      startY,
      currentX: e.clientX - containerRect.left,
      currentY: e.clientY - containerRect.top,
    });
    segmentDepDirectRef.current = true;
    const handleDepMove = (dmv: MouseEvent) => {
      if (!containerRef.current) return;
      const cr = containerRef.current.getBoundingClientRect();
      setDrawingDependency(prev => prev ? { ...prev, currentX: dmv.clientX - cr.left, currentY: dmv.clientY - cr.top } : null);
    };
    const handleDepUp = (dup: MouseEvent) => {
      window.removeEventListener('mousemove', handleDepMove);
      window.removeEventListener('mouseup', handleDepUp);
      segmentDepDirectRef.current = false;
      setDrawingDependency(null);
      if (!onUpdateDependencies) return;
      // Segments can only link to initiatives (not to other segments)
      let targetId: string | null = null;
      const els = document.elementsFromPoint(dup.clientX, dup.clientY);
      for (const el of els) {
        const id = el.getAttribute('data-initiative-id') ?? el.closest('[data-initiative-id]')?.getAttribute('data-initiative-id');
        if (id) { targetId = id; break; }
      }
      if (!targetId) {
        for (const el of document.querySelectorAll('[data-initiative-id]')) {
          const r = el.getBoundingClientRect();
          if (dup.clientX >= r.left && dup.clientX <= r.right && dup.clientY >= r.top && dup.clientY <= r.bottom) {
            targetId = el.getAttribute('data-initiative-id');
            if (targetId) break;
          }
        }
      }
      if (targetId && targetId !== segId) {
        onUpdateDependencies([...dependencies, {
          id: `dep-${Date.now()}`,
          sourceId: segId,
          sourceType: 'segment',
          targetId,
          type: 'requires',
        }]);
      }
    };
    window.addEventListener('mousemove', handleDepMove);
    window.addEventListener('mouseup', handleDepUp);
  };

  const handleSegmentRowMove = (segId: string, delta: number) => {
    const seg = localSegments.find(s => s.id === segId);
    if (!seg) return;
    const newRow = Math.max(0, (seg.row ?? 0) + delta);
    if (newRow === (seg.row ?? 0)) return;
    const updated = localSegments.map(s => s.id === segId ? { ...s, row: newRow } : s);
    const resolved = resolveSegmentConflicts(segId, updated);
    setLocalSegments(resolved);
    const hasConflicts = resolved.some(s => {
      const orig = updated.find(u => u.id === s.id);
      return orig && s.row !== orig.row && s.id !== segId;
    });
    if (hasConflicts && onUpdateApplicationSegments) {
      onUpdateApplicationSegments(resolved);
    } else if (onSaveApplicationSegment) {
      const movedSeg = resolved.find(s => s.id === segId);
      if (movedSeg) onSaveApplicationSegment(movedSeg);
    }
  };

  // Closure to bind `dependencies` for getGroupsForAsset (imported pure fn)
  const getGroupsForAsset = (assetInitiatives: Initiative[]) =>
    tlGetGroupsForAsset(assetInitiatives, dependencies);


  const getAssetLayout = (asset: Asset, assetInitiatives: Initiative[]) => {
    const isOperating = !!resizing || !!moving;

    if (isOperating && lastStableLayouts.current.has(asset.id)) {
      const stable = lastStableLayouts.current.get(asset.id)!;
      return {
        ...stable,
        items: stable.items.map(item => {
          const currentInit = localInitiatives.find(li => li.id === item.init.id);
          if (currentInit) {
            return {
              ...item,
              init: currentInit,
              left: getPosition(currentInit.startDate),
              width: getWidth(currentInit.startDate, currentInit.endDate)
            };
          }
          return item;
        })
      };
    }

    const layout = layoutAsset(assetInitiatives);
    if (!isOperating) {
      lastStableLayouts.current.set(asset.id, layout);
    }
    return layout;
  };

  // Keep track of initiative positions for dependency drawing
  // Keep track of initiative positions for dependency drawing by reading the actual DOM rects.
  // This completely eliminates drift caused by borders, margins, or dynamic rendering.
  useEffect(() => {
    if (!containerRef.current) return;

    // We need to wait for the DOM to paint so we can read rects.
    // A small timeout ensures the React render loop has painted the DOM nodes before we measure.
    const timer = setTimeout(() => {
      if (!containerRef.current) return;
      const positions = new Map<string, { x: number; y: number; width: number; height: number; assetId?: string }>();
      const containerRect = containerRef.current.getBoundingClientRect();

      // Find every initiative block drawn in the DOM
      const elements = containerRef.current.querySelectorAll('[data-initiative-id]');

      elements.forEach((el) => {
        const initId = el.getAttribute('data-initiative-id');
        if (initId) {
          const rect = el.getBoundingClientRect();
          positions.set(initId, {
            // Calculate the true offset inside the relative container
            x: rect.left - containerRect.left,
            y: rect.top - containerRect.top,
            width: rect.width,
            height: rect.height,
          });
        }
      });

      setInitiativePositions(positions);

      // Also track milestone positions
      const milePositions = new Map<string, { x: number; y: number }>();
      const mileElements = containerRef.current.querySelectorAll('[data-milestone-id]');
      mileElements.forEach((el) => {
        const mileId = el.getAttribute('data-milestone-id');
        if (mileId) {
          const rect = el.getBoundingClientRect();
          milePositions.set(mileId, {
            x: rect.left - containerRect.left + rect.width / 2,
            y: rect.top - containerRect.top + rect.height / 2,
          });
        }
      });
      setMilestonePositions(milePositions);

      // Also track segment positions
      const segPositions = new Map<string, { x: number; y: number; width: number; height: number }>();
      const segElements = containerRef.current.querySelectorAll('[data-segment-id]');
      segElements.forEach((el) => {
        const segId = el.getAttribute('data-segment-id');
        if (segId) {
          const rect = el.getBoundingClientRect();
          segPositions.set(segId, {
            x: rect.left - containerRect.left,
            y: rect.top - containerRect.top,
            width: rect.width,
            height: rect.height,
          });
        }
      });
      setSegmentPositions(segPositions);
    }, 50);

    return () => clearTimeout(timer);
  }, [localInitiatives, localSegments, assets, totalWidth, sortedCategoryIds, assetsByCategory, settings, collapsedCategories, dependencies]);

  const formatOverlapDuration = (days: number) => {
    if (settings.monthsToShow <= 3) {
      const weeks = Math.max(1, Math.round(days / 7));
      return `${weeks} Week${weeks !== 1 ? 's' : ''}`;
    } else if (settings.monthsToShow === 6) {
      const halfMonths = Math.max(1, Math.round(days / 15.2));
      return `${halfMonths} Half-month${halfMonths !== 1 ? 's' : ''}`;
    } else if (settings.monthsToShow <= 12) {
      const months = Math.max(1, Math.round(days / 30.4));
      return `${months} Month${months !== 1 ? 's' : ''}`;
    } else {
      const quarters = Math.max(1, Math.round(days / 91));
      return `${quarters} Quarter${quarters !== 1 ? 's' : ''}`;
    }
  };

  const getConflictPoints = (assetId: string) => {
    if (settings.conflictDetection === 'off') return [];
    const assetInitiatives = localInitiatives.filter(i => i.assetId === assetId);
    const conflictsMap = new Map<string, number>();

    for (let i = 0; i < assetInitiatives.length; i++) {
      for (let j = i + 1; j < assetInitiatives.length; j++) {
        const a = assetInitiatives[i];
        const b = assetInitiatives[j];
        if (a.startDate < b.endDate && a.endDate > b.startDate) {
          const conflictStart = a.startDate > b.startDate ? a.startDate : b.startDate;
          const conflictEnd = a.endDate < b.endDate ? a.endDate : b.endDate;

          const start = new Date(conflictStart).getTime();
          const end = new Date(conflictEnd).getTime();
          const overlapDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));

          const existingOverlap = conflictsMap.get(conflictStart) || 0;
          if (overlapDays > existingOverlap) {
            conflictsMap.set(conflictStart, overlapDays);
          }
        }
      }
    }
    return Array.from(conflictsMap.entries()).map(([date, overlapDays]) => ({ date, overlapDays }));
  };

  const now = new Date();
  const currentPos = getPosition(now.toISOString());
  const isCurrentTimeVisible = currentPos >= 0 && currentPos <= 100;
  const groupBy = settings.groupBy || 'asset';
  const display = settings.display || 'both';
  const hasDtsAssets = assets.some(a => typeof a.alias === 'string' && a.alias.startsWith('DTS.'));

  const DTS_PHASE_GROUPS = dtsPhases.length > 0
    ? dtsPhases.map(p => ({ id: p.id, name: p.name }))
    : [
        { id: 'phase-1', name: 'Phase 1 — Register & Expose' },
        { id: 'phase-2', name: 'Phase 2 — Integrate DPI' },
        { id: 'phase-3', name: 'Phase 3 — AI & Legacy Exit' },
        { id: 'back-office', name: 'Back-Office Consolidation' },
        { id: 'not-dts', name: 'Not DTS' },
      ];

  const groupedReferenceIds = new Set((groupBy === 'programme' ? programmes : strategies).map(group => group.id));
  const orphanedSwimlaneInitiatives = (groupBy === 'programme' || groupBy === 'strategy')
    ? localInitiatives.filter(i => {
        if (i.isPlaceholder) return false;
        const groupId = groupBy === 'programme' ? i.programmeId : i.strategyId;
        return !groupId || !groupedReferenceIds.has(groupId);
      })
    : [];

  if (timeColumns.length === 0) return null;

  return (
    <div id="timeline-visualiser" ref={timelineRef} className="flex flex-col h-full bg-slate-50 border border-slate-200 rounded-xl shadow-sm overflow-hidden relative"
      onClick={() => { setSelectedInitiativeId(null); setInitiativePanelId(null); setSelectedSegmentId(null); setSegmentPanelId(null); }}
    >

      {settings.clusterName && (
        <div className="px-4 py-1.5 bg-slate-100 border-b border-slate-200 text-xs text-slate-500 font-medium">
          <span data-testid="timeline-cluster-name">{settings.clusterName}</span>
        </div>
      )}

      <div className="flex-1 overflow-auto scroll-smooth" ref={scrollContainerRef}>
        <div className="relative w-max min-w-full">
          <div className="flex sticky top-0 z-40 bg-white shadow-sm border-b border-slate-200">
            <div className="sticky left-0 flex-shrink-0 p-4 font-bold text-slate-700 border-r border-slate-200 bg-slate-50 z-50 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]" style={{ width: SIDEBAR_WIDTH }}>
              {groupBy === 'programme' ? 'Programme' : groupBy === 'strategy' ? 'Strategy' : groupBy === 'dts-phase' ? 'DTS Phase' : 'Asset'}
            </div>
            <div className="flex" style={{ width: totalWidth }}>
              {timeColumns.map((col, idx) => (
                <div
                  key={idx}
                  data-testid={`timeline-col-${idx}`}
                  className={cn(
                    "flex-shrink-0 border-r border-slate-100 p-2 text-center text-sm font-medium text-slate-600 bg-white flex flex-col justify-center",
                    idx === 0 && "border-l-2 border-l-slate-300"
                  )}
                  style={{ width: columnWidth }}
                >
                  <div className="text-xs text-slate-400 uppercase tracking-wider">{col.label}</div>
                  <div>{col.sublabel}</div>
                </div>
              ))}
            </div>
          </div>

          {isCurrentTimeVisible && (
            <div
              data-testid="today-indicator"
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
              style={{ left: `${SIDEBAR_WIDTH + (currentPos / 100) * totalWidth}px` }}
            >
              <div className="absolute top-8 -translate-x-1/2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap">Today</div>
            </div>
          )}

          <div className="flex flex-col relative" ref={containerRef}>
            <svg
              data-testid="dependencies-svg"
              className="absolute inset-0 z-[25]"
              style={{ width: totalWidth + SIDEBAR_WIDTH, height: '100%', pointerEvents: 'none' }}
            >
              <defs>
                <marker id="arrowhead-red" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
                </marker>
                <marker id="arrowhead-blue" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
                </marker>
              </defs>
              {/* eslint-disable-next-line react-hooks/refs */}
              {settings.showRelationships !== 'off' && (() => {
                // Helper to look up position for any entity (initiative or segment)
                const getEntityPos = (id: string, type?: 'initiative' | 'milestone' | 'segment') => {
                  if (type === 'segment') return segmentPositions.get(id);
                  if (type === 'milestone') {
                    const mPos = milestonePositions.get(id);
                    return mPos ? { x: mPos.x, y: mPos.y, width: 0, height: 0 } : undefined;
                  }
                  return initiativePositions.get(id) ?? segmentPositions.get(id);
                };
                // Auto-stagger: group deps that share the same routing corridor
                const corridorGroups = new Map<string, string[]>();
                for (const dep of dependencies) {
                  const source = getEntityPos(dep.sourceId, dep.sourceType);
                  const target = getEntityPos(dep.targetId, dep.targetType);
                  if (!source || !target) continue;
                  const sEndX = source.x + source.width;
                  const tStartX = target.x;
                  const gap = tStartX - sEndX;
                  if (gap >= 20) {
                    const key = `${Math.round(sEndX / 4) * 4}_${Math.round(tStartX / 4) * 4}`;
                    if (!corridorGroups.has(key)) corridorGroups.set(key, []);
                    corridorGroups.get(key)!.push(dep.id);
                  }
                }
                const STAGGER_STEP = 16;
                const autoOffsets = new Map<string, number>();
                for (const depIds of corridorGroups.values()) {
                  if (depIds.length <= 1) continue;
                  depIds.forEach((id, i) => {
                    autoOffsets.set(id, (i - (depIds.length - 1) / 2) * STAGGER_STEP);
                  });
                }

                return dependencies.map(dep => {
                const isMilestoneSource = dep.sourceType === 'milestone';
                const source = getEntityPos(dep.sourceId, dep.sourceType);
                const target = getEntityPos(dep.targetId, dep.targetType);
                if (!source || !target) return null;

                // Determine if same asset
                const _sourceAssetId = isMilestoneSource ? undefined : initiativeAssetIdMap.get(dep.sourceId);
                const _targetAssetId = initiativeAssetIdMap.get(dep.targetId);

                const sStartX = source.x;
                const sEndX = source.x + source.width;
                const tStartX = target.x;
                const tEndX = target.x + target.width;
                const sMidY = source.y + source.height / 2;
                const tMidY = target.y + target.height / 2;
                const sBottom = source.y + source.height;
                const tBottom = target.y + target.height;

                let path: string;
                let labelX: number, labelY: number;

                const gap = tStartX - sEndX;
                const overlapLeft = Math.max(sStartX, tStartX);
                const overlapRight = Math.min(sEndX, tEndX);
                const overlapWidth = overlapRight - overlapLeft;

                if (gap >= 20) {
                  // State 1: Clear Horizontal Flow (exits right, enters left)
                  const midX = (sEndX + gap / 2) + (dep.midXOffset || 0) + (autoOffsets.get(dep.id) || 0);
                  path = `M ${sEndX} ${sMidY} L ${midX} ${sMidY} L ${midX} ${tMidY} L ${tStartX - 6} ${tMidY}`;
                  labelX = midX + 30; // Offset to the right of the vertical segment
                  labelY = (sMidY + tMidY) / 2;
                } else if (tEndX <= sStartX + 20) {
                  // State 2: Backwards Flow (exits left, enters right)
                  const midX = (tEndX + (sStartX - tEndX) / 2) + (dep.midXOffset || 0);
                  path = `M ${sStartX} ${sMidY} L ${midX} ${sMidY} L ${midX} ${tMidY} L ${tEndX + 6} ${tMidY}`;
                  labelX = midX - 30; // Offset to the left of the vertical segment
                  labelY = (sMidY + tMidY) / 2;
                } else if (overlapWidth > 40) {
                  // State 3: Significant Overlap (exits bottom/top, enters top/bottom)
                  const midX = (overlapLeft + overlapWidth / 2) + (dep.midXOffset || 0);
                  if (sMidY < tMidY) {
                    path = `M ${midX} ${sBottom} L ${midX} ${target.y - 6}`;
                    labelX = midX + 30; // Offset to the right
                    labelY = (sBottom + target.y) / 2;
                  } else {
                    path = `M ${midX} ${source.y} L ${midX} ${tBottom + 6}`;
                    labelX = midX + 30; // Offset to the right
                    labelY = (source.y + tBottom) / 2;
                  }
                } else {
                  // State 4: Adjacent Proximity (Cramped Horizontal Gap)
                  // Exit source right, drop down/up into the top/bottom of target.
                  let baseDropX = tStartX + 30;
                  if (baseDropX > tEndX - 10) baseDropX = tEndX - 10;
                  const dropX = baseDropX + (dep.midXOffset || 0);

                  if (sMidY < tMidY) {
                    path = `M ${sEndX} ${sMidY} L ${dropX} ${sMidY} L ${dropX} ${target.y - 6}`;
                    labelX = dropX + 30; // Offset to the right
                    labelY = (sMidY + target.y) / 2;
                  } else {
                    path = `M ${sEndX} ${sMidY} L ${dropX} ${sMidY} L ${dropX} ${tBottom + 6}`;
                    labelX = dropX + 30; // Offset to the right
                    labelY = (sMidY + tBottom) / 2;
                  }
                }

                // Store path segments for SVG-level hit-testing
                const parseSegments = (d: string): number[][] => {
                  const pts = d.replace(/[ML]/g, '').trim().split(/\s+L\s*|\s{2,}/).map(s => s.trim().split(/\s+/).map(Number));
                  const segs: number[][] = [];
                  for (let i = 0; i < pts.length - 1; i++) {
                    if (pts[i].length >= 2 && pts[i+1].length >= 2) segs.push([pts[i][0], pts[i][1], pts[i+1][0], pts[i+1][1]]);
                  }
                  return segs;
                };
                depSegmentsRef.current.set(dep.id, parseSegments(path));

                const handleDependencyMouseDown = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  isDraggingRef.current = false;
                  setMovingDependency({
                    id: dep.id,
                    initialX: e.clientX,
                    initialOffset: dep.midXOffset || 0
                  });
                };

                const isDepOnCriticalPath = criticalPathDepIds.has(dep.id);
                const depColor = dep.type === 'blocks' ? '#ef4444' : dep.type === 'requires' ? '#3b82f6' : '#475569';
                const depLabelBorder = dep.type === 'blocks' ? '#fecaca' : dep.type === 'requires' ? '#bfdbfe' : '#cbd5e1';
                const depMarker = dep.type === 'blocks' ? 'url(#arrowhead-red)' : dep.type === 'requires' ? 'url(#arrowhead-blue)' : undefined;

                const handleDependencyClick = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  if (isDraggingRef.current) { isDraggingRef.current = false; return; }
                  if (disambiguateAt) { setDisambiguateAt(null); return; }
                  const svgEl = (e.currentTarget as SVGGElement).ownerSVGElement;
                  if (!svgEl) { setSelectedDependencyId(dep.id); return; }
                  const rect = svgEl.getBoundingClientRect();
                  const px = e.clientX - rect.left;
                  const py = e.clientY - rect.top;
                  const THRESHOLD = 8;
                  const distToSegment = (x1: number, y1: number, x2: number, y2: number) => {
                    const dx = x2 - x1, dy = y2 - y1;
                    const len2 = dx * dx + dy * dy;
                    if (len2 === 0) return Math.hypot(px - x1, py - y1);
                    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
                    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
                  };
                  const nearby = dependencies.filter(d => {
                    const segs = depSegmentsRef.current.get(d.id);
                    return segs?.some(([x1, y1, x2, y2]) => distToSegment(x1, y1, x2, y2) < THRESHOLD);
                  });
                  if (nearby.length > 1) {
                    setDisambiguateAt({ x: e.clientX, y: e.clientY, candidates: nearby });
                  } else {
                    setSelectedDependencyId(dep.id);
                  }
                };

                return (
                  <g key={dep.id} data-dep-id={dep.id} onMouseDown={handleDependencyMouseDown} onClick={handleDependencyClick} className="cursor-pointer group" style={{ pointerEvents: 'all' }}>
                    {isMilestoneSource && (
                      <circle
                        data-testid="milestone-dep-source"
                        cx={source.x}
                        cy={source.y}
                        r="5"
                        fill={depColor}
                        opacity="0.8"
                      />
                    )}
                    <path
                      d={path}
                      stroke="transparent"
                      strokeWidth="16"
                      fill="none"
                    />
                    <path
                      d={path}
                      stroke={isDepOnCriticalPath ? '#f59e0b' : depColor}
                      strokeWidth={isDepOnCriticalPath ? "3.5" : "2"}
                      fill="none"
                      markerEnd={depMarker}
                      opacity={isDepOnCriticalPath ? "1" : "0.8"}
                      strokeDasharray={dep.type === 'related' ? "4 2" : "none"}
                    />
                    <rect
                      data-testid="dep-label-rect"
                      x={labelX - 25}
                      y={labelY - 9}
                      width="50"
                      height="18"
                      fill="#ffffff"
                      rx="9"
                      opacity="0.9"
                      stroke={depLabelBorder}
                      strokeWidth="1"
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        const src = isMilestoneSource
                          ? (milestones.find(m => m.id === dep.sourceId)?.name ?? 'Milestone')
                          : (initiatives.find(i => i.id === dep.sourceId)?.name ?? 'Unknown');
                        const tgt = initiatives.find(i => i.id === dep.targetId)?.name ?? 'Unknown';
                        const text = dep.type === 'blocks'
                          ? `${src} must finish before ${tgt} can start.`
                          : dep.type === 'requires'
                          ? `${src} requires ${tgt} to start first.`
                          : `${src} and ${tgt} are related.`;
                        setLabelTooltip({ x: e.clientX, y: e.clientY - 48, text });
                        clearTimeout(labelTooltipTimerRef.current);
                        labelTooltipTimerRef.current = setTimeout(() => setLabelTooltip(null), 3000);
                      }}
                    />
                    <text
                      x={labelX}
                      y={labelY}
                      fill={depColor}
                      fontSize="9"
                      fontWeight="bold"
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="select-none pointer-events-none"
                    >
                      {dep.type}
                    </text>
                  </g>
                );
              });
              })()}

              {/* Live drawing arrow */}
              {settings.showRelationships !== 'off' && drawingDependency && (
                <path
                  d={`M ${drawingDependency.startX} ${drawingDependency.startY} L ${drawingDependency.currentX} ${drawingDependency.currentY} `}
                  stroke="#3b82f6"
                  strokeWidth="3"
                  fill="none"
                  markerEnd="url(#arrowhead)"
                  opacity="0.8"
                  strokeDasharray="5 5"
                  style={{ pointerEvents: 'none' }}
                />
              )}
            </svg>

            {disambiguateAt && (
              <ArrowDisambiguator
                x={disambiguateAt.x}
                y={disambiguateAt.y}
                candidates={disambiguateAt.candidates}
                initiatives={initiatives}
                onSelect={(id) => { setDisambiguateAt(null); setSelectedDependencyId(id); }}
                onClose={() => setDisambiguateAt(null)}
              />
            )}

            {labelTooltip && (
              <div
                data-testid="arrow-label-tooltip"
                className="fixed z-[160] bg-white rounded-xl shadow-2xl border border-slate-200 px-3 py-2 max-w-xs text-xs text-slate-700 leading-snug cursor-pointer"
                style={{ left: Math.min(labelTooltip.x, window.innerWidth - 320), top: labelTooltip.y }}
                onClick={() => { clearTimeout(labelTooltipTimerRef.current); setLabelTooltip(null); }}
              >
                {labelTooltip.text}
              </div>
            )}

            {/* Swimlane view: group by Programme or Strategy */}
            {(groupBy === 'programme' || groupBy === 'strategy') && (groupBy === 'programme' ? programmes : strategies).map(group => {
              const groupInits = localInitiatives.filter(i =>
                (groupBy === 'programme' ? i.programmeId === group.id : i.strategyId === group.id) && !i.isPlaceholder
              );
              if (groupInits.length === 0) return null;
              const { items: swimlaneItems, height: swimlaneHeight } = layoutAsset(groupInits);
              return (
                <div key={group.id} data-testid={`swimlane-row-${groupBy}-${group.id}`}>
                  {/* Group header */}
                  <div className="flex z-30 bg-slate-100 border-y border-slate-200 w-max">
                    <div className="sticky left-0 flex-shrink-0 px-4 py-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-100 z-40 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]" style={{ width: SIDEBAR_WIDTH }}>
                      {group.name}
                      <span className="ml-2 text-[10px] font-medium tracking-normal normal-case text-slate-400">({groupInits.length})</span>
                    </div>
                    <div className="flex-shrink-0" style={{ width: totalWidth }} />
                  </div>
                  {/* Row */}
                  <div className="flex border-b border-slate-200 hover:bg-slate-50 transition-colors">
                    <div className="sticky left-0 flex-shrink-0 bg-white border-r border-slate-200 px-3 flex items-center z-20 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.06)]" style={{ width: SIDEBAR_WIDTH, height: swimlaneHeight }}>
                      <span className="text-xs text-slate-400 truncate">{groupInits.length} initiative{groupInits.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="relative bg-white" style={{ width: totalWidth, height: swimlaneHeight }}>
                      {isCurrentTimeVisible && (
                        <div className="absolute top-0 bottom-0 w-0.5 bg-emerald-400/80 z-10 pointer-events-none" style={{ left: `${currentPos}%` }} />
                      )}
                      {swimlaneItems.map(({ init, top, height: barH, left, width: barW }: any) => {
                        if (left + barW < 0 || left > 100) return null;
                        const prog = programmeMap.get(init.programmeId);
                        const strat = strategyMap.get(init.strategyId);
                        const colorClass = getInitiativeColor(init, prog, strat);
                        const subtitle = getInitiativeSubtitle(init, prog, strat);
                        const isOnCriticalPath = criticalPathInitIds.has(init.id);
                        return (
                          <InitiativeBar
                            key={init.id}
                            init={init}
                            left={left}
                            width={barW}
                            height={barH}
                            top={top}
                            colorClass={colorClass}
                            subtitle={subtitle}
                            isOnCriticalPath={isOnCriticalPath}
                            isSelected={selectedInitiativeId === init.id}
                            resources={resources}
                            settings={settings}
                            progName={prog?.name}
                            stratName={strat?.name}
                            isDraggingRef={isDraggingRef}
                            onSelect={() => setSelectedInitiativeId(init.id)}
                            onOpenPanel={() => setInitiativePanelId(init.id)}
                            onMoveStart={(e) => {
                              isDraggingRef.current = false;
                              setMoving({ id: init.id, initialX: e.clientX, initialY: e.clientY, initialStart: init.startDate, initialEnd: init.endDate });
                            }}
                            onResizeStart={(e, edge) => handleResizeStart(e, init.id, edge, edge === 'start' ? init.startDate : init.endDate)}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}

            {(groupBy === 'programme' || groupBy === 'strategy') && orphanedSwimlaneInitiatives.length > 0 && (() => {
              const { items: swimlaneItems, height: swimlaneHeight } = layoutAsset(orphanedSwimlaneInitiatives);
              return (
                <div data-testid={`swimlane-row-${groupBy}-unassigned`}>
                  <div className="flex z-30 bg-amber-50 border-y border-amber-200 w-max">
                    <div className="sticky left-0 flex-shrink-0 px-4 py-1.5 text-xs font-bold text-amber-700 uppercase tracking-wider bg-amber-50 z-40 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]" style={{ width: SIDEBAR_WIDTH }}>
                      Unassigned {groupBy === 'programme' ? 'Programme' : 'Strategy'}
                      <span className="ml-2 text-[10px] font-medium tracking-normal normal-case text-amber-600">({orphanedSwimlaneInitiatives.length})</span>
                    </div>
                    <div className="flex-shrink-0" style={{ width: totalWidth }} />
                  </div>
                  <div className="flex border-b border-amber-200 hover:bg-amber-50/50 transition-colors">
                    <div className="sticky left-0 flex-shrink-0 bg-white border-r border-slate-200 px-3 flex items-center z-20 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.06)]" style={{ width: SIDEBAR_WIDTH, height: swimlaneHeight }}>
                      <span className="text-xs text-amber-600 truncate">{orphanedSwimlaneInitiatives.length} initiative{orphanedSwimlaneInitiatives.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="relative bg-white" style={{ width: totalWidth, height: swimlaneHeight }}>
                      {isCurrentTimeVisible && (
                        <div className="absolute top-0 bottom-0 w-0.5 bg-emerald-400/80 z-10 pointer-events-none" style={{ left: `${currentPos}%` }} />
                      )}
                      {swimlaneItems.map(({ init, top, height: barH, left, width: barW }: any) => {
                        if (left + barW < 0 || left > 100) return null;
                        const prog = programmeMap.get(init.programmeId);
                        const strat = strategyMap.get(init.strategyId);
                        const colorClass = getInitiativeColor(init, prog, strat);
                        const subtitle = getInitiativeSubtitle(init, prog, strat);
                        const isOnCriticalPath = criticalPathInitIds.has(init.id);
                        return (
                          <InitiativeBar
                            key={init.id}
                            init={init}
                            left={left}
                            width={barW}
                            height={barH}
                            top={top}
                            colorClass={colorClass}
                            subtitle={subtitle}
                            isOnCriticalPath={isOnCriticalPath}
                            isSelected={selectedInitiativeId === init.id}
                            resources={resources}
                            settings={settings}
                            progName={prog?.name}
                            stratName={strat?.name}
                            isDraggingRef={isDraggingRef}
                            onSelect={() => setSelectedInitiativeId(init.id)}
                            onOpenPanel={() => setInitiativePanelId(init.id)}
                            onMoveStart={(e) => {
                              isDraggingRef.current = false;
                              setMoving({ id: init.id, initialX: e.clientX, initialY: e.clientY, initialStart: init.startDate, initialEnd: init.endDate });
                            }}
                            onResizeStart={(e, edge) => handleResizeStart(e, init.id, edge, edge === 'start' ? init.startDate : init.endDate)}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Swimlane view: group by DTS Phase */}
            {groupBy === 'dts-phase' && DTS_PHASE_GROUPS.map(group => {
              const groupInits = localInitiatives.filter(i => i.dtsPhase === group.id && !i.isPlaceholder);
              if (groupInits.length === 0) return null;
              const { items: swimlaneItems, height: swimlaneHeight } = layoutAsset(groupInits);
              return (
                <div key={group.id} data-testid={`swimlane-row-dts-phase-${group.id}`}>
                  <div className="flex z-30 bg-slate-100 border-y border-slate-200 w-max">
                    <div className="sticky left-0 flex-shrink-0 px-4 py-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-100 z-40 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]" style={{ width: SIDEBAR_WIDTH }}>
                      {group.name}
                      <span className="ml-2 text-[10px] font-medium tracking-normal normal-case text-slate-400">({groupInits.length})</span>
                    </div>
                    <div className="flex-shrink-0" style={{ width: totalWidth }} />
                  </div>
                  <div className="flex border-b border-slate-200 hover:bg-slate-50 transition-colors">
                    <div className="sticky left-0 flex-shrink-0 bg-white border-r border-slate-200 px-3 flex items-center z-20 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.06)]" style={{ width: SIDEBAR_WIDTH, height: swimlaneHeight }}>
                      <span className="text-xs text-slate-400 truncate">{groupInits.length} initiative{groupInits.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="relative bg-white" style={{ width: totalWidth, height: swimlaneHeight }}>
                      {isCurrentTimeVisible && (
                        <div className="absolute top-0 bottom-0 w-0.5 bg-emerald-400/80 z-10 pointer-events-none" style={{ left: `${currentPos}%` }} />
                      )}
                      {swimlaneItems.map(({ init, top, height: barH, left, width: barW }: any) => {
                        if (left + barW < 0 || left > 100) return null;
                        const prog = programmeMap.get(init.programmeId);
                        const strat = strategyMap.get(init.strategyId);
                        return (
                          <InitiativeBar
                            key={init.id}
                            init={init}
                            left={left}
                            width={barW}
                            height={barH}
                            top={top}
                            colorClass={getInitiativeColor(init, prog, strat)}
                            isSelected={selectedInitiativeId === init.id}
                            resources={resources}
                            settings={settings}
                            progName={prog?.name}
                            stratName={strat?.name}
                            isDraggingRef={isDraggingRef}
                            onSelect={() => setSelectedInitiativeId(init.id)}
                            onOpenPanel={() => setInitiativePanelId(init.id)}
                            onMoveStart={(e) => {
                              isDraggingRef.current = false;
                              setMoving({ id: init.id, initialX: e.clientX, initialY: e.clientY, initialStart: init.startDate, initialEnd: init.endDate });
                            }}
                            onResizeStart={(e, edge) => handleResizeStart(e, init.id, edge, edge === 'start' ? init.startDate : init.endDate)}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Default view: group by Asset/Category */}
            {/* eslint-disable-next-line react-hooks/refs */}
            {groupBy === 'asset' && sortedCategoryIds.map((catId) => {
              const category = assetCategories.find(c => c.id === catId);
              const categoryName = category?.name || 'Uncategorized';
              const isCollapsed = collapsedCategories.has(catId);

              // Filter assets for this category based on empty row settings
              let categoryAssets = assetsByCategory[catId] || [];
              if (settings.emptyRowDisplay === 'hide') {
                categoryAssets = categoryAssets.filter(asset => {
                  const hasInitiatives = localInitiatives.some(i => i.assetId === asset.id);
                  const hasApplications = applications.some(a => a.assetId === asset.id);
                  if (display === 'applications') return hasApplications;
                  if (display === 'both') return hasInitiatives || hasApplications;
                  return hasInitiatives;
                });
              }

              // If the category is totally empty (or all assets hidden), don't render the category at all
              if (categoryAssets.length === 0) return null;

              return (
                <div key={catId} data-testid={`category-row-${catId}`} onDragOver={(e) => handleCategoryDragOver(e, catId)}>
                  <div
                    draggable
                    data-testid={`category-drag-handle-${catId}`}
                    onDragStart={(e) => handleCategoryDragStart(e, catId)}
                    onDragEnd={handleCategoryDragEnd}
                    className={cn(
                      "flex z-30 bg-slate-100 border-y border-slate-200 w-max",
                      !isMobile && "cursor-grab active:cursor-grabbing",
                      draggingCategory === catId && "opacity-50"
                    )}
                  >
                    <div className="sticky left-0 flex-shrink-0 px-4 py-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2 bg-slate-100 z-40 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]" style={{ width: SIDEBAR_WIDTH }}>
                      {!isMobile && <div className="p-0.5 hover:bg-slate-200 rounded text-slate-400">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="5" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="19" r="1" /><circle cx="15" cy="5" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="19" r="1" /></svg>
                      </div>}
                      <button
                        onClick={() => toggleCategory(catId)}
                        className="flex items-center gap-1.5 hover:text-slate-700 focus:outline-none"
                      >
                        {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                        {categoryName}
                        <span className="text-[10px] font-medium text-slate-400 tracking-normal normal-case">
                          ({categoryAssets.length} asset{categoryAssets.length !== 1 ? 's' : ''})
                        </span>
                        {catId.startsWith('cat-dts-') && (
                          <span className="text-[9px] font-normal text-slate-300 normal-case tracking-normal">© Crown copyright, CC BY 4.0</span>
                        )}
                      </button>
                    </div>
                    <div className="flex-shrink-0" style={{ width: totalWidth }} />
                  </div>

                  {!isCollapsed && categoryAssets.map(asset => {
                    const allAssetInitiatives = localInitiatives.filter(i => i.assetId === asset.id);
                    const assetApplications = applications.filter(a => a.assetId === asset.id);
                    // All initiatives render at the asset level; applicationId is metadata only
                    const assetLevelInitiatives = allAssetInitiatives;
                    const assetMilestones = milestones.filter(m => m.assetId === asset.id);
                    const conflictPoints = getConflictPoints(asset.id);
                    const { items: layoutItems, height: rowHeight } = getAssetLayout(asset, assetLevelInitiatives);
                    // Collect all segments for this asset's applications swimlane
                    const assetSegments = localSegments.filter(s =>
                      assetApplications.some(a => a.id === s.applicationId)
                    );

                    // When in applications-only mode, skip assets with no applications only if empty rows are hidden
                    if (display === 'applications' && assetApplications.length === 0 && settings.emptyRowDisplay === 'hide') return null;

                    return (
                      <React.Fragment key={asset.id}>
                      <div
                        data-testid={`asset-row-${asset.id}`}
                        data-asset-id={asset.id}
                        className={cn(
                          "flex border-b border-slate-200 hover:bg-slate-50 transition-colors group relative",
                          draggingAssetId === asset.id && "opacity-50"
                        )}
                        onDragOver={(e) => handleAssetDragOver(e, asset)}
                      >
                        {/* Asset Name Sidebar — spans both Initiatives and Applications swimlanes */}
                        <div
                          data-testid="asset-swimlane-label"
                          data-alias={asset.alias}
                          draggable
                          onDragStart={(e) => handleAssetDragStart(e, asset.id)}
                          onDragEnd={handleAssetDragEnd}
                          className={cn("sticky left-0 flex-shrink-0 p-4 border-r border-slate-200 bg-white z-30 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)] group-hover:bg-slate-50 transition-colors flex flex-col justify-center self-stretch", !isMobile && "cursor-grab active:cursor-grabbing")}
                          style={{ width: SIDEBAR_WIDTH }}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {!isMobile && <div className="p-0.5 hover:bg-slate-100 rounded text-slate-300 group-hover:text-slate-400 flex-shrink-0">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="5" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="19" r="1" /><circle cx="15" cy="5" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="19" r="1" /></svg>
                            </div>}
                            <div className="font-semibold text-slate-800 min-w-0 flex-1">{asset.name}</div>
                            {settings.showDtsAdoptionStatus === 'on' && typeof asset.alias === 'string' && asset.alias.startsWith('DTS.') && asset.dtsAdoptionStatus && (() => {
                              const statusColors: Record<string, string> = {
                                'not-started': 'bg-slate-200 text-slate-600',
                                'scoping': 'bg-yellow-100 text-yellow-700',
                                'in-delivery': 'bg-blue-100 text-blue-700',
                                'adopted': 'bg-emerald-100 text-emerald-700',
                                'decommissioning': 'bg-orange-100 text-orange-700',
                                'not-applicable': 'bg-slate-100 text-slate-400',
                              };
                              const statusLabels: Record<string, string> = {
                                'not-started': 'Not Started',
                                'scoping': 'Scoping',
                                'in-delivery': 'In Delivery',
                                'adopted': 'Adopted',
                                'decommissioning': 'Decommissioning',
                                'not-applicable': 'N/A',
                              };
                              return (
                                <span
                                  data-testid={`dts-adoption-badge-${asset.id}`}
                                  className={cn('flex-shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full', statusColors[asset.dtsAdoptionStatus] || 'bg-slate-100 text-slate-500')}
                                >
                                  {statusLabels[asset.dtsAdoptionStatus] || asset.dtsAdoptionStatus}
                                </span>
                              );
                            })()}
                            {onDeleteAsset && (
                              <button
                                data-testid="asset-swimlane-delete-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const hasLinkedData =
                                    initiatives.some(i => i.assetId === asset.id) ||
                                    applications.some(a => a.assetId === asset.id);
                                  if (hasLinkedData) {
                                    setPendingConfirm({ type: 'delete-asset', assetId: asset.id, assetName: asset.name, hasLinkedData: true });
                                  } else {
                                    onDeleteAsset(asset.id);
                                  }
                                }}
                                className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                                title={`Delete ${asset.name}`}
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                          <div className={cn("text-xs text-slate-400 mt-1", !isMobile && "ml-4")}>{allAssetInitiatives.length} Initiative{allAssetInitiatives.length !== 1 ? 's' : ''}</div>
                        </div>

                        {/* Swimlanes stacked vertically */}
                        <div className="flex flex-col relative">

                        {/* Initiatives swimlane — hidden when display is 'applications' */}
                        {display !== 'applications' && (
                        <div
                          data-testid="asset-row-content"
                          className="relative flex-shrink-0"
                          style={{ width: totalWidth, height: rowHeight }}
                          onDoubleClick={(e) => handleRowDoubleClick(e, asset.id)}
                        >
                          <div className="absolute inset-0 flex pointer-events-none">
                            {timeColumns.map((col, idx) => (
                              <div key={idx} className={cn("border-r border-slate-100 h-full", idx === 0 && "border-l-2 border-l-slate-200")} style={{ width: columnWidth }} />
                            ))}
                          </div>

                          {layoutItems.map(({ init, top, height, left, width, isGroup, groupProgrammeNames, groupStrategyNames }: any) => {
                            const prog = programmeMap.get(init.programmeId);
                            const strat = strategyMap.get(init.strategyId);
                            const colorClass = getInitiativeColor(init, prog, strat);
                            const subtitle = getInitiativeSubtitle(init, prog, strat, isGroup, groupProgrammeNames, groupStrategyNames);

                            if (left + width < 0 || left > 100) return null;

                            const isOnCriticalPath = criticalPathInitIds.has(init.id);

                            return (
                              <InitiativeBar
                                key={init.id}
                                init={init}
                                left={left}
                                width={width}
                                height={height}
                                top={top}
                                colorClass={colorClass}
                                subtitle={subtitle}
                                isGroup={isGroup}
                                isOnCriticalPath={isOnCriticalPath}
                                isSelected={selectedInitiativeId === init.id}
                                groupProgrammeNames={groupProgrammeNames}
                                groupStrategyNames={groupStrategyNames}
                                resources={resources}
                                settings={settings}
                                progName={prog?.name}
                                stratName={strat?.name}
                                isDraggingRef={isDraggingRef}
                                onSelect={() => setSelectedInitiativeId(init.id)}
                                onOpenPanel={() => setInitiativePanelId(init.id)}
                                onMoveStart={(e) => {
                                  isDraggingRef.current = false;
                                  setMoving({ id: init.id, initialX: e.clientX, initialY: e.clientY, initialStart: init.startDate, initialEnd: init.endDate });
                                }}
                                onResizeStart={(e, edge) => handleResizeStart(e, init.id, edge, edge === 'start' ? init.startDate : init.endDate)}
                                onUngroup={isGroup ? () => {
                                  const currentCollapsed = settings.collapsedGroups || [];
                                  const nextCollapsed = currentCollapsed.filter(id => id !== init.id);
                                  if (onUpdateSettings) onUpdateSettings({ ...settings, collapsedGroups: nextCollapsed });
                                } : undefined}
                              />
                            );
                          })}

                          {/* Groups UI */}
                          {!resizing && !moving && getGroupsForAsset(assetLevelInitiatives).map(group => {
                            const groupItems = layoutItems.filter(it => group.includes(it.init.id));
                            if (groupItems.length === 0) return null;

                            const groupId = group.sort().join('|');
                            const isCollapsed = settings.collapsedGroups?.includes(groupId);
                            if (isCollapsed) return null; // Handled as a single bar in layoutItems

                            const minLeft = Math.min(...groupItems.map(it => it.left));
                            const maxRight = Math.max(...groupItems.map(it => it.left + it.width));
                            const minTop = Math.min(...groupItems.map(it => it.top));
                            const maxBottom = Math.max(...groupItems.map(it => it.top + it.height));

                            return (
                              <div
                                key={groupId}
                                data-testid="initiative-group-box"
                                className="absolute border-2 border-blue-400/30 border-dashed rounded-lg bg-blue-50/10 pointer-events-none z-0"
                                style={{
                                  left: `${minLeft - 0.5}%`,
                                  width: `${maxRight - minLeft + 1}%`,
                                  top: minTop - 8,
                                  height: maxBottom - minTop + 16
                                }}
                              >
                                <button
                                  data-testid="collapse-group-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const currentCollapsed = settings.collapsedGroups || [];
                                    const isCurrentlyCollapsed = currentCollapsed.includes(groupId);
                                    const nextCollapsed = isCurrentlyCollapsed
                                      ? currentCollapsed.filter(id => id !== groupId)
                                      : [...currentCollapsed, groupId];
                                    if (onUpdateSettings) {
                                      onUpdateSettings({
                                        ...settings,
                                        collapsedGroups: nextCollapsed
                                      });
                                    }
                                  }}
                                  className={`absolute -top-3 -right-3 p-1 bg-white border border-blue-200 text-blue-500 rounded-full shadow-sm hover:bg-blue-50 transition-all pointer-events-auto z-50 ${settings.collapsedGroups?.includes(groupId) ? "opacity-100" : "group-hover:opacity-100 opacity-0"}`}
                                  title={settings.collapsedGroups?.includes(groupId) ? "Ungroup Initiatives" : "Group Initiatives"}
                                >
                                  <Boxes size={14} />
                                </button>
                              </div>
                            );
                          })}

                          {conflictPoints.map((conflict, idx) => {
                            const pos = getPosition(conflict.date);
                            if (pos < 0 || pos > 100) return null;
                            return (
                              <div key={`conflict-${idx}`} className="absolute top-0 bottom-0 flex flex-col items-center justify-center group/marker z-0 pointer-events-none" style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}>
                                <div className="absolute top-0 bottom-0 w-0.5 border-l-2 border-dotted border-red-500/60" />
                                <div data-testid="conflict-marker" className="relative p-1.5 rounded-full shadow-md border-2 border-white bg-red-500 text-white animate-pulse pointer-events-auto">
                                  <AlertTriangle size={16} />
                                </div>
                                <div className="absolute left-full ml-2 bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded border border-red-200 shadow-sm whitespace-nowrap z-40 pointer-events-none">
                                  <div className="text-[10px] font-bold text-red-600 leading-none">Conflict Detected</div>
                                  <div className="text-[8px] text-slate-500 mt-0.5">Overlaps by {formatOverlapDuration(conflict.overlapDays)}</div>
                                </div>
                              </div>
                            );
                          })}

                        </div>
                        )} {/* end initiatives swimlane */}

                        {/* Applications swimlane — single merged row per asset, hidden when display is 'initiatives'.
                            Renders when the asset has Application objects (which may have lifecycle segments). */}
                        {display !== 'initiatives' && (assetApplications.length > 0 || assetSegments.length > 0) && (() => {
                          const { items: segLayoutItems, height: swimlaneHeight } = layoutSegments(assetSegments);
                          return (
                          <div
                            data-testid={`application-swimlane-${asset.id}`}
                            className="border-t border-slate-100"
                          >
                            <div
                              data-testid="application-row-content"
                              className="relative flex-shrink-0 bg-slate-50/30"
                              style={{ width: totalWidth, height: swimlaneHeight }}
                              onDoubleClick={(e) => {
                                if (!onSaveApplicationSegment) return;
                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                const offsetX = e.clientX - rect.left;
                                const pct = offsetX / totalWidth;
                                const daysFromStart = Math.round(pct * totalDays);
                                const newStart = format(addDays(startDate, daysFromStart), 'yyyy-MM-dd');
                                const newEnd = format(addDays(startDate, daysFromStart + 90), 'yyyy-MM-dd');
                                const autoRow = computeAutoRow(newStart, newEnd, assetSegments);
                                setCreatingSegmentParams({ id: crypto.randomUUID(), assetId: asset.id, startDate: newStart, endDate: newEnd, row: autoRow });
                                setSelectedSegmentId(null);
                              }}
                            >
                              <div className="absolute inset-0 flex pointer-events-none">
                                {timeColumns.map((col, idx) => (
                                  <div key={idx} className={cn("border-r border-slate-100/70 h-full", idx === 0 && "border-l-2 border-l-slate-200")} style={{ width: columnWidth }} />
                                ))}
                              </div>

                              {segLayoutItems.map(({ seg, top, height, left, width, rowSpan }) => {
                                if (left + width < 0 || left > 100) return null;
                                const colorClass = SEGMENT_COLORS[seg.status] || 'bg-slate-400';
                                const displayLabel = applications.find(a => a.id === seg.applicationId)?.name
                                  || SEGMENT_LABELS[seg.status];
                                const isSegSelected = selectedSegmentId === seg.id;
                                return (
                                  <div
                                    key={seg.id}
                                    data-testid={`segment-bar-${seg.id}`}
                                    data-segment-id={seg.id}
                                    data-selected={isSegSelected ? 'true' : undefined}
                                    onMouseDown={(e) => {
                                      isDraggingRef.current = false;
                                      setMovingSegment({ id: seg.id, initialX: e.clientX, initialY: e.clientY, initialRow: seg.row ?? 0, initialStart: seg.startDate, initialEnd: seg.endDate });
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (isDraggingRef.current) { isDraggingRef.current = false; return; }
                                      setSelectedSegmentId(seg.id);
                                      setCreatingSegmentParams(null);
                                    }}
                                    onDoubleClick={(e) => {
                                      e.stopPropagation();
                                      setSegmentPanelId(seg.id);
                                      setCreatingSegmentParams(null);
                                    }}
                                    className={cn(
                                      "absolute rounded-md shadow-sm border border-white/20 flex flex-col justify-center px-2 overflow-hidden cursor-pointer hover:z-20 hover:shadow-xl select-none group/seg",
                                      colorClass, "text-white",
                                      isSegSelected && "outline outline-2 outline-dashed outline-slate-800 z-[50]"
                                    )}
                                    style={{ left: `${left}%`, width: `${Math.max(width, 0.5)}%`, height, top }}
                                    title={`${displayLabel}\n${seg.startDate} → ${seg.endDate}`}
                                  >
                                    <div draggable="false" data-testid="segment-resize-left" className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize z-10 flex items-center justify-center"
                                      onMouseDown={(e) => { e.stopPropagation(); setResizingSegment({ id: seg.id, edge: 'start', initialX: e.clientX, initialDate: seg.startDate }); }}>
                                      <div className="w-px h-3/4 bg-white/40 rounded-full group-hover/seg:bg-white/70 transition-colors" />
                                    </div>
                                    <div draggable="false" data-testid="segment-resize-right" className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize z-10 flex items-center justify-center"
                                      onMouseDown={(e) => { e.stopPropagation(); setResizingSegment({ id: seg.id, edge: 'end', initialX: e.clientX, initialDate: seg.endDate }); }}>
                                      <div className="w-px h-3/4 bg-white/40 rounded-full group-hover/seg:bg-white/70 transition-colors" />
                                    </div>
                                    <div draggable="false" data-testid="segment-resize-bottom"
                                      className={`absolute left-2 right-2 bottom-0 h-2 cursor-ns-resize flex items-center justify-center transition-opacity z-10 ${isSegSelected ? 'opacity-100' : 'opacity-0 group-hover/seg:opacity-100'}`}
                                      onMouseDown={(e) => { e.stopPropagation(); setResizingSegmentVertical({ id: seg.id, initialY: e.clientY, initialRowSpan: rowSpan }); }}>
                                      <div className="w-8 h-0.5 bg-white/60 rounded-full" />
                                    </div>
                                    <div
                                      data-testid="segment-stripe"
                                      className="absolute inset-0 pointer-events-none rounded-md"
                                      style={{ background: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.12) 0px, rgba(255,255,255,0.12) 4px, transparent 4px, transparent 12px)' }}
                                    />
                                    {isSegSelected && (
                                      <div className="absolute top-0.5 left-0.5 flex flex-row gap-0.5 z-20" onClick={(e) => e.stopPropagation()}>
                                        <button
                                          data-testid="segment-row-up"
                                          className="w-4 h-4 bg-white/30 hover:bg-white/60 rounded text-white text-[9px] flex items-center justify-center leading-none"
                                          onMouseDown={(e) => e.stopPropagation()}
                                          onClick={(e) => { e.stopPropagation(); handleSegmentRowMove(seg.id, -1); }}
                                        >↑</button>
                                        <button
                                          data-testid="segment-row-down"
                                          className="w-4 h-4 bg-white/30 hover:bg-white/60 rounded text-white text-[9px] flex items-center justify-center leading-none"
                                          onMouseDown={(e) => e.stopPropagation()}
                                          onClick={(e) => { e.stopPropagation(); handleSegmentRowMove(seg.id, +1); }}
                                        >↓</button>
                                      </div>
                                    )}
                                    {isSegSelected && (
                                      <div
                                        data-testid="segment-action-toolbar"
                                        className="absolute top-0.5 right-0.5 flex items-center gap-0.5 z-[50]"
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <button
                                          data-testid="segment-action-edit"
                                          className="w-5 h-5 bg-white hover:bg-slate-100 rounded shadow-sm text-slate-700 text-[10px] flex items-center justify-center leading-none"
                                          onClick={(e) => { e.stopPropagation(); setSegmentPanelId(seg.id); }}
                                          title="Edit segment"
                                        >✎</button>
                                        {settings.showRelationships !== 'off' && onUpdateDependencies && (
                                          <button
                                            data-testid="segment-action-link"
                                            className="w-5 h-5 bg-white hover:bg-slate-100 rounded shadow-sm text-slate-700 text-[10px] flex items-center justify-center leading-none"
                                            onMouseDown={(e) => { e.stopPropagation(); handleSegmentDepMouseDown(e, seg.id); }}
                                            onClick={(e) => e.stopPropagation()}
                                            title="Drag to another segment to create a dependency"
                                          >⛓</button>
                                        )}
                                      </div>
                                    )}
                                    <div
                                      className="flex items-center justify-between gap-1 w-full overflow-hidden"
                                      style={left < 0 ? { paddingLeft: `${Math.max(0, (-left / 100) * totalWidth - 8)}px` } : undefined}
                                    >
                                      <div data-testid="segment-label" className="font-bold text-[11px] leading-tight truncate drop-shadow-md">{displayLabel}</div>
                                      <div data-testid="segment-status-label" className="flex-shrink-0 text-[10px] font-semibold px-1 rounded bg-white/20 text-white truncate max-w-[45%]">
                                        {SEGMENT_LABELS[seg.status] ?? seg.status}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          );
                        })()} {/* end applications swimlane */}

                        {/* Milestone markers — lifted to span both swimlanes */}
                        {assetMilestones.map(mile => {
                          const currentMile = localMilestones.find(m => m.id === mile.id) || mile;
                          const pos = getPosition(currentMile.date);
                          if (pos < 0 || pos > 100) return null;
                          return (
                            <div
                              key={mile.id}
                              data-milestone-id={mile.id}
                              onMouseDown={(e) => handleMilestoneMouseDown(e, mile)}
                              className="absolute top-0 bottom-0 flex flex-col items-center group/marker z-0 cursor-grab active:cursor-grabbing"
                              style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}
                            >
                              <div className="absolute top-0 bottom-0 w-px border-l border-dashed border-slate-400/50 group-hover/marker:border-slate-600" />
                              {/* Badge pinned to initiatives-row height so it stays within that swimlane */}
                              <div className="flex flex-col items-center justify-center" style={{ height: display !== 'applications' ? rowHeight : undefined }}>
                                <div data-testid="milestone-dep-handle" className={cn(
                                  "relative p-1.5 rounded-full shadow-md border-2 border-white transition-transform group-hover/marker:scale-110",
                                  mile.type === 'critical' ? "bg-red-100 text-red-600" :
                                    mile.type === 'warning' ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"
                                )}>
                                  {mile.type === 'critical' ? <Star size={16} fill="currentColor" /> : <Info size={16} />}
                                </div>
                                {(() => {
                                  // Prefer left side when no initiative bar ends within 8% of the milestone
                                  const hasContentLeft = layoutItems.some(({ left: iLeft, width: iWidth }: any) =>
                                    iLeft < pos && iLeft + iWidth > pos - 8
                                  );
                                  const side = !hasContentLeft ? 'left' : 'right';
                                  return (
                                    <div
                                      data-testid="milestone-label"
                                      data-label-side={side}
                                      className={cn(
                                        "absolute bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded border border-slate-200 shadow-sm whitespace-nowrap z-40 pointer-events-none",
                                        side === 'right' ? "left-full ml-2" : "right-full mr-2 text-right"
                                      )}
                                    >
                                      <div className="text-[10px] font-bold text-slate-800 leading-none">{mile.name}</div>
                                      <div className="text-[8px] text-slate-500 mt-0.5">{format(parseISO(currentMile.date), 'MMM yyyy')}</div>
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          );
                        })}

                        </div> {/* end swimlanes stack */}
                      </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              );
            })}

            {/* GEANZ Application Technology section */}
            {groupBy === 'asset' && settings.showGeanzCatalogue !== false && (
              <div data-testid="geanz-section">
                {/* Section header */}
                <div className="flex z-30 bg-indigo-50 border-y border-indigo-100 w-max">
                  <div className="sticky left-0 flex-shrink-0 px-4 py-1.5 text-xs font-bold text-indigo-500 uppercase tracking-wider flex items-center gap-2 bg-indigo-50 z-40 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]" style={{ width: SIDEBAR_WIDTH }}>
                    <span>GEANZ Application Technology</span>
                    <span className="text-[9px] font-normal text-indigo-300 normal-case tracking-normal">© Crown copyright, CC BY 4.0</span>
                  </div>
                  <div className="flex-shrink-0" style={{ width: totalWidth }} />
                </div>

                {/* eslint-disable-next-line react-hooks/refs */}
                {geanzAreas.map((area: GeanzArea) => {
                  const areaAssets = geanzAssetsByArea[area.alias] || [];
                  const isPopulated = areaAssets.length > 0;

                  return (
                    <div key={area.alias} data-testid={`geanz-area-entry-${area.alias}`}>
                      {/* Unpopulated: show area row with pre-populate button */}
                      {!isPopulated && (
                        <div
                          data-testid={`geanz-area-row-${area.alias}`}
                          data-row-type="geanz-area"
                          className="flex w-max border-b border-slate-100 bg-slate-50/60 hover:bg-slate-50 transition-colors"
                        >
                          <div
                            className="sticky left-0 flex-shrink-0 px-4 py-2 border-r border-slate-200 bg-slate-50/60 z-30 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.06)] flex items-center gap-2"
                            style={{ width: SIDEBAR_WIDTH }}
                          >
                            <div className="flex-1">
                              <div className="text-xs font-semibold text-slate-600">{area.name}</div>
                              {GEANZ_TO_DTS_MAP[area.alias] && (
                                <span
                                  data-testid="geanz-dts-map-badge"
                                  className="inline-block mt-0.5 text-[9px] font-mono font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded px-1 py-0.5 leading-none"
                                  title={`Maps to DTS component ${GEANZ_TO_DTS_MAP[area.alias]}`}
                                >
                                  {GEANZ_TO_DTS_MAP[area.alias]}
                                </span>
                              )}
                            </div>
                            {area.assets.length > 0 ? (
                              <button
                                data-testid={`geanz-prepopulate-btn-${area.alias}`}
                                onClick={() => {
                                  if (!onAddAssets) return;
                                  const newAssets: Asset[] = area.assets.map(entry => ({
                                    id: `geanz-${entry.externalId}`,
                                    name: entry.name,
                                    categoryId: GEANZ_CATEGORY_ID,
                                    alias: entry.alias,
                                    externalId: entry.externalId,
                                  }));
                                  onAddAssets(newAssets);
                                }}
                                className="flex-shrink-0 text-[10px] text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:border-indigo-400 bg-indigo-50 hover:bg-indigo-100 rounded px-1.5 py-0.5 transition-colors whitespace-nowrap"
                              >
                                + Add all {area.assets.length} asset{area.assets.length !== 1 ? 's' : ''}
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-300 italic">No items yet</span>
                            )}
                          </div>
                          <div className="flex-shrink-0" style={{ width: totalWidth }} />
                        </div>
                      )}

                      {/* Populated: show a thin header with Remove all, then the asset rows */}
                      {isPopulated && (
                        <div className="flex w-max border-b border-indigo-100/50 bg-indigo-50/30">
                          <div
                            className="sticky left-0 flex-shrink-0 px-4 py-1 border-r border-slate-200 bg-indigo-50/30 z-30 flex items-center gap-2"
                            style={{ width: SIDEBAR_WIDTH }}
                          >
                            <div className="text-[10px] font-semibold text-indigo-400 flex-1">{area.name}</div>
                            <button
                              data-testid={`geanz-remove-btn-${area.alias}`}
                              onClick={() => setPendingConfirm({
                                type: 'remove-area',
                                areaAlias: area.alias,
                                areaName: area.name,
                                assetCount: areaAssets.length,
                              })}
                              className="flex-shrink-0 text-[10px] text-slate-400 hover:text-red-500 border border-slate-200 hover:border-red-300 rounded px-1.5 py-0.5 transition-colors whitespace-nowrap"
                            >
                              Remove all
                            </button>
                          </div>
                          <div className="flex-shrink-0" style={{ width: totalWidth }} />
                        </div>
                      )}

                      {/* Populated asset swimlanes for this area */}
                      {isPopulated && areaAssets.map(asset => {
                        const allAssetInitiatives = localInitiatives.filter(i => i.assetId === asset.id);
                        const { items: layoutItems, height: rowHeight } = getAssetLayout(asset, allAssetInitiatives);
                        return (
                          <React.Fragment key={asset.id}>
                            <div
                              data-testid={`asset-row-${asset.id}`}
                              data-asset-id={asset.id}
                              className="flex border-b border-slate-100 hover:bg-slate-50 transition-colors group relative"
                            >
                              <div
                                data-testid="asset-swimlane-label"
                                data-alias={asset.alias}
                                className="sticky left-0 flex-shrink-0 px-4 py-3 border-r border-slate-200 bg-white z-30 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)] group-hover:bg-slate-50 transition-colors flex items-center gap-2 self-stretch"
                                style={{ width: SIDEBAR_WIDTH }}
                              >
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-slate-700">{asset.name}</div>
                                </div>
                                {onDeleteAsset && (
                                  <button
                                    data-testid="asset-swimlane-delete-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const hasLinkedData = allAssetInitiatives.length > 0 ||
                                        applications.some(a => a.assetId === asset.id);
                                      if (hasLinkedData) {
                                        setPendingConfirm({ type: 'delete-asset', assetId: asset.id, assetName: asset.name, hasLinkedData: true });
                                      } else {
                                        onDeleteAsset(asset.id);
                                      }
                                    }}
                                    className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                                    title={`Delete ${asset.name}`}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                              {display !== 'applications' && (
                              <div
                                data-testid="asset-row-content"
                                className="relative flex-shrink-0"
                                style={{ width: totalWidth, height: rowHeight }}
                                onDoubleClick={(e) => handleRowDoubleClick(e, asset.id)}
                              >
                                <div className="absolute inset-0 flex pointer-events-none">
                                  {timeColumns.map((col, idx) => (
                                    <div key={idx} className={cn("border-r border-slate-100 h-full", idx === 0 && "border-l-2 border-l-slate-200")} style={{ width: columnWidth }} />
                                  ))}
                                </div>
                                {layoutItems.map(({ init, top, height, left, width }: any) => {
                                  if (left + width < 0 || left > 100) return null;
                                  const prog = programmeMap.get(init.programmeId);
                                  const strat = strategyMap.get(init.strategyId);
                                  return (
                                    <InitiativeBar
                                      key={init.id}
                                      init={init}
                                      left={left}
                                      width={width}
                                      height={height}
                                      top={top}
                                      colorClass={getInitiativeColor(init, prog, strat)}
                                      isSelected={selectedInitiativeId === init.id}
                                      resources={resources}
                                      settings={settings}
                                      progName={prog?.name}
                                      stratName={strat?.name}
                                      isDraggingRef={isDraggingRef}
                                      onSelect={() => setSelectedInitiativeId(init.id)}
                                      onOpenPanel={() => setInitiativePanelId(init.id)}
                                      onMoveStart={(e) => {
                                        isDraggingRef.current = false;
                                        setMoving({ id: init.id, initialX: e.clientX, initialY: e.clientY, initialStart: init.startDate, initialEnd: init.endDate });
                                      }}
                                      onResizeStart={(e, edge) => handleResizeStart(e, init.id, edge, edge === 'start' ? init.startDate : init.endDate)}
                                    />
                                  );
                                })}
                              </div>
                              )}
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* GEANZ confirm modals */}
      {pendingConfirm?.type === 'delete-asset' && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4" data-testid="confirm-modal">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm flex flex-col animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3 p-5 pb-3">
              <div className="flex-shrink-0 mt-0.5 text-red-500"><AlertTriangle size={20} /></div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-slate-800">Delete {pendingConfirm.assetName}?</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Initiatives and segments linked to this asset will also be deleted.
                </p>
              </div>
            </div>
            <div className="flex gap-2 p-4 pt-2 justify-end">
              <button data-testid="confirm-modal-cancel" onClick={() => setPendingConfirm(null)} className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
              <button data-testid="confirm-modal-confirm" onClick={() => { onDeleteAsset?.(pendingConfirm.assetId); setPendingConfirm(null); }} className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
      {pendingConfirm?.type === 'remove-area' && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4" data-testid="confirm-modal">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm flex flex-col animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3 p-5 pb-3">
              <div className="flex-shrink-0 mt-0.5 text-red-500"><AlertTriangle size={20} /></div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-slate-800">Remove all assets?</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Remove {pendingConfirm.assetCount} asset{pendingConfirm.assetCount !== 1 ? 's' : ''} from <strong>{pendingConfirm.areaName}</strong>? Initiatives and segments linked to these assets will also be deleted.
                </p>
              </div>
            </div>
            <div className="flex gap-2 p-4 pt-2 justify-end">
              <button data-testid="confirm-modal-cancel" onClick={() => setPendingConfirm(null)} className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
              <button data-testid="confirm-modal-confirm" onClick={() => {
                const areaAlias = pendingConfirm.areaAlias;
                const toDelete = (geanzAssetsByArea[areaAlias] || []).map(a => a.id);
                onBulkDeleteAssets?.(toDelete);
                setPendingConfirm(null);
              }} className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">Remove all</button>
            </div>
          </div>
        </div>
      )}

      <InitiativePanel
        isOpen={initiativePanelId !== null || creatingInitiativeParams !== null}
        onClose={() => {
          setInitiativePanelId(null);
          setSelectedInitiativeId(null);
          setCreatingInitiativeParams(null);
        }}
        initiative={
          initiativePanelId
            ? initiatives.find(i => i.id === initiativePanelId) || null
            : creatingInitiativeParams
              ? {
                id: creatingInitiativeParams.id,
                name: '',
                description: '',
                assetId: creatingInitiativeParams.assetId,
                programmeId: programmes[0]?.id || '',
                strategyId: strategies[0]?.id || '',
                startDate: creatingInitiativeParams.startDate,
                endDate: creatingInitiativeParams.endDate,
                capex: 0,
                opex: 0,
              }
              : null
        }
        assets={assets}
        applications={applications}
        programmes={programmes}
        strategies={strategies}
        dependencies={dependencies}
        initiatives={initiatives}
        resources={resources}
        hasDtsAssets={hasDtsAssets}
        dtsPhases={dtsPhases}
        isNew={creatingInitiativeParams !== null}
        onSave={(initiative) => {
          if (initiativePanelId) {
            if (onUpdateInitiative) onUpdateInitiative(initiative);
          } else {
            if (onAddInitiative) onAddInitiative(initiative);
          }
          setInitiativePanelId(null);
          setSelectedInitiativeId(null);
          setCreatingInitiativeParams(null);
        }}
        onDelete={(initiative) => {
          if (onDeleteInitiative) onDeleteInitiative(initiative);
          setInitiativePanelId(null);
          setSelectedInitiativeId(null);
          setCreatingInitiativeParams(null);
        }}
      />

      <ApplicationSegmentPanel
        isOpen={segmentPanelId !== null || creatingSegmentParams !== null}
        isNew={creatingSegmentParams !== null}
        segment={
          segmentPanelId
            ? localSegments.find(s => s.id === segmentPanelId) || null
            : creatingSegmentParams
              ? {
                  id: creatingSegmentParams.id,
                  applicationId: applications.find(a => a.assetId === creatingSegmentParams.assetId)?.id ?? '',
                  startDate: creatingSegmentParams.startDate,
                  endDate: creatingSegmentParams.endDate,
                  status: applicationStatuses[0]?.id ?? 'appstatus-planned',
                  row: creatingSegmentParams.row,
                  rowSpan: 1,
                }
              : null
        }
        application={
          (segmentPanelId
            ? applications.find(a => a.id === localSegments.find(s => s.id === segmentPanelId)?.applicationId)
            : null) || null
        }
        applications={(() => {
          const assetId = segmentPanelId
            ? applications.find(a => a.id === localSegments.find(s => s.id === segmentPanelId)?.applicationId)?.assetId
            : creatingSegmentParams?.assetId;
          return assetId ? applications.filter(a => a.assetId === assetId) : [];
        })()}
        onClose={() => { setSegmentPanelId(null); setSelectedSegmentId(null); setCreatingSegmentParams(null); }}
        onSave={(seg) => {
          if (onSaveApplicationSegment) onSaveApplicationSegment(seg);
          setSegmentPanelId(null);
          setSelectedSegmentId(null);
          setCreatingSegmentParams(null);
        }}
        onDelete={(seg) => {
          if (onDeleteApplicationSegment) onDeleteApplicationSegment(seg);
          setSegmentPanelId(null);
          setSelectedSegmentId(null);
        }}
        applicationStatuses={applicationStatuses}
      />

      <DependencyPanel
        isOpen={selectedDependencyId !== null}
        onClose={() => setSelectedDependencyId(null)}
        dependency={selectedDependencyId ? dependencies.find(d => d.id === selectedDependencyId) || null : null}
        initiatives={initiatives}
        milestones={milestones}
        applicationSegments={localSegments}
        applications={applications}
        onSave={(updatedDep) => {
          if (onUpdateDependencies) {
            onUpdateDependencies(dependencies.map(d => d.id === updatedDep.id ? updatedDep : d));
          }
          setSelectedDependencyId(null);
        }}
        onDelete={(deletedDep) => {
          if (onUpdateDependencies) {
            onUpdateDependencies(dependencies.filter(d => d.id !== deletedDep.id));
          }
          setSelectedDependencyId(null);
        }}
      />

      {/* Floating Legend — anchored to bottom-right of the visualiser canvas */}
      <div
        data-testid="timeline-legend"
        className="absolute bottom-3 right-3 z-[40] bg-white/95 backdrop-blur-sm border border-slate-200 rounded-lg shadow-md text-xs select-none"
        style={{ maxWidth: '220px' }}
      >
        <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-100">
          <span className="font-semibold text-slate-600 uppercase tracking-wide text-[10px]">Legend</span>
          <button
            data-testid="legend-toggle"
            onClick={() => {
              const next = !legendExpanded;
              setLegendExpanded(next);
              try { localStorage.setItem('scenia_legend_expanded', String(next)); } catch { /* noop */ }
            }}
            className="p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label={legendExpanded ? 'Collapse legend' : 'Expand legend'}
          >
            {legendExpanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>
        </div>

        {legendExpanded && (
          <div data-testid="legend-content" className="p-2.5 space-y-2.5">
            {/* Colour swatches */}
            <div data-testid="legend-colour-swatches">
              <div data-testid="colour-legend">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  {colorBy === 'rag' ? 'Status' : colorBy === 'status' ? 'Progress' : colorBy === 'programme' ? 'Programmes' : 'Strategies'}
                </p>
                <div className="space-y-1">
                  {colorBy === 'rag' ? (
                    Object.entries(RAG_LABELS).map(([key, label]) => (
                      <div key={key} className="flex items-center gap-1.5">
                        <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', RAG_COLORS[key])} />
                        <span className="text-slate-600">{label}</span>
                      </div>
                    ))
                  ) : colorBy === 'status' ? (
                    Object.entries(STATUS_LABELS).map(([key, label]) => (
                      <div key={key} className="flex items-center gap-1.5">
                        <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', STATUS_COLORS[key])} />
                        <span className="text-slate-600">{label}</span>
                      </div>
                    ))
                  ) : (
                    (colorBy === 'programme' ? programmes : strategies).map(item => (
                      <div key={item.id} className="flex items-center gap-1.5">
                        <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', item.color)} />
                        <span className="text-slate-600 truncate">{item.name}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Milestone types */}
            <div data-testid="legend-milestones">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Milestones</p>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0"><Info size={10} /></div>
                  <span className="text-slate-600">Info</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0"><Info size={10} /></div>
                  <span className="text-slate-600">Warning</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0"><Star size={10} fill="currentColor" /></div>
                  <span className="text-slate-600">Critical</span>
                </div>
              </div>
            </div>

            {/* Dependency arrows */}
            {settings.showRelationships !== 'off' && (
              <div data-testid="legend-dependencies">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Dependencies</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-px bg-blue-500 relative flex-shrink-0">
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 border-y-[3px] border-y-transparent border-l-[5px] border-l-blue-500" />
                    </div>
                    <span className="text-slate-600">Requires</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-px bg-red-500 relative flex-shrink-0">
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 border-y-[3px] border-y-transparent border-l-[5px] border-l-red-500" />
                    </div>
                    <span className="text-slate-600">Blocks</span>
                  </div>
                </div>
              </div>
            )}

            {/* Conflict indicator */}
            <div data-testid="legend-conflict">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Indicators</p>
              <div className="flex items-center gap-1.5">
                <AlertTriangle size={12} className="text-red-500 flex-shrink-0" />
                <span className="text-slate-600">Conflict</span>
              </div>
            </div>

            {/* Timestamp */}
            <div data-testid="legend-timestamp" className="border-t border-slate-100 pt-2">
              <span className="text-[10px] text-slate-400">
                {legendNow.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                {' · '}
                {legendNow.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

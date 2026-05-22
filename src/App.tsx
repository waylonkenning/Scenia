/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, lazy, Suspense, useRef } from 'react';
import { Timeline } from './components/Timeline';
import { MobileCardView } from './components/MobileCardView';
import { useMediaQuery } from './lib/useMediaQuery';
import { DataControls } from './components/DataControls';
import { ModalErrorBoundary, TestErrorThrower } from './components/ErrorBoundary';
import { TutorialModal } from './components/TutorialModal';
import { LandingPage } from './components/LandingPage';
import { VersionManager } from './components/VersionManager';
import { LayoutGrid, Table, Loader2, Search, Undo2, Redo2, HelpCircle, BookOpen, History, AlertTriangle, GitBranch, AlignLeft, DollarSign, MoreHorizontal, BarChart2, ZoomIn, ZoomOut, SlidersHorizontal, X, Keyboard, GitCommit, GitCommitHorizontal, Palette, Box, Boxes, Target, Users, Layers, AppWindow } from 'lucide-react';

import {
  demoAssets as initialAssets,
  demoInitiatives as initialInitiatives,
  demoMilestones as initialMilestones,
  demoProgrammes as initialProgrammes,
  demoStrategies as initialStrategies,
  demoDependencies as initialDependencies,
  demoAssetCategories as initialAssetCategories,
  demoTimelineSettings as defaultTimelineSettings,
  demoResources as initialResources,
  demoApplications as initialApplications,
  demoApplicationSegments as initialApplicationSegments,
  demoApplicationStatuses as initialApplicationStatuses,
} from './demoData';
import { Asset, Application, ApplicationSegment, ApplicationStatus, DtsPhaseRecord, Initiative, Milestone, Programme, Strategy, Dependency, AssetCategory, TimelineSettings, Resource, Version } from './types';
import { cn } from './lib/utils';
import { getAppData, saveAppData, getAllVersions } from './lib/db';
import { importFromExcel } from './lib/excel';
import { validateImportSchema } from './lib/importValidation';
import { importSharedWorkspace } from './lib/share';
import { getTemplateData, TemplateId } from './lib/workspaceTemplates';
import { isWorkspaceEmpty } from './lib/workspaceState';

// Lazy load modals and heavy components for code splitting
const FeaturesModal = lazy(() => import('./components/FeaturesModal').then(m => ({ default: m.FeaturesModal })));
const KeyboardShortcutsModal = lazy(() => import('./components/KeyboardShortcutsModal').then(m => ({ default: m.KeyboardShortcutsModal })));
const TemplatePickerModal = lazy(() => import('./components/TemplatePickerModal').then(m => ({ default: m.TemplatePickerModal })));
const DataManager = lazy(() => import('./components/DataManager').then(m => ({ default: m.DataManager })));
const ReportsView = lazy(() => import('./components/ReportsView').then(m => ({ default: m.ReportsView })));
const HelpView = lazy(() => import('./components/HelpView').then(m => ({ default: m.HelpView })));

type AppState = {
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
  dtsPhases: DtsPhaseRecord[];
  versions?: Version[];
};

function isValidSharedAppState(data: unknown): data is AppState {
  if (!data || typeof data !== 'object') return false;
  const record = data as Record<string, unknown>;
  return Array.isArray(record.assets)
    && Array.isArray(record.applications)
    && Array.isArray(record.applicationSegments)
    && Array.isArray(record.initiatives)
    && Array.isArray(record.milestones)
    && Array.isArray(record.programmes)
    && Array.isArray(record.strategies)
    && Array.isArray(record.dependencies)
    && Array.isArray(record.assetCategories)
    && Array.isArray(record.resources)
    && Array.isArray(record.applicationStatuses)
    && Array.isArray(record.dtsPhases)
    && !!record.timelineSettings
    && typeof record.timelineSettings === 'object';
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <div className="flex flex-col items-center gap-2 text-slate-500">
        <Loader2 className="animate-spin" size={32} />
        <p className="text-sm">Loading...</p>
      </div>
    </div>
  );
}

export default function App() {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [view, setView] = useState<'visualiser' | 'data' | 'reports' | 'guide'>('visualiser');
  const [isLoading, setIsLoading] = useState(true);
  const [isImportingShare, setIsImportingShare] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  
  // Check for share link in URL to skip landing page
  const hasShareId = new URLSearchParams(window.location.search).has('id');

  const [showLandingPage, setShowLandingPage] = useState(
    !hasShareId && !localStorage.getItem('scenia_has_seen_landing') && !localStorage.getItem('scenia-e2e')
  );
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templatePickerIsReset, setTemplatePickerIsReset] = useState(false);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [assetCategories, setAssetCategories] = useState<AssetCategory[]>([]);
  const [timelineSettings, setTimelineSettings] = useState<TimelineSettings>(defaultTimelineSettings);
  const [resources, setResources] = useState<Resource[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationSegments, setApplicationSegments] = useState<ApplicationSegment[]>([]);
  const [applicationStatuses, setApplicationStatuses] = useState<ApplicationStatus[]>([]);
  const [dtsPhases, setDtsPhases] = useState<DtsPhaseRecord[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);

  const [undoStack, setUndoStack] = useState<AppState[]>([]);
  const [redoStack, setRedoStack] = useState<AppState[]>([]);
  const [dbSaveError, setDbSaveError] = useState<string | null>(null);

  const hasDtsAssets = assets.some(a => typeof a.alias === 'string' && a.alias.startsWith('DTS.'));

  const [searchQuery, setSearchQuery] = useState('');
  const [isVersionManagerOpen, setIsVersionManagerOpen] = useState(false);
  const [showMoreSettingsPanel, setShowMoreSettingsPanel] = useState(false);
  const [showViewOptionsPanel, setShowViewOptionsPanel] = useState(false);
  const [showMobileSheet, setShowMobileSheet] = useState(false);
  const moreSettingsPanelRef = useRef<HTMLDivElement>(null);
  const viewOptionsPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMobileSheet) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowMobileSheet(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showMobileSheet]);
  const undoRef = useRef<() => void>(() => {});
  const redoRef = useRef<() => void>(() => {});

  const getCurrentState = (): AppState => ({
    assets, applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, applicationStatuses, dtsPhases
  });

  const getCurrentStateRef = useRef(getCurrentState);

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Check for share link in URL
        const urlParams = new URLSearchParams(window.location.search);
        const shareId = urlParams.get('id');
        const hash = window.location.hash;
        const keyMatch = hash.match(/key=([^&]*)/);
        const shareKey = keyMatch ? keyMatch[1] : null;

        if (shareId && shareKey) {
          setIsImportingShare(true);
          try {
            const importedData = await importSharedWorkspace(shareId, shareKey);
            if (!isValidSharedAppState(importedData)) {
              throw new Error('Shared workspace data is invalid or incomplete.');
            }

            const shouldImport = window.confirm(
              'This share link will replace your current local workspace. Do you want to continue?'
            );

            if (!shouldImport) {
              window.history.replaceState({}, document.title, window.location.pathname);
              setIsImportingShare(false);
              // Continue to normal load path without importing.
            } else {
              const sharedData = importedData as AppState;
            await saveAppData(sharedData);
            // Clear the URL params without refreshing
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // Re-load the data from DB to ensure it's properly initialized
            const dbData = await getAppData();
            setAssets(dbData.assets);
            setApplications(dbData.applications || []);
            setApplicationSegments((dbData as any).applicationSegments || []);
            setInitiatives(dbData.initiatives.map(i => ({ ...i, capex: Number(i.capex) || 0, opex: Number(i.opex) || 0 })));
            setMilestones(dbData.milestones);
            setProgrammes(dbData.programmes);
            setStrategies(dbData.strategies || []);
            setDependencies(dbData.dependencies || []);
            setAssetCategories(dbData.assetCategories || []);
            setResources(dbData.resources || []);
            setApplicationStatuses((dbData as any).applicationStatuses || []);
            setDtsPhases((dbData as any).dtsPhases || []);
            setTimelineSettings({ ...defaultTimelineSettings, ...(dbData.timelineSettings || {}) });
            setVersions(await getAllVersions());
            setIsImportingShare(false);
            setIsLoading(false);
            return;
            }
          } catch (error) {
            console.error('Failed to import shared workspace:', error);
            setDbSaveError(error instanceof Error ? error.message : 'Failed to import shared workspace.');
            setIsImportingShare(false);
            // Continue to normal load if share fails
          }
        }

        const dbData = await getAppData();
        const loadedVersions = await getAllVersions();
        setVersions(loadedVersions);

        // If the workspace has no user-authored data yet, show the template picker
        // (or auto-load GEANZ in E2E mode).
        if (isWorkspaceEmpty(dbData)) {
          if (localStorage.getItem('scenia-e2e')) {
            // E2E mode: auto-load GEANZ template so existing tests keep working
            const defaults: AppState = {
              assets: initialAssets,
              applications: initialApplications,
              applicationSegments: initialApplicationSegments,
              initiatives: initialInitiatives,
              milestones: initialMilestones,
              programmes: initialProgrammes,
              strategies: initialStrategies,
              dependencies: initialDependencies,
              assetCategories: initialAssetCategories,
              timelineSettings: defaultTimelineSettings,
              resources: initialResources,
              applicationStatuses: initialApplicationStatuses,
              dtsPhases: [],
            };
            await saveAppData(defaults);
            setAssets(defaults.assets);
            setApplications(defaults.applications);
            setApplicationSegments(defaults.applicationSegments);
            setInitiatives(defaults.initiatives);
            setMilestones(defaults.milestones);
            setProgrammes(defaults.programmes);
            setStrategies(defaults.strategies);
            setDependencies(defaults.dependencies);
            setAssetCategories(defaults.assetCategories);
            setTimelineSettings(defaults.timelineSettings);
            setResources(defaults.resources);
            setApplicationStatuses(defaults.applicationStatuses);
          } else {
            // First real run: let the user pick a template
            setShowTemplatePicker(true);
          }
        } else {
          setAssets(dbData.assets);
          setApplications(dbData.applications || []);
          setApplicationSegments((dbData as any).applicationSegments || []);
          setInitiatives(dbData.initiatives.map(i => ({ ...i, capex: Number(i.capex) || 0, opex: Number(i.opex) || 0 })));
          setMilestones(dbData.milestones);
          setProgrammes(dbData.programmes);
          setStrategies(dbData.strategies || []);
          setDependencies(dbData.dependencies || []);
          setAssetCategories(dbData.assetCategories || []);
          setResources(dbData.resources || []);
          setApplicationStatuses((dbData as any).applicationStatuses || []);
          setDtsPhases((dbData as any).dtsPhases || []);
          const rawSettings = dbData.timelineSettings || {};
          // Migration: if we have legacy startYear but no startDate, convert it
          const migratedSettings = ('startYear' in rawSettings && !('startDate' in rawSettings))
            ? { startDate: `${(rawSettings as any).startYear}-01-01` }
            : {};
          const mergedSettings = { ...defaultTimelineSettings, ...rawSettings, ...migratedSettings };
          setTimelineSettings(mergedSettings);

          if (!mergedSettings.hasSeenTutorial && !localStorage.getItem('scenia-e2e')) {
            setShowTutorial(true);
          }
        }
      } catch (error) {
        console.error('Failed to load data from DB:', error);
        // Fallback to initial data
        setAssets(initialAssets);
        setApplications(initialApplications);
        setApplicationSegments(initialApplicationSegments);
        setInitiatives(initialInitiatives);
        setMilestones(initialMilestones);
        setProgrammes(initialProgrammes);
        setStrategies(initialStrategies);
        setDependencies(initialDependencies);
        setAssetCategories(initialAssetCategories);
        setTimelineSettings(defaultTimelineSettings);
        setResources(initialResources);
        setApplicationStatuses(initialApplicationStatuses);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const handleSelectTemplate = useCallback(async (templateId: TemplateId, withDemoData: boolean) => {
    const data = getTemplateData(templateId, withDemoData);
    const dataWithEmptyVersions = { ...data, versions: [] };
    try {
      await saveAppData(dataWithEmptyVersions);
    } catch (error) {
      console.error('Failed to save template data to DB:', error instanceof Error ? `${error.name}: ${error.message}` : error);
      setDbSaveError('Failed to save the selected template. Your data may not persist after a reload.');
    }
    setAssets(data.assets);
    setApplications(data.applications);
    setApplicationSegments(data.applicationSegments);
    setInitiatives(data.initiatives);
    setMilestones(data.milestones);
    setProgrammes(data.programmes);
    setStrategies(data.strategies);
    setDependencies(data.dependencies);
    setAssetCategories(data.assetCategories);
    setTimelineSettings(data.timelineSettings);
    setResources(data.resources);
    setApplicationStatuses(data.applicationStatuses);
    setDtsPhases(data.dtsPhases || []);
    setVersions([]);
    setShowTemplatePicker(false);
    setTemplatePickerIsReset(false);
    if (!data.timelineSettings.hasSeenTutorial && !localStorage.getItem('scenia-e2e')) {
      setShowTutorial(true);
    }
  }, []);

  const handleViewerImport = useCallback(async (file: File) => {
    try {
      const imported = await importFromExcel(file);
      const hasData = Object.values(imported).some(arr => Array.isArray(arr) && arr.length > 0);
      if (!hasData) {
        setDbSaveError('No valid data found in the Excel file.');
        return;
      }

      const schemaIssues = validateImportSchema(imported as Record<string, unknown[]>);
      const errorIssues = schemaIssues.filter(issue => issue.severity === 'error');
      if (errorIssues.length > 0) {
        const preview = errorIssues.slice(0, 3).map(issue => `${issue.entity}: ${issue.issue}`).join('; ');
        const moreText = errorIssues.length > 3 ? ` (and ${errorIssues.length - 3} more)` : '';
        setDbSaveError(`Viewer import failed validation: ${preview}${moreText}`);
        return;
      }

      const blank = getTemplateData('viewer', false);
      const data: AppState = {
        assetCategories: imported.assetCategories ?? blank.assetCategories,
        assets: imported.assets ?? blank.assets,
        initiatives: imported.initiatives ?? blank.initiatives,
        milestones: imported.milestones ?? blank.milestones,
        applicationSegments: imported.applicationSegments ?? blank.applicationSegments,
        programmes: imported.programmes ?? blank.programmes,
        strategies: imported.strategies ?? blank.strategies,
        dependencies: imported.dependencies ?? blank.dependencies,
        resources: imported.resources ?? blank.resources,
        applications: imported.applications ?? blank.applications,
        applicationStatuses: imported.applicationStatuses ?? blank.applicationStatuses,
        dtsPhases: (imported as any).dtsPhases ?? blank.dtsPhases,
        timelineSettings: { ...blank.timelineSettings, ...(imported.timelineSettings ?? {}) },
        versions: imported.versions ?? [],
      };
      await saveAppData(data);
      setAssets(data.assets);
      setApplications(data.applications);
      setApplicationSegments(data.applicationSegments);
      setInitiatives(data.initiatives);
      setMilestones(data.milestones);
      setProgrammes(data.programmes);
      setStrategies(data.strategies);
      setDependencies(data.dependencies);
      setAssetCategories(data.assetCategories);
      setTimelineSettings(data.timelineSettings);
      setResources(data.resources);
      setApplicationStatuses(data.applicationStatuses);
      setDtsPhases(data.dtsPhases || []);
      setVersions(data.versions || []);
      setShowTemplatePicker(false);
      setTemplatePickerIsReset(false);
    } catch (error) {
      console.error('Viewer import failed:', error instanceof Error ? `${error.name}: ${error.message}` : error);
      setDbSaveError('Failed to import the file. Please check it is a valid Scenia Excel export.');
    }
  }, []);

  const handleUpdate = useCallback(async (data: AppState, skipHistory = false) => {
    if (!skipHistory) {
      setUndoStack(prev => {
        const newStack = [...prev, getCurrentStateRef.current()];
        if (newStack.length > 10) return newStack.slice(newStack.length - 10);
        return newStack;
      });
      setRedoStack([]);
    }
    // Update state immediately for UI responsiveness
    setAssets(data.assets);
    setApplications(data.applications || []);
    setApplicationSegments(data.applicationSegments || []);
    setInitiatives(data.initiatives);
    setMilestones(data.milestones);
    setProgrammes(data.programmes);
    setStrategies(data.strategies);
    setDependencies(data.dependencies);
    setAssetCategories(data.assetCategories);
    setTimelineSettings(data.timelineSettings);
    setResources(data.resources || []);
    setApplicationStatuses(data.applicationStatuses || []);
    setDtsPhases((data as any).dtsPhases || []);
    if (data.versions) setVersions(data.versions);

    // Persist to DB
    try {
      await saveAppData(data);
    } catch (error) {
      console.error('Failed to save data to DB:', error instanceof Error ? `${error.name}: ${error.message}` : error);
      setDbSaveError('Failed to save changes. Your data may not persist after a reload. If this keeps happening, try refreshing the page.');
    }
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    // Capture previous state BEFORE any state mutations
    const previousState = undoStack[undoStack.length - 1];
    // Capture current state for redo stack BEFORE mutating
    const currentState = getCurrentState();

    // Build new stacks with captured state
    const newUndoStack = undoStack.slice(0, -1);
    const newRedoStack = undoStack.length > 10
      ? [...redoStack.slice(-9), currentState]
      : [...redoStack, currentState];

    setRedoStack(newRedoStack);
    setUndoStack(newUndoStack);

    handleUpdate(previousState, true);
  }, [undoStack, redoStack, handleUpdate]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    // Capture next state BEFORE any state mutations
    const nextState = redoStack[redoStack.length - 1];
    // Capture current state for undo stack BEFORE mutating
    const currentState = getCurrentState();

    // Build new stacks with captured state
    const newRedoStack = redoStack.slice(0, -1);
    const newUndoStack = undoStack.length > 10
      ? [...undoStack.slice(-9), currentState]
      : [...undoStack, currentState];

    setUndoStack(newUndoStack);
    setRedoStack(newRedoStack);

    handleUpdate(nextState, true);
  }, [undoStack, redoStack, handleUpdate]);

  // Keep refs pointing to latest callbacks so the keyboard listener never needs to re-register
  undoRef.current = handleUndo;
  redoRef.current = handleRedo;
  getCurrentStateRef.current = getCurrentState;

  const handleAddInitiative = useCallback((newInit: Initiative) => {
    if (initiatives.some(i => i.id === newInit.id)) return;
    handleUpdate({ assets, applications, applicationSegments, initiatives: [...initiatives, newInit], milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, applicationStatuses, dtsPhases });
  }, [assets, applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, applicationStatuses, dtsPhases, handleUpdate]);

  const handleUpdateInitiative = useCallback((updatedInit: Initiative) => {
    handleUpdate({ assets, applications, applicationSegments, initiatives: initiatives.map(i => i.id === updatedInit.id ? updatedInit : i), milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, applicationStatuses, dtsPhases });
  }, [assets, applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, applicationStatuses, dtsPhases, handleUpdate]);

  const handleUpdateAssets = useCallback((updatedAssets: Asset[]) => {
    handleUpdate({ assets: updatedAssets, applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, applicationStatuses, dtsPhases });
  }, [applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, applicationStatuses, dtsPhases, handleUpdate]);

  const handleUpdateAsset = useCallback((updatedAsset: Asset) => {
    handleUpdate({ assets: assets.map(a => a.id === updatedAsset.id ? updatedAsset : a), applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, applicationStatuses, dtsPhases });
  }, [assets, applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, applicationStatuses, dtsPhases, handleUpdate]);

  const handleUpdateDependencies = useCallback((updatedDependencies: Dependency[]) => {
    handleUpdate({ assets, applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies: updatedDependencies, assetCategories, timelineSettings, resources, applicationStatuses, dtsPhases });
  }, [assets, applications, applicationSegments, initiatives, milestones, programmes, strategies, assetCategories, timelineSettings, resources, applicationStatuses, dtsPhases, handleUpdate]);

  const handleUpdateMilestone = useCallback((updatedMilestone: Milestone) => {
    handleUpdate({ assets, applications, applicationSegments, initiatives, milestones: milestones.map(m => m.id === updatedMilestone.id ? updatedMilestone : m), programmes, strategies, dependencies, assetCategories, timelineSettings, resources, applicationStatuses, dtsPhases });
  }, [assets, applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, applicationStatuses, dtsPhases, handleUpdate]);

  const handleDeleteInitiative = useCallback((deletedInit: Initiative) => {
    handleUpdate({ assets, applications, applicationSegments, initiatives: initiatives.filter(i => i.id !== deletedInit.id), milestones, programmes, strategies, dependencies: dependencies.filter(d => d.sourceId !== deletedInit.id && d.targetId !== deletedInit.id), assetCategories, timelineSettings, resources, applicationStatuses, dtsPhases });
  }, [assets, applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, applicationStatuses, dtsPhases, handleUpdate]);

  const handleUpdateSettings = useCallback((updatedSettings: TimelineSettings) => {
    handleUpdate({ assets, applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings: updatedSettings, resources, applicationStatuses, dtsPhases });
  }, [assets, applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, resources, applicationStatuses, dtsPhases, handleUpdate]);

  const handleRestoreVersion = useCallback((version: import('./types').Version) => {
    handleUpdate({ ...version.data, applicationStatuses: version.data.applicationStatuses ?? [], dtsPhases: version.data.dtsPhases ?? [] });
  }, [handleUpdate]);

  const handleSaveApplicationSegment = useCallback((seg: import('./types').ApplicationSegment) => {
    const exists = applicationSegments.some(s => s.id === seg.id);
    const savedSeg = exists ? seg : { ...seg, id: `seg-${Date.now()}` };
    const next = exists ? applicationSegments.map(s => s.id === seg.id ? savedSeg : s) : [...applicationSegments, savedSeg];
    handleUpdate({ assets, applications, applicationSegments: next, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, applicationStatuses, dtsPhases });
  }, [assets, applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, applicationStatuses, dtsPhases, handleUpdate]);

  const handleDeleteApplicationSegment = useCallback((seg: import('./types').ApplicationSegment) => {
    handleUpdate({ assets, applications, applicationSegments: applicationSegments.filter(s => s.id !== seg.id), initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, applicationStatuses, dtsPhases });
  }, [assets, applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, applicationStatuses, dtsPhases, handleUpdate]);

  const handleUpdateApplicationSegments = useCallback((segs: import('./types').ApplicationSegment[]) => {
    handleUpdate({ assets, applications, applicationSegments: segs, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, applicationStatuses, dtsPhases });
  }, [assets, applications, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, applicationStatuses, dtsPhases, handleUpdate]);

  const handleDeleteAsset = useCallback((assetId: string) => {
    const assetAppIds = new Set(applications.filter(a => a.assetId === assetId).map(a => a.id));
    handleUpdate({
      assets: assets.filter(a => a.id !== assetId),
      applications: applications.filter(a => a.assetId !== assetId),
      applicationSegments: applicationSegments.filter(s => !assetAppIds.has(s.applicationId)),
      initiatives: initiatives.filter(i => i.assetId !== assetId),
      milestones: milestones.filter(m => m.assetId !== assetId),
      programmes, strategies,
      dependencies: dependencies.filter(d => {
        const deletedInitIds = new Set(initiatives.filter(i => i.assetId === assetId).map(i => i.id));
        return !deletedInitIds.has(d.sourceId) && !deletedInitIds.has(d.targetId);
      }),
      assetCategories, timelineSettings, resources, applicationStatuses, dtsPhases,
    });
  }, [assets, applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, applicationStatuses, dtsPhases, handleUpdate]);

  const handleBulkDeleteAssets = useCallback((assetIds: string[]) => {
    const idSet = new Set(assetIds);
    const assetAppIds = new Set(
      applications.filter(a => idSet.has(a.assetId)).map(a => a.id)
    );
    const deletedInitIds = new Set(
      initiatives.filter(i => idSet.has(i.assetId)).map(i => i.id)
    );
    handleUpdate({
      assets: assets.filter(a => !idSet.has(a.id)),
      applications: applications.filter(a => !idSet.has(a.assetId)),
      applicationSegments: applicationSegments.filter(s => !assetAppIds.has(s.applicationId)),
      initiatives: initiatives.filter(i => !idSet.has(i.assetId)),
      milestones: milestones.filter(m => !idSet.has(m.assetId)),
      programmes, strategies,
      dependencies: dependencies.filter(d =>
        !deletedInitIds.has(d.sourceId) && !deletedInitIds.has(d.targetId)
      ),
      assetCategories, timelineSettings, resources, applicationStatuses, dtsPhases,
    });
  }, [assets, applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, applicationStatuses, dtsPhases, handleUpdate]);

  const handleAddAssets = useCallback((newAssets: Asset[]) => {
    // Skip any assets already present (matched by externalId to prevent duplicates)
    const existingExternalIds = new Set(assets.map(a => a.externalId).filter(Boolean));
    const toAdd = newAssets.filter(a => !a.externalId || !existingExternalIds.has(a.externalId));
    if (toAdd.length === 0) return;
    handleUpdate({ assets: [...assets, ...toAdd], applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, applicationStatuses, dtsPhases });
  }, [assets, applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, applicationStatuses, dtsPhases, handleUpdate]);

  useEffect(() => {
    if (!showMoreSettingsPanel && !showViewOptionsPanel) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (showMoreSettingsPanel && moreSettingsPanelRef.current && !moreSettingsPanelRef.current.contains(e.target as Node)) {
        setShowMoreSettingsPanel(false);
      }
      if (showViewOptionsPanel && viewOptionsPanelRef.current && !viewOptionsPanelRef.current.contains(e.target as Node)) {
        setShowViewOptionsPanel(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMoreSettingsPanel, showViewOptionsPanel]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Escape') {
        setShowShortcuts(false);
      }

      if (e.metaKey || e.ctrlKey) {
        if (e.key === 'z') {
          e.preventDefault();
          undoRef.current();
        } else if (e.key === 'Z' || (e.key === 'z' && e.shiftKey)) {
          e.preventDefault();
          redoRef.current();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-100">
        <div className="flex flex-col items-center gap-2 text-slate-500">
          <Loader2 className="animate-spin" size={32} />
          <p>{isImportingShare ? 'Restoring shared workspace...' : 'Loading data...'}</p>
        </div>

        {isImportingShare && (
          <div data-testid="restoring-data-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[200]">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                <Loader2 className="animate-spin text-blue-600" size={32} />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Restoring Data</h2>
              <p className="text-slate-600">
                Please wait while we securely decrypt and load the shared workspace...
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-slate-100 p-3 md:p-6 flex flex-col">
      {dbSaveError && (
        <div
          data-testid="db-error-banner"
          className="flex items-center gap-3 mb-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800 flex-shrink-0"
        >
          <span className="flex-1">{dbSaveError}</span>
          <button
            onClick={() => setDbSaveError(null)}
            className="text-red-500 hover:text-red-700 font-bold text-lg leading-none"
            title="Dismiss"
          >×</button>
        </div>
      )}
      <header className="mb-4 flex-shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm">

        {/* ── Mobile header ── */}
        <div data-testid="mobile-header" className="flex md:hidden items-center gap-3 px-4 py-2">
          <h1 className="text-lg font-bold text-slate-900 tracking-tight whitespace-nowrap">Scenia</h1>
          <div className="flex-1" />
          <button
            data-testid="mobile-settings-btn"
            onClick={() => setShowMobileSheet(true)}
            className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
            title="Timeline settings"
          >
            <SlidersHorizontal size={16} />
          </button>
        </div>

        {/* ── Desktop header ── */}
        <div data-testid="desktop-header-controls" className="hidden md:flex flex-wrap items-center gap-3 px-4 py-2 overflow-x-auto">
        {/* Logo */}
        <h1 className="text-lg font-bold text-slate-900 tracking-tight whitespace-nowrap">Scenia</h1>

        <div className="w-px h-6 bg-slate-200 shrink-0" />

        {/* View Toggle */}
        <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200 shrink-0">
          <button
            onClick={() => setView('visualiser')}
            data-testid="nav-visualiser"
            aria-pressed={view === 'visualiser'}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer",
              view === 'visualiser'
                ? "bg-white text-blue-700 shadow-sm ring-1 ring-blue-200"
                : "text-slate-600 hover:text-slate-800"
            )}
          >
            <LayoutGrid size={14} />
            Visualiser
          </button>
          <button
            onClick={() => setView('data')}
            data-testid="nav-data-manager"
            aria-pressed={view === 'data'}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer",
              view === 'data'
                ? "bg-white text-blue-700 shadow-sm ring-1 ring-blue-200"
                : "text-slate-600 hover:text-slate-800"
            )}
          >
            <Table size={14} />
            Data Manager
          </button>
          <button
            onClick={() => setView('reports')}
            data-testid="nav-reports"
            aria-pressed={view === 'reports'}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer",
              view === 'reports'
                ? "bg-white text-blue-700 shadow-sm ring-1 ring-blue-200"
                : "text-slate-600 hover:text-slate-800"
            )}
          >
            <BarChart2 size={14} />
            Reports
          </button>
          <button
            onClick={() => setView('guide')}
            data-testid="nav-guide"
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer",
              view === 'guide'
                ? "bg-white text-blue-700 shadow-sm ring-1 ring-blue-200"
                : "text-slate-600 hover:text-slate-800"
            )}
          >
            <BookOpen size={14} />
            Guide
          </button>
        </div>

        {/* Search */}
        <div className="relative w-44 shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            type="search"
            data-testid="search-input"
            placeholder="Search initiatives..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {view === 'visualiser' && <>
        <div className="w-px h-6 bg-slate-200 shrink-0" />

        {/* Timeline Range */}
        <label className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0">
          Start
          <input
            type="date"
            data-testid="timeline-start-input"
            value={timelineSettings.startDate}
            onChange={(e) => {
              handleUpdate({
                assets, applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories,
                timelineSettings: { ...timelineSettings, startDate: e.target.value },
                resources, applicationStatuses, dtsPhases,
              });
            }}
            className="px-1.5 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0">
          Months
          <select
            data-testid="timeline-months-select"
            value={timelineSettings.monthsToShow || 36}
            onChange={(e) => {
              handleUpdate({
                assets, applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories,
                timelineSettings: { ...timelineSettings, monthsToShow: parseInt(e.target.value) as 3 | 6 | 12 | 24 | 36 },
                resources, applicationStatuses, dtsPhases,
              });
            }}
            className="px-1.5 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="3">3</option>
            <option value="6">6</option>
            <option value="12">12</option>
            <option value="24">24</option>
            <option value="36">36</option>
          </select>
        </label>

        {/* Inline Display Toggles */}
        {(() => {
          const conflictsOn = (timelineSettings.conflictDetection || 'on') === 'on';
          const relationshipsOn = (timelineSettings.showRelationships || 'on') === 'on';
          const descriptionsOn = (timelineSettings.descriptionDisplay || 'off') === 'on';
          const budgetMode = timelineSettings.budgetVisualisation || 'off';
          const criticalPathOn = (timelineSettings.criticalPath || 'off') === 'on';
          const showResourcesOn = (timelineSettings.showResources || 'off') === 'on';
          const budgetCycle: Array<'off' | 'label' | 'bar-height'> = ['off', 'label', 'bar-height'];
          const nextBudget = budgetCycle[(budgetCycle.indexOf(budgetMode as 'off' | 'label' | 'bar-height') + 1) % 3];

          const toggleClass = (active: boolean) => cn(
            "p-1.5 rounded-md border transition-colors",
            active
              ? "bg-blue-50 border-blue-200 text-blue-600"
              : "bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          );

          return (
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                data-testid="toggle-conflicts"
                data-active={conflictsOn ? 'true' : 'false'}
                aria-label="Conflict Detection"
                aria-pressed={conflictsOn}
                onClick={() => handleUpdate({ assets, applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings: { ...timelineSettings, conflictDetection: conflictsOn ? 'off' : 'on' }, resources, applicationStatuses, dtsPhases })}
                className={toggleClass(conflictsOn)}
                title="Conflict Detection"
              >
                <AlertTriangle size={13} />
              </button>
              <button
                data-testid="toggle-relationships"
                data-active={relationshipsOn ? 'true' : 'false'}
                aria-label="Relationship Lines"
                aria-pressed={relationshipsOn}
                onClick={() => handleUpdate({ assets, applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings: { ...timelineSettings, showRelationships: relationshipsOn ? 'off' : 'on' }, resources, applicationStatuses, dtsPhases })}
                className={toggleClass(relationshipsOn)}
                title="Relationship Lines"
              >
                <GitBranch size={13} />
              </button>
              <button
                data-testid="toggle-descriptions"
                data-active={descriptionsOn ? 'true' : 'false'}
                aria-label="Descriptions"
                aria-pressed={descriptionsOn}
                onClick={() => handleUpdate({ assets, applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings: { ...timelineSettings, descriptionDisplay: descriptionsOn ? 'off' : 'on' }, resources, applicationStatuses, dtsPhases })}
                className={toggleClass(descriptionsOn)}
                title="Descriptions"
              >
                <AlignLeft size={13} />
              </button>
              <button
                data-testid="toggle-budget"
                data-mode={budgetMode}
                aria-label={`Budget visualisation: ${budgetMode}`}
                aria-pressed={budgetMode !== 'off'}
                onClick={() => handleUpdate({ assets, applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings: { ...timelineSettings, budgetVisualisation: nextBudget }, resources, applicationStatuses, dtsPhases })}
                className={toggleClass(budgetMode !== 'off')}
                title={`Budget: ${budgetMode}`}
              >
                <DollarSign size={13} />
              </button>
              <button
                data-testid="toggle-critical-path"
                data-active={criticalPathOn ? 'true' : 'false'}
                aria-label="Critical Path"
                aria-pressed={criticalPathOn}
                onClick={() => handleUpdate({ assets, applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings: { ...timelineSettings, criticalPath: criticalPathOn ? 'off' : 'on' }, resources, applicationStatuses, dtsPhases })}
                className={toggleClass(criticalPathOn)}
                title="Critical Path"
              >
                <GitCommit size={13} />
              </button>
              <button
                data-testid="toggle-resources"
                data-active={showResourcesOn ? 'true' : 'false'}
                aria-label="Show Resources"
                aria-pressed={showResourcesOn}
                onClick={() => handleUpdate({ assets, applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings: { ...timelineSettings, showResources: showResourcesOn ? 'off' : 'on' }, resources, applicationStatuses, dtsPhases })}
                className={toggleClass(showResourcesOn)}
                title="Show Resources"
              >
                <Users size={13} />
              </button>

              {/* Zoom controls */}
              {(() => {
                const ZOOM_STEPS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0];
                const currentZoom = timelineSettings.columnZoom ?? 1.0;
                const currentIdx = ZOOM_STEPS.findIndex(z => Math.abs(z - currentZoom) < 0.01);
                const idx = currentIdx === -1 ? ZOOM_STEPS.indexOf(1.0) : currentIdx;
                const canZoomOut = idx > 0;
                const canZoomIn = idx < ZOOM_STEPS.length - 1;
                return (
                  <>
                    <div className="w-px h-4 bg-slate-200 mx-0.5" />
                    <button
                      data-testid="zoom-out"
                      aria-label="Zoom out"
                      disabled={!canZoomOut}
                      onClick={() => handleUpdate({ assets, applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings: { ...timelineSettings, columnZoom: ZOOM_STEPS[idx - 1] }, resources, applicationStatuses, dtsPhases })}
                      className={cn(toggleClass(false), !canZoomOut && 'opacity-30 cursor-not-allowed')}
                      title="Zoom out"
                    >
                      <ZoomOut size={13} />
                    </button>
                    <button
                      data-testid="zoom-in"
                      aria-label="Zoom in"
                      disabled={!canZoomIn}
                      onClick={() => handleUpdate({ assets, applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings: { ...timelineSettings, columnZoom: ZOOM_STEPS[idx + 1] }, resources, applicationStatuses, dtsPhases })}
                      className={cn(toggleClass(false), !canZoomIn && 'opacity-30 cursor-not-allowed')}
                      title="Zoom in"
                    >
                      <ZoomIn size={13} />
                    </button>
                  </>
                );
              })()}

              {/* More settings (snap, empty rows) */}
              <div className="relative" ref={moreSettingsPanelRef}>
                <button
                  data-testid="display-more-btn"
                  onClick={() => setShowMoreSettingsPanel(v => !v)}
                  className={toggleClass(showMoreSettingsPanel)}
                  title="More settings"
                >
                  <MoreHorizontal size={13} />
                </button>
                {showMoreSettingsPanel && moreSettingsPanelRef.current && (() => {
                  const r = moreSettingsPanelRef.current!.getBoundingClientRect();
                  const w = 192; // w-48
                  const left = Math.min(r.left, window.innerWidth - w - 4);
                  return (
                  <div
                    className="fixed bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-3 w-48"
                    style={{ top: r.bottom + 6, left }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="space-y-2">
                      {[
                        { label: 'Empty Rows', id: 'emptyRowDisplay', value: timelineSettings.emptyRowDisplay || 'show', options: [['show', 'Show'], ['hide', 'Hide']], key: 'emptyRowDisplay' as const },
                        { label: 'Snap to Month', id: 'snapToPeriod', value: timelineSettings.snapToPeriod || 'off', options: [['off', 'Off'], ['month', 'Month']], key: 'snapToPeriod' as const },
                      ].map(({ label, id, value, options, key }) => (
                        <div key={id} className="flex items-center justify-between gap-3">
                          <label htmlFor={id} className="text-xs text-slate-600 whitespace-nowrap">{label}</label>
                          <select
                            id={id}
                            value={value}
                            onChange={(e) => {
                              handleUpdate({
                                assets, applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories,
                                timelineSettings: { ...timelineSettings, [key]: e.target.value },
                                resources, applicationStatuses, dtsPhases,
                              });
                            }}
                            className="px-1.5 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            {options.map(([val, lbl]) => (
                              <option key={val} value={val}>{lbl}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                      <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-100">
                        <label htmlFor="clusterName" className="text-xs text-slate-600 whitespace-nowrap">Cluster</label>
                        <input
                          id="clusterName"
                          data-testid="cluster-name-input"
                          type="text"
                          value={timelineSettings.clusterName || ''}
                          onChange={(e) => {
                            handleUpdate({
                              assets, applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories,
                              timelineSettings: { ...timelineSettings, clusterName: e.target.value || undefined },
                              resources, applicationStatuses, dtsPhases,
                            });
                          }}
                          placeholder="e.g. Digital First Cluster"
                          className="px-1.5 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 w-32"
                        />
                      </div>
                    </div>
                  </div>
                  );
                })()}
              </div>
            </div>
          );
        })()}
        </>}

        {/* View Options — colour-by and group-by in a single compact popover */}
        {view === 'visualiser' && (() => {
          const colorBy = timelineSettings.colorBy || 'programme';
          const groupBy = timelineSettings.groupBy || 'asset';
          const display = timelineSettings.display || 'both';
          const dtsAdoptionOn = timelineSettings.showDtsAdoptionStatus === 'on';
          const colorLabel = colorBy === 'programme' ? 'Programme' : colorBy === 'strategy' ? 'Strategy' : colorBy === 'rag' ? 'Status' : colorBy === 'dts-phase' ? 'DTS Phase' : 'Progress';
          const groupLabel = groupBy === 'asset' ? 'Asset' : groupBy === 'programme' ? 'Programme' : groupBy === 'dts-phase' ? 'DTS Phase' : 'Strategy';
          const displayLabel = display === 'initiatives' ? 'Initiatives' : display === 'applications' ? 'Applications' : 'Both';
          return (
            <div className="relative shrink-0" ref={viewOptionsPanelRef}>
              <button
                data-testid="view-options-btn"
                onClick={() => setShowViewOptionsPanel(v => !v)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                  showViewOptionsPanel
                    ? "bg-blue-50 border-blue-200 text-blue-600"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                )}
                title="View options: colour, grouping and display"
              >
                <Palette size={13} />
                {colorLabel}
                <span className="text-slate-300">·</span>
                <Box size={13} />
                {groupLabel}
                <span className="text-slate-300">·</span>
                {displayLabel}
              </button>

              {showViewOptionsPanel && viewOptionsPanelRef.current && (() => {
                const r = viewOptionsPanelRef.current!.getBoundingClientRect();
                const w = 208; // w-52
                const left = Math.min(r.left, window.innerWidth - w - 4);
                return (
                <div
                  data-testid="view-options-popover"
                  className="fixed bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-3 w-52"
                  style={{ top: r.bottom + 6, left }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {/* Colour by */}
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Colour by</p>
                  <div className="flex flex-col gap-1 mb-3">
                    <button
                      aria-pressed={colorBy === 'programme'}
                      onClick={() => handleUpdateSettings({ ...timelineSettings, colorBy: 'programme' })}
                      className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all", colorBy === 'programme' ? "bg-blue-50 text-blue-600" : "text-slate-600 hover:bg-slate-50")}
                    >
                      <Palette size={13} />
                      By Programme
                    </button>
                    <button
                      aria-pressed={colorBy === 'strategy'}
                      onClick={() => handleUpdateSettings({ ...timelineSettings, colorBy: 'strategy' })}
                      className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all", colorBy === 'strategy' ? "bg-indigo-50 text-indigo-600" : "text-slate-600 hover:bg-slate-50")}
                    >
                      <Palette size={13} />
                      By Strategy
                    </button>
                    <button
                      aria-pressed={colorBy === 'status'}
                      onClick={() => handleUpdateSettings({ ...timelineSettings, colorBy: 'status' })}
                      className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all", colorBy === 'status' ? "bg-emerald-50 text-emerald-600" : "text-slate-600 hover:bg-slate-50")}
                    >
                      <Palette size={13} />
                      By Progress
                    </button>
                    <button
                      aria-pressed={colorBy === 'rag'}
                      onClick={() => handleUpdateSettings({ ...timelineSettings, colorBy: 'rag' })}
                      className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all", colorBy === 'rag' ? "bg-rose-50 text-rose-600" : "text-slate-600 hover:bg-slate-50")}
                    >
                      <Palette size={13} />
                      By Status
                    </button>
                    {hasDtsAssets && (
                      <button
                        data-testid="colour-by-dts-phase"
                        aria-pressed={colorBy === 'dts-phase'}
                        onClick={() => handleUpdateSettings({ ...timelineSettings, colorBy: 'dts-phase' })}
                        className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all", colorBy === 'dts-phase' ? "bg-violet-50 text-violet-600" : "text-slate-600 hover:bg-slate-50")}
                      >
                        <Palette size={13} />
                        DTS Phase
                      </button>
                    )}
                  </div>

                  {/* Group by */}
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Group by</p>
                  <div className="flex flex-col gap-1 mb-3">
                    <button
                      data-testid="group-by-asset"
                      aria-pressed={groupBy === 'asset'}
                      onClick={() => handleUpdateSettings({ ...timelineSettings, groupBy: 'asset' })}
                      className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all", groupBy === 'asset' ? "bg-slate-100 text-slate-800" : "text-slate-600 hover:bg-slate-50")}
                    >
                      <Box size={13} />
                      Asset
                    </button>
                    <button
                      data-testid="group-by-programme"
                      aria-pressed={groupBy === 'programme'}
                      onClick={() => handleUpdateSettings({ ...timelineSettings, groupBy: 'programme' })}
                      className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all", groupBy === 'programme' ? "bg-slate-100 text-slate-800" : "text-slate-600 hover:bg-slate-50")}
                    >
                      <Boxes size={13} />
                      Programme
                    </button>
                    <button
                      data-testid="group-by-strategy"
                      aria-pressed={groupBy === 'strategy'}
                      onClick={() => handleUpdateSettings({ ...timelineSettings, groupBy: 'strategy' })}
                      className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all", groupBy === 'strategy' ? "bg-slate-100 text-slate-800" : "text-slate-600 hover:bg-slate-50")}
                    >
                      <Target size={13} />
                      Strategy
                    </button>
                    {hasDtsAssets && (
                      <button
                        data-testid="group-by-dts-phase"
                        aria-pressed={groupBy === 'dts-phase'}
                        onClick={() => handleUpdateSettings({ ...timelineSettings, groupBy: 'dts-phase' })}
                        className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all", groupBy === 'dts-phase' ? "bg-slate-100 text-slate-800" : "text-slate-600 hover:bg-slate-50")}
                      >
                        <Boxes size={13} />
                        DTS Phase
                      </button>
                    )}
                  </div>

                  {/* Show */}
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Show</p>
                  <div className="flex flex-col gap-1">
                    <button
                      data-testid="show-both"
                      aria-pressed={display === 'both'}
                      onClick={() => handleUpdateSettings({ ...timelineSettings, display: 'both' })}
                      className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all", display === 'both' ? "bg-slate-100 text-slate-800" : "text-slate-600 hover:bg-slate-50")}
                    >
                      <Layers size={13} />
                      Both
                    </button>
                    <button
                      data-testid="show-initiatives"
                      aria-pressed={display === 'initiatives'}
                      onClick={() => handleUpdateSettings({ ...timelineSettings, display: 'initiatives' })}
                      className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all", display === 'initiatives' ? "bg-slate-100 text-slate-800" : "text-slate-600 hover:bg-slate-50")}
                    >
                      <GitCommitHorizontal size={13} />
                      Initiatives
                    </button>
                    <button
                      data-testid="show-applications"
                      aria-pressed={display === 'applications'}
                      onClick={() => handleUpdateSettings({ ...timelineSettings, display: 'applications' })}
                      className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all", display === 'applications' ? "bg-slate-100 text-slate-800" : "text-slate-600 hover:bg-slate-50")}
                    >
                      <AppWindow size={13} />
                      Applications
                    </button>
                  </div>

                  {/* DTS adoption status toggle — only for DTS workspaces */}
                  {hasDtsAssets && (
                    <>
                      <div className="border-t border-slate-100 my-3" />
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">DTS</p>
                      <button
                        data-testid="toggle-dts-adoption-status"
                        data-active={dtsAdoptionOn ? 'true' : 'false'}
                        onClick={() => handleUpdateSettings({ ...timelineSettings, showDtsAdoptionStatus: dtsAdoptionOn ? 'off' : 'on' })}
                        className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all w-full text-left", dtsAdoptionOn ? "bg-indigo-50 text-indigo-600" : "text-slate-600 hover:bg-slate-50")}
                      >
                        <span className={cn("w-3 h-3 rounded-full border flex-shrink-0", dtsAdoptionOn ? "bg-indigo-500 border-indigo-500" : "border-slate-300")} />
                        Adoption Status
                      </button>
                    </>
                  )}
                </div>
                );
              })()}
            </div>
          );
        })()}

        {/* Spacer */}
        <div className="flex-1" />

        {/* History */}
        <button
          onClick={() => setIsVersionManagerOpen(true)}
          data-testid="nav-history"
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
          title="Version History"
        >
          <History size={14} />
          History
        </button>

        <div className="w-px h-6 bg-slate-200 shrink-0" />

        {/* Data Controls (PDF, Export, Import) */}
        <DataControls
          data={{ assets, applications, applicationSegments, applicationStatuses, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, versions, dtsPhases }}
          onImport={handleUpdate}
          onError={setDbSaveError}
          timelineId={view === 'visualiser' ? 'timeline-visualiser' : undefined}
        />

        <div className="w-px h-6 bg-slate-200 shrink-0" />

        {/* Undo/Redo */}
        <div className="flex items-center bg-slate-50 rounded-lg border border-slate-200 p-0.5 shrink-0">
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="p-1.5 text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed rounded-md transition-colors"
            title="Undo"
          >
            <Undo2 size={14} />
          </button>
          {undoStack.length > 0 && (
            <span data-testid="undo-counter" className="text-[10px] font-medium text-slate-400 px-0.5 min-w-[12px] text-center leading-none select-none">
              {undoStack.length}
            </span>
          )}
          <div className="w-px h-3.5 bg-slate-200" />
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="p-1.5 text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed rounded-md transition-colors"
            title="Redo"
          >
            <Redo2 size={14} />
          </button>
        </div>

        {/* Features / Tutorial */}
        <div className="flex bg-slate-50 rounded-lg border border-slate-200 p-0.5 shrink-0">
          <button
            onClick={() => setShowFeatures(true)}
            data-testid="nav-features"
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-white rounded-md transition-colors"
            title="Features"
          >
            <BookOpen size={16} />
          </button>
          <div className="w-px h-3.5 bg-slate-200 my-auto mx-0.5" />
          <button
            onClick={() => setShowTutorial(true)}
            data-testid="nav-tutorial"
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-white rounded-md transition-colors"
            title="Tutorial"
          >
            <HelpCircle size={16} />
          </button>
          <div className="w-px h-3.5 bg-slate-200 my-auto mx-0.5" />
          <button
            onClick={() => setShowShortcuts(true)}
            data-testid="keyboard-shortcuts-btn"
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-white rounded-md transition-colors"
            title="Keyboard Shortcuts"
          >
            <Keyboard size={16} />
          </button>
        </div>
        </div>{/* end desktop-header-controls */}
      </header>

      {/* ── Mobile settings bottom sheet ── */}
      {showMobileSheet && (
        <>
          <div
            data-testid="mobile-settings-backdrop"
            className="fixed inset-0 bg-slate-900/40 z-40 md:hidden"
            onClick={() => setShowMobileSheet(false)}
            onKeyDown={(e) => e.key === 'Escape' && setShowMobileSheet(false)}
          />
          <div
            data-testid="mobile-settings-sheet"
            className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white rounded-t-2xl shadow-2xl border-t border-slate-200 p-5 space-y-4"
            onKeyDown={(e) => e.key === 'Escape' && setShowMobileSheet(false)}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-slate-700">Settings</span>
              <button onClick={() => setShowMobileSheet(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                <X size={16} />
              </button>
            </div>
            <label className="flex items-center justify-between text-sm text-slate-600">
              Start date
              <input
                type="date"
                value={timelineSettings.startDate}
                onChange={(e) => handleUpdate({ assets, applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings: { ...timelineSettings, startDate: e.target.value }, resources, applicationStatuses, dtsPhases })}
                className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
            <label className="flex items-center justify-between text-sm text-slate-600">
              Months
              <select
                value={timelineSettings.monthsToShow || 36}
                onChange={(e) => handleUpdate({ assets, applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings: { ...timelineSettings, monthsToShow: parseInt(e.target.value) as 3 | 6 | 12 | 24 | 36 }, resources, applicationStatuses, dtsPhases })}
                className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="3">3</option>
                <option value="6">6</option>
                <option value="12">12</option>
                <option value="24">24</option>
                <option value="36">36</option>
              </select>
            </label>
            {/* Group by — bucket mode for card view */}
            <div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Group by</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {(['Timeline', 'Quarter', 'Year', 'Programme', 'Strategy'] as const).map(label => {
                  const mode = label.toLowerCase() as 'timeline' | 'quarter' | 'year' | 'programme' | 'strategy';
                  const active = (timelineSettings.mobileBucketMode ?? 'timeline') === mode;
                  return (
                    <button
                      key={mode}
                      data-testid={`bucket-mode-${mode}`}
                      onClick={() => handleUpdate({ assets, applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings: { ...timelineSettings, mobileBucketMode: mode }, resources, applicationStatuses, dtsPhases })}
                      className={cn(
                        'px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                        active ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-500'
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
                {hasDtsAssets && (
                  <button
                    data-testid="bucket-mode-dts-phase"
                    onClick={() => handleUpdate({ assets, applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings: { ...timelineSettings, mobileBucketMode: 'dts-phase' }, resources, applicationStatuses, dtsPhases })}
                    className={cn(
                      'px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                      (timelineSettings.mobileBucketMode as string) === 'dts-phase' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-500'
                    )}
                  >
                    DTS Phase
                  </button>
                )}
              </div>
            </div>

            {(() => {
              const conflictsOn = (timelineSettings.conflictDetection || 'on') === 'on';
              const relationshipsOn = (timelineSettings.showRelationships || 'on') === 'on';
              const descriptionsOn = (timelineSettings.descriptionDisplay || 'off') === 'on';
              const budgetMode = timelineSettings.budgetVisualisation || 'off';
              const budgetCycle: Array<'off' | 'label' | 'bar-height'> = ['off', 'label', 'bar-height'];
              const nextBudget = budgetCycle[(budgetCycle.indexOf(budgetMode as 'off' | 'label' | 'bar-height') + 1) % 3];
              const dtsAdoptionOn = timelineSettings.showDtsAdoptionStatus === 'on';
              const sheetToggleClass = (active: boolean) => cn(
                'px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                active ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-500'
              );
              return (
                <div className="flex flex-wrap gap-2">
                  <button data-testid="mobile-toggle-conflicts" aria-pressed={conflictsOn} className={sheetToggleClass(conflictsOn)} onClick={() => handleUpdate({ assets, applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings: { ...timelineSettings, conflictDetection: conflictsOn ? 'off' : 'on' }, resources, applicationStatuses, dtsPhases })}>Conflicts</button>
                  <button data-testid="mobile-toggle-relationships" aria-pressed={relationshipsOn} className={sheetToggleClass(relationshipsOn)} onClick={() => handleUpdate({ assets, applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings: { ...timelineSettings, showRelationships: relationshipsOn ? 'off' : 'on' }, resources, applicationStatuses, dtsPhases })}>Relationships</button>
                  <button data-testid="mobile-toggle-descriptions" aria-pressed={descriptionsOn} className={sheetToggleClass(descriptionsOn)} onClick={() => handleUpdate({ assets, applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings: { ...timelineSettings, descriptionDisplay: descriptionsOn ? 'off' : 'on' }, resources, applicationStatuses, dtsPhases })}>Descriptions</button>
                  <button data-testid="mobile-toggle-budget" aria-pressed={budgetMode !== 'off'} className={sheetToggleClass(budgetMode !== 'off')} onClick={() => handleUpdate({ assets, applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings: { ...timelineSettings, budgetVisualisation: nextBudget }, resources, applicationStatuses, dtsPhases })}>Budget: {budgetMode}</button>
                  {hasDtsAssets && (
                    <button data-testid="mobile-toggle-dts-adoption" className={sheetToggleClass(dtsAdoptionOn)} onClick={() => handleUpdate({ assets, applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings: { ...timelineSettings, showDtsAdoptionStatus: dtsAdoptionOn ? 'off' : 'on' }, resources, applicationStatuses, dtsPhases })}>Adoption Status</button>
                  )}
                </div>
              );
            })()}
          </div>
        </>
      )}

      {/* ── Mobile bottom tab bar ── */}
      <div data-testid="mobile-tab-bar" className="flex md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 shadow-lg">
        {([
          { id: 'visualiser', testid: 'mobile-tab-visualiser', icon: <LayoutGrid size={20} />, label: 'Visualiser' },
          { id: 'reports',    testid: 'mobile-tab-reports',    icon: <BarChart2 size={20} />,  label: 'Reports' },
        ] as const).map(tab => (
          <button
            key={tab.id}
            data-testid={tab.testid}
            onClick={() => setView(tab.id)}
            className={cn(
              'flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors border-t-2',
              view === tab.id ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <main className="flex-1 min-h-0 pb-16 md:pb-0">
        {view === 'visualiser' ? (
          isMobile ? (
            <MobileCardView
              assets={assets}
              initiatives={initiatives}
              programmes={programmes}
              strategies={strategies}
              dependencies={dependencies}
              assetCategories={assetCategories}
              settings={timelineSettings}
              resources={resources}
              dtsPhases={dtsPhases}
              onSaveInitiative={handleUpdateInitiative}
              onDeleteInitiative={handleDeleteInitiative}
              onOpenSettings={() => setShowMobileSheet(true)}
            />
          ) : (
          <Timeline
            assets={assets}
            applications={applications}
            initiatives={initiatives}
            milestones={milestones}
            programmes={programmes}
            strategies={strategies}
            dependencies={dependencies}
            assetCategories={assetCategories}
            resources={resources}
            settings={timelineSettings}
            searchQuery={searchQuery}
            onAddInitiative={handleAddInitiative}
            onUpdateInitiative={handleUpdateInitiative}
            onUpdateAssets={handleUpdateAssets}
            onUpdateDependencies={handleUpdateDependencies}
            onUpdateMilestone={handleUpdateMilestone}
            onDeleteInitiative={handleDeleteInitiative}
            onUpdateSettings={handleUpdateSettings}
            applicationSegments={applicationSegments}
            onSaveApplicationSegment={handleSaveApplicationSegment}
            onDeleteApplicationSegment={handleDeleteApplicationSegment}
            onUpdateApplicationSegments={handleUpdateApplicationSegments}
            applicationStatuses={applicationStatuses}
            dtsPhases={dtsPhases}
            onDeleteAsset={handleDeleteAsset}
            onBulkDeleteAssets={handleBulkDeleteAssets}
            onAddAssets={handleAddAssets}
          />
          )
        ) : view === 'data' ? (
          <Suspense fallback={<LoadingFallback />}>
            <DataManager
              data={{ assets, applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, applicationStatuses, dtsPhases }}
              onUpdate={handleUpdate}
              onOpenTemplatePicker={() => { setTemplatePickerIsReset(true); setShowTemplatePicker(true); }}
              searchQuery={searchQuery}
            />
          </Suspense>
        ) : view === 'reports' ? (
          <Suspense fallback={<LoadingFallback />}>
            <ReportsView assets={assets} initiatives={initiatives} milestones={milestones} dependencies={dependencies} currentData={getCurrentState()} programmes={programmes} strategies={strategies} assetCategories={assetCategories} resources={resources} dtsPhases={dtsPhases} onSaveAsset={handleUpdateAsset} onNavigateToAsset={(assetId, assetName) => { setView('visualiser'); setSearchQuery(assetName); }} />
          </Suspense>
        ) : (
          <Suspense fallback={<LoadingFallback />}>
            <HelpView />
          </Suspense>
        )}
      </main>

      <footer className="hidden md:flex flex-shrink-0 pt-2 items-center justify-center gap-1 text-xs text-slate-400">
        Scenia IT Initiative Planner — an{' '}
        <a
          href="https://github.com/waylonkenning/scenia"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-slate-600 transition-colors"
        >
          open source
        </a>
        {' '}tool from{' '}
        <a
          href="https://kenning.co.nz"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-slate-600 transition-colors"
        >
          Waylon Kenning
        </a>
      </footer>

      {showFeatures && (
        <ModalErrorBoundary onDismiss={() => setShowFeatures(false)}>
          <TestErrorThrower />
          <Suspense fallback={null}>
            <FeaturesModal onClose={() => setShowFeatures(false)} />
          </Suspense>
        </ModalErrorBoundary>
      )}

      <ModalErrorBoundary onDismiss={() => setShowShortcuts(false)}>
        <Suspense fallback={null}>
          <KeyboardShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
        </Suspense>
      </ModalErrorBoundary>

      {showTemplatePicker && !showLandingPage && (
        <ModalErrorBoundary onDismiss={() => { setShowTemplatePicker(false); setTemplatePickerIsReset(false); }}>
          <Suspense fallback={null}>
            <TemplatePickerModal onSelect={handleSelectTemplate} onViewerImport={handleViewerImport} isReset={templatePickerIsReset} />
          </Suspense>
        </ModalErrorBoundary>
      )}

      {showTutorial && (
        <ModalErrorBoundary onDismiss={() => setShowTutorial(false)}>
          <Suspense fallback={null}>
            <TutorialModal
              onClose={() => {
                setShowTutorial(false);
                if (!timelineSettings.hasSeenTutorial) {
                  handleUpdate({
                    assets, applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories,
                    timelineSettings: { ...timelineSettings, hasSeenTutorial: true },
                    resources, applicationStatuses, dtsPhases,
                  });
                }
              }} 
            />
          </Suspense>
        </ModalErrorBoundary>
      )}

      {showLandingPage && (
        <ModalErrorBoundary onDismiss={() => setShowLandingPage(false)}>
          <Suspense fallback={null}>
            <LandingPage
              onGetStarted={() => {
                setShowLandingPage(false);
                localStorage.setItem('scenia_has_seen_landing', 'true');
              }}
            />
          </Suspense>
        </ModalErrorBoundary>
      )}

      <ModalErrorBoundary onDismiss={() => setIsVersionManagerOpen(false)}>
        <VersionManager
          isOpen={isVersionManagerOpen}
          onClose={() => setIsVersionManagerOpen(false)}
          onRestore={handleRestoreVersion}
          versions={versions}
          onUpdateVersions={setVersions}
          currentData={{
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
          }}
        />
      </ModalErrorBoundary>
    </div>
  );
}

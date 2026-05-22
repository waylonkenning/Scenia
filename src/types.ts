/**
 * @license
 * Apache License 2.0
 */

export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

/**
 * Represents a high-level strategic goal.
 * Used for categorising and colouring initiatives.
 */
export interface Strategy {
  id: string;
  name: string;
  color: string; // Tailwind color class or hex string
}

/**
 * Represents a delivery programme that groups multiple initiatives.
 */
export interface Programme {
  id: string;
  name: string;
  color: string; // Tailwind color class or hex string
}

/**
 * High-level grouping for IT Assets (e.g., "Infrastructure", "Applications").
 */
export interface AssetCategory {
  id: string;
  name: string;
  order?: number; // Optional sort order for the categories
}

/**
 * A person or generic role that can be assigned to initiatives.
 */
export interface Resource {
  id: string;
  name: string;  // Person name or generic role, e.g. "Jane Smith" or "Business Analyst"
  role?: string; // Optional job title / role label
}

/**
 * A named, coloured status that can be applied to an ApplicationSegment.
 */
export interface ApplicationStatus {
  id: string;
  name: string;
  color: string;
}

/**
 * The core entity representing a specific project or piece of work.
 */
export interface Initiative {
  id: string;
  name: string;
  programmeId: string;
  strategyId?: string;
  assetId: string;
  applicationId?: string; // Optional: links the initiative to a specific application within the asset
  startDate: string; // ISO format: YYYY-MM-DD
  endDate: string;   // ISO format: YYYY-MM-DD
  capex: number;     // Capital expenditure
  opex: number;      // Operational expenditure
  description?: string;
  isPlaceholder?: boolean;
  status?: 'planned' | 'active' | 'done' | 'cancelled';
  ragStatus?: 'green' | 'amber' | 'red';
  progress?: number; // 0–100
  owner?: string;    // Legacy free-text owner (used as fallback when ownerId is absent)
  ownerId?: string;  // ID of a Resource record
  resourceIds?: string[]; // IDs of additionally assigned resources
  dtsPhase?: DtsPhase;   // Only relevant for DTS workspaces
}

/**
 * Defines a directed relationship between two initiatives.
 */
export interface Dependency {
  id: string;
  sourceId: string; // The ID of the initiative, milestone, or application segment that has the dependency
  targetId: string; // The ID of the initiative or application segment being depended upon
  type: 'blocks' | 'requires' | 'related';
  midXOffset?: number; // Manual horizontal offset for the vertical segment of the arrow
  sourceType?: 'initiative' | 'milestone' | 'segment'; // Defaults to 'initiative' when absent
  targetType?: 'initiative' | 'segment'; // Defaults to 'initiative' when absent
}

/**
 * Significant point in time for a specific Asset.
 */
export interface Milestone {
  id: string;
  assetId: string;
  date: string; // ISO format: YYYY-MM-DD
  name: string;
  type: 'info' | 'warning' | 'critical';
}

export type DtsAdoptionStatus =
  | 'not-started'
  | 'scoping'
  | 'in-delivery'
  | 'adopted'
  | 'decommissioning'
  | 'not-applicable';

/** Loose string type — phase IDs are now user-defined records stored in IndexedDB. */
export type DtsPhase = string;

/**
 * A user-configurable DTS Phase record stored in the dtsPhases IndexedDB store.
 */
export interface DtsPhaseRecord {
  id: string;
  name: string;
  color: string;
}

/**
 * Represents a specific system, team, or resource area.
 */
export interface Asset {
  id: string;
  name: string;
  categoryId: string;
  maturity?: number; // 1–5: Emergent → Optimised. Omitted means unrated.
  alias?: string;      // GEANZ alias code, e.g. "TAP.16.01" — present only on GEANZ-sourced assets
  externalId?: string; // GEANZ GUID — used for idempotent re-import
  dtsAdoptionStatus?: DtsAdoptionStatus; // Only relevant for DTS assets (alias starts with "DTS.")
}

/**
 * An application or technology component that makes up an IT asset.
 */
export interface Application {
  id: string;
  assetId: string;
  name: string;
}

/**
 * A time-bounded lifecycle phase for an Application.
 * An application may have many segments representing its progression
 * through planned → in-production → sunset → retired etc.
 */
export interface ApplicationSegment {
  id: string;
  applicationId: string; // Links segment to an Application record within the asset
  startDate: string; // ISO format: YYYY-MM-DD
  endDate: string;   // ISO format: YYYY-MM-DD
  status: string;
  row?: number;      // Which row within the swimlane (0-indexed). Auto-assigned if absent.
  rowSpan?: number;  // How many rows tall this segment is (default 1). Controlled by bottom-edge drag.
}

/**
 * Internal type used for rendering the timeline grid columns.
 */
export interface TimeColumn {
  date: Date;
  label: string;
  year: number;
  quarter: number;
}

/**
 * Global UI and rendering configuration.
 */
export interface TimelineSettings {
  startDate: string; // YYYY-MM-DD
  monthsToShow: 3 | 6 | 12 | 24 | 36;
  budgetVisualisation: 'label' | 'bar-height' | 'off';
  descriptionDisplay: 'on' | 'off';
  emptyRowDisplay: 'show' | 'hide';
  snapToPeriod: 'off' | 'month';
  conflictDetection: 'on' | 'off';
  showRelationships: 'on' | 'off';
  columnWidths?: Record<string, Record<string, string>>;
  collapsedGroups?: string[];
  hasSeenTutorial?: boolean;
  columnZoom?: number; // Multiplier for minimum column width (0.5–3.0, default 1.0)
  sidebarWidth?: number; // Width of the sticky asset/programme sidebar in pixels
  mobileBucketMode?: 'timeline' | 'quarter' | 'year' | 'programme' | 'strategy' | 'dts-phase';
  criticalPath?: 'on' | 'off';
  groupBy?: 'asset' | 'programme' | 'strategy' | 'dts-phase';
  colorBy?: 'programme' | 'strategy' | 'status' | 'rag' | 'dts-phase';
  showResources?: 'on' | 'off';
  display?: 'both' | 'initiatives' | 'applications';
  templateId?: string;           // Which workspace template was selected on first load
  showGeanzCatalogue?: boolean;  // When false, the GEANZ catalogue section is hidden (default: true)
  showDtsAdoptionStatus?: 'on' | 'off'; // Show coloured adoption status badges on DTS asset rows
  clusterName?: string;                 // Agency cluster name — shown in header and DTS Summary export
}

/**
 * A persistent snapshot of the entire application state.
 */
export interface Version {
  id: string;
  name: string;
  timestamp: string; // ISO string
  description?: string;
  data: {
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
    applicationStatuses?: ApplicationStatus[];
    dtsPhases?: DtsPhaseRecord[];
  };
}

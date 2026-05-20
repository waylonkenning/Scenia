import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, FileText, AlertCircle, Check, TriangleAlert, ImageDown, Share } from 'lucide-react';
import { exportToExcel, importFromExcel } from '../lib/excel';
import { SchemaIssue, validateImportSchema } from '../lib/importValidation';
import { exportToPDF, exportToPNG } from '../lib/pdf';
import { shareWorkspace } from '../lib/share';
import { Asset, Application, ApplicationSegment, ApplicationStatus, Initiative, Milestone, Programme, Strategy, Dependency, AssetCategory, TimelineSettings, Resource, Version, DtsPhaseRecord } from '../types';

interface DataControlsProps {
  data: {
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
    timelineSettings: TimelineSettings;
    resources: Resource[];
    versions?: Version[];
    dtsPhases?: DtsPhaseRecord[];
  };
  onImport: (data: {
    assets: Asset[];
    applications: Application[];
    applicationSegments: ApplicationSegment[];
    applicationStatuses: ApplicationStatus[];
    initiatives: Initiative[];
    milestones: Milestone[];
    programmes: Programme[];
    strategies: Strategy[];
    dependencies: Dependency[];
    assetCategories: AssetCategory[];
    timelineSettings: TimelineSettings;
    resources: Resource[];
    versions?: Version[];
    dtsPhases?: DtsPhaseRecord[];
  }) => void;
  onError?: (message: string | null) => void;
  timelineId?: string; // ID of the element to capture for PDF
}

export function DataControls({ data, onImport, onError, timelineId }: DataControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPreviewData, setImportPreviewData] = useState<Partial<typeof data> | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importSchemaIssues, setImportSchemaIssues] = useState<SchemaIssue[]>([]);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [showShareSuccessModal, setShowShareSuccessModal] = useState(false);
  const [showShareConsentModal, setShowShareConsentModal] = useState(false);
  const [hasConsented, setHasConsented] = useState(false);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };
  const handleShare = async () => {
    setHasConsented(false);
    setShowShareConsentModal(true);
  };

  const handleGenerateShareLink = async () => {
    setShowShareConsentModal(false);
    setIsSharing(true);
    try {
      const { url } = await shareWorkspace(data);
      try {
        await navigator.clipboard.writeText(url);
      } catch (clipErr) {
        console.warn('Clipboard copy failed:', clipErr);
      }
      setShowShareSuccessModal(true);
    } catch (error) {
      console.error('Share failed:', error);
      const message = error instanceof Error ? error.message : 'Failed to generate share link.';
      showNotification('error', message);
      if (onError) onError(message);
    } finally {
      setIsSharing(false);
    }
  };

  const handleExportExcel = () => {
    exportToExcel(data);
  };

  const handleExportPDF = () => {
    if (timelineId) {
      exportToPDF(timelineId, `it-roadmap-${new Date().toISOString().split('T')[0]}.pdf`)
        .catch(() => showNotification('error', 'Failed to export PDF. Please try again.'));
    } else {
      showNotification('error', 'Switch to Visualiser view to export PDF.');
    }
  };

  const handleExportPNG = () => {
    if (timelineId) {
      exportToPNG(timelineId, `it-roadmap-${new Date().toISOString().split('T')[0]}.png`)
        .catch(() => showNotification('error', 'Failed to export PNG. Please try again.'));
    } else {
      showNotification('error', 'Switch to Visualiser view to export PNG.');
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const importedData = await importFromExcel(file);

      // Basic validation/merging logic
      const hasData = Object.values(importedData).some(arr => Array.isArray(arr) && arr.length > 0);
      if (hasData) {
        const schemaIssues = validateImportSchema(importedData as Record<string, unknown[]>);
        const errorIssues = schemaIssues.filter(i => i.severity === 'error');

        // If there are error-severity issues, block the import
        if (errorIssues.length > 0) {
          const errorSummary = errorIssues.slice(0, 3).map(i => i.issue).join('; ');
          const moreText = errorIssues.length > 3 ? ` (and ${errorIssues.length - 3} more)` : '';
          showNotification('error', `Validation failed: ${errorSummary}${moreText}`);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        setImportSchemaIssues(schemaIssues);
        setImportPreviewData(importedData as Partial<typeof data>);
        setShowImportModal(true);
      } else {
        showNotification('error', 'No valid data found in the Excel file.');
      }
    } catch (error) {
      console.error('Import failed:', error);
      showNotification('error', 'Failed to import Excel file. Please check the format.');
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleOverwriteImport = () => {
    if (!importPreviewData) return;
    onImport({
      assets: importPreviewData.assets || [],
      applications: importPreviewData.applications || [],
      applicationSegments: importPreviewData.applicationSegments || [],
      applicationStatuses: importPreviewData.applicationStatuses || [],
      initiatives: importPreviewData.initiatives || [],
      milestones: importPreviewData.milestones || [],
      programmes: importPreviewData.programmes || [],
      strategies: importPreviewData.strategies || [],
      dependencies: importPreviewData.dependencies || [],
      assetCategories: importPreviewData.assetCategories || [],
      timelineSettings: importPreviewData.timelineSettings || data.timelineSettings,
      resources: importPreviewData.resources || [],
      versions: importPreviewData.versions || [],
      dtsPhases: importPreviewData.dtsPhases || [],
    });
    setShowImportModal(false);
    setImportPreviewData(null);
    setImportSchemaIssues([]);
    showNotification('success', 'Data overwritten successfully.');
  };

  const handleMergeImport = () => {
    if (!importPreviewData) return;

    // Helper to merge arrays by ID
    const mergeArrays = <T extends { id: string }>(existing: T[], imported: T[] = []) => {
      const merged = [...existing];
      imported.forEach(importItem => {
        const index = merged.findIndex(e => e.id === importItem.id);
        if (index >= 0) {
          merged[index] = importItem;
        } else {
          merged.push(importItem);
        }
      });
      return merged;
    };

    onImport({
      assets: mergeArrays(data.assets, importPreviewData.assets),
      applications: mergeArrays(data.applications || [], importPreviewData.applications),
      applicationSegments: mergeArrays(data.applicationSegments || [], importPreviewData.applicationSegments),
      applicationStatuses: mergeArrays(data.applicationStatuses || [], importPreviewData.applicationStatuses),
      initiatives: mergeArrays(data.initiatives, importPreviewData.initiatives),
      milestones: mergeArrays(data.milestones, importPreviewData.milestones),
      programmes: mergeArrays(data.programmes, importPreviewData.programmes),
      strategies: mergeArrays(data.strategies, importPreviewData.strategies),
      dependencies: mergeArrays(data.dependencies, importPreviewData.dependencies),
      assetCategories: mergeArrays(data.assetCategories, importPreviewData.assetCategories),
      timelineSettings: importPreviewData.timelineSettings || data.timelineSettings,
      resources: mergeArrays(data.resources, importPreviewData.resources),
      versions: mergeArrays(data.versions || [], importPreviewData.versions || []),
      dtsPhases: mergeArrays(data.dtsPhases || [], importPreviewData.dtsPhases || []),
    });
    setShowImportModal(false);
    setImportPreviewData(null);
    setImportSchemaIssues([]);
    showNotification('success', 'Data merged successfully.');
  };

  return (
    <div className="flex items-center gap-1.5 relative">
      <button
        data-testid="share-button"
        onClick={handleShare}
        disabled={isSharing}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
        title="Generate a temporary, secure share link"
      >
        <Share size={14} className={isSharing ? 'animate-pulse' : ''} />
        {isSharing ? 'Sharing...' : 'Share'}
      </button>

      <button
        onClick={handleExportPDF}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
        title="Download roadmap as PDF"
        disabled={!timelineId}
      >
        <FileText size={14} />
        PDF
      </button>

      <button
        data-testid="export-png"
        onClick={handleExportPNG}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
        title="Download roadmap as PNG"
        disabled={!timelineId}
      >
        <ImageDown size={14} />
        PNG
      </button>

      <button
        data-testid="export-excel"
        onClick={handleExportExcel}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
        title="Download current data as Excel"
      >
        <FileSpreadsheet size={14} />
        Export
      </button>

      <button
        onClick={handleImportClick}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
        title="Upload Excel file to update data"
      >
        <Upload size={14} />
        Import
      </button>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".xlsx, .xls"
        className="hidden"
      />

      {notification && (
        <div
          data-testid={notification.type === 'success' ? 'import-success-notification' : 'import-error-notification'}
          className={`absolute top-full right-0 mt-2 px-3 py-2 rounded-lg text-xs font-medium shadow-md z-50 whitespace-nowrap ${
            notification.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {notification.message}
        </div>
      )}

      {showShareConsentModal && (
        <div data-testid="share-consent-modal" className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[110]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 mx-4 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Share className="text-blue-600" size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-4">Share Workspace</h3>
            
            <div className="text-left space-y-4 mb-8 text-slate-600 text-sm">
              <p>
                By generating a share link, a copy of your current workspace data will be:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Encrypted locally</strong> in your browser using AES-GCM (Zero-Knowledge).</li>
                <li><strong>Uploaded</strong> to our secure server in its encrypted format.</li>
                <li><strong>Stored temporarily</strong> and automatically deleted after 1 week.</li>
              </ul>
              <p>
                The decryption key stays in your URL and is never sent to the server. Only people with the full link can view your data.
              </p>
            </div>

            <label className="flex items-center gap-3 mb-8 cursor-pointer group">
              <input
                type="checkbox"
                checked={hasConsented}
                onChange={(e) => setHasConsented(e.target.checked)}
                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors">
                I understand and consent to sharing my data securely.
              </span>
            </label>

            <div className="flex gap-3">
              <button
                onClick={() => setShowShareConsentModal(false)}
                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                data-testid="generate-share-link-button"
                onClick={handleGenerateShareLink}
                disabled={!hasConsented}
                className="flex-[2] py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:bg-slate-300 text-white rounded-xl font-semibold transition-colors"
              >
                Generate share link
              </button>
            </div>
          </div>
        </div>
      )}

      {showShareSuccessModal && (
        <div data-testid="share-success-modal" className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[110]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 mx-4 text-center">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="text-emerald-600" size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Link Copied!</h3>
            <p className="text-slate-600 mb-6">
              Your secure share link has been copied to your clipboard. 
              <span className="block mt-2 font-medium text-amber-600">
                This link will expire in 1 week.
              </span>
            </p>
            <button
              onClick={() => setShowShareSuccessModal(false)}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {showImportModal && importPreviewData && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[100] import-preview-modal">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 mx-4">
            <div className="flex items-center gap-3 mb-4 text-blue-600">
              <AlertCircle size={24} />
              <h2 className="text-xl font-semibold text-slate-900">Import Preview</h2>
            </div>

            <p className="text-slate-600 mb-4">
              We found the following data in your Excel file:
            </p>

            <ul className="space-y-2 mb-4 text-sm text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-200">
              {importPreviewData.initiatives && <li><span className="font-semibold">{importPreviewData.initiatives.length}</span> Initiatives</li>}
              {importPreviewData.assets && <li><span className="font-semibold">{importPreviewData.assets.length}</span> Assets</li>}
              {importPreviewData.applications && importPreviewData.applications.length > 0 && <li><span className="font-semibold">{importPreviewData.applications.length}</span> Applications</li>}
              {importPreviewData.applicationSegments && importPreviewData.applicationSegments.length > 0 && <li><span className="font-semibold">{importPreviewData.applicationSegments.length}</span> Application Segments</li>}
              {importPreviewData.applicationStatuses && importPreviewData.applicationStatuses.length > 0 && <li><span className="font-semibold">{importPreviewData.applicationStatuses.length}</span> Application Statuses</li>}
              {importPreviewData.resources && importPreviewData.resources.length > 0 && <li><span className="font-semibold">{importPreviewData.resources.length}</span> Resources</li>}
              {importPreviewData.programmes && <li><span className="font-semibold">{importPreviewData.programmes.length}</span> Programmes</li>}
              {importPreviewData.strategies && <li><span className="font-semibold">{importPreviewData.strategies.length}</span> Strategies</li>}
              {importPreviewData.milestones && <li><span className="font-semibold">{importPreviewData.milestones.length}</span> Milestones</li>}
              {importPreviewData.dependencies && <li><span className="font-semibold">{importPreviewData.dependencies.length}</span> Dependencies</li>}
              {importPreviewData.assetCategories && <li><span className="font-semibold">{importPreviewData.assetCategories.length}</span> Categories</li>}
              {importPreviewData.versions && importPreviewData.versions.length > 0 && <li><span className="font-semibold text-indigo-600">{importPreviewData.versions.length}</span> History Snapshots</li>}
            </ul>


            {importSchemaIssues.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2 text-amber-700">
                  <TriangleAlert size={16} />
                  <span className="text-sm font-semibold">Schema warnings — this file may be from an older version</span>
                </div>
                <ul className="space-y-1 text-xs bg-amber-50 border border-amber-200 rounded-lg p-3">
                  {importSchemaIssues.map((issue, i) => (
                    <li key={i} className={`flex items-start gap-1.5 ${issue.severity === 'error' ? 'text-rose-700' : 'text-amber-800'}`}>
                      <span className="font-semibold capitalize shrink-0">{issue.entity}:</span>
                      <span>{issue.issue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={handleMergeImport}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                title="Update exiting items and add new ones. Safest option."
              >
                <Check size={18} />
                Merge Data
              </button>

              <button
                onClick={handleOverwriteImport}
                className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-medium transition-colors"
                title="Completely wipe current data and replace with Excel subset."
              >
                Overwrite All Data
              </button>

              <button
                onClick={() => { setShowImportModal(false); setImportPreviewData(null); setImportSchemaIssues([]); }}
                className="w-full py-2.5 text-slate-500 hover:bg-slate-100 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

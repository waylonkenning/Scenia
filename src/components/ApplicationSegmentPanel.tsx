import React, { useState, useEffect } from 'react';
import { ApplicationSegment, Application, ApplicationStatus } from '../types';
import { X, Trash2 } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';
import { useFocusTrap } from '../lib/useFocusTrap';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'appstatus-planned',        label: 'Planned' },
  { value: 'appstatus-funded',         label: 'Funded' },
  { value: 'appstatus-in-production',  label: 'In Production' },
  { value: 'appstatus-sunset',         label: 'Sunset' },
  { value: 'appstatus-out-of-support', label: 'Out of Support' },
  { value: 'appstatus-retired',        label: 'Retired' },
];

interface ApplicationSegmentPanelProps {
  segment: ApplicationSegment | null;
  application: Application | null;
  applications?: Application[];
  isOpen: boolean;
  isNew: boolean;
  onClose: () => void;
  onSave: (segment: ApplicationSegment) => void;
  onDelete?: (segment: ApplicationSegment) => void;
  applicationStatuses?: ApplicationStatus[];
}

export function ApplicationSegmentPanel({
  segment,
  application,
  applications = [],
  isOpen,
  isNew,
  onClose,
  onSave,
  onDelete,
  applicationStatuses,
}: ApplicationSegmentPanelProps) {
  const [formData, setFormData] = useState<ApplicationSegment | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const panelRef = useFocusTrap(isOpen, onClose);

  const statusOptions = applicationStatuses && applicationStatuses.length > 0
    ? applicationStatuses.map(s => ({ value: s.id, label: s.name }))
    : STATUS_OPTIONS;

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (segment) setFormData({ ...segment });
  }, [segment]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!isOpen || !formData) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.startDate || !formData.endDate) return;
    if (formData.endDate <= formData.startDate) return;
    onSave(formData);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.target === e.currentTarget) onClose();
  };

  const field = (label: string, children: React.ReactNode) => (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
    </div>
  );

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50 flex justify-end"
        onClick={handleOverlayClick}
        data-testid="segment-panel"
      >
        <div ref={panelRef} className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 flex-shrink-0">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                {isNew ? 'Add Lifecycle Segment' : 'Edit Lifecycle Segment'}
              </h2>
              {(() => {
                const displayApp = application ?? applications.find(a => a.id === formData?.applicationId);
                return displayApp ? <p className="text-xs text-slate-500 mt-0.5">{displayApp.name}</p> : null;
              })()}
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-md transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <form id="segment-form" onSubmit={handleSubmit} className="space-y-5">
              {applications.length > 0 && field('Application',
                <select
                  data-testid="segment-application"
                  value={formData.applicationId ?? ''}
                  onChange={e => setFormData({ ...formData, applicationId: e.target.value || undefined })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— None —</option>
                  {applications.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              )}

              {field('Status',
                <select
                  data-testid="segment-status"
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {statusOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              )}


              <div className="grid grid-cols-2 gap-4">
                {field('Start Date',
                  <input
                    type="date"
                    data-testid="segment-start-date"
                    value={formData.startDate}
                    onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
                {field('End Date',
                  <input
                    type="date"
                    data-testid="segment-end-date"
                    value={formData.endDate}
                    onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>
              {formData.endDate && formData.startDate && formData.endDate <= formData.startDate && (
                <p className="text-xs text-red-600">End date must be after start date.</p>
              )}
            </form>
          </div>

          <div className="p-4 border-t border-slate-200 bg-slate-50 flex-shrink-0 flex items-center gap-3">
            {!isNew && onDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete segment"
              >
                <Trash2 size={18} />
              </button>
            )}
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="segment-form"
              className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-sm"
            >
              {isNew ? 'Add Segment' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {confirmDelete && formData && onDelete && (
        <ConfirmModal
          isOpen={confirmDelete}
          title="Delete Segment"
          message={`Remove the "${(application ?? applications.find(a => a.id === formData.applicationId))?.name ?? statusOptions.find(o => o.value === formData.status)?.label}" segment? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => { onDelete(formData); setConfirmDelete(false); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}

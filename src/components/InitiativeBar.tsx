import React from 'react';
import { Initiative, Resource, TimelineSettings } from '../types';
import { cn } from '../lib/utils';

const ICON_BTN = "w-5 h-5 bg-white hover:bg-slate-100 rounded shadow-sm text-slate-700 text-[10px] flex items-center justify-center leading-none";

function formatBudget(amount: number): string {
  return amount >= 1_000_000
    ? `$${(amount / 1_000_000).toFixed(1)}m`
    : `$${Math.round(amount / 1000)}k`;
}

export interface InitiativeBarProps {
  init: Initiative;

  // Percentage-based positioning
  left: number;
  width: number;
  height: number | string;
  top: number | string;

  // Visual state
  colorClass: string;
  subtitle?: string;
  isGroup?: boolean;
  isOnCriticalPath?: boolean;
  isSelected: boolean;

  // Group bar metadata
  groupIds?: string[];
  groupProgrammeNames?: string;
  groupStrategyNames?: string;

  // Content data
  resources: Resource[];
  settings: TimelineSettings;

  // Hover title
  progName?: string;
  stratName?: string;

  // Interaction
  isDraggingRef: React.MutableRefObject<boolean>;
  onSelect: () => void;
  onOpenPanel: () => void;
  onMoveStart: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent, edge: 'start' | 'end') => void;
  onUngroup?: () => void;
}

export function InitiativeBar({
  init,
  left,
  width,
  height,
  top,
  colorClass,
  subtitle,
  isGroup = false,
  isOnCriticalPath = false,
  isSelected,
  resources,
  settings,
  progName,
  stratName,
  isDraggingRef,
  onSelect,
  onOpenPanel,
  onMoveStart,
  onResizeStart,
  onUngroup,
}: InitiativeBarProps) {
  const capex = init.capex || 0;
  const opex = init.opex || 0;
  const hasBudget = (capex + opex) > 0;

  const maxDescriptionChars = 600;
  const hasDescription = typeof init.description === 'string' && init.description.length > 0;
  const safeDescription = hasDescription
    ? init.description.slice(0, maxDescriptionChars) + (init.description.length > maxDescriptionChars ? '…' : '')
    : '';

  const hoverTitle = isGroup
    ? `Group: ${init.name}\n${safeDescription}`
    : `${init.isPlaceholder ? '[Placeholder] ' : ''}${init.name}\nProgramme: ${progName ?? ''}\nStrategy: ${stratName ?? ''}\nCapEx: $${capex.toLocaleString()}\nOpEx: $${opex.toLocaleString()}${safeDescription ? `\n${safeDescription}` : ''}`;

  return (
    <div
      data-initiative-id={init.id}
      data-testid={isGroup ? 'project-group-bar' : `initiative-bar-${init.id}`}
      data-selected={isSelected ? 'true' : undefined}
      data-critical-path={isOnCriticalPath ? 'true' : 'false'}
      onMouseDown={onMoveStart}
      onClick={(e) => {
        e.stopPropagation();
        if (isDraggingRef.current) {
          isDraggingRef.current = false;
          return;
        }
        onSelect();
      }}
      onDoubleClick={(e) => { e.stopPropagation(); onOpenPanel(); }}
      className={cn(
        'absolute rounded-md shadow-sm border flex flex-col justify-center px-2 overflow-hidden transition hover:z-20 hover:shadow-xl cursor-pointer group/item select-none',
        init.isPlaceholder
          ? 'bg-transparent border-red-500 border-dashed border-2 text-red-600 opacity-70'
          : isGroup
            ? 'border-2 border-dashed border-blue-400/60 text-slate-900 font-bold'
            : cn(colorClass, 'text-white border-white/20'),
        isOnCriticalPath && 'ring-2 ring-amber-400 ring-offset-1 z-10',
        isSelected && 'outline outline-2 outline-dashed outline-slate-800 z-20',
      )}
      style={{ left: `${left}%`, width: `${width}%`, height, top }}
      title={hoverTitle}
    >
      {/* Group bar background tint */}
      {isGroup && (
        <div
          className={cn('absolute inset-0 pointer-events-none rounded-md opacity-20', colorClass)}
          style={{ zIndex: 0 }}
        />
      )}

      {/* Progress overlay */}
      {!init.isPlaceholder && (init.progress ?? 0) > 0 && (
        <div
          data-testid="progress-overlay"
          className="absolute left-0 top-0 bottom-0 pointer-events-none rounded-l-md bg-white/25"
          style={{ width: `${init.progress}%`, zIndex: 1 }}
        />
      )}

      {/* Resize handles */}
      <div
        draggable="false"
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/30 z-10"
        onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, 'start'); }}
      />
      <div
        draggable="false"
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/30 z-10"
        onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, 'end'); }}
      />

      {/* Owner badge — absolutely positioned top-right */}
      {!init.isPlaceholder && !isGroup && width > 6 && (() => {
        const ownerResource = init.ownerId ? resources.find(r => r.id === init.ownerId) : null;
        const ownerNameSource = ownerResource?.name ?? init.owner;
        if (typeof ownerNameSource !== 'string') return null;
        const ownerName = ownerNameSource.trim();
        if (!ownerName) return null;
        return (
          <div
            data-testid="owner-badge"
            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white/30 border border-white/50 flex items-center justify-center text-[8px] font-bold text-white z-[2]"
            title={ownerName}
          >
            {ownerName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
        );
      })()}

      {/* Main content */}
      <div className="flex flex-col overflow-hidden h-full py-0.5">
        {/* Title row: name + budget pill */}
        <div data-testid="initiative-title-row" className="flex items-center gap-1 min-w-0 pr-6">
          <div
            draggable="false"
            className={cn(
              'font-bold text-[11px] leading-tight truncate flex-1',
              !init.isPlaceholder && 'drop-shadow-md',
            )}
          >
            {init.name}
          </div>

          {settings.budgetVisualisation === 'label' && hasBudget && (
            <div data-testid="initiative-budget-pill" className="flex-shrink-0 flex flex-col gap-0.5">
              {capex > 0 && (
                <span
                  data-testid="capex-label"
                  className={cn(
                    'text-[9px] font-bold px-1 rounded backdrop-blur-[2px] leading-tight',
                    init.isPlaceholder
                      ? 'bg-red-50 text-red-600 border border-red-200'
                      : isGroup
                        ? 'bg-blue-100/50 text-blue-900 border border-blue-200/50'
                        : 'bg-white/20 text-white',
                  )}
                >
                  CapEx {formatBudget(capex)}
                </span>
              )}
              {opex > 0 && (
                <span
                  data-testid="opex-label"
                  className={cn(
                    'text-[9px] font-bold px-1 rounded backdrop-blur-[2px] leading-tight',
                    init.isPlaceholder
                      ? 'bg-red-50 text-red-600 border border-red-200'
                      : isGroup
                        ? 'bg-blue-100/50 text-blue-900 border border-blue-200/50'
                        : 'bg-white/20 text-white',
                  )}
                >
                  OpEx {formatBudget(opex)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Subtitle row */}
        {subtitle && width > 5 && (
          <div
            draggable="false"
            className={cn(
              'text-[9px] italic opacity-70 truncate mt-0.5',
              !init.isPlaceholder && 'drop-shadow-md',
            )}
          >
            {subtitle}
          </div>
        )}

        {/* Resource names row */}
        {settings.showResources === 'on' && !isGroup && width > 8 && (() => {
          const assignedNames = (Array.isArray(init.resourceIds) ? init.resourceIds : [])
            .map(rid => resources.find(r => r.id === rid)?.name)
            .filter(Boolean);
          if (assignedNames.length === 0) return null;
          return (
            <span data-testid="initiative-resource-names" className="text-[9px] text-white/80 truncate mt-0.5">
              {assignedNames.join(', ')}
            </span>
          );
        })()}

        {/* Description row — full width; capped at 2 lines for individual bars, uncapped for group bars */}
        {settings.descriptionDisplay === 'on' && init.description && (
          (isGroup || width > 8) ? (
            <div
              draggable="false"
              data-testid="initiative-description-row"
              className={cn(
                'text-[9px] leading-[12px] opacity-90 mt-1 pt-1 border-t border-white/30 whitespace-pre-wrap break-words',
                !isGroup && 'line-clamp-2',
                !init.isPlaceholder && 'drop-shadow-md',
              )}
            >
              {safeDescription}
            </div>
          ) : null
        )}
      </div>

      {/* Action toolbar — shown when selected, non-group bars only */}
      {isSelected && !isGroup && (
        <div
          data-testid="initiative-action-toolbar"
          className="absolute top-0.5 right-0.5 flex items-center gap-0.5 z-20"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            data-testid="initiative-action-edit"
            className={ICON_BTN}
            onClick={(e) => { e.stopPropagation(); onOpenPanel(); }}
            title="Edit initiative"
          >✎</button>
          {settings.showRelationships !== 'off' && (
            <button
              data-testid="initiative-action-link"
              className={ICON_BTN}
              title="Drag to another initiative to create a dependency"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >⛓</button>
          )}
        </div>
      )}

      {/* Ungroup button — group bars only */}
      {isGroup && onUngroup && (
        <button
          data-testid="expand-group-btn"
          className="absolute bottom-0.5 right-0.5 text-[9px] bg-blue-100 hover:bg-blue-200 text-blue-800 px-1 py-0.5 rounded z-20"
          onClick={(e) => { e.stopPropagation(); onUngroup(); }}
          title="Expand group"
        >
          ⊞
        </button>
      )}
    </div>
  );
}

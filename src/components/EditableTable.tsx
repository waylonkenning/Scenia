import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Plus, Trash2, ClipboardPaste, X, Check, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { ConfirmModal } from './ConfirmModal';

export interface Option {
  value: string;
  label: string;
}

// Defined outside component to avoid re-creation on every render
const COLORS = [
  { value: 'bg-slate-500', name: 'Slate' }, { value: 'bg-gray-500', name: 'Gray' }, { value: 'bg-zinc-500', name: 'Zinc' },
  { value: 'bg-red-400', name: 'Light Red' }, { value: 'bg-red-500', name: 'Red' }, { value: 'bg-red-600', name: 'Dark Red' },
  { value: 'bg-orange-400', name: 'Light Orange' }, { value: 'bg-orange-500', name: 'Orange' }, { value: 'bg-orange-600', name: 'Dark Orange' },
  { value: 'bg-amber-400', name: 'Light Amber' }, { value: 'bg-amber-500', name: 'Amber' }, { value: 'bg-amber-600', name: 'Dark Amber' },
  { value: 'bg-emerald-400', name: 'Light Emerald' }, { value: 'bg-emerald-500', name: 'Emerald' }, { value: 'bg-emerald-600', name: 'Dark Emerald' },
  { value: 'bg-cyan-400', name: 'Light Cyan' }, { value: 'bg-cyan-500', name: 'Cyan' }, { value: 'bg-cyan-600', name: 'Dark Cyan' },
  { value: 'bg-blue-400', name: 'Light Blue' }, { value: 'bg-blue-500', name: 'Blue' }, { value: 'bg-blue-600', name: 'Dark Blue' },
  { value: 'bg-indigo-400', name: 'Light Indigo' }, { value: 'bg-indigo-500', name: 'Indigo' }, { value: 'bg-indigo-600', name: 'Dark Indigo' },
  { value: 'bg-violet-400', name: 'Light Violet' }, { value: 'bg-violet-500', name: 'Violet' }, { value: 'bg-violet-600', name: 'Dark Violet' },
  { value: 'bg-rose-400', name: 'Light Rose' }, { value: 'bg-rose-500', name: 'Rose' }, { value: 'bg-rose-600', name: 'Dark Rose' },
];

export interface Column<T> {
  key: keyof T;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'color' | 'boolean' | 'textarea';
  options?: Option[]; // For select type
  placeholder?: string;
  width?: string;
  cellTestId?: string; // Optional data-testid applied to the <td> element
}

interface EditableTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onUpdate: (newData: T[]) => void;
  onDelete?: (deletedRow: T) => boolean; // If returns true, delete was handled externally
  idField: keyof T;
  searchQuery?: string;
  tableId?: string;
  onColumnResize?: (columnKey: string, newWidth: string) => void;
}

export function EditableTable<T extends { [key: string]: any }>({
  data,
  columns,
  onUpdate,
  onDelete,
  idField,
  searchQuery,
  tableId = 'default',
  onColumnResize
}: EditableTableProps<T>) {
  const [rows, setRows] = useState<T[]>(data);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof T; direction: 'asc' | 'desc' } | null>(null);
  const [pendingFocus, setPendingFocus] = useState<{ id: string; key: keyof T } | null>(null);
  const [activeColorPicker, setActiveColorPicker] = useState<{ rowId: string | number, colKey: keyof T } | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [showScrollFade, setShowScrollFade] = useState(false);

  // Column Resizing State
  const [resizing, setResizing] = useState<{ key: string; startX: number; startWidth: number } | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const scrollWrapperRef = useRef<HTMLDivElement>(null);
  const rowIdCounter = useRef(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizing) return;
      const dx = e.clientX - resizing.startX;
      const newWidth = Math.max(50, resizing.startWidth + dx);
      
      const column = columns.find(c => String(c.key) === resizing.key);
      if (column) {
        column.width = `${newWidth}px`;
        // Force re-render if needed, but since we're modifying the prop directly 
        // and it's used in the style, we might need a local width state or just let the parent update.
        // For now, let's trigger the parent update immediately or on mouseup.
        if (tableRef.current) {
          const th = tableRef.current.querySelector(`th[data-col-key="${resizing.key}"]`) as HTMLElement;
          if (th) th.style.width = `${newWidth}px`;
        }
      }
    };

    const handleMouseUp = () => {
      if (resizing) {
        const column = columns.find(c => String(c.key) === resizing.key);
        if (column && onColumnResize) {
          onColumnResize(resizing.key, column.width || '');
        }
        setResizing(null);
      }
    };

    if (resizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing, columns, onColumnResize]);

  const checkScrollFade = useCallback(() => {
    const el = scrollWrapperRef.current;
    if (!el) return;
    const canScrollRight = el.scrollWidth > el.clientWidth + 1;
    const atRightEdge = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
    setShowScrollFade(canScrollRight && !atRightEdge);
  }, []);

  useEffect(() => {
    const el = scrollWrapperRef.current;
    if (!el) return;
    checkScrollFade();
    el.addEventListener('scroll', checkScrollFade);
    const ro = new ResizeObserver(checkScrollFade);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', checkScrollFade);
      ro.disconnect();
    };
  }, [checkScrollFade]);

  const handleResizeStart = (e: React.MouseEvent, key: string, currentWidth: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Parse current width
    let width = 0;
    if (currentWidth.endsWith('px')) {
      width = parseInt(currentWidth);
    } else if (currentWidth.endsWith('%')) {
      // Convert % to px based on current offsetWidth
      const th = (e.target as HTMLElement).closest('th');
      width = th?.offsetWidth || 0;
    } else {
      const th = (e.target as HTMLElement).closest('th');
      width = th?.offsetWidth || 0;
    }

    setResizing({
      key,
      startX: e.clientX,
      startWidth: width
    });
  };

  // Only one blank row that spawns another when edited
  const GHOST_ROWS_COUNT = 1;

  useEffect(() => {
    setRows(data);
  }, [data]);

  // Handle focusing the new row after it's been added to the real rows
  useEffect(() => {
    if (pendingFocus) {
      const timer = setTimeout(() => {
        const input = document.querySelector(`tr[data-id="${pendingFocus.id}"] [data-key="${String(pendingFocus.key)}"] input, tr[data-id="${pendingFocus.id}"] [data-key="${String(pendingFocus.key)}"] select`) as HTMLElement;
        if (input) {
          input.focus();
          if (input instanceof HTMLInputElement && (input.type === 'text' || input.type === 'search' || input.type === 'date' || input.type === 'number')) {
            const val = input.value;
            input.setSelectionRange(val.length, val.length);
          }
        }
        setPendingFocus(null);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [rows, pendingFocus]);

  const sortedRows = useMemo(() => {
    let filteredData = rows;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filteredData = rows.filter(row => {
        return columns.some(col => {
          const val = row[col.key];
          if (val === null || val === undefined) return false;

          if (col.type === 'select' && col.options) {
            const opt = col.options.find(o => String(o.value) === String(val));
            return opt?.label.toLowerCase().includes(q) || String(val).toLowerCase().includes(q);
          }
          return String(val).toLowerCase().includes(q);
        });
      });
    }

    if (!sortConfig) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === bValue) return 0;
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      const column = columns.find(c => c.key === sortConfig.key);

      if (column?.type === 'number') {
        const aNum = parseFloat(String(aValue)) || 0;
        const bNum = parseFloat(String(bValue)) || 0;
        return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
      }

      const aString = String(aValue).toLowerCase();
      const bString = String(bValue).toLowerCase();

      if (sortConfig.direction === 'asc') {
        return aString.localeCompare(bString);
      } else {
        return bString.localeCompare(aString);
      }
    });
  }, [rows, sortConfig, columns, searchQuery]);

  const handleSort = (key: keyof T) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      setSortConfig(null);
      return;
    }
    setSortConfig({ key, direction });
  };

  const handleChange = (index: number, key: keyof T, value: unknown, isGhost: boolean = false, focusNextColumn: boolean = false) => {
    if (isGhost) {
      const newId = crypto.randomUUID();
      const newRow = {} as T;
      newRow[idField] = newId as T[keyof T];

      columns.forEach(col => {
        if (col.key !== idField) {
          newRow[col.key] = (col.type === 'number' ? 0 : (col.type === 'boolean' ? false : '')) as T[keyof T];
        }
      });

      newRow[key] = value as T[keyof T];

      const updatedRows = [...rows, newRow];
      setRows(updatedRows);
      onUpdate(updatedRows);

      // If focusNextColumn is true, find and focus the next column
      if (focusNextColumn) {
        const currentColIndex = columns.findIndex(col => col.key === key);
        const nextColIndex = currentColIndex + 1;
        if (nextColIndex < columns.length) {
          setPendingFocus({ id: newId, key: columns[nextColIndex].key });
        } else {
          setPendingFocus({ id: newId, key });
        }
      } else {
        setPendingFocus({ id: newId, key });
      }
    } else {
      const newRows = [...rows];
      newRows[index] = { ...newRows[index], [key]: value };
      setRows(newRows);
      onUpdate(newRows);
    }
  };

  const handleCheckboxChange = (index: number, key: keyof T, checked: boolean, isGhost: boolean = false) => {
    handleChange(index, key, checked, isGhost, false);
  };

  const handleKeyDown = (e: React.KeyboardEvent, colIndex: number, isGhost: boolean) => {
    if (isGhost && e.key === 'Tab' && !e.shiftKey) {
      const target = e.target as HTMLInputElement;
      if (target.value || target.type === 'checkbox') {
        // Prevent default Tab behavior
        e.preventDefault();
        
        // Trigger the change to create the new row, with focusNextColumn flag
        handleChange(rows.length, columns[colIndex].key, target.type === 'checkbox' ? target.checked : target.value, true, true);
      }
    }
  };

  const handleAdd = () => {
    const newId = crypto.randomUUID();
    const newRow = {} as T;
    newRow[idField] = newId as T[keyof T];

    columns.forEach(col => {
      if (col.key !== idField) {
        newRow[col.key] = (col.type === 'number' ? 0 : (col.type === 'boolean' ? false : '')) as T[keyof T];
      }
    });

    const newRows = [...rows, newRow];
    setRows(newRows);
    onUpdate(newRows);
  };

  const handleDelete = (index: number) => {
    const row = rows[index];
    if (onDelete && onDelete(row)) {
      return;
    }
    const newRows = rows.filter((_, i) => i !== index);
    setRows(newRows);
    onUpdate(newRows);
  };

  const handleClearAll = () => setConfirmClearAll(true);
  const executeClearAll = () => {
    setConfirmClearAll(false);
    setRows([]);
    onUpdate([]);
  };

  const handlePasteCsv = () => {
    if (!csvText.trim()) return;

    const lines = csvText.trim().split('\n');
    const updatedRows = [...rows];
    let hasHeader = false;
    let headerMapping: (keyof T | null)[] = [];

    if (lines.length > 0) {
      const firstLineValues = lines[0].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().toLowerCase().replace(/^"|"$/g, ''));
      const colLabels = columns.map(c => c.label.toLowerCase());
      const colKeys = columns.map(c => String(c.key).toLowerCase());

      const matches = firstLineValues.filter(v =>
        v === 'id' || colLabels.includes(v) || colKeys.includes(v)
      ).length;

      if (matches >= 1) {
        hasHeader = true;
        headerMapping = firstLineValues.map(val => {
          if (val === 'id' || val === String(idField).toLowerCase()) return idField;
          const colByKey = columns.find(c => String(c.key).toLowerCase() === val);
          if (colByKey) return colByKey.key;
          const colByLabel = columns.find(c => c.label.toLowerCase() === val);
          if (colByLabel) return colByLabel.key;
          return null;
        });
      }
    }

    const startIndex = hasHeader ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
      const rowData = {} as T;

      if (hasHeader) {
        headerMapping.forEach((key, valIdx) => {
          if (key && valIdx < values.length) {
            const raw = values[valIdx];
            const col = columns.find(c => c.key === key);
            const value: string | number | boolean =
              col?.type === 'number' ? (parseFloat(raw) || 0) :
              col?.type === 'boolean' ? (raw.toLowerCase() === 'true' || raw === '1') :
              col?.type === 'select'
                ? (col.options?.some(option => option.value === raw) ? raw : '')
                : raw;
            rowData[key] = value as T[keyof T];
          }
        });
      } else {
        columns.forEach((col, colIdx) => {
          if (colIdx < values.length) {
            const raw = values[colIdx];
            const value: string | number | boolean =
              col.type === 'number' ? (parseFloat(raw) || 0) :
              col.type === 'boolean' ? (raw.toLowerCase() === 'true' || raw === '1') :
              raw;
            rowData[col.key] = value as T[keyof T];
          } else if (rowData[col.key] === undefined) {
            rowData[col.key] = (col.type === 'number' ? 0 : (col.type === 'boolean' ? false : '')) as T[keyof T];
          }
        });
      }

      const targetId = rowData[idField] || crypto.randomUUID();
      rowData[idField] = targetId as T[keyof T];

      const existingIndex = updatedRows.findIndex(r => String(r[idField]) === String(targetId));
      if (existingIndex !== -1) {
        updatedRows[existingIndex] = { ...updatedRows[existingIndex], ...rowData };
      } else {
        updatedRows.push(rowData as T);
      }
    }

    setRows(updatedRows);
    onUpdate(updatedRows);
    setCsvText('');
    setIsCsvModalOpen(false);
  };

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex-1 relative min-h-0">
        <div
          ref={scrollWrapperRef}
          data-testid={`${tableId}-table-scroll-wrapper`}
          className="h-full overflow-auto border border-slate-200 rounded-lg bg-white shadow-sm"
        >
        <table ref={tableRef} className="min-w-full text-sm text-left border-collapse table-fixed">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10 shadow-sm">
            <tr>
              {columns.map(col => (
                <th
                  key={String(col.key)}
                  data-col-key={String(col.key)}
                  onClick={(e) => {
                    // Don't sort if clicking the resize handle
                    if ((e.target as HTMLElement).classList.contains('resize-handle')) return;
                    handleSort(col.key);
                  }}
                  className="px-4 py-3 font-medium border-b border-r border-slate-200 last:border-r-0 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors group/header relative"
                  style={{ width: col.width }}
                >
                  <div className="flex items-center gap-2 pr-2">
                    {col.label}
                    {sortConfig?.key === col.key ? (
                      sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-blue-500" /> : <ArrowDown size={14} className="text-blue-500" />
                    ) : (
                      <ArrowUpDown size={14} className="text-slate-300 opacity-0 group-hover/header:opacity-100" />
                    )}
                  </div>
                  <div 
                    className={cn(
                      "resize-handle absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-400 z-20 transition-colors",
                      resizing?.key === String(col.key) ? "bg-blue-500" : "bg-transparent"
                    )}
                    onMouseDown={(e) => handleResizeStart(e, String(col.key), col.width || '')}
                  />
                </th>
              ))}
              <th className="px-4 py-3 border-b border-slate-200 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => {
              const rowIndex = rows.findIndex(r => r[idField] === row[idField]);
              return (
                <tr key={String(row[idField])} data-real="true" data-id={String(row[idField])} className="hover:bg-slate-50 group">
                  {columns.map((col) => (
                    <td key={`${String(row[idField])}-${String(col.key)}`} data-key={String(col.key)} data-testid={col.cellTestId} className="border-b border-r border-slate-100 last:border-r-0 p-0 relative">
                      {col.type === 'select' ? (
                        <select
                          value={String(row[col.key] || '')}
                          onChange={(e) => handleChange(rowIndex, col.key, e.target.value, false)}
                          aria-label={col.label}
                          className="w-full h-full px-3 py-2 bg-transparent border-none focus:ring-2 focus:ring-inset focus:ring-blue-500 outline-none appearance-none"
                        >
                          <option value="">Select...</option>
                          {col.options?.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      ) : col.type === 'color' ? (
                        <div className="relative flex items-center h-full w-full">
                          <button
                            type="button"
                            onClick={() => setActiveColorPicker({ rowId: String(row[idField]), colKey: col.key })}
                            className="flex items-center w-full h-full px-4 hover:bg-slate-100 transition-colors"
                          >
                            <div className={cn("w-4 h-4 text-xs font-semibold rounded-full border border-slate-200 mr-2 flex-shrink-0", String(row[col.key]))} />
                            <span className="text-sm truncate text-slate-700">
                              {COLORS.find(c => c.value === String(row[col.key]))?.name || 'Select Color...'}
                            </span>
                          </button>

                          {activeColorPicker?.rowId === String(row[idField]) && activeColorPicker?.colKey === col.key && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setActiveColorPicker(null)} />
                              <div className="absolute top-full left-0 mt-1 p-2 bg-white rounded-lg shadow-xl border border-slate-200 z-50 w-64">
                                <div className="text-xs font-semibold text-slate-500 mb-2 px-1">Select Color</div>
                                <div className="grid grid-cols-6 gap-1">
                                  {COLORS.map((colorOption) => (
                                    <button
                                      key={colorOption.value}
                                      onClick={() => {
                                        handleChange(rowIndex, col.key, colorOption.value, false);
                                        setActiveColorPicker(null);
                                      }}
                                      title={colorOption.name}
                                      className={cn(
                                        "w-8 h-8 rounded-full border border-slate-200 hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 flex items-center justify-center",
                                        colorOption.value
                                      )}
                                    >
                                      {String(row[col.key]) === colorOption.value && (
                                        <div className="w-2.5 h-2.5 bg-white rounded-full opacity-90" />
                                      )}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      ) : col.type === 'boolean' ? (
                        <div className="flex items-center justify-center h-full">
                          <input
                            type="checkbox"
                            checked={!!row[col.key]}
                            onChange={(e) => handleCheckboxChange(rowIndex, col.key, e.target.checked, false)}
                            aria-label={col.label}
                            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                          />
                        </div>
                      ) : col.type === 'textarea' ? (
                        <textarea
                          rows={2}
                          value={String(row[col.key] || '')}
                          onChange={(e) => handleChange(rowIndex, col.key, e.target.value, false)}
                          placeholder={col.placeholder}
                          aria-label={col.label}
                          className="w-full px-3 py-2 bg-transparent border-none focus:ring-2 focus:ring-inset focus:ring-blue-500 outline-none resize-none text-sm"
                          data-testid={`real-textarea-${String(col.key)}`}
                        />
                      ) : (
                        <input
                          type={col.type}
                          value={col.type === 'number' ? (row[col.key] == null ? '' : Number(row[col.key])) : String(row[col.key] || '')}
                          onChange={(e) => handleChange(rowIndex, col.key, col.type === 'number' ? Number(e.target.value) : e.target.value, false)}
                          placeholder={col.placeholder}
                          aria-label={col.label}
                          className="w-full h-full px-3 py-2 bg-transparent border-none focus:ring-2 focus:ring-inset focus:ring-blue-500 outline-none"
                          data-testid={`real-input-${String(col.key)}`}
                        />
                      )}
                    </td>
                  ))}
                  <td className="border-b border-slate-100 p-1 text-center">
                    <button
                      onClick={() => handleDelete(rowIndex)}
                      data-testid={`delete-row-btn-${tableId}`}
                      className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete row"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}

            {Array.from({ length: GHOST_ROWS_COUNT }).map((_, i) => (
              <tr key={`blank-${i}`} className="hover:bg-slate-50 group">
                {columns.map((col, colIndex) => (
                  <td key={`blank-${i}-${String(col.key)}`} data-key={String(col.key)} className="border-b border-r border-slate-100 last:border-r-0 p-0 relative">
                    {col.type === 'select' ? (
                      <select
                        value=""
                        onChange={(e) => handleChange(rows.length + i, col.key, e.target.value, true)}
                        onKeyDown={(e) => handleKeyDown(e, colIndex, true)}
                        aria-label={col.label}
                        className="w-full h-full px-3 py-2 bg-transparent border-none focus:ring-2 focus:ring-inset focus:ring-blue-500 outline-none appearance-none"
                        data-testid={`ghost-select-${String(col.key)}`}
                      >
                        <option value=""></option>
                        {col.options?.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : col.type === 'color' ? (
                      <div className="relative flex items-center h-full w-full">
                        <button
                          type="button"
                          onClick={() => setActiveColorPicker({ rowId: 'ghost', colKey: col.key })}
                          className="flex items-center w-full h-full px-4 hover:bg-slate-100 transition-colors"
                        >
                          <div className="w-4 h-4 rounded-full mr-2 border border-slate-100 bg-slate-50 flex-shrink-0" />
                          <span className="text-sm truncate text-slate-400">Select Color...</span>
                        </button>

                        {activeColorPicker?.rowId === 'ghost' && activeColorPicker?.colKey === col.key && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setActiveColorPicker(null)} />
                            <div className="absolute top-full left-0 mt-1 p-2 bg-white rounded-lg shadow-xl border border-slate-200 z-50 w-64">
                              <div className="text-xs font-semibold text-slate-500 mb-2 px-1">Select Color</div>
                              <div className="grid grid-cols-6 gap-1">
                                {COLORS.map((colorOption) => (
                                  <button
                                    key={colorOption.value}
                                    onClick={() => {
                                      handleChange(rows.length + i, col.key, colorOption.value, true);
                                      setActiveColorPicker(null);
                                    }}
                                    title={colorOption.name}
                                    className={cn(
                                      "w-8 h-8 rounded-full border border-slate-200 hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center",
                                      colorOption.value
                                    )}
                                  />
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    ) : col.type === 'boolean' ? (
                      <div className="flex items-center justify-center h-full">
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={(e) => handleCheckboxChange(rows.length + i, col.key, e.target.checked, true)}
                          onKeyDown={(e) => handleKeyDown(e, colIndex, true)}
                          aria-label={col.label}
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                          data-testid={`ghost-checkbox-${String(col.key)}`}
                        />
                      </div>
                    ) : col.type === 'textarea' ? (
                      <textarea
                        rows={2}
                        defaultValue=""
                        onKeyDown={(e) => handleKeyDown(e, colIndex, true)}
                        onBlur={(e) => {
                          if (e.target.value) {
                            handleChange(rows.length + i, col.key, e.target.value, true);
                            e.target.value = "";
                          }
                        }}
                        placeholder={col.placeholder}
                        aria-label={col.label}
                        className="w-full px-3 py-2 bg-transparent border-none focus:ring-2 focus:ring-inset focus:ring-blue-500 outline-none resize-none text-sm"
                        data-testid={`ghost-textarea-${String(col.key)}`}
                      />
                    ) : (
                      <input
                        type={col.type}
                        defaultValue=""
                        onKeyDown={(e) => handleKeyDown(e, colIndex, true)}
                        onBlur={(e) => {
                          if (e.target.value) {
                            handleChange(rows.length + i, col.key, col.type === 'number' ? Number(e.target.value) : e.target.value, true);
                            e.target.value = "";
                          }
                        }}
                        placeholder={col.placeholder}
                        aria-label={col.label}
                        className="w-full h-full px-3 py-2 bg-transparent border-none focus:ring-2 focus:ring-inset focus:ring-blue-500 outline-none"
                        data-testid={`ghost-input-${String(col.key)}`}
                      />
                    )}
                  </td>
                ))}
                <td className="border-b border-slate-100 p-1 text-center">
                  <div className="w-6 h-6" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {showScrollFade && (
          <div
            data-testid="table-scroll-fade-right"
            className="pointer-events-none absolute top-0 right-0 h-full w-16 rounded-r-lg"
            style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.9))' }}
          />
        )}
      </div>
      <div className="mt-4 flex gap-3">
        <button
          onClick={handleAdd}
          data-testid={`add-row-btn-${tableId}`}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium text-sm"
        >
          <Plus size={16} />
          Add Row
        </button>
        <button
          onClick={() => setIsCsvModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm font-medium text-sm"
        >
          <ClipboardPaste size={16} />
          Paste CSV
        </button>
        <div className="ml-auto">
          <button
            onClick={handleClearAll}
            className="flex items-center gap-2 px-4 py-2 bg-white text-red-600 border border-red-100 rounded-lg hover:bg-red-50 hover:border-red-200 transition-all shadow-sm font-medium text-sm"
          >
            <Trash2 size={16} />
            Delete all rows for this table
          </button>
        </div>
      </div>

      {isCsvModalOpen && (
        <div className="absolute inset-0 z-20 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6 rounded-lg">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col overflow-hidden border border-slate-200">
            <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <ClipboardPaste size={18} className="text-blue-500" />
                Paste CSV Data
              </h3>
              <button onClick={() => setIsCsvModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 flex-1">
              <p className="text-xs text-slate-500 mb-3">
                Paste comma-separated values. Each line will become a new row.
                <br />
                Expected columns: <span className="font-mono text-blue-600">{columns.map(c => c.label).join(', ')}</span>
              </p>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                className="w-full h-48 p-3 text-sm font-mono border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                placeholder="Value 1, Value 2, Value 3..."
                autoFocus
                data-testid="csv-paste-textarea"
              />
            </div>
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setIsCsvModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handlePasteCsv}
                disabled={!csvText.trim()}
                data-testid="import-rows-button"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm shadow-sm"
              >
                <Check size={16} />
                Import Rows
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={confirmClearAll}
        title="Delete all rows"
        message="Are you sure you want to clear all rows in this table? This cannot be undone."
        confirmLabel="Delete All"
        onConfirm={executeClearAll}
        onCancel={() => setConfirmClearAll(false)}
      />
    </div>
  );
}

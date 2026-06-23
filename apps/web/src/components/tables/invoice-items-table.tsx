'use client';

/**
 * Invoice Items Table
 *
 * Excel-like editable table for invoice line items with drag-drop reordering
 * and inline editing capabilities.
 */

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Plus, Minus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { DraftInvoiceItem } from '@erp/shared';

// =============================================================================
// TYPES
// =============================================================================

interface InvoiceItemsTableProps {
  items: DraftInvoiceItem[];
  onItemsChange: (items: DraftInvoiceItem[]) => void;
  onAddItem: () => void;
  onRemoveItem: (localId: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onItemUpdate: (localId: string, field: keyof DraftInvoiceItem, value: unknown) => void;
  stockAvailability?: Record<string, number>;
  /** localId of a row to briefly highlight (e.g. after a scan increments it). */
  highlightLocalId?: string | null;
  readOnly?: boolean;
  className?: string;
}

interface SortableRowProps {
  item: DraftInvoiceItem;
  index: number;
  onRemove: (localId: string) => void;
  onUpdate: (localId: string, field: keyof DraftInvoiceItem, value: unknown) => void;
  stockAvailable?: number;
  highlight?: boolean;
  readOnly?: boolean;
}

interface EditableCellProps {
  value: string | number;
  onChange: (value: string | number) => void;
  type?: 'text' | 'number';
  className?: string;
  min?: number;
  max?: number;
  step?: number;
  readOnly?: boolean;
  /** Accessible label for screen readers */
  'aria-label'?: string;
}

// =============================================================================
// EDITABLE CELL COMPONENT
// =============================================================================

function EditableCell({
  value,
  onChange,
  type = 'text',
  className,
  min,
  max,
  step,
  readOnly,
  'aria-label': ariaLabel,
}: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(String(value));
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    const newValue = type === 'number' ? parseFloat(editValue) || 0 : editValue;
    if (newValue !== value) {
      onChange(newValue);
    }
  }, [editValue, onChange, type, value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleBlur();
      } else if (e.key === 'Escape') {
        setEditValue(String(value));
        setIsEditing(false);
      }
    },
    [handleBlur, value]
  );

  if (readOnly) {
    return (
      <span className={cn('block px-2 py-1', className)}>
        {type === 'number' ? Number(value).toLocaleString() : value}
      </span>
    );
  }

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        type={type}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        min={min}
        max={max}
        step={step}
        aria-label={ariaLabel}
        className={cn('h-8 px-2', className)}
      />
    );
  }

  return (
    <div
      className={cn(
        'cursor-pointer px-2 py-1 rounded hover:bg-muted/50',
        className
      )}
      onClick={() => setIsEditing(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setIsEditing(true);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={ariaLabel ? `${ariaLabel}: ${value}` : undefined}
    >
      {type === 'number' ? Number(value).toLocaleString() : value}
    </div>
  );
}

// =============================================================================
// SORTABLE ROW COMPONENT
// =============================================================================

function SortableRow({
  item,
  index,
  onRemove,
  onUpdate,
  stockAvailable,
  highlight,
  readOnly,
}: SortableRowProps) {
  const t = useTranslations('sales.items');
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.localId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const hasInsufficientStock =
    stockAvailable !== undefined && item.quantity > stockAvailable;

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(
        'group transition-colors',
        isDragging && 'bg-muted',
        hasInsufficientStock && 'bg-destructive/10',
        highlight && 'bg-primary/10 ring-1 ring-inset ring-primary'
      )}
    >
      {/* Drag Handle */}
      <TableCell className="w-10 px-2">
        {!readOnly && (
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab touch-none p-1 opacity-50 hover:opacity-100"
            aria-label={t('ariaReorder', { name: item.itemName })}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
      </TableCell>

      {/* Line Number */}
      <TableCell className="w-12 text-center text-muted-foreground">
        {index + 1}
      </TableCell>

      {/* Item Name */}
      <TableCell className="min-w-[200px]">
        <div className="flex flex-col">
          <span className="font-medium">{item.itemName}</span>
          {item.itemSku && (
            <span className="text-xs text-muted-foreground">{item.itemSku}</span>
          )}
        </div>
      </TableCell>

      {/* Description */}
      <TableCell className="min-w-[150px]">
        <EditableCell
          value={item.description}
          onChange={(v) => onUpdate(item.localId, 'description', String(v))}
          readOnly={readOnly}
          aria-label={t('ariaDescription', { name: item.itemName })}
        />
      </TableCell>

      {/* Quantity */}
      <TableCell className="w-32">
        <div className="flex flex-col">
          <div className="flex items-center gap-1">
            {!readOnly && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() =>
                  onUpdate(item.localId, 'quantity', Math.max(0.001, item.quantity - 1))
                }
                aria-label={t('ariaDecrement', { name: item.itemName })}
              >
                <Minus className="h-3 w-3" />
              </Button>
            )}
            <EditableCell
              value={item.quantity}
              onChange={(v) => onUpdate(item.localId, 'quantity', Number(v))}
              type="number"
              min={0.001}
              step={0.001}
              readOnly={readOnly}
              className="w-16 text-center"
              aria-label={t('ariaQuantity', { name: item.itemName })}
            />
            {!readOnly && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => onUpdate(item.localId, 'quantity', item.quantity + 1)}
                aria-label={t('ariaIncrement', { name: item.itemName })}
              >
                <Plus className="h-3 w-3" />
              </Button>
            )}
          </div>
          {stockAvailable !== undefined && (
            <span
              className={cn(
                'text-xs',
                hasInsufficientStock ? 'text-destructive' : 'text-muted-foreground'
              )}
            >
              {t('stock', { count: stockAvailable })}
            </span>
          )}
        </div>
      </TableCell>

      {/* Unit Price */}
      <TableCell className="w-28">
        <EditableCell
          value={item.unitPrice}
          onChange={(v) => onUpdate(item.localId, 'unitPrice', Number(v))}
          type="number"
          min={0}
          step={0.01}
          readOnly={readOnly}
          className="w-24"
          aria-label={t('ariaUnitPrice', { name: item.itemName })}
        />
      </TableCell>

      {/* Discount % */}
      <TableCell className="w-20">
        <EditableCell
          value={item.discountPercent}
          onChange={(v) => onUpdate(item.localId, 'discountPercent', Number(v))}
          type="number"
          min={0}
          max={100}
          step={0.1}
          readOnly={readOnly}
          className="w-16"
          aria-label={t('ariaDiscountPercent', { name: item.itemName })}
        />
      </TableCell>

      {/* Tax % */}
      <TableCell className="w-20">
        <EditableCell
          value={item.taxRate}
          onChange={(v) => onUpdate(item.localId, 'taxRate', Number(v))}
          type="number"
          min={0}
          max={100}
          step={0.1}
          readOnly={readOnly}
          className="w-16"
          aria-label={t('ariaTaxRate', { name: item.itemName })}
        />
      </TableCell>

      {/* Line Total */}
      <TableCell className="w-32 text-right font-medium">
        {item.lineTotal.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </TableCell>

      {/* Actions */}
      <TableCell className="w-12">
        {!readOnly && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-40 hover:opacity-100 focus-visible:opacity-100"
            onClick={() => onRemove(item.localId)}
            aria-label={t('ariaRemove', { name: item.itemName })}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function InvoiceItemsTable({
  items,
  onItemsChange,
  onAddItem,
  onRemoveItem,
  onReorder,
  onItemUpdate,
  stockAvailability,
  highlightLocalId,
  readOnly = false,
  className,
}: InvoiceItemsTableProps) {
  const t = useTranslations('sales.items');
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = items.findIndex((item) => item.localId === active.id);
        const newIndex = items.findIndex((item) => item.localId === over.id);
        onReorder(oldIndex, newIndex);
      }
    },
    [items, onReorder]
  );

  // Calculate totals
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice * (1 - item.discountPercent / 100),
    0
  );
  const taxTotal = items.reduce(
    (sum, item) =>
      sum + item.quantity * item.unitPrice * (1 - item.discountPercent / 100) * (item.taxRate / 100),
    0
  );
  const grandTotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Table */}
      <div className="rounded-md border overflow-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead className="w-12 text-center">{t('columns.row')}</TableHead>
                <TableHead className="min-w-[200px]">{t('columns.item')}</TableHead>
                <TableHead className="min-w-[150px]">{t('columns.description')}</TableHead>
                <TableHead className="w-32">{t('columns.qty')}</TableHead>
                <TableHead className="w-28">{t('columns.unitPrice')}</TableHead>
                <TableHead className="w-20">{t('columns.discountPercent')}</TableHead>
                <TableHead className="w-20">{t('columns.taxPercent')}</TableHead>
                <TableHead className="w-32 text-right">{t('columns.total')}</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <SortableContext
                items={items.map((i) => i.localId)}
                strategy={verticalListSortingStrategy}
              >
                {items.map((item, index) => (
                  <SortableRow
                    key={item.localId}
                    item={item}
                    index={index}
                    onRemove={onRemoveItem}
                    onUpdate={onItemUpdate}
                    stockAvailable={stockAvailability?.[item.itemId]}
                    highlight={item.localId === highlightLocalId}
                    readOnly={readOnly}
                  />
                ))}
              </SortableContext>

              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Search className="h-8 w-8" />
                      <p>{t('empty')}</p>
                      {!readOnly && (
                        <Button variant="outline" size="sm" onClick={onAddItem}>
                          <Plus className="h-4 w-4 mr-2" />
                          {t('addItem')}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DndContext>
      </div>

      {/* Add Item Button */}
      {!readOnly && items.length > 0 && (
        <Button variant="outline" onClick={onAddItem}>
          <Plus className="h-4 w-4 mr-2" />
          {t('addItem')}
        </Button>
      )}

      {/* Totals */}
      {items.length > 0 && (
        <div className="flex justify-end">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('subtotal')}</span>
              <span>
                {subtotal.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('tax')}</span>
              <span>
                {taxTotal.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="flex justify-between border-t pt-2 font-medium">
              <span>{t('total')}</span>
              <span>
                {grandTotal.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InvoiceItemsTable;

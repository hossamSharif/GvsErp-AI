'use client';

/**
 * Invoice Items Table
 *
 * Excel-like editable table for invoice line items with drag-drop reordering
 * and inline editing capabilities.
 */

import React, { useCallback, useState, useRef, useEffect } from 'react';
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
import { GripVertical, Trash2, Plus, Search } from 'lucide-react';
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
  readOnly?: boolean;
  className?: string;
}

interface SortableRowProps {
  item: DraftInvoiceItem;
  index: number;
  onRemove: (localId: string) => void;
  onUpdate: (localId: string, field: keyof DraftInvoiceItem, value: unknown) => void;
  stockAvailable?: number;
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
      onKeyDown={(e) => e.key === 'Enter' && setIsEditing(true)}
      tabIndex={0}
      role="button"
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
  readOnly,
}: SortableRowProps) {
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
        'group',
        isDragging && 'bg-muted',
        hasInsufficientStock && 'bg-destructive/10'
      )}
    >
      {/* Drag Handle */}
      <TableCell className="w-10 px-2">
        {!readOnly && (
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab touch-none p-1 opacity-50 hover:opacity-100"
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
        />
      </TableCell>

      {/* Quantity */}
      <TableCell className="w-24">
        <div className="flex flex-col">
          <EditableCell
            value={item.quantity}
            onChange={(v) => onUpdate(item.localId, 'quantity', Number(v))}
            type="number"
            min={0.001}
            step={0.001}
            readOnly={readOnly}
            className="w-20"
          />
          {stockAvailable !== undefined && (
            <span
              className={cn(
                'text-xs',
                hasInsufficientStock ? 'text-destructive' : 'text-muted-foreground'
              )}
            >
              Stock: {stockAvailable}
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
            className="h-8 w-8 opacity-0 group-hover:opacity-100"
            onClick={() => onRemove(item.localId)}
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
  readOnly = false,
  className,
}: InvoiceItemsTableProps) {
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
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead className="min-w-[200px]">Item</TableHead>
                <TableHead className="min-w-[150px]">Description</TableHead>
                <TableHead className="w-24">Qty</TableHead>
                <TableHead className="w-28">Unit Price</TableHead>
                <TableHead className="w-20">Disc %</TableHead>
                <TableHead className="w-20">Tax %</TableHead>
                <TableHead className="w-32 text-right">Total</TableHead>
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
                    readOnly={readOnly}
                  />
                ))}
              </SortableContext>

              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Search className="h-8 w-8" />
                      <p>No items added yet</p>
                      {!readOnly && (
                        <Button variant="outline" size="sm" onClick={onAddItem}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Item
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
          Add Item
        </Button>
      )}

      {/* Totals */}
      {items.length > 0 && (
        <div className="flex justify-end">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal:</span>
              <span>
                {subtotal.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax:</span>
              <span>
                {taxTotal.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="flex justify-between border-t pt-2 font-medium">
              <span>Total:</span>
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

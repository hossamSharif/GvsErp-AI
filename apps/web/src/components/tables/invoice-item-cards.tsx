'use client';

/**
 * Invoice Item Cards
 *
 * Mobile counterpart of InvoiceItemsTable: each line is an accordion card.
 * Collapsed it shows the name, price × qty, line total and a large − qty +
 * stepper; tapping the card expands price / discount / tax / stock and a
 * delete button. Only one card is open at a time. Same callbacks as the table.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, Minus, Plus, Search, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { DraftInvoiceItem } from '@erp/shared';

interface InvoiceItemCardsProps {
  items: DraftInvoiceItem[];
  onRemoveItem: (localId: string) => void;
  onItemUpdate: (localId: string, field: keyof DraftInvoiceItem, value: unknown) => void;
  stockAvailability?: Record<string, number>;
  highlightLocalId?: string | null;
  readOnly?: boolean;
  className?: string;
}

const fmt = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// =============================================================================
// NUMBER FIELD — local text state, commits on blur/Enter like EditableCell
// =============================================================================

function NumberField({
  id,
  label,
  value,
  onCommit,
  min,
  max,
  step,
  className,
}: {
  id: string;
  label: string;
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  const commit = () => {
    let n = parseFloat(text);
    if (Number.isNaN(n)) n = value;
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    setText(String(n));
    if (n !== value) onCommit(n);
  };

  return (
    <div className={cn('space-y-1', className)}>
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        value={text}
        min={min}
        max={max}
        step={step}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        onFocus={(e) => e.currentTarget.select()}
        className="h-11 text-base"
      />
    </div>
  );
}

// =============================================================================
// QUANTITY STEPPER
// =============================================================================

function QuantityStepper({
  item,
  onUpdate,
}: {
  item: DraftInvoiceItem;
  onUpdate: (localId: string, field: keyof DraftInvoiceItem, value: unknown) => void;
}) {
  const t = useTranslations('sales.items');
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(String(item.quantity));
  useEffect(() => setText(String(item.quantity)), [item.quantity]);

  const commit = () => {
    const n = parseFloat(text);
    setEditing(false);
    if (!Number.isNaN(n) && n > 0 && n !== item.quantity) {
      onUpdate(item.localId, 'quantity', n);
    } else {
      setText(String(item.quantity));
    }
  };

  return (
    // Stop taps here from toggling the card.
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-11 w-11 shrink-0"
        disabled={item.quantity <= 1}
        onClick={() => onUpdate(item.localId, 'quantity', Math.max(1, item.quantity - 1))}
        aria-label={t('ariaDecrement', { name: item.itemName })}
      >
        <Minus className="h-4 w-4" />
      </Button>
      {editing ? (
        <Input
          autoFocus
          type="number"
          inputMode="decimal"
          value={text}
          min={0.001}
          step={0.001}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Escape') {
              setText(String(item.quantity));
              setEditing(false);
            }
          }}
          onFocus={(e) => e.currentTarget.select()}
          className="h-11 w-16 px-1 text-center text-base"
          aria-label={t('ariaQuantity', { name: item.itemName })}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="h-11 w-16 rounded-md border border-transparent text-center text-base font-semibold tabular-nums hover:border-input"
          aria-label={t('ariaQuantity', { name: item.itemName })}
        >
          {item.quantity}
        </button>
      )}
      <Button
        type="button"
        size="icon"
        className="h-11 w-11 shrink-0"
        onClick={() => onUpdate(item.localId, 'quantity', item.quantity + 1)}
        aria-label={t('ariaIncrement', { name: item.itemName })}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}

// =============================================================================
// CARD
// =============================================================================

function ItemCard({
  item,
  index,
  expanded,
  onToggle,
  onRemove,
  onUpdate,
  stockAvailable,
  highlight,
  readOnly,
}: {
  item: DraftInvoiceItem;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onRemove: (localId: string) => void;
  onUpdate: (localId: string, field: keyof DraftInvoiceItem, value: unknown) => void;
  stockAvailable?: number;
  highlight?: boolean;
  readOnly?: boolean;
}) {
  const t = useTranslations('sales.items');
  const ref = useRef<HTMLDivElement>(null);
  const panelId = `item-panel-${item.localId}`;

  // Stock is unknown offline (not cached) — only flag a shortage we can see.
  const hasInsufficientStock = stockAvailable !== undefined && item.quantity > stockAvailable;

  // Bring a line into view when a re-add flashes it.
  useEffect(() => {
    if (highlight) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [highlight]);

  return (
    <div
      ref={ref}
      className={cn(
        'rounded-lg border bg-card transition-colors',
        hasInsufficientStock && 'border-destructive/50 bg-destructive/5',
        highlight && 'bg-primary/10 ring-1 ring-primary',
        expanded && 'shadow-sm'
      )}
    >
      {/* Collapsed summary — the whole row toggles the panel */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        className="flex cursor-pointer flex-col gap-2 p-3"
      >
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded bg-muted px-1 text-xs text-muted-foreground">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 font-medium leading-snug">{item.itemName}</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {fmt(item.unitPrice)} × {item.quantity}
              {item.discountPercent > 0 && ` · −${item.discountPercent}%`}
            </p>
          </div>
          <div className="shrink-0 text-end">
            <p className="font-semibold tabular-nums">{fmt(item.lineTotal)}</p>
          </div>
          <ChevronDown
            className={cn(
              'mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              expanded && 'rotate-180'
            )}
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          {stockAvailable !== undefined ? (
            <span
              className={cn(
                'text-xs',
                hasInsufficientStock ? 'font-medium text-destructive' : 'text-muted-foreground'
              )}
            >
              {t('stock', { count: stockAvailable })}
            </span>
          ) : (
            <span />
          )}
          {readOnly ? (
            <span className="text-sm font-semibold tabular-nums">× {item.quantity}</span>
          ) : (
            <QuantityStepper item={item} onUpdate={onUpdate} />
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div id={panelId} className="space-y-3 border-t p-3">
          {item.itemSku && (
            <p className="text-xs text-muted-foreground">{item.itemSku}</p>
          )}
          {readOnly ? (
            <dl className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">{t('columns.unitPrice')}</dt>
                <dd className="tabular-nums">{fmt(item.unitPrice)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t('columns.discountPercent')}</dt>
                <dd className="tabular-nums">{item.discountPercent}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t('columns.taxPercent')}</dt>
                <dd className="tabular-nums">{item.taxRate}</dd>
              </div>
            </dl>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <NumberField
                  id={`${item.localId}-price`}
                  label={t('columns.unitPrice')}
                  value={item.unitPrice}
                  onCommit={(v) => onUpdate(item.localId, 'unitPrice', v)}
                  min={0}
                  step={0.01}
                />
                <NumberField
                  id={`${item.localId}-disc`}
                  label={t('columns.discountPercent')}
                  value={item.discountPercent}
                  onCommit={(v) => onUpdate(item.localId, 'discountPercent', v)}
                  min={0}
                  max={100}
                  step={0.1}
                />
                <NumberField
                  id={`${item.localId}-tax`}
                  label={t('columns.taxPercent')}
                  value={item.taxRate}
                  onCommit={(v) => onUpdate(item.localId, 'taxRate', v)}
                  min={0}
                  max={100}
                  step={0.1}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onRemove(item.localId)}
                aria-label={t('ariaRemove', { name: item.itemName })}
              >
                <Trash2 className="me-2 h-4 w-4" />
                {t('deleteItem')}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// LIST
// =============================================================================

export function InvoiceItemCards({
  items,
  onRemoveItem,
  onItemUpdate,
  stockAvailability,
  highlightLocalId,
  readOnly = false,
  className,
}: InvoiceItemCardsProps) {
  const t = useTranslations('sales.items');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-muted-foreground',
          className
        )}
      >
        <Search className="h-8 w-8" />
        {/* No add button here — the form's "Add items" button sits right above. */}
        <p>{t('empty')}</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {items.map((item, index) => (
        <ItemCard
          key={item.localId}
          item={item}
          index={index}
          expanded={expandedId === item.localId}
          onToggle={() => setExpandedId((id) => (id === item.localId ? null : item.localId))}
          onRemove={(localId) => {
            if (expandedId === localId) setExpandedId(null);
            onRemoveItem(localId);
          }}
          onUpdate={onItemUpdate}
          stockAvailable={stockAvailability?.[item.itemId]}
          highlight={item.localId === highlightLocalId}
          readOnly={readOnly}
        />
      ))}
    </div>
  );
}

export default InvoiceItemCards;

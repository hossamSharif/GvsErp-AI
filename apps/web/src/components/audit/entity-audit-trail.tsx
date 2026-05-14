'use client';

/**
 * EntityAuditTrail (Phase 8)
 *
 * Collapsible "Edit log" panel for any entity (invoice, customer, supplier,
 * bank account, cost center, …). Surfaces the audit_logs rows captured by
 * the auto_audit_changes() trigger plus any application-side logAction()
 * calls. Mirrors Tally's per-voucher Edit Log feature.
 *
 * Diff rendering is computed client-side from old_values + new_values —
 * shows only fields whose value actually changed, with creation/deletion
 * snapshots rendered in full.
 */

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useEntityAuditLogs } from '@/hooks/use-audit-logs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, History, Loader2 } from 'lucide-react';
import type { AuditEntityType, AuditLog } from '@erp/shared';

// Fields with predictable noise — collapsing the diff hides them by
// default so the user sees only meaningful changes.
const NOISY_FIELDS = new Set(['created_at', 'updated_at']);

interface DiffEntry {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

function computeDiff(
  oldValues: Record<string, unknown> | null,
  newValues: Record<string, unknown> | null
): DiffEntry[] {
  if (!oldValues && !newValues) return [];
  if (!oldValues) {
    // Create — render new state as one-sided diff
    return Object.entries(newValues!)
      .filter(([k]) => !NOISY_FIELDS.has(k))
      .map(([field, newValue]) => ({ field, oldValue: undefined, newValue }));
  }
  if (!newValues) {
    return Object.entries(oldValues)
      .filter(([k]) => !NOISY_FIELDS.has(k))
      .map(([field, oldValue]) => ({ field, oldValue, newValue: undefined }));
  }
  const keys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);
  const out: DiffEntry[] = [];
  for (const key of keys) {
    if (NOISY_FIELDS.has(key)) continue;
    const ov = oldValues[key];
    const nv = newValues[key];
    if (JSON.stringify(ov) !== JSON.stringify(nv)) {
      out.push({ field: key, oldValue: ov, newValue: nv });
    }
  }
  return out;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '∅';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function actionVariant(
  action: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (action) {
    case 'create':
      return 'default';
    case 'delete':
      return 'destructive';
    case 'update':
      return 'secondary';
    default:
      return 'outline';
  }
}

interface EntityAuditTrailProps {
  entityType: AuditEntityType;
  entityId: string;
  /** Default collapsed. Pass false to start expanded. */
  defaultCollapsed?: boolean;
  limit?: number;
}

export function EntityAuditTrail({
  entityType,
  entityId,
  defaultCollapsed = true,
  limit = 50,
}: EntityAuditTrailProps) {
  const t = useTranslations('auditTrail');
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const { data: logs, isLoading } = useEntityAuditLogs(entityType, entityId, limit);

  const dateFormat = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    []
  );

  const count = logs?.length ?? 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" /> {t('title')}
            {count > 0 && (
              <Badge variant="outline" className="ml-2 font-normal">
                {count}
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      {!collapsed && (
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : !logs || logs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {t('empty')}
            </p>
          ) : (
            <ol className="space-y-4">
              {logs.map((entry: AuditLog) => {
                const diff = computeDiff(
                  entry.oldValues as Record<string, unknown> | null,
                  entry.newValues as Record<string, unknown> | null
                );
                return (
                  <li
                    key={entry.id}
                    className="border-l-2 pl-4 py-1"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant={actionVariant(entry.action)} className="capitalize">
                        {entry.action}
                      </Badge>
                      <span className="text-muted-foreground">
                        {dateFormat.format(new Date(entry.createdAt))}
                      </span>
                      {(entry.userName || entry.userEmail) && (
                        <span className="text-muted-foreground">
                          · {entry.userName ?? entry.userEmail}
                        </span>
                      )}
                    </div>
                    {diff.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-xs">
                        {diff.map((d) => (
                          <li key={d.field} className="flex items-baseline gap-2 font-mono">
                            <span className="text-muted-foreground min-w-32">{d.field}</span>
                            {entry.action === 'create' ? (
                              <span className="text-green-700 dark:text-green-400">
                                {formatValue(d.newValue)}
                              </span>
                            ) : entry.action === 'delete' ? (
                              <span className="text-red-700 dark:text-red-400 line-through">
                                {formatValue(d.oldValue)}
                              </span>
                            ) : (
                              <>
                                <span className="text-red-700 dark:text-red-400 line-through">
                                  {formatValue(d.oldValue)}
                                </span>
                                <span className="text-muted-foreground">→</span>
                                <span className="text-green-700 dark:text-green-400">
                                  {formatValue(d.newValue)}
                                </span>
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground italic">
                        {t('noChangedFields')}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      )}
    </Card>
  );
}

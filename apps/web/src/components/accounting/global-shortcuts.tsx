'use client';

/**
 * Global keyboard shortcuts (Phase 9)
 *
 * Tally-style F-key routing for the operational flows. Active anywhere in
 * the dashboard; suppressed while focus is in an input/textarea/select/
 * contenteditable so users can still type F-keys in form fields.
 *
 *   F5       Payment   →  /payments/new
 *   F6       Receipt   →  /payments/new (same form — payment type is a
 *                          radio inside)
 *   F7       Journal   →  /accounting/journal/new
 *   F8       Sales     →  /sales/new
 *   F9       Purchase  →  /purchases/new
 *   Alt+F1   Day Book  →  /accounting/reports/day-book
 *   Shift+/  Help      →  Opens the shortcut cheatsheet dialog
 *
 * Voucher-type-specific shortcuts (Contra F4, Credit Note Ctrl+F8, etc.)
 * are deferred until P2 (voucher types) ships and gives them dedicated
 * routes — wiring them to generic forms now would be misleading.
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ShortcutsHelpDialog } from './shortcuts-help-dialog';

interface ShortcutDef {
  /** Matcher: returns true when the keyboard event should trigger this. */
  matches: (e: KeyboardEvent) => boolean;
  /** Path relative to locale (leading slash). null = no nav, runs `action`. */
  path?: string;
  /** Imperative action (e.g. open dialog). Mutually exclusive with path. */
  action?: () => void;
  /** Label key under accounting.shortcuts.* — used by the help dialog. */
  labelKey: string;
  /** Display key combo for the help dialog. */
  combo: string;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  // Radix Select trigger / shadcn combobox use role=combobox
  if (target.getAttribute('role') === 'combobox') return true;
  return false;
}

export function GlobalShortcuts() {
  const router = useRouter();
  const { locale } = useParams();
  const localeStr = locale as string;
  const [helpOpen, setHelpOpen] = useState(false);

  const navigate = useCallback(
    (path: string) => router.push(`/${localeStr}${path}`),
    [router, localeStr]
  );

  useEffect(() => {
    const shortcuts: ShortcutDef[] = [
      {
        combo: 'F5',
        labelKey: 'payment',
        path: '/payments/new',
        matches: (e) => e.key === 'F5' && !e.altKey && !e.ctrlKey && !e.metaKey,
      },
      {
        combo: 'F6',
        labelKey: 'receipt',
        path: '/payments/new',
        matches: (e) => e.key === 'F6' && !e.altKey && !e.ctrlKey && !e.metaKey,
      },
      {
        combo: 'F7',
        labelKey: 'journal',
        path: '/accounting/journal/new',
        matches: (e) => e.key === 'F7' && !e.altKey && !e.ctrlKey && !e.metaKey,
      },
      {
        combo: 'F8',
        labelKey: 'sales',
        path: '/sales/new',
        matches: (e) => e.key === 'F8' && !e.altKey && !e.ctrlKey && !e.metaKey,
      },
      {
        combo: 'F9',
        labelKey: 'purchase',
        path: '/purchases/new',
        matches: (e) => e.key === 'F9' && !e.altKey && !e.ctrlKey && !e.metaKey,
      },
      {
        combo: 'Alt+F1',
        labelKey: 'dayBook',
        path: '/accounting/reports/day-book',
        matches: (e) => e.key === 'F1' && e.altKey,
      },
      {
        combo: '?',
        labelKey: 'help',
        action: () => setHelpOpen(true),
        matches: (e) =>
          e.key === '?' && !e.altKey && !e.ctrlKey && !e.metaKey,
      },
    ];

    const handler = (e: KeyboardEvent) => {
      // Don't hijack typing.
      if (isTypingTarget(e.target)) return;

      for (const s of shortcuts) {
        if (s.matches(e)) {
          e.preventDefault();
          if (s.path) navigate(s.path);
          else if (s.action) s.action();
          return;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  return <ShortcutsHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />;
}

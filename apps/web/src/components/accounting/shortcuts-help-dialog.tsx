'use client';

/**
 * Shortcuts cheatsheet (Phase 9)
 *
 * Modal listing the F-key shortcuts. Opens via the "?" hotkey or from a
 * future menu trigger. Keep this in sync with the shortcut array in
 * global-shortcuts.tsx.
 */

import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const SHORTCUTS: { combo: string; labelKey: string }[] = [
  { combo: 'F5', labelKey: 'payment' },
  { combo: 'F6', labelKey: 'receipt' },
  { combo: 'F7', labelKey: 'journal' },
  { combo: 'F8', labelKey: 'sales' },
  { combo: 'F9', labelKey: 'purchase' },
  { combo: 'Alt + F1', labelKey: 'dayBook' },
  { combo: '?', labelKey: 'help' },
];

interface ShortcutsHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortcutsHelpDialog({ open, onOpenChange }: ShortcutsHelpDialogProps) {
  const t = useTranslations('accounting.shortcuts');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('dialogTitle')}</DialogTitle>
          <DialogDescription>{t('dialogDescription')}</DialogDescription>
        </DialogHeader>
        <ul className="divide-y">
          {SHORTCUTS.map((s) => (
            <li
              key={s.combo}
              className="flex items-center justify-between gap-4 py-2.5 text-sm"
            >
              <span>{t(s.labelKey)}</span>
              <kbd className="px-2 py-1 rounded border bg-muted text-xs font-mono">
                {s.combo}
              </kbd>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

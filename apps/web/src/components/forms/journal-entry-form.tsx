'use client';

/**
 * Journal Entry Form Component
 *
 * Form for creating/editing journal entries with:
 * - Multiple line items (debits and credits)
 * - Real-time balance validation
 * - Account selection
 * - Autosave to local storage
 */

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useAccounts } from '@/hooks/use-accounts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import type { CreateJournalLineInput } from '@erp/shared';

interface JournalEntryFormProps {
  initialData?: {
    entry_date: string;
    description?: string;
    lines: CreateJournalLineInput[];
  };
  onSubmit: (data: {
    entry_date: string;
    description?: string;
    lines: CreateJournalLineInput[];
  }) => Promise<void>;
  isPending?: boolean;
}

export function JournalEntryForm({
  initialData,
  onSubmit,
  isPending = false,
}: JournalEntryFormProps) {
  const t = useTranslations('accounting.journal.form');
  const [entryDate, setEntryDate] = useState(
    initialData?.entry_date || new Date().toISOString().split('T')[0]
  );
  const [description, setDescription] = useState(initialData?.description || '');
  const [lines, setLines] = useState<CreateJournalLineInput[]>(
    initialData?.lines || [
      { account_id: '', debit: 0, credit: 0, description: '' },
      { account_id: '', debit: 0, credit: 0, description: '' },
    ]
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const { data: accounts } = useAccounts({ tree: false });

  // Autosave to localStorage
  useEffect(() => {
    const autosaveKey = 'journal-entry-draft';
    const data = { entry_date: entryDate, description, lines };
    localStorage.setItem(autosaveKey, JSON.stringify(data));
  }, [entryDate, description, lines]);

  // Load from localStorage on mount
  useEffect(() => {
    if (!initialData) {
      const autosaveKey = 'journal-entry-draft';
      const saved = localStorage.getItem(autosaveKey);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          setEntryDate(data.entry_date);
          setDescription(data.description);
          setLines(data.lines);
        } catch (error) {
          console.error('Failed to load autosaved data', error);
        }
      }
    }
  }, [initialData]);

  const addLine = () => {
    setLines([...lines, { account_id: '', debit: 0, credit: 0, description: '' }]);
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof CreateJournalLineInput, value: CreateJournalLineInput[keyof CreateJournalLineInput]) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const totalDebits = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
  const totalCredits = lines.reduce((sum, line) => sum + (line.credit || 0), 0);
  const difference = totalDebits - totalCredits;
  const isBalanced = Math.abs(difference) < 0.01;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isBalanced) {
      setValidationError(t('errors.notBalanced'));
      return;
    }

    // Filter out empty lines
    const validLines = lines.filter(
      (line) =>
        line.account_id && ((line.debit ?? 0) > 0 || (line.credit ?? 0) > 0)
    );

    if (validLines.length < 2) {
      setValidationError(t('errors.tooFewLines'));
      return;
    }

    setValidationError(null);

    await onSubmit({
      entry_date: entryDate,
      description,
      lines: validLines,
    });

    // Clear autosave after successful submission
    localStorage.removeItem('journal-entry-draft');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('entryInfo')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="entry_date">{t('entryDate')}</Label>
              <Input
                id="entry_date"
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t('descriptionLabel')}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('descriptionPlaceholder')}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('lines')}</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            <Plus className="mr-2 h-4 w-4" />
            {t('addLine')}
          </Button>
        </CardHeader>
        {validationError && (
          <div className="px-6 pb-2">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          </div>
        )}
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">{t('columns.account')}</TableHead>
                <TableHead className="w-[200px]">{t('columns.description')}</TableHead>
                <TableHead className="w-[150px] text-right">{t('columns.debit')}</TableHead>
                <TableHead className="w-[150px] text-right">{t('columns.credit')}</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Select
                      value={line.account_id}
                      onValueChange={(value) => updateLine(index, 'account_id', value)}
                    >
                      <SelectTrigger aria-label={t('aria.accountForLine', { n: index + 1 })}>
                        <SelectValue placeholder={t('placeholders.selectAccount')} />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts?.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.code} - {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={line.description || ''}
                      onChange={(e) =>
                        updateLine(index, 'description', e.target.value)
                      }
                      placeholder={t('placeholders.lineDescription')}
                      aria-label={t('aria.descriptionForLine', { n: index + 1 })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      value={line.debit || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        updateLine(index, 'debit', val);
                        if (val > 0) updateLine(index, 'credit', 0);
                      }}
                      className="text-right"
                      placeholder={t('placeholders.amount')}
                      aria-label={t('aria.debitForLine', { n: index + 1 })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      value={line.credit || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        updateLine(index, 'credit', val);
                        if (val > 0) updateLine(index, 'debit', 0);
                      }}
                      className="text-right"
                      placeholder={t('placeholders.amount')}
                      aria-label={t('aria.creditForLine', { n: index + 1 })}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLine(index)}
                      disabled={lines.length <= 2}
                      aria-label={t('aria.removeLine', { n: index + 1 })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-semibold">
                  {t('totals')}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {totalDebits.toFixed(2)}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {totalCredits.toFixed(2)}
                </TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableFooter>
          </Table>

          {!isBalanced && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {t('notBalanced', { diff: Math.abs(difference).toFixed(2) })}{' '}
                  {difference > 0 ? t('exceedDebit') : t('exceedCredit')}
                </span>
              </div>
            </div>
          )}

          {isBalanced && totalDebits > 0 && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border-t border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">{t('balanced')}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button
          type="submit"
          disabled={!isBalanced || isPending}
          size="lg"
        >
          {isPending ? t('saving') : t('save')}
        </Button>
      </div>
    </form>
  );
}

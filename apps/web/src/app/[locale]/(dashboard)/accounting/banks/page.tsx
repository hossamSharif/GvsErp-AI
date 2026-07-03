'use client';

/**
 * Bank Accounts Page
 *
 * Lists tenant bank/cash accounts (plan Phase 3). Each row is a first-class
 * entity bound 1:1 to a ledger in the chart of accounts; the "View Ledger"
 * link jumps to the existing General Ledger screen filtered to that bank.
 */

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useBanks, useCreateBank, useUpdateBank, useDeactivateBank } from '@/hooks/use-banks';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CurrencySelect } from '@/components/forms/currency-select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Landmark, Loader2, ExternalLink, Trash2, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type {
  CreateBankAccountInput,
  UpdateBankAccountInput,
  BankAccountWithLedger,
} from '@erp/shared';

const EMPTY_FORM: CreateBankAccountInput = {
  name: '',
  account_number: '',
  bank_name: '',
  opening_balance: 0,
  currency: 'USD',
};

export default function BankAccountsPage() {
  const t = useTranslations('accounting.banks');
  const { locale } = useParams();
  const { toast } = useToast();

  const { data: banks, isLoading } = useBanks();
  const createMutation = useCreateBank();
  const updateMutation = useUpdateBank();
  const deactivateMutation = useDeactivateBank();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<CreateBankAccountInput>(EMPTY_FORM);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [editBank, setEditBank] = useState<BankAccountWithLedger | null>(null);
  const [editForm, setEditForm] = useState<UpdateBankAccountInput>({});

  const handleCreate = async () => {
    try {
      const currency = formData.currency?.trim()
        ? formData.currency.trim().toUpperCase()
        : undefined;
      await createMutation.mutateAsync({
        ...formData,
        account_number: formData.account_number?.trim() || undefined,
        bank_name: formData.bank_name?.trim() || undefined,
        currency,
      });
      toast({ title: t('createSuccess') });
      setDialogOpen(false);
      setFormData(EMPTY_FORM);
    } catch (error) {
      toast({
        title: t('createError'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    }
  };

  const openEdit = (bank: BankAccountWithLedger) => {
    setEditBank(bank);
    setEditForm({
      name: bank.name,
      bank_name: bank.bank_name ?? '',
      account_number: bank.account_number ?? '',
      notes: bank.notes ?? '',
    });
  };

  const handleUpdate = async () => {
    if (!editBank) return;
    try {
      await updateMutation.mutateAsync({
        id: editBank.id,
        input: {
          name: editForm.name?.trim() || undefined,
          bank_name: editForm.bank_name?.trim() || null,
          account_number: editForm.account_number?.trim() || null,
          notes: editForm.notes?.trim() || null,
        },
      });
      toast({ title: t('editSuccess') });
      setEditBank(null);
    } catch (error) {
      toast({
        title: t('editError'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateId) return;
    try {
      await deactivateMutation.mutateAsync(deactivateId);
      toast({ title: t('deactivateSuccess') });
    } catch (error) {
      toast({
        title: t('deactivateError'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setDeactivateId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Landmark className="h-6 w-6" /> {t('title')}
          </h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> {t('addBank')}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : banks && banks.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('columns.name')}</TableHead>
                  <TableHead>{t('columns.bankName')}</TableHead>
                  <TableHead>{t('columns.accountNumber')}</TableHead>
                  <TableHead>{t('columns.ledgerCode')}</TableHead>
                  <TableHead className="text-right">{t('columns.balance')}</TableHead>
                  <TableHead>{t('columns.status')}</TableHead>
                  <TableHead className="text-right">{t('columns.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {banks.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell>{b.bank_name || '-'}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {b.account_number || '-'}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {b.ledger?.code || '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {b.ledger ? b.ledger.balance.toFixed(2) : '-'}
                    </TableCell>
                    <TableCell>
                      {b.is_active ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                          {t('status.active')}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">{t('status.inactive')}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-2">
                        {b.ledger && (
                          <Button asChild variant="ghost" size="sm">
                            <Link
                              href={`/${locale}/accounting/ledger?account_id=${b.ledger.id}`}
                            >
                              <ExternalLink className="h-4 w-4 mr-1" />
                              {t('viewLedger')}
                            </Link>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(b)}
                          aria-label={t('editBank')}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {b.is_active && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeactivateId(b.id)}
                            aria-label={t('deactivate')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              {t('empty')}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('form.title')}</DialogTitle>
            <DialogDescription>{t('form.description')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bank-name">{t('form.name')}</Label>
              <Input
                id="bank-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('form.namePlaceholder')}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bank-bankName">{t('form.bankName')}</Label>
                <Input
                  id="bank-bankName"
                  value={formData.bank_name ?? ''}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  placeholder={t('form.bankNamePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bank-accountNumber">{t('form.accountNumber')}</Label>
                <Input
                  id="bank-accountNumber"
                  value={formData.account_number ?? ''}
                  onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                  placeholder="****1234"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bank-openingBalance">{t('form.openingBalance')}</Label>
                <Input
                  id="bank-openingBalance"
                  type="number"
                  step="0.01"
                  value={formData.opening_balance ?? 0}
                  onChange={(e) =>
                    setFormData({ ...formData, opening_balance: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bank-currency">{t('form.currency')}</Label>
                <CurrencySelect
                  value={formData.currency ?? 'USD'}
                  onValueChange={(code) => setFormData({ ...formData, currency: code })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('form.cancel')}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending || !formData.name.trim()}
            >
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('form.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editBank} onOpenChange={(open) => !open && setEditBank(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('form.editTitle')}</DialogTitle>
            <DialogDescription>{t('form.editDescription')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-bank-name">{t('form.name')}</Label>
              <Input
                id="edit-bank-name"
                value={editForm.name ?? ''}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder={t('form.namePlaceholder')}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-bank-bankName">{t('form.bankName')}</Label>
                <Input
                  id="edit-bank-bankName"
                  value={editForm.bank_name ?? ''}
                  onChange={(e) => setEditForm({ ...editForm, bank_name: e.target.value })}
                  placeholder={t('form.bankNamePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-bank-accountNumber">{t('form.accountNumber')}</Label>
                <Input
                  id="edit-bank-accountNumber"
                  value={editForm.account_number ?? ''}
                  onChange={(e) => setEditForm({ ...editForm, account_number: e.target.value })}
                  placeholder="****1234"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-bank-notes">{t('form.notes')}</Label>
              <Input
                id="edit-bank-notes"
                value={editForm.notes ?? ''}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-bank-openingBalance">{t('form.openingBalance')}</Label>
                <Input
                  id="edit-bank-openingBalance"
                  value={editBank?.opening_balance ?? 0}
                  disabled
                />
                <p className="text-xs text-muted-foreground">{t('form.currencyLocked')}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-bank-currency">{t('form.currency')}</Label>
                <Input id="edit-bank-currency" value={editBank?.currency ?? ''} disabled />
                <p className="text-xs text-muted-foreground">{t('form.currencyLocked')}</p>
              </div>
            </div>
            {editBank?.ledger && (
              <div className="space-y-2">
                <Label htmlFor="edit-bank-ledger">{t('form.ledgerCode')}</Label>
                <Input
                  id="edit-bank-ledger"
                  value={`${editBank.ledger.code} — ${editBank.ledger.name}`}
                  disabled
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBank(null)}>
              {t('form.cancel')}
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateMutation.isPending || !editForm.name?.trim()}
            >
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('form.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deactivateId}
        onOpenChange={(open) => !open && setDeactivateId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deactivateConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deactivateConfirm.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('form.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate}>
              {t('deactivate')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

'use client';

/**
 * Chart of Accounts Page
 *
 * Displays the hierarchical chart of accounts with CRUD operations.
 */

import { useState } from 'react';
import { useAccounts, useCreateAccount, useUpdateAccount, useDeleteAccount } from '@/hooks/use-accounts';
import { useAccountingStatus } from '@/hooks/use-accounting';
import { AccountingActivationWizard } from '@/components/wizards/accounting-activation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Edit2, Trash2, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Account, AccountType, CreateAccountInput } from '@erp/shared';

export default function ChartOfAccountsPage() {
  const { toast } = useToast();
  const [showActivation, setShowActivation] = useState(false);
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<AccountType | 'all'>('all');

  // Form state
  const [formData, setFormData] = useState<CreateAccountInput>({
    code: '',
    name: '',
    type: 'asset',
    parent_id: undefined,
  });

  const { data: status, isLoading: statusLoading } = useAccountingStatus();
  const { data: accounts, isLoading: accountsLoading } = useAccounts({
    tree: true,
    type: filterType === 'all' ? undefined : filterType,
  });
  const createMutation = useCreateAccount();
  const updateMutation = useUpdateAccount();
  const deleteMutation = useDeleteAccount();

  const isActivated = status?.is_activated ?? false;

  const toggleNode = (id: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedNodes(newExpanded);
  };

  const handleOpenDialog = (account?: Account) => {
    if (account) {
      setEditingAccount(account);
      setFormData({
        code: account.code,
        name: account.name,
        type: account.type,
        parent_id: account.parent_id,
      });
    } else {
      setEditingAccount(null);
      setFormData({
        code: '',
        name: '',
        type: 'asset',
        parent_id: undefined,
      });
    }
    setShowAccountDialog(true);
  };

  const handleCloseDialog = () => {
    setShowAccountDialog(false);
    setEditingAccount(null);
  };

  const handleSubmit = async () => {
    try {
      if (editingAccount) {
        await updateMutation.mutateAsync({
          id: editingAccount.id,
          data: formData,
        });
        toast({
          title: 'Success',
          description: 'Account updated successfully',
        });
      } else {
        await createMutation.mutateAsync(formData);
        toast({
          title: 'Success',
          description: 'Account created successfully',
        });
      }
      handleCloseDialog();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error?.message || 'Failed to save account',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this account?')) return;

    try {
      await deleteMutation.mutateAsync(id);
      toast({
        title: 'Success',
        description: 'Account deleted successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error?.message || 'Failed to delete account',
        variant: 'destructive',
      });
    }
  };

  const renderAccountTree = (accountList: Account[], depth: number = 0) => {
    return accountList.map((account) => {
      const hasChildren = account.children && account.children.length > 0;
      const isExpanded = expandedNodes.has(account.id);

      return (
        <div key={account.id}>
          <div
            className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-md group"
            style={{ paddingLeft: `${depth * 24 + 8}px` }}
          >
            <div className="flex items-center flex-1 min-w-0">
              {hasChildren ? (
                <button
                  onClick={() => toggleNode(account.id)}
                  className="mr-2 p-0.5 hover:bg-muted rounded"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              ) : (
                <div className="w-6 mr-2" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-sm text-muted-foreground">
                    {account.code}
                  </span>
                  <span className="font-medium">{account.name}</span>
                  <span className="text-xs text-muted-foreground capitalize">
                    ({account.type})
                  </span>
                </div>
              </div>
              <div className="ml-auto text-sm font-mono">
                {account.balance !== 0 && (
                  <span className={account.balance >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {account.balance.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 ml-4 opacity-0 group-hover:opacity-100">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenDialog(account)}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(account.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {hasChildren && isExpanded && renderAccountTree(account.children!, depth + 1)}
        </div>
      );
    });
  };

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isActivated) {
    return (
      <>
        <div className="flex flex-col items-center justify-center h-96">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Accounting Module Not Activated</CardTitle>
              <CardDescription>
                Activate the accounting module to manage your chart of accounts and financial statements.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setShowActivation(true)} className="w-full">
                Activate Accounting Module
              </Button>
            </CardContent>
          </Card>
        </div>
        <AccountingActivationWizard
          open={showActivation}
          onClose={() => setShowActivation(false)}
        />
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Chart of Accounts</h1>
          <p className="text-muted-foreground">
            Manage your accounting accounts and categories
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          New Account
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Label>Filter by Type:</Label>
          <Select
            value={filterType}
            onValueChange={(value) => setFilterType(value as AccountType | 'all')}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="asset">Asset</SelectItem>
              <SelectItem value="liability">Liability</SelectItem>
              <SelectItem value="equity">Equity</SelectItem>
              <SelectItem value="revenue">Revenue</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          {accountsLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : accounts && accounts.length > 0 ? (
            <div className="space-y-1">
              {renderAccountTree(accounts)}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No accounts found. Click "New Account" to create one.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Form Dialog */}
      <Dialog open={showAccountDialog} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? 'Edit Account' : 'Create Account'}
            </DialogTitle>
            <DialogDescription>
              {editingAccount
                ? 'Update account information'
                : 'Add a new account to your chart of accounts'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Account Code</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="1000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Account Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Cash"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Account Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) =>
                  setFormData({ ...formData, type: value as AccountType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asset">Asset</SelectItem>
                  <SelectItem value="liability">Liability</SelectItem>
                  <SelectItem value="equity">Equity</SelectItem>
                  <SelectItem value="revenue">Revenue</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingAccount ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

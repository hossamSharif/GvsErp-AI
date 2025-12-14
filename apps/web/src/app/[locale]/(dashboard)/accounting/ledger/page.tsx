'use client';

import { useState } from 'react';
import { useGeneralLedger } from '@/hooks/use-accounting';
import { useAccounts } from '@/hooks/use-accounts';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Download } from 'lucide-react';
import { format } from 'date-fns';

export default function GeneralLedgerPage() {
  const [accountId, setAccountId] = useState('');
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: accounts } = useAccounts({ tree: false });
  const { data, isLoading } = useGeneralLedger(accountId, startDate, endDate);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">General Ledger</h1>
        <p className="text-muted-foreground">View transaction history for an account</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-end gap-4 mb-6">
            <div className="flex-1 max-w-xs space-y-2">
              <Label>Account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts?.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.code} - {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <Button variant="outline"><Download className="mr-2 h-4 w-4" />Export PDF</Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : data ? (
            <div>
              <div className="mb-4 p-4 bg-muted rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-semibold">{data.account_code} - {data.account_name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm text-muted-foreground">Beginning Balance: </span>
                    <span className="font-mono font-semibold">{data.beginning_balance.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Entry Number</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.entries.map((entry, index) => (
                    <TableRow key={index}>
                      <TableCell>{format(new Date(entry.date), 'PP')}</TableCell>
                      <TableCell className="font-mono">{entry.entry_number}</TableCell>
                      <TableCell>{entry.description}</TableCell>
                      <TableCell className="text-right font-mono">
                        {entry.debit > 0 ? entry.debit.toFixed(2) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {entry.credit > 0 ? entry.credit.toFixed(2) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {entry.balance.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-4 p-4 bg-muted rounded-lg text-right">
                <span className="text-sm text-muted-foreground">Ending Balance: </span>
                <span className="font-mono font-semibold text-lg">{data.ending_balance.toFixed(2)}</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Select an account to view its general ledger
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

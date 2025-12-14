'use client';

import { useState } from 'react';
import { useTrialBalance } from '@/hooks/use-accounting';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Download } from 'lucide-react';

export default function TrialBalancePage() {
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const { data, isLoading, refetch } = useTrialBalance(asOfDate);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Trial Balance</h1>
        <p className="text-muted-foreground">View account balances as of a specific date</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-end gap-4 mb-6">
            <div className="flex-1 max-w-xs space-y-2">
              <Label>As Of Date</Label>
              <Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
            </div>
            <Button onClick={() => refetch()}>Generate Report</Button>
            <Button variant="outline"><Download className="mr-2 h-4 w-4" />Export PDF</Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : data ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account Code</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-mono">{row.account_code}</TableCell>
                    <TableCell>{row.account_name}</TableCell>
                    <TableCell className="capitalize">{row.account_type}</TableCell>
                    <TableCell className="text-right font-mono">
                      {row.debit > 0 ? row.debit.toFixed(2) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {row.credit > 0 ? row.credit.toFixed(2) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="font-bold">Totals:</TableCell>
                  <TableCell className="text-right font-mono font-bold">{data.total_debits.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono font-bold">{data.total_credits.toFixed(2)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

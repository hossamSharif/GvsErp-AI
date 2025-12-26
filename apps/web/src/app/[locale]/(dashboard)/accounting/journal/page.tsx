'use client';

/**
 * Journal Entries Page
 *
 * Lists all journal entries with filtering and CRUD operations.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useJournalEntries, usePostJournalEntry, useDeleteJournalEntry } from '@/hooks/use-journal-entries';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, MoreHorizontal, Edit2, Trash2, CheckCircle2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export default function JournalEntriesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations('accounting.journal');
  const tc = useTranslations('common');
  const [filters, setFilters] = useState({
    page: 1,
    limit: 50,
  });

  const { data, isLoading } = useJournalEntries(filters);
  const postMutation = usePostJournalEntry();
  const deleteMutation = useDeleteJournalEntry();

  const handlePost = async (id: string) => {
    if (!confirm(t('postConfirm'))) {
      return;
    }

    try {
      await postMutation.mutateAsync(id);
      toast({
        title: tc('success'),
        description: t('messages.postSuccess'),
      });
    } catch (error: any) {
      toast({
        title: tc('error'),
        description: error.response?.data?.error?.message || t('messages.postError'),
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('deleteConfirm'))) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(id);
      toast({
        title: tc('success'),
        description: t('messages.deleteSuccess'),
      });
    } catch (error: any) {
      toast({
        title: tc('error'),
        description: error.response?.data?.error?.message || t('messages.deleteError'),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <Button onClick={() => router.push('/accounting/journal/new')}>
          <Plus className="mr-2 h-4 w-4" />
          {t('newJournalEntry')}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : data && data.data.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('fields.entryNumber')}</TableHead>
                  <TableHead>{t('fields.date')}</TableHead>
                  <TableHead>{t('fields.description')}</TableHead>
                  <TableHead>{t('fields.source')}</TableHead>
                  <TableHead>{t('fields.status')}</TableHead>
                  <TableHead className="text-right">{t('fields.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono">{entry.entry_number}</TableCell>
                    <TableCell>{format(new Date(entry.entry_date), 'PPP')}</TableCell>
                    <TableCell>{entry.description || '-'}</TableCell>
                    <TableCell className="capitalize">
                      {entry.source_type ? (
                        <Badge variant="outline">{entry.source_type}</Badge>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {entry.is_posted ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                          {t('status.posted')}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">{t('status.draft')}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!entry.is_posted && (
                            <>
                              <DropdownMenuItem
                                onClick={() => router.push(`/accounting/journal/${entry.id}`)}
                              >
                                <Edit2 className="mr-2 h-4 w-4" />
                                {t('edit')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handlePost(entry.id)}>
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                {t('postEntry')}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(entry.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {t('delete')}
                              </DropdownMenuItem>
                            </>
                          )}
                          {entry.is_posted && (
                            <DropdownMenuItem
                              onClick={() => router.push(`/accounting/journal/${entry.id}`)}
                            >
                              {t('viewDetails')}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              {t('noEntriesFound')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

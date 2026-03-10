'use client';

/**
 * Journal Entries Page
 *
 * Lists all journal entries with filtering and CRUD operations.
 */

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
import { Plus, MoreHorizontal, Edit2, Trash2, CheckCircle2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export default function JournalEntriesPage() {
  const router = useRouter();
  const { locale } = useParams();
  const { toast } = useToast();
  const [filters, setFilters] = useState({
    page: 1,
    limit: 50,
  });
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [targetEntryId, setTargetEntryId] = useState<string | null>(null);

  const { data, isLoading } = useJournalEntries(filters);
  const postMutation = usePostJournalEntry();
  const deleteMutation = useDeleteJournalEntry();

  const handlePost = (id: string) => {
    setTargetEntryId(id);
    setPostDialogOpen(true);
  };

  const confirmPost = async () => {
    if (!targetEntryId) return;
    setPostDialogOpen(false);

    try {
      await postMutation.mutateAsync(targetEntryId);
      toast({
        title: 'Success',
        description: 'Journal entry posted successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to post journal entry',
        variant: 'destructive',
      });
    }
    setTargetEntryId(null);
  };

  const handleDelete = (id: string) => {
    setTargetEntryId(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!targetEntryId) return;
    setDeleteDialogOpen(false);

    try {
      await deleteMutation.mutateAsync(targetEntryId);
      toast({
        title: 'Success',
        description: 'Journal entry deleted successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete journal entry',
        variant: 'destructive',
      });
    }
    setTargetEntryId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Journal Entries</h1>
          <p className="text-muted-foreground">
            Manage your accounting journal entries
          </p>
        </div>
        <Button onClick={() => router.push(`/${locale}/accounting/journal/new`)}>
          <Plus className="mr-2 h-4 w-4" />
          New Journal Entry
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
                  <TableHead>Entry Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                          Posted
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Draft</Badge>
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
                                onClick={() => router.push(`/${locale}/accounting/journal/${entry.id}`)}
                              >
                                <Edit2 className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handlePost(entry.id)}>
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Post Entry
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(entry.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
                          {entry.is_posted && (
                            <DropdownMenuItem
                              onClick={() => router.push(`/${locale}/accounting/journal/${entry.id}`)}
                            >
                              View Details
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
              No journal entries found. Click "New Journal Entry" to create one.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Post Confirmation Dialog */}
      <AlertDialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Post Journal Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to post this journal entry? This action cannot be undone.
              Once posted, the entry will update account balances and cannot be edited or deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPost}>
              Post Entry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Journal Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this journal entry? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useCreateJournalEntry } from '@/hooks/use-journal-entries';
import { JournalEntryForm } from '@/components/forms/journal-entry-form';
import { useToast } from '@/hooks/use-toast';

export default function NewJournalEntryPage() {
  const router = useRouter();
  const { toast } = useToast();
  const createMutation = useCreateJournalEntry();

  const handleSubmit = async (data: any) => {
    try {
      await createMutation.mutateAsync(data);
      toast({
        title: 'Success',
        description: 'Journal entry created successfully',
      });
      router.push('/accounting/journal');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error?.message || 'Failed to create journal entry',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Journal Entry</h1>
        <p className="text-muted-foreground">Create a new accounting journal entry</p>
      </div>
      <JournalEntryForm onSubmit={handleSubmit} isPending={createMutation.isPending} />
    </div>
  );
}

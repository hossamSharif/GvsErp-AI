'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCreateJournalEntry } from '@/hooks/use-journal-entries';
import { JournalEntryForm } from '@/components/forms/journal-entry-form';
import { useToast } from '@/hooks/use-toast';

export default function NewJournalEntryPage() {
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations('accounting.journal');
  const tc = useTranslations('common');
  const createMutation = useCreateJournalEntry();

  const handleSubmit = async (data: any) => {
    try {
      await createMutation.mutateAsync(data);
      toast({
        title: tc('success'),
        description: t('messages.createSuccess'),
      });
      router.push('/accounting/journal');
    } catch (error: any) {
      toast({
        title: tc('error'),
        description: error.response?.data?.error?.message || t('messages.createError'),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('createTitle')}</h1>
        <p className="text-muted-foreground">{t('createDescription')}</p>
      </div>
      <JournalEntryForm onSubmit={handleSubmit} isPending={createMutation.isPending} />
    </div>
  );
}

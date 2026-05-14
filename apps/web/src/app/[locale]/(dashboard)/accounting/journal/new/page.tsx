'use client';

import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCreateJournalEntry } from '@/hooks/use-journal-entries';
import { JournalEntryForm } from '@/components/forms/journal-entry-form';
import { useToast } from '@/hooks/use-toast';
import type { CreateJournalEntryInput } from '@erp/shared';

export default function NewJournalEntryPage() {
  const router = useRouter();
  const { locale } = useParams();
  const { toast } = useToast();
  const t = useTranslations('accounting.journal');
  const tCommon = useTranslations('common');
  const createMutation = useCreateJournalEntry();

  const handleSubmit = async (data: CreateJournalEntryInput) => {
    try {
      await createMutation.mutateAsync(data);
      toast({
        title: tCommon('success'),
        description: t('new.toast.created'),
      });
      router.push(`/${locale}/accounting/journal`);
    } catch (error) {
      toast({
        title: tCommon('error'),
        description: error instanceof Error ? error.message : t('new.toast.createError'),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('new.title')}</h1>
        <p className="text-muted-foreground">{t('new.description')}</p>
      </div>
      <JournalEntryForm onSubmit={handleSubmit} isPending={createMutation.isPending} />
    </div>
  );
}

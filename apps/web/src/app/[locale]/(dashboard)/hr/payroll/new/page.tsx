'use client';

/**
 * New Payroll Run Page
 *
 * Page for creating a new payroll run.
 */

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PayrollForm } from '@/components/forms/payroll-form';
import Link from 'next/link';

// Mock API call - replace with actual API hook
const useCreatePayrollRun = () => {
  const [isLoading, setIsLoading] = useState(false);

  const createPayrollRun = async (data: any) => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log('Creating payroll run:', data);
      return { success: true, data };
    } finally {
      setIsLoading(false);
    }
  };

  return { createPayrollRun, isLoading };
};

export default function NewPayrollRunPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations('hr');
  const { createPayrollRun, isLoading } = useCreatePayrollRun();

  const handleSubmit = async (data: any) => {
    const result = await createPayrollRun(data);
    if (result.success) {
      router.push(`/${locale}/hr/payroll`);
    }
  };

  // Set default period dates (current month)
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const initialData = {
    period_start: firstDayOfMonth.toISOString().split('T')[0],
    period_end: lastDayOfMonth.toISOString().split('T')[0],
    items: [],
    status: 'draft' as const,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/${locale}/hr/payroll`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('payroll.newRun')}</h1>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
      </div>

      {/* Form */}
      <PayrollForm
        initialData={initialData}
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />
    </div>
  );
}

'use client';

/**
 * New Customer Page
 *
 * Page for creating a new customer with:
 * - Party form component
 * - Navigation back to customers list
 * - Success/error handling
 */

import { useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useCreateParty } from '@/hooks/use-parties';
import { PartyForm } from '@/components/forms/party-form';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import type { CreatePartyInput } from '@erp-saas/shared';
import { ArrowLeft } from 'lucide-react';

export default function NewCustomerPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { toast } = useToast();

  // Create customer mutation
  const createMutation = useCreateParty({
    onSuccess: (response) => {
      toast({
        title: 'Customer created',
        description: `${response.data.name} has been created successfully.`,
      });
      router.push(`/${locale}/customers/${response.data.id}`);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create customer',
        variant: 'destructive',
      });
    },
  });

  // Handlers
  const handleSubmit = useCallback(
    async (data: CreatePartyInput) => {
      await createMutation.mutateAsync({
        ...data,
        type: 'customer',
      });
    },
    [createMutation]
  );

  const handleCancel = useCallback(() => {
    router.push(`/${locale}/customers`);
  }, [router, locale]);

  const handleBack = useCallback(() => {
    router.push(`/${locale}/customers`);
  }, [router, locale]);

  return (
    <div className="space-y-6 p-8">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Customer</h1>
          <p className="text-muted-foreground">
            Create a new customer record
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl">
        <PartyForm
          partyType="customer"
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={createMutation.isPending}
          mode="create"
        />
      </div>
    </div>
  );
}

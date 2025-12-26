'use client';

/**
 * Party Form Component
 *
 * Form for creating and editing parties (customers/suppliers) with:
 * - Basic info (name, email, phone)
 * - Contact details (address, tax number)
 * - Notes and status
 */

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type {
  Party,
  PartyType,
  CreatePartyInput,
  UpdatePartyInput,
} from '@erp-saas/shared';
import { Save, Loader2 } from 'lucide-react';

// =============================================================================
// FORM SCHEMA
// =============================================================================

const partyFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name is too long'),
  email: z.string().email('Invalid email format').max(255).nullable().optional().or(z.literal('')),
  phone: z.string().max(50).nullable().optional().or(z.literal('')),
  address: z.string().max(500).nullable().optional().or(z.literal('')),
  taxNumber: z.string().max(50).nullable().optional().or(z.literal('')),
  notes: z.string().max(2000).nullable().optional().or(z.literal('')),
  isActive: z.boolean().default(true),
});

type PartyFormData = z.infer<typeof partyFormSchema>;

// =============================================================================
// PROPS
// =============================================================================

interface PartyFormProps {
  /** Party type - customer or supplier */
  partyType: PartyType;
  /** Existing party data for editing */
  party?: Party;
  /** Submit handler */
  onSubmit: (data: CreatePartyInput | UpdatePartyInput) => Promise<void>;
  /** Cancel handler */
  onCancel?: () => void;
  /** Loading state */
  isLoading?: boolean;
  /** Mode: create or edit */
  mode?: 'create' | 'edit';
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PartyForm({
  partyType,
  party,
  onSubmit,
  onCancel,
  isLoading = false,
  mode = 'create',
}: PartyFormProps) {
  // Form setup
  const form = useForm<PartyFormData>({
    resolver: zodResolver(partyFormSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      address: '',
      taxNumber: '',
      notes: '',
      isActive: true,
    },
  });

  // Populate form with existing data
  useEffect(() => {
    if (party && mode === 'edit') {
      form.reset({
        name: party.name,
        email: party.email || '',
        phone: party.phone || '',
        address: party.address || '',
        taxNumber: party.taxNumber || '',
        notes: party.notes || '',
        isActive: party.isActive,
      });
    }
  }, [party, mode, form]);

  // Handle form submission
  const handleSubmit = async (data: PartyFormData) => {
    // Convert empty strings to null
    const submitData = {
      ...(mode === 'create' && { type: partyType }),
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      address: data.address || null,
      taxNumber: data.taxNumber || null,
      notes: data.notes || null,
      ...(mode === 'edit' && { isActive: data.isActive }),
    };

    await onSubmit(submitData as CreatePartyInput | UpdatePartyInput);
  };

  const partyLabel = partyType === 'customer' ? 'Customer' : 'Supplier';

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              {mode === 'create'
                ? `Enter the ${partyLabel.toLowerCase()} details`
                : `Update the ${partyLabel.toLowerCase()} information`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Name <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder={`${partyLabel} name`} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Email */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="email@example.com"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormDescription>
                    Contact email for invoices and communications
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Phone */}
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Additional Details */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Details</CardTitle>
            <CardDescription>Optional contact and tax information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Address */}
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Street address, city, country"
                      className="min-h-[80px]"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tax Number */}
            <FormField
              control={form.control}
              name="taxNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tax Number / VAT ID</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Tax identification number"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormDescription>
                    VAT, GST, or tax registration number
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes or comments"
                      className="min-h-[100px]"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormDescription>
                    Internal notes (not visible to {partyLabel.toLowerCase()})
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Status (Edit Mode Only) */}
        {mode === 'edit' && (
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
              <CardDescription>Manage {partyLabel.toLowerCase()} status</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <FormDescription>
                        Inactive {partyType}s won't appear in dropdowns
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        )}

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {mode === 'create' ? 'Creating...' : 'Updating...'}
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {mode === 'create' ? `Create ${partyLabel}` : `Update ${partyLabel}`}
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

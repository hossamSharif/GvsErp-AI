'use client';

/**
 * Edit Purchase Page
 *
 * Edit an existing draft purchase order.
 */

import React, { useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InvoiceForm } from '@/components/forms/invoice-form';
import { useInvoice } from '@/hooks/use-invoices';
import type { InvoiceWithRelations } from '@erp/shared';

// Mock data - in a real app, these would come from API hooks
const MOCK_WAREHOUSES = [
  { id: 'wh-1', name: 'Main Warehouse' },
  { id: 'wh-2', name: 'Branch Store' },
];

const MOCK_PARTIES = [
  { id: 'p-4', name: 'Supplier Corp', type: 'supplier' as const, balance: 200.00, email: 'supplier@example.com', phone: '+1234567893' },
  { id: 'p-5', name: 'Wholesale Inc', type: 'supplier' as const, balance: -100.00, email: 'wholesale@example.com', phone: '+1234567894' },
  { id: 'p-6', name: 'Global Goods', type: 'supplier' as const, balance: 1000.00, email: 'global@example.com', phone: '+1234567895' },
];

const MOCK_ITEMS = [
  { id: 'item-1', name: 'Product A', sku: 'SKU-001', unitPrice: 20.00, taxRate: 10 },
  { id: 'item-2', name: 'Product B', sku: 'SKU-002', unitPrice: 40.00, taxRate: 10 },
  { id: 'item-3', name: 'Product C', sku: 'SKU-003', unitPrice: 60.00, taxRate: 5 },
  { id: 'item-4', name: 'Raw Material X', sku: 'RAW-001', unitPrice: 15.00, taxRate: 0 },
];

export default function EditPurchasePage() {
  const params = useParams();
  const router = useRouter();

  const invoiceId = params.id as string;

  // Fetch existing invoice
  const { data, isLoading, error } = useInvoice(invoiceId);
  const invoice = data?.data;

  const handleSaved = useCallback((updatedInvoice: InvoiceWithRelations) => {
    // Navigate to the invoice details page
    router.push(`/purchases/${updatedInvoice.id}`);
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading purchase...</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-destructive">Purchase not found</p>
        <Button variant="outline" asChild>
          <Link href="/purchases">Back to Purchases</Link>
        </Button>
      </div>
    );
  }

  if (invoice.status !== 'draft') {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-destructive">Only draft purchases can be edited</p>
        <Button variant="outline" asChild>
          <Link href={`/purchases/${invoiceId}`}>View Purchase</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/purchases/${invoiceId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Edit Purchase</h1>
          <p className="text-muted-foreground">
            Editing {invoice.invoiceNumber}
          </p>
        </div>
      </div>

      {/* Invoice Form */}
      <InvoiceForm
        type="purchase"
        existingInvoice={invoice}
        warehouses={MOCK_WAREHOUSES}
        parties={MOCK_PARTIES}
        items={MOCK_ITEMS}
        onSaved={handleSaved}
      />
    </div>
  );
}

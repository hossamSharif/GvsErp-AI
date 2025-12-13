'use client';

/**
 * New Sale Page
 *
 * Create a new sales invoice with autosave support.
 */

import React, { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InvoiceForm } from '@/components/forms/invoice-form';
import type { InvoiceWithRelations } from '@erp/shared';

// Mock data - in a real app, these would come from API hooks
const MOCK_WAREHOUSES = [
  { id: 'wh-1', name: 'Main Warehouse' },
  { id: 'wh-2', name: 'Branch Store' },
];

const MOCK_PARTIES = [
  { id: 'p-1', name: 'John Doe', type: 'customer' as const, balance: 150.00, email: 'john@example.com', phone: '+1234567890' },
  { id: 'p-2', name: 'Jane Smith', type: 'customer' as const, balance: -50.00, email: 'jane@example.com', phone: '+1234567891' },
  { id: 'p-3', name: 'ABC Company', type: 'customer' as const, balance: 500.00, email: 'abc@example.com', phone: '+1234567892' },
];

const MOCK_ITEMS = [
  { id: 'item-1', name: 'Product A', sku: 'SKU-001', unitPrice: 25.00, taxRate: 10 },
  { id: 'item-2', name: 'Product B', sku: 'SKU-002', unitPrice: 50.00, taxRate: 10 },
  { id: 'item-3', name: 'Product C', sku: 'SKU-003', unitPrice: 75.00, taxRate: 5 },
  { id: 'item-4', name: 'Service X', sku: null, unitPrice: 100.00, taxRate: 0 },
];

export default function NewSalePage() {
  const router = useRouter();

  const handleSaved = useCallback((invoice: InvoiceWithRelations) => {
    // Navigate to the invoice details page
    router.push(`/sales/${invoice.id}`);
  }, [router]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/sales">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New Sale</h1>
          <p className="text-muted-foreground">
            Create a new sales invoice
          </p>
        </div>
      </div>

      {/* Invoice Form */}
      <InvoiceForm
        type="sale"
        warehouses={MOCK_WAREHOUSES}
        parties={MOCK_PARTIES}
        items={MOCK_ITEMS}
        defaultWarehouseId={MOCK_WAREHOUSES[0]?.id}
        onSaved={handleSaved}
      />
    </div>
  );
}

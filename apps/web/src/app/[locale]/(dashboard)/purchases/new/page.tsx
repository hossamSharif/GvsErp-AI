'use client';

/**
 * New Purchase Page
 *
 * Create a new purchase order with autosave support.
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

export default function NewPurchasePage() {
  const router = useRouter();

  const handleSaved = useCallback((invoice: InvoiceWithRelations) => {
    // Navigate to the invoice details page
    router.push(`/purchases/${invoice.id}`);
  }, [router]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/purchases">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New Purchase Order</h1>
          <p className="text-muted-foreground">
            Create a new purchase order from a supplier
          </p>
        </div>
      </div>

      {/* Invoice Form */}
      <InvoiceForm
        type="purchase"
        warehouses={MOCK_WAREHOUSES}
        parties={MOCK_PARTIES}
        items={MOCK_ITEMS}
        defaultWarehouseId={MOCK_WAREHOUSES[0]?.id}
        onSaved={handleSaved}
      />
    </div>
  );
}

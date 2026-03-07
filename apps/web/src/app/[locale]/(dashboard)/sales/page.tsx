'use client';

/**
 * Sales List Page
 *
 * Displays all sales invoices with filtering, sorting, and pagination.
 */

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Undo2,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useInvoices, usePrefetchInvoice } from '@/hooks/use-invoices';
import type { InvoiceStatus, InvoiceQueryParams } from '@erp/shared';

// =============================================================================
// CONSTANTS
// =============================================================================

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; icon: React.ElementType; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Draft', icon: Clock, variant: 'secondary' },
  final: { label: 'Finalized', icon: CheckCircle, variant: 'default' },
  returned: { label: 'Returned', icon: RotateCcw, variant: 'outline' },
  canceled: { label: 'Canceled', icon: XCircle, variant: 'destructive' },
};

// =============================================================================
// COMPONENT
// =============================================================================

export default function SalesListPage() {
  const router = useRouter();
  const { locale } = useParams();
  const prefetchInvoice = usePrefetchInvoice();

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [page, setPage] = useState(1);

  // Build query params
  const queryParams: InvoiceQueryParams = useMemo(() => ({
    type: 'sale',
    search: searchQuery || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    page,
    limit: 20,
    sortBy: 'createdAt',
    sortDir: 'desc',
  }), [searchQuery, statusFilter, page]);

  // Fetch invoices
  const { data, isLoading, error } = useInvoices(queryParams);

  const invoices = data?.data || [];
  const meta = data?.meta;

  // Handle row click
  const handleRowClick = (invoiceId: string) => {
    router.push(`/${locale}/sales/${invoiceId}`);
  };

  // Handle row hover (prefetch)
  const handleRowHover = (invoiceId: string) => {
    prefetchInvoice(invoiceId);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sales Invoices</h1>
          <p className="text-muted-foreground">
            Manage your sales invoices
          </p>
        </div>
        <Button asChild>
          <Link href={`/${locale}/sales/new`}>
            <Plus className="h-4 w-4 mr-2" />
            New Sale
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Sales</CardDescription>
            <CardTitle className="text-2xl">{meta?.total || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Showing</CardDescription>
            <CardTitle className="text-2xl">
              {invoices.length}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                of {meta?.total || 0}
              </span>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Drafts on Page</CardDescription>
            <CardTitle className="text-2xl text-amber-600">
              {invoices.filter(i => i.status === 'draft').length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Page Total</CardDescription>
            <CardTitle className="text-2xl">
              {invoices
                .reduce((sum, i) => sum + i.total, 0)
                .toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by invoice number..."
            aria-label="Search sales invoices"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value as InvoiceStatus | 'all');
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="final">Finalized</SelectItem>
            <SelectItem value="returned">Returned</SelectItem>
            <SelectItem value="canceled">Canceled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-destructive">
                    Error loading invoices
                  </TableCell>
                </TableRow>
              ) : invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <FileText className="h-8 w-8" />
                      <p>No sales invoices found</p>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/${locale}/sales/new`}>Create your first sale</Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((invoice) => {
                  const statusConfig = STATUS_CONFIG[invoice.status];
                  const StatusIcon = statusConfig.icon;

                  return (
                    <TableRow
                      key={invoice.id}
                      className="cursor-pointer"
                      tabIndex={0}
                      role="link"
                      aria-label={`View sale ${invoice.invoiceNumber}`}
                      onClick={() => handleRowClick(invoice.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleRowClick(invoice.id);
                        }
                      }}
                      onMouseEnter={() => handleRowHover(invoice.id)}
                      onFocus={() => handleRowHover(invoice.id)}
                    >
                      <TableCell className="font-medium">
                        {invoice.invoiceNumber}
                      </TableCell>
                      <TableCell>
                        {invoice.party?.name || (
                          <span className="text-muted-foreground">Walk-in</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(invoice.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {invoice.total.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <Link href={`/${locale}/sales/${invoice.id}`}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                            {invoice.status === 'draft' && (
                              <DropdownMenuItem asChild>
                                <Link href={`/${locale}/sales/${invoice.id}/edit`}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </Link>
                              </DropdownMenuItem>
                            )}
                            {invoice.status === 'final' && (
                              <DropdownMenuItem asChild>
                                <Link href={`/${locale}/sales/${invoice.id}?return=true`}>
                                  <Undo2 className="h-4 w-4 mr-2" />
                                  Create Return
                                </Link>
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {meta && meta.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, meta.total)} of {meta.total} invoices
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.total_pages}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

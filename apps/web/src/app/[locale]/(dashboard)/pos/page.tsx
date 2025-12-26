'use client';

/**
 * POS Locations Management Page
 * Phase 7: User Story 5 - Manage Point of Sale Locations
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {  Plus, Settings, Store, MapPin, CheckCircle2, XCircle } from 'lucide-react';
import { usePOSLocations, useDeletePOSLocation } from '@/hooks/use-pos';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { CreateWarehouseDialog } from '@/components/dialogs/create-warehouse-dialog';

export default function POSLocationsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations('pos');
  const tc = useTranslations('common');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  // Fetch POS locations
  const { data: locationsResponse, isLoading } = usePOSLocations(false);
  const locations = locationsResponse?.data || [];

  // Delete mutation
  const deleteMutation = useDeletePOSLocation({
    onSuccess: () => {
      toast({
        title: tc('success'),
        description: t('locations.messages.deleteSuccess'),
      });
      setDeleteDialogOpen(false);
      setSelectedLocationId(null);
    },
    onError: (error) => {
      toast({
        title: tc('error'),
        description: error.message || t('locations.messages.deleteError'),
        variant: 'destructive',
      });
    },
  });

  const handleDelete = () => {
    if (selectedLocationId) {
      deleteMutation.mutate(selectedLocationId);
    }
  };

  const handleOpenTerminal = (id: string) => {
    router.push(`/pos/${id}/terminal`);
  };

  const handleConfigure = (id: string) => {
    router.push(`/pos/${id}/settings`);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">{t('loadingLocations')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('addPOSLocation')}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('locations.totalLocations')}</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{locations.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('locations.active')}</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {locations.filter((loc) => loc.is_active).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('locations.inactive')}</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {locations.filter((loc) => !loc.is_active).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* POS Locations Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('locations.title')}</CardTitle>
          <CardDescription>
            {t('locations.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {locations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Store className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t('locations.noPOSLocations')}</h3>
              <p className="text-muted-foreground mb-4">
                {t('locations.noPOSLocationsDesc')}
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t('createPOSLocation')}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('locations.fields.name')}</TableHead>
                  <TableHead>{t('locations.fields.warehouse')}</TableHead>
                  <TableHead>{t('locations.fields.status')}</TableHead>
                  <TableHead>{t('locations.fields.created')}</TableHead>
                  <TableHead className="text-right">{t('locations.fields.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((location) => (
                  <TableRow key={location.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center">
                        <Store className="mr-2 h-4 w-4 text-muted-foreground" />
                        {location.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                        {location.warehouse.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={location.is_active ? 'default' : 'secondary'}>
                        {location.is_active ? t('locations.active') : t('locations.inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(location.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenTerminal(location.id)}
                          disabled={!location.is_active}
                        >
                          {t('openTerminal')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleConfigure(location.id)}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedLocationId(location.id);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          {t('delete')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create POS Location Dialog (reusing warehouse dialog temporarily) */}
      {showCreateDialog && (
        <CreateWarehouseDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('locations.deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('locations.deleteDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('locations.deleteDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t('locations.deleteDialog.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

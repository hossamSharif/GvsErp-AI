'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, Pencil, Store, MapPin, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
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
import { POSLocationDialog } from '@/components/dialogs/pos-location-dialog';
import type { POSLocationWithWarehouse } from '@erp/shared';

export default function POSLocationsPage() {
  const router = useRouter();
  const { locale } = useParams();
  const { toast } = useToast();
  const t = useTranslations('pos');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editLocation, setEditLocation] = useState<POSLocationWithWarehouse | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  const { data: locationsResponse, isLoading } = usePOSLocations(false);
  const locations = locationsResponse?.data || [];

  const deleteMutation = useDeletePOSLocation({
    onSuccess: () => {
      toast({ title: t('deleteSuccess') });
      setDeleteDialogOpen(false);
      setSelectedLocationId(null);
    },
    onError: (error) => {
      toast({
        title: t('deleteError'),
        description: error.message,
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
    router.push(`/${locale}/pos/${id}/terminal`);
  };

  const handleEdit = (loc: POSLocationWithWarehouse) => {
    setEditLocation(loc);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditLocation(null);
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">{t('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          {t('addLocation')}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('totalLocations')}</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{locations.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('active')}</CardTitle>
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
            <CardTitle className="text-sm font-medium">{t('inactive')}</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {locations.filter((loc) => !loc.is_active).length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('locationsList')}</CardTitle>
          <CardDescription>{t('locationsListDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {locations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Store className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t('noLocationsTitle')}</h3>
              <p className="text-muted-foreground mb-4">{t('noLocationsDescription')}</p>
              <Button onClick={handleAdd}>
                <Plus className="mr-2 h-4 w-4" />
                {t('createLocation')}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('name')}</TableHead>
                  <TableHead>{t('warehouse')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead>{t('created')}</TableHead>
                  <TableHead className="text-end">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((location) => (
                  <TableRow key={location.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center">
                        <Store className="me-2 h-4 w-4 text-muted-foreground" />
                        {location.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <MapPin className="me-2 h-4 w-4 text-muted-foreground" />
                        {location.warehouse?.name ?? '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={location.is_active ? 'default' : 'secondary'}>
                        {location.is_active ? t('active') : t('inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(location.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-end">
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
                          size="icon"
                          aria-label={t('configure')}
                          onClick={() => handleEdit(location)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t('delete')}
                          onClick={() => {
                            setSelectedLocationId(location.id);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
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

      <POSLocationDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditLocation(null);
        }}
        location={editLocation}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t('delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

'use client';

import { useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  DollarSign,
  CreditCard,
  Banknote,
  X,
  Check,
  Loader2,
  Printer,
} from 'lucide-react';
import { usePOSLocation, useProcessQuickSale } from '@/hooks/use-pos';
import { useItems } from '@/hooks/use-items';
import { useTenantSettings } from '@/hooks/use-settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import type { QuickSaleItem } from '@erp/shared';

interface CartItem extends QuickSaleItem {
  name: string;
  stock: number;
}

export default function POSTerminalPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations('pos.terminal');
  const locale = params.locale as string;
  const posLocationId = params.id as string;

  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('cash');
  const [completedSale, setCompletedSale] = useState<{
    invoiceNumber: string;
    items: CartItem[];
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    total: number;
    paymentMethod: string;
  } | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  const { data: locationResponse, isLoading: locationLoading } = usePOSLocation(posLocationId);
  const { data: itemsResponse } = useItems({ search: searchQuery, limit: 10 });
  const location = locationResponse?.data;
  const { data: settingsResponse } = useTenantSettings();
  const logoUrl = settingsResponse?.data?.logo_url;
  const [logoFailed, setLogoFailed] = useState(false);
  const items = itemsResponse?.data || [];

  const subtotal = cart.reduce((sum, item) => {
    const itemTotal = item.quantity * item.unit_price;
    const itemDiscount = item.discount_percent
      ? itemTotal * (item.discount_percent / 100)
      : 0;
    return sum + (itemTotal - itemDiscount);
  }, 0);

  const discountAmount = subtotal * (discountPercent / 100);
  const taxRate = location?.settings?.tax?.default_rate || 0;
  const taxAmount = (subtotal - discountAmount) * (taxRate / 100);
  const total = subtotal - discountAmount + taxAmount;

  const processSaleMutation = useProcessQuickSale(posLocationId, {
    onSuccess: (response) => {
      toast({
        title: t('saleCompleted'),
        description: t('saleSuccessMessage', { number: response.data.invoice_number }),
      });
      setCompletedSale({
        invoiceNumber: response.data.invoice_number,
        items: [...cart],
        subtotal,
        discountAmount,
        taxAmount,
        total,
        paymentMethod: selectedPaymentMethod,
      });
      setCart([]);
      setDiscountPercent(0);
    },
    onError: (error) => {
      toast({
        title: t('saleFailed'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const addToCart = (itemId: string, itemName: string, price: number, stock: number) => {
    const existingItem = cart.find((item) => item.item_id === itemId);

    if (existingItem) {
      updateQuantity(itemId, existingItem.quantity + 1);
    } else {
      setCart([
        ...cart,
        {
          item_id: itemId,
          name: itemName,
          quantity: 1,
          unit_price: price,
          stock,
          discount_percent: 0,
        },
      ]);
    }
    setSearchQuery('');
  };

  const updateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId);
      return;
    }

    setCart(
      cart.map((item) =>
        item.item_id === itemId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const removeFromCart = (itemId: string) => {
    setCart(cart.filter((item) => item.item_id !== itemId));
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast({
        title: t('cartEmptyError'),
        description: t('cartEmptyMessage'),
        variant: 'destructive',
      });
      return;
    }

    const saleData = {
      items: cart.map(({ item_id, quantity, unit_price, discount_percent }) => ({
        item_id,
        quantity,
        unit_price,
        discount_percent,
      })),
      discount_percent: discountPercent,
      payment_method: selectedPaymentMethod,
    };

    processSaleMutation.mutate(saleData);
  };

  const clearCart = () => {
    setCart([]);
    setDiscountPercent(0);
  };

  if (locationLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!location) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h2 className="text-2xl font-bold mb-4">{t('locationNotFound')}</h2>
        <Button onClick={() => router.push(`/${locale}/pos`)}>{t('backToLocations')}</Button>
      </div>
    );
  }

  const paymentLabel = (m: string) =>
    ({ cash: t('cash'), card: t('card'), bank_transfer: t('transfer') }[m] || m);

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="border-b bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{location.name}</h1>
            <p className="text-sm text-muted-foreground">{location.warehouse?.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{paymentLabel(selectedPaymentMethod)}</Badge>
            <Button variant="outline" size="sm" onClick={() => router.push(`/${locale}/pos`)}>
              <X className="me-2 h-4 w-4" />
              {t('closeTerminal')}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 overflow-auto md:overflow-hidden">
        <div className="flex flex-col space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('itemSearch')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                placeholder={t('searchPlaceholder')}
                aria-label={t('searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            </CardContent>
          </Card>

          <Card className="flex-1 overflow-auto">
            <CardContent className="p-4 space-y-2">
              {!searchQuery && (
                <p className="text-muted-foreground text-center py-8">
                  {t('searchHint')}
                </p>
              )}
              {searchQuery && items.length === 0 && (
                <p className="text-muted-foreground text-center py-8">{t('noItemsFound')}</p>
              )}
              {searchQuery &&
                items.map((item) => (
                  <button
                    key={item.id}
                    className="w-full flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer text-start focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    onClick={() =>
                      addToCart(item.id, item.name, item.prices?.[0]?.price || 0, 0)
                    }
                  >
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">{item.sku}</p>
                    </div>
                    <div className="text-end">
                      <p className="font-bold">${(item.prices?.[0]?.price || 0).toFixed(2)}</p>
                    </div>
                  </button>
                ))}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col space-y-4">
          <Card className="flex-1 overflow-auto">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                <ShoppingCart className="inline me-2 h-5 w-5" />
                {t('cart')} ({t('cartItems', { count: cart.length })})
              </CardTitle>
              {cart.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm">
                      {t('clearAll')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('clearCartTitle')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('clearCartDescription', { count: cart.length })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('close')}</AlertDialogCancel>
                      <AlertDialogAction onClick={clearCart}>{t('clearCart')}</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {cart.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">{t('cartEmpty')}</p>
              ) : (
                cart.map((item) => (
                  <div key={item.item_id} className="flex items-center gap-2 p-2 border rounded">
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        ${item.unit_price.toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={t('decrease', { name: item.name })}
                        onClick={() => updateQuantity(item.item_id, item.quantity - 1)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-12 text-center font-medium">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={t('increase', { name: item.name })}
                        onClick={() => updateQuantity(item.item_id, item.quantity + 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={t('removeItem', { name: item.name })}
                        onClick={() => removeFromCart(item.item_id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="text-end min-w-[80px]">
                      <p className="font-bold">
                        ${(item.quantity * item.unit_price).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>{t('subtotal')}:</span>
                  <span className="font-medium">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>{t('discount')}:</span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      aria-label={t('discount')}
                      value={discountPercent}
                      onChange={(e) =>
                        setDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value))))
                      }
                      className="w-20 h-8"
                      min="0"
                      max="100"
                    />
                    <span>%</span>
                    <span className="font-medium text-red-600">
                      -${discountAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span>
                    {t('tax')} ({taxRate}%):
                  </span>
                  <span className="font-medium">${taxAmount.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>{t('total')}:</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex gap-2">
                {[
                  { value: 'cash', label: t('cash'), icon: Banknote },
                  { value: 'card', label: t('card'), icon: CreditCard },
                  { value: 'bank_transfer', label: t('transfer'), icon: DollarSign },
                ].map(({ value, label, icon: Icon }) => (
                  <Button
                    key={value}
                    variant={selectedPaymentMethod === value ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setSelectedPaymentMethod(value)}
                  >
                    <Icon className="me-2 h-4 w-4" />
                    {label}
                  </Button>
                ))}
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    className="w-full h-12 text-lg"
                    size="lg"
                    disabled={cart.length === 0 || processSaleMutation.isPending}
                  >
                    {processSaleMutation.isPending ? (
                      <>
                        <Loader2 className="me-2 h-5 w-5 animate-spin" />
                        {t('processing')}
                      </>
                    ) : (
                      <>
                        <Check className="me-2 h-5 w-5" />
                        {t('completeSale')}
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('confirmSaleTitle')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {cart.length === 1
                        ? t('confirmSaleDescription', {
                            count: cart.length,
                            total: total.toFixed(2),
                            method: paymentLabel(selectedPaymentMethod),
                          })
                        : t('confirmSaleDescriptionPlural', {
                            count: cart.length,
                            total: total.toFixed(2),
                            method: paymentLabel(selectedPaymentMethod),
                          })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('close')}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCheckout}>
                      {t('completeSale')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!completedSale} onOpenChange={(open) => !open && setCompletedSale(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('saleComplete')}</DialogTitle>
            <DialogDescription>
              {completedSale && t('saleInvoiceCreated', { number: completedSale.invoiceNumber })}
            </DialogDescription>
          </DialogHeader>
          {completedSale && (
            <div ref={receiptRef} className="space-y-3 text-sm print:text-xs">
              <div className="text-center border-b pb-2">
                {logoUrl && !logoFailed && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt=""
                    className="receipt-logo mx-auto mb-1 max-h-16 max-w-[160px] object-contain"
                    onError={() => setLogoFailed(true)}
                  />
                )}
                <p className="font-bold text-lg">{location?.name}</p>
                <p className="text-muted-foreground print:text-black">
                  {completedSale.invoiceNumber}
                </p>
                <p className="text-muted-foreground print:text-black">
                  {new Date().toLocaleString()}
                </p>
              </div>
              <div className="space-y-1">
                {completedSale.items.map((item) => (
                  <div key={item.item_id} className="flex justify-between">
                    <span>
                      {item.name} x{item.quantity}
                    </span>
                    <span>${(item.quantity * item.unit_price).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>{t('subtotal')}</span>
                  <span>${completedSale.subtotal.toFixed(2)}</span>
                </div>
                {completedSale.discountAmount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>{t('discount')}</span>
                    <span>-${completedSale.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                {completedSale.taxAmount > 0 && (
                  <div className="flex justify-between">
                    <span>{t('tax')}</span>
                    <span>${completedSale.taxAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base">
                  <span>{t('total')}</span>
                  <span>${completedSale.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground print:text-black">
                  <span>{t('payment')}</span>
                  <span>{paymentLabel(completedSale.paymentMethod)}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="print:hidden">
            <Button variant="outline" onClick={() => setCompletedSale(null)}>
              {t('close')}
            </Button>
            <Button
              onClick={async () => {
                const printContent = receiptRef.current;
                if (!printContent) return;
                const printWindow = window.open('', '_blank', 'width=400,height=600');
                if (!printWindow) return;
                printWindow.document.write(`<html><head><title>Receipt - ${completedSale?.invoiceNumber}</title>
                  <style>
                    body{font-family:monospace;padding:20px;max-width:300px;margin:0 auto;font-size:14px}
                    .flex{display:flex;justify-content:space-between}
                    .justify-between{justify-content:space-between}
                    .font-bold{font-weight:bold}
                    .font-medium{font-weight:500}
                    .text-lg{font-size:18px}
                    .text-sm{font-size:12px}
                    .text-base{font-size:16px}
                    .text-center{text-align:center}
                    .text-red-600{color:#dc2626}
                    .text-muted-foreground{color:#6b7280}
                    .border-b{border-bottom:1px dashed #000}
                    .pb-2{padding-bottom:8px}
                    .space-y-1>*+*{margin-top:4px}
                    .space-y-3>*+*{margin-top:12px}
                    hr{border:none;border-top:1px dashed #000;margin:8px 0}
                    .receipt-logo{display:block;max-width:160px;max-height:80px;margin:0 auto 6px;filter:grayscale(1)}
                  </style></head><body>`);
                printWindow.document.write(printContent.innerHTML);
                printWindow.document.write('</body></html>');
                printWindow.document.close();
                // Let the logo load first, or it prints blank; give up after 2s.
                const images = Array.from(printWindow.document.images);
                await Promise.race([
                  Promise.all(images.map((img) => img.decode().catch(() => img.remove()))),
                  new Promise((resolve) => setTimeout(resolve, 2000)),
                ]);
                printWindow.print();
              }}
            >
              <Printer className="me-2 h-4 w-4" />
              {t('printReceipt')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

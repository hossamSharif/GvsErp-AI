'use client';

/**
 * POS Terminal Interface
 * Phase 7: User Story 5 - Manage Point of Sale Locations
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  DollarSign,
  Users,
  Tag,
  Receipt,
  X,
  Check,
  Loader2,
} from 'lucide-react';
import { usePOSLocation, useProcessQuickSale } from '@/hooks/use-pos';
import { useItems } from '@/hooks/use-items';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
  const posLocationId = params.id as string;

  // State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('cash');

  // Queries
  const { data: locationResponse, isLoading: locationLoading } = usePOSLocation(posLocationId);
  const { data: itemsResponse } = useItems({ search: searchQuery, limit: 10 });
  const location = locationResponse?.data;
  const items = itemsResponse?.data || [];

  // Process sale mutation
  const processSaleMutation = useProcessQuickSale(posLocationId, {
    onSuccess: (response) => {
      toast({
        title: 'Sale Completed',
        description: `Invoice ${response.data.invoice_number} created successfully`,
      });
      setCart([]);
      setDiscountPercent(0);
      // TODO: Print receipt or show receipt dialog
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to process sale',
        variant: 'destructive',
      });
    },
  });

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => {
    const itemTotal = item.quantity * item.unit_price;
    const itemDiscount = item.discount_percent
      ? itemTotal * (item.discount_percent / 100)
      : 0;
    return sum + (itemTotal - itemDiscount);
  }, 0);

  const discountAmount = subtotal * (discountPercent / 100);
  const taxRate = location?.settings.tax?.default_rate || 0;
  const taxAmount = (subtotal - discountAmount) * (taxRate / 100);
  const total = subtotal - discountAmount + taxAmount;

  // Add item to cart
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

  // Update quantity
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

  // Remove from cart
  const removeFromCart = (itemId: string) => {
    setCart(cart.filter((item) => item.item_id !== itemId));
  };

  // Process checkout
  const handleCheckout = () => {
    if (cart.length === 0) {
      toast({
        title: 'Cart Empty',
        description: 'Please add items to the cart before checkout',
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

  // Clear cart
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
        <h2 className="text-2xl font-bold mb-4">POS Location Not Found</h2>
        <Button onClick={() => router.push('/pos')}>Back to POS Locations</Button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{location.name}</h1>
            <p className="text-sm text-muted-foreground">{location.warehouse.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{selectedPaymentMethod.toUpperCase()}</Badge>
            <Button variant="outline" size="sm" onClick={() => router.push('/pos')}>
              <X className="h-4 w-4 mr-2" />
              Close Terminal
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-2 gap-4 p-4 overflow-hidden">
        {/* Left: Item Search & Selection */}
        <div className="flex flex-col space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Item Search</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="Search items by name, SKU, or barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            </CardContent>
          </Card>

          {/* Item Results */}
          <Card className="flex-1 overflow-auto">
            <CardContent className="p-4 space-y-2">
              {searchQuery && items.length === 0 && (
                <p className="text-muted-foreground text-center py-8">No items found</p>
              )}
              {searchQuery &&
                items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer"
                    onClick={() =>
                      addToCart(item.id, item.name, item.prices?.[0]?.price || 0, 100)
                    }
                  >
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">{item.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">${item.prices?.[0]?.price.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">Stock: 100</p>
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>
        </div>

        {/* Right: Cart & Checkout */}
        <div className="flex flex-col space-y-4">
          {/* Cart Items */}
          <Card className="flex-1 overflow-auto">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                <ShoppingCart className="inline mr-2 h-5 w-5" />
                Cart ({cart.length} items)
              </CardTitle>
              {cart.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearCart}>
                  Clear All
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {cart.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Cart is empty</p>
              ) : (
                cart.map((item) => (
                  <div key={item.item_id} className="flex items-center gap-2 p-2 border rounded">
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        ${item.unit_price.toFixed(2)} each
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQuantity(item.item_id, item.quantity - 1)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-12 text-center font-medium">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQuantity(item.item_id, item.quantity + 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeFromCart(item.item_id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="text-right min-w-[80px]">
                      <p className="font-bold">
                        ${(item.quantity * item.unit_price).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Totals & Checkout */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-medium">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Discount:</span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(Number(e.target.value))}
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
                  <span>Tax ({taxRate}%):</span>
                  <span className="font-medium">${taxAmount.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>

              <Button
                className="w-full h-12 text-lg"
                size="lg"
                onClick={handleCheckout}
                disabled={cart.length === 0 || processSaleMutation.isPending}
              >
                {processSaleMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-5 w-5" />
                    Complete Sale
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

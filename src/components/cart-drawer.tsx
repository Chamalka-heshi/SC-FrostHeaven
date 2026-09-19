import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ShoppingCart, ShoppingBag, Minus, Plus, Trash2, Store, Truck, Clock } from "lucide-react";
import { toast } from "sonner";
import { useCartStore } from "@/stores/cart";
import { useAuth } from "@/lib/auth-context";
import { PayHereButton } from "@/components/payhere-button";
import { OrderReceiptModal, type ReceiptOrder } from "@/components/order-receipt-modal";
import { DELIVERY_ZONES, PICKUP_INFO } from "@/lib/fulfillment";

export const CartDrawer = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [receiptModalOrder, setReceiptModalOrder] = useState<ReceiptOrder | null>(null);
  const { user, profile } = useAuth();
  const {
    items,
    updateQuantity,
    removeItem,
    clearCart,
    getWhatsAppOrderUrl,
    fulfillmentMethod,
    deliveryZoneVariantId,
    setFulfillment,
    getDeliveryFee,
  } = useCartStore();

  const deliveryFee = getDeliveryFee();
  const selectedZone = DELIVERY_ZONES.find((z) => z.variantId === deliveryZoneVariantId) ?? null;
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce(
    (sum, item) => sum + parseFloat(item.price.amount) * item.quantity,
    0,
  );
  const grandTotal = totalPrice + deliveryFee;

  const handleWhatsAppCheckout = () => {
    const waUrl = getWhatsAppOrderUrl();
    if (waUrl) {
      window.open(waUrl, "_blank");
      setIsOpen(false);
    }
  };

  const handlePayHereCartSuccess = (paymentId: string) => {
    const currentItems = [...items];
    const receiptData: ReceiptOrder = {
      id: `CART-${Date.now().toString().slice(-6)}`,
      customer_name:
        profile?.full_name || (user?.user_metadata?.["full_name"] as string | undefined) || "Valued Customer",
      customer_email: user?.email || "customer@scfrostheaven.com",
      customer_phone: profile?.phone || "+94702411623",
      customer_address:
        profile?.address ||
        (fulfillmentMethod === "delivery" && selectedZone ? selectedZone.area : "Mirissa Store Pickup"),
      event_type: "Bakery Menu Order",
      event_date: new Date().toISOString().slice(0, 10),
      items: currentItems.map((i) => ({
        title: i.product.node.title,
        quantity: i.quantity,
        price: parseFloat(i.price.amount),
      })),
      fulfillment_method: fulfillmentMethod,
      delivery_fee_lkr: deliveryFee,
      status: "paid",
      quoted_price_lkr: grandTotal,
      amount_paid_lkr: grandTotal,
      payment_status: "fully_paid",
      payment_method: "online_payment",
      payment_reference: `PayHere: ${paymentId}`,
      created_at: new Date().toISOString(),
    };

    clearCart();
    setIsOpen(false);
    setReceiptModalOrder(receiptData);
    toast.success(`Payment completed successfully via PayHere! Invoice #INV-${receiptData.id.slice(0, 8)} ready.`);
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="relative rounded-full border-border/60 cursor-pointer">
            <ShoppingCart className="h-5 w-5" />
            {totalItems > 0 && (
              <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs bg-primary text-primary-foreground">
                {totalItems}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full sm:max-w-lg flex flex-col h-full bg-background">
          <SheetHeader className="flex-shrink-0">
            <SheetTitle>Your Cart</SheetTitle>
            <SheetDescription>
              {totalItems === 0
                ? "Your cart is empty"
                : `${totalItems} item${totalItems !== 1 ? "s" : ""} in your cart`}
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col flex-1 pt-6 min-h-0">
            {items.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Your cart is empty</p>
                  <Button
                    onClick={() => setIsOpen(false)}
                    variant="outline"
                    className="mt-4 rounded-full"
                    asChild
                  >
                    <a href="/menu">Browse our menu</a>
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto pr-2 min-h-0">
                  <div className="space-y-4">
                    {items.map((item) => (
                      <div
                        key={item.variantId}
                        className="flex gap-4 p-3 rounded-xl bg-secondary/30"
                      >
                        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                          {item.product.node.images?.edges?.[0]?.node && (
                            <img
                              src={item.product.node.images.edges[0].node.url}
                              alt={item.product.node.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate text-foreground">
                            {item.product.node.title}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {item.selectedOptions.map((option) => option.value).join(" • ")}
                          </p>
                          <p className="font-semibold text-primary">
                            {item.price.currencyCode} {parseFloat(item.price.amount).toFixed(2)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive cursor-pointer"
                            onClick={() => removeItem(item.variantId)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 rounded-full cursor-pointer"
                              onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <span className="w-8 text-center text-sm">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 rounded-full cursor-pointer"
                              onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex-shrink-0 space-y-4 pt-4 border-t border-border/50 bg-background">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-foreground">Fulfillment Method</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFulfillment("pickup")}
                        className={`rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                          fulfillmentMethod === "pickup"
                            ? "border-primary bg-primary/10"
                            : "border-border/60 hover:bg-secondary/40"
                        }`}
                      >
                        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <Store className="h-4 w-4" /> Pickup
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">Free</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFulfillment("delivery", deliveryZoneVariantId)}
                        className={`rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                          fulfillmentMethod === "delivery"
                            ? "border-primary bg-primary/10"
                            : "border-border/60 hover:bg-secondary/40"
                        }`}
                      >
                        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <Truck className="h-4 w-4" /> Delivery
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">From LKR 300</span>
                      </button>
                    </div>

                    {fulfillmentMethod === "pickup" ? (
                      <div className="rounded-xl bg-secondary/30 p-3 text-xs text-muted-foreground">
                        <p className="flex items-center gap-1.5 font-medium text-foreground">
                          <Clock className="h-3.5 w-3.5" /> {PICKUP_INFO.eta}
                        </p>
                        <p className="mt-1">{PICKUP_INFO.address}</p>
                        <p>{PICKUP_INFO.hours}</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {DELIVERY_ZONES.map((zone) => {
                          const active = zone.variantId === deliveryZoneVariantId;
                          return (
                            <button
                              key={zone.id}
                              type="button"
                              onClick={() => setFulfillment("delivery", zone.variantId)}
                              className={`w-full rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                                active ? "border-primary bg-primary/10" : "border-border/60 hover:bg-secondary/40"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium text-foreground">{zone.label}</span>
                                <span className="text-sm font-semibold text-primary">
                                  LKR {zone.fee.toFixed(2)}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">{zone.area}</p>
                              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" /> {zone.eta}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span>
                        {items[0]?.price.currencyCode || "LKR"} {totalPrice.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>
                        {fulfillmentMethod === "delivery"
                          ? `Delivery${selectedZone ? ` — ${selectedZone.label}` : ""}`
                          : "Pickup"}
                      </span>
                      <span>
                        {deliveryFee > 0
                          ? `${items[0]?.price.currencyCode || "LKR"} ${deliveryFee.toFixed(2)}`
                          : "Free"}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-foreground">Total</span>
                    <span className="text-xl font-bold text-primary">
                      {items[0]?.price.currencyCode || "LKR"} {grandTotal.toFixed(2)}
                    </span>
                  </div>

                  {/* Primary Payment: PayHere Online Gateway */}
                  <div className="space-y-2 pt-1">
                    <PayHereButton
                      amountLkr={grandTotal}
                      orderId={`cart_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`}
                      itemDescription={items
                        .map((i) => `${i.product.node.title} (x${i.quantity})`)
                        .join(", ")}
                      customerName={
                        profile?.full_name || (user?.user_metadata?.["full_name"] as string | undefined) || "Valued Customer"
                      }
                      customerEmail={user?.email || "customer@scfrostheaven.com"}
                      customerPhone={profile?.phone || "+94702411623"}
                      customerAddress={
                        profile?.address ||
                        (fulfillmentMethod === "delivery" && selectedZone
                          ? selectedZone.area
                          : "Mirissa")
                      }
                      customerCity={profile?.city || "Mirissa"}
                      onSuccess={handlePayHereCartSuccess}
                      buttonText={`Pay LKR ${grandTotal.toFixed(2)} via PayHere`}
                    />
                  </div>

                  {/* Secondary Option: WhatsApp Order */}
                  <div className="relative flex items-center justify-center my-1">
                    <div className="border-t border-border/50 w-full" />
                    <span className="bg-background px-2 text-[10px] text-muted-foreground uppercase font-medium">
                      or
                    </span>
                    <div className="border-t border-border/50 w-full" />
                  </div>

                  <Button
                    onClick={handleWhatsAppCheckout}
                    variant="outline"
                    className="w-full rounded-full cursor-pointer text-xs h-10 gap-2"
                    disabled={items.length === 0}
                  >
                    <ShoppingBag className="w-4 h-4" />
                    Order via WhatsApp Hotline
                  </Button>
                  <p className="text-[11px] text-center text-muted-foreground">
                    Official Bakery Hotline: +94 70 241 1623
                  </p>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Immediate Post-Payment Invoice Modal for Cart Orders */}
      <OrderReceiptModal
        order={receiptModalOrder}
        isOpen={Boolean(receiptModalOrder)}
        onClose={() => setReceiptModalOrder(null)}
      />
    </>
  );
};


import { useState, useEffect } from "react";
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
import { ShoppingCart, Minus, Plus, Trash2, ExternalLink, Loader2, Store, Truck, Clock } from "lucide-react";
import { useCartStore } from "@/stores/cart";
import { DELIVERY_ZONES, PICKUP_INFO } from "@/lib/fulfillment";

export const CartDrawer = () => {
  const [isOpen, setIsOpen] = useState(false);
  const {
    items,
    isLoading,
    isSyncing,
    updateQuantity,
    removeItem,
    getCheckoutUrl,
    syncCart,
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

  useEffect(() => {
    if (isOpen) syncCart();
  }, [isOpen, syncCart]);

  const handleCheckout = () => {
    const checkoutUrl = getCheckoutUrl();
    if (checkoutUrl) {
      window.open(checkoutUrl, "_blank");
      setIsOpen(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="relative rounded-full border-border/60">
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
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => removeItem(item.variantId)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 rounded-full"
                            onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                          <span className="w-8 text-center text-sm">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 rounded-full"
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
                  <p className="text-sm font-semibold text-foreground">How would you like to receive it?</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFulfillment("pickup")}
                      disabled={isLoading}
                      className={`rounded-xl border p-3 text-left transition-colors ${
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
                      disabled={isLoading}
                      className={`rounded-xl border p-3 text-left transition-colors ${
                        fulfillmentMethod === "delivery"
                          ? "border-primary bg-primary/10"
                          : "border-border/60 hover:bg-secondary/40"
                      }`}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Truck className="h-4 w-4" /> Delivery
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">From LKR 500</span>
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
                            disabled={isLoading}
                            className={`w-full rounded-xl border p-3 text-left transition-colors ${
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
                    {items[0]?.price.currencyCode || "LKR"} {(totalPrice + deliveryFee).toFixed(2)}
                  </span>
                </div>
                <Button
                  onClick={handleCheckout}
                  className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                  size="lg"
                  disabled={items.length === 0 || isLoading || isSyncing}
                >
                  {isLoading || isSyncing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Checkout with Shopify
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

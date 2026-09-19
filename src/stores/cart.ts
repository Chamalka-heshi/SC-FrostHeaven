import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ShopifyProduct } from "@/lib/shopify";
import {
  DELIVERY_ZONES,
  PICKUP_INFO,
  getZoneByVariantId,
  type FulfillmentMethod,
} from "@/lib/fulfillment";

export interface CartItem {
  lineId: string | null;
  product: ShopifyProduct;
  variantId: string;
  variantTitle: string;
  price: { amount: string; currencyCode: string };
  quantity: number;
  selectedOptions: Array<{ name: string; value: string }>;
}

interface CartStore {
  items: CartItem[];
  fulfillmentMethod: FulfillmentMethod;
  deliveryZoneVariantId: string | null;
  setFulfillment: (method: FulfillmentMethod, zoneVariantId?: string | null) => void;
  getDeliveryFee: () => number;
  addItem: (item: Omit<CartItem, "lineId">) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  clearCart: () => void;
  getWhatsAppOrderUrl: () => string | null;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      fulfillmentMethod: "pickup",
      deliveryZoneVariantId: null,

      getDeliveryFee: () => {
        const { fulfillmentMethod, deliveryZoneVariantId } = get();
        if (fulfillmentMethod !== "delivery") return PICKUP_INFO.fee;
        return getZoneByVariantId(deliveryZoneVariantId)?.fee ?? 0;
      },

      setFulfillment: (method, zoneVariantId = null) => {
        const zone = method === "delivery" ? getZoneByVariantId(zoneVariantId) ?? DELIVERY_ZONES[0] : null;
        set({
          fulfillmentMethod: method,
          deliveryZoneVariantId: zone?.variantId ?? null,
        });
      },

      addItem: (item) => {
        const { items } = get();
        const existingItem = items.find((i) => i.variantId === item.variantId);
        const localLineId = `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        if (existingItem) {
          const newQuantity = existingItem.quantity + item.quantity;
          set({
            items: items.map((i) =>
              i.variantId === item.variantId ? { ...i, quantity: newQuantity } : i,
            ),
          });
        } else {
          set({
            items: [...items, { ...item, lineId: localLineId }],
          });
        }
      },

      updateQuantity: (variantId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(variantId);
          return;
        }

        const { items } = get();
        set({
          items: items.map((i) => (i.variantId === variantId ? { ...i, quantity } : i)),
        });
      },

      removeItem: (variantId) => {
        const { items } = get();
        set({
          items: items.filter((i) => i.variantId !== variantId),
        });
      },

      clearCart: () =>
        set({
          items: [],
          deliveryZoneVariantId: null,
          fulfillmentMethod: "pickup",
        }),

      getWhatsAppOrderUrl: () => {
        const { items, fulfillmentMethod, deliveryZoneVariantId, getDeliveryFee } = get();
        if (items.length === 0) return null;

        const zone = fulfillmentMethod === "delivery" ? getZoneByVariantId(deliveryZoneVariantId) : null;
        const deliveryFee = getDeliveryFee();
        const totalPrice = items.reduce(
          (sum, item) => sum + parseFloat(item.price.amount) * item.quantity,
          0,
        );
        const grandTotal = (totalPrice + deliveryFee).toFixed(2);

        let msg = `🍰 *Order from SC Frost Heaven*\n\n`;
        items.forEach((it, idx) => {
          msg += `${idx + 1}. *${it.product.node.title}* x ${it.quantity} — LKR ${(parseFloat(it.price.amount) * it.quantity).toFixed(2)}\n`;
        });
        msg += `\n*Fulfillment:* ${fulfillmentMethod === "delivery" ? `Delivery (${zone?.label || "Standard"} - ${zone?.area || ""})` : "Store Pickup (Mirissa)"}`;
        if (deliveryFee > 0) {
          msg += `\n*Delivery Fee:* LKR ${deliveryFee.toFixed(2)}`;
        }
        msg += `\n*Total Amount:* LKR ${grandTotal}`;
        msg += `\n\nPlease confirm availability for this order. Thank you!`;

        return `https://wa.me/94702411623?text=${encodeURIComponent(msg)}`;
      },
    }),
    {
      name: "frostheaven-local-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items,
        fulfillmentMethod: state.fulfillmentMethod,
        deliveryZoneVariantId: state.deliveryZoneVariantId,
      }),
    },
  ),
);

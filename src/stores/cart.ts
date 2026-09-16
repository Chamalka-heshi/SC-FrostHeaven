import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  createShopifyCart,
  addLineToShopifyCart,
  updateShopifyCartLine,
  removeLineFromShopifyCart,
  getShopifyCart,
  addSimpleLineToCart,
  updateShopifyCartAttributes,
  type ShopifyProduct,
} from "@/lib/shopify";
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
  cartId: string | null;
  checkoutUrl: string | null;
  isLoading: boolean;
  isSyncing: boolean;
  fulfillmentMethod: FulfillmentMethod;
  deliveryZoneVariantId: string | null;
  deliveryLineId: string | null;
  setFulfillment: (method: FulfillmentMethod, zoneVariantId?: string | null) => Promise<void>;
  getDeliveryFee: () => number;
  addItem: (item: Omit<CartItem, "lineId">) => Promise<void>;
  updateQuantity: (variantId: string, quantity: number) => Promise<void>;
  removeItem: (variantId: string) => Promise<void>;
  clearCart: () => void;
  syncCart: () => Promise<void>;
  getCheckoutUrl: () => string | null;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      cartId: null,
      checkoutUrl: null,
      isLoading: false,
      isSyncing: false,
      fulfillmentMethod: "pickup",
      deliveryZoneVariantId: null,
      deliveryLineId: null,

      getDeliveryFee: () => {
        const { fulfillmentMethod, deliveryZoneVariantId } = get();
        if (fulfillmentMethod !== "delivery") return PICKUP_INFO.fee;
        return getZoneByVariantId(deliveryZoneVariantId)?.fee ?? 0;
      },

      setFulfillment: async (method, zoneVariantId = null) => {
        const { cartId, deliveryLineId, clearCart } = get();
        const zone = method === "delivery" ? getZoneByVariantId(zoneVariantId) ?? DELIVERY_ZONES[0] : null;

        set({
          fulfillmentMethod: method,
          deliveryZoneVariantId: zone?.variantId ?? null,
          isLoading: Boolean(cartId),
        });

        if (!cartId) return;

        try {
          // Remove any existing delivery fee line first
          if (deliveryLineId) {
            const removed = await removeLineFromShopifyCart(cartId, deliveryLineId);
            if (removed.cartNotFound) {
              clearCart();
              return;
            }
            set({ deliveryLineId: null });
          }

          if (zone) {
            const added = await addSimpleLineToCart(cartId, zone.variantId, 1);
            if (added.cartNotFound) {
              clearCart();
              return;
            }
            if (added.success) set({ deliveryLineId: added.lineId ?? null });
          }

          await updateShopifyCartAttributes(cartId, [
            { key: "Fulfillment", value: zone ? "Delivery" : "Pickup" },
            {
              key: zone ? "Delivery zone" : "Pickup location",
              value: zone ? `${zone.label} (${zone.area})` : PICKUP_INFO.address,
            },
            { key: "Estimated time", value: zone ? zone.eta : PICKUP_INFO.eta },
          ]);
        } catch (error) {
          console.error("Failed to update fulfillment option:", error);
        } finally {
          set({ isLoading: false });
        }
      },

      addItem: async (item) => {
        const { items, cartId, clearCart } = get();
        const existingItem = items.find((i) => i.variantId === item.variantId);
        const isShopifyItem = item.variantId.startsWith("gid://shopify/");

        set({ isLoading: true });
        try {
          if (!isShopifyItem) {
            // Local / Supabase Bakery Item
            if (existingItem) {
              const newQuantity = existingItem.quantity + item.quantity;
              set({
                items: items.map((i) =>
                  i.variantId === item.variantId ? { ...i, quantity: newQuantity } : i,
                ),
              });
            } else {
              const localLineId = `line_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
              set({
                items: [...items, { ...item, lineId: localLineId }],
              });
            }
            return;
          }

          // Shopify Item
          if (!cartId) {
            const result = await createShopifyCart({ ...item, lineId: null });
            if (result) {
              set({
                cartId: result.cartId,
                checkoutUrl: result.checkoutUrl,
                items: [{ ...item, lineId: result.lineId }],
                deliveryLineId: null,
              });
              const { fulfillmentMethod, deliveryZoneVariantId } = get();
              if (fulfillmentMethod === "delivery") {
                await get().setFulfillment("delivery", deliveryZoneVariantId);
              }
            }
          } else if (existingItem) {
            const newQuantity = existingItem.quantity + item.quantity;
            if (!existingItem.lineId) {
              console.error("Cannot update quantity for item without lineId:", existingItem);
              return;
            }
            const result = await updateShopifyCartLine(cartId, existingItem.lineId, newQuantity);
            if (result.success) {
              const currentItems = get().items;
              set({
                items: currentItems.map((i) =>
                  i.variantId === item.variantId ? { ...i, quantity: newQuantity } : i,
                ),
              });
            } else if (result.cartNotFound) {
              clearCart();
            }
          } else {
            const result = await addLineToShopifyCart(cartId, { ...item, lineId: null });
            if (result.success) {
              const currentItems = get().items;
              set({
                items: [...currentItems, { ...item, lineId: result.lineId ?? null }],
              });
            } else if (result.cartNotFound) {
              clearCart();
            }
          }
        } catch (error) {
          console.error("Failed to add item:", error);
        } finally {
          set({ isLoading: false });
        }
      },

      updateQuantity: async (variantId, quantity) => {
        if (quantity <= 0) {
          await get().removeItem(variantId);
          return;
        }

        const { items, cartId, clearCart } = get();
        const item = items.find((i) => i.variantId === variantId);
        if (!item) return;

        const isShopifyItem = variantId.startsWith("gid://shopify/");
        if (!isShopifyItem) {
          set({
            items: items.map((i) => (i.variantId === variantId ? { ...i, quantity } : i)),
          });
          return;
        }

        if (!item.lineId || !cartId) return;

        set({ isLoading: true });
        try {
          const result = await updateShopifyCartLine(cartId, item.lineId, quantity);
          if (result.success) {
            const currentItems = get().items;
            set({
              items: currentItems.map((i) => (i.variantId === variantId ? { ...i, quantity } : i)),
            });
          } else if (result.cartNotFound) {
            clearCart();
          }
        } catch (error) {
          console.error("Failed to update quantity:", error);
        } finally {
          set({ isLoading: false });
        }
      },

      removeItem: async (variantId) => {
        const { items, cartId, clearCart } = get();
        const item = items.find((i) => i.variantId === variantId);
        if (!item) return;

        const isShopifyItem = variantId.startsWith("gid://shopify/");
        if (!isShopifyItem) {
          const newItems = items.filter((i) => i.variantId !== variantId);
          if (newItems.length === 0) {
            clearCart();
          } else {
            set({ items: newItems });
          }
          return;
        }

        if (!item.lineId || !cartId) return;

        set({ isLoading: true });
        try {
          const result = await removeLineFromShopifyCart(cartId, item.lineId);
          if (result.success) {
            const currentItems = get().items;
            const newItems = currentItems.filter((i) => i.variantId !== variantId);
            if (newItems.length === 0) {
              clearCart();
            } else {
              set({ items: newItems });
            }
          } else if (result.cartNotFound) {
            clearCart();
          }
        } catch (error) {
          console.error("Failed to remove item:", error);
        } finally {
          set({ isLoading: false });
        }
      },

      clearCart: () =>
        set({
          items: [],
          cartId: null,
          checkoutUrl: null,
          deliveryLineId: null,
          deliveryZoneVariantId: null,
          fulfillmentMethod: "pickup",
        }),
      getCheckoutUrl: () => {
        const { items, checkoutUrl, fulfillmentMethod, deliveryZoneVariantId, getDeliveryFee } = get();
        if (items.length === 0) return null;

        const hasOnlyShopifyItems = items.every((i) => i.variantId.startsWith("gid://shopify/"));
        if (hasOnlyShopifyItems && checkoutUrl) {
          return checkoutUrl;
        }

        // WhatsApp Checkout Direct Link for SC Frost Heaven (+94 70 241 1623)
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
        msg += `\n*Fulfillment:* ${fulfillmentMethod === "delivery" ? `Delivery (${zone?.label || "Standard"} - ${zone?.area || ""})` : "Store Pickup"}`;
        if (deliveryFee > 0) {
          msg += `\n*Delivery Fee:* LKR ${deliveryFee.toFixed(2)}`;
        }
        msg += `\n*Total Amount:* LKR ${grandTotal}`;
        msg += `\n\nPlease confirm availability and payment options for this order. Thank you!`;

        return `https://wa.me/94702411623?text=${encodeURIComponent(msg)}`;
      },

      syncCart: async () => {
        const { cartId, isSyncing, clearCart } = get();
        if (!cartId || isSyncing) return;

        set({ isSyncing: true });
        try {
          const cart = await getShopifyCart(cartId);
          if (!cart || cart.totalQuantity === 0) clearCart();
        } catch (error) {
          console.error("Failed to sync cart with Shopify:", error);
        } finally {
          set({ isSyncing: false });
        }
      },
    }),
    {
      name: "shopify-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items,
        cartId: state.cartId,
        checkoutUrl: state.checkoutUrl,
        fulfillmentMethod: state.fulfillmentMethod,
        deliveryZoneVariantId: state.deliveryZoneVariantId,
        deliveryLineId: state.deliveryLineId,
      }),
    },
  ),
);

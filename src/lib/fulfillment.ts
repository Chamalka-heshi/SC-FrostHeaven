export type FulfillmentMethod = "pickup" | "delivery";

export interface DeliveryZone {
  id: string;
  label: string;
  area: string;
  variantId: string;
  fee: number;
  eta: string;
}

export const PICKUP_INFO = {
  label: "Pickup",
  address: "SC Frost Heaven Kitchen, Colombo",
  eta: "Ready in 24–48 hours",
  hours: "Pickup window: 9:00 AM – 6:00 PM daily",
  fee: 0,
};

// Shopify "Delivery" product (handle: delivery) variant IDs
export const DELIVERY_ZONES: DeliveryZone[] = [
  {
    id: "colombo",
    label: "Colombo City",
    area: "Colombo 1–15",
    variantId: "gid://shopify/ProductVariant/62239369199986",
    fee: 500,
    eta: "Same day or next day (2–4 hrs slot)",
  },
  {
    id: "greater-colombo",
    label: "Greater Colombo",
    area: "Dehiwala, Nugegoda, Kotte, Wattala, Moratuwa",
    variantId: "gid://shopify/ProductVariant/62239369232754",
    fee: 900,
    eta: "Next day delivery (1–2 days)",
  },
  {
    id: "islandwide",
    label: "Islandwide",
    area: "Rest of Sri Lanka",
    variantId: "gid://shopify/ProductVariant/62239369265522",
    fee: 1500,
    eta: "2–3 working days",
  },
];

export const DELIVERY_VARIANT_IDS = DELIVERY_ZONES.map((z) => z.variantId);

export function getZoneByVariantId(variantId: string | null) {
  return DELIVERY_ZONES.find((z) => z.variantId === variantId) ?? null;
}

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
  address: '"Chamathka", Wilegodawaththa, Henwala, Mirissa',
  eta: "Ready in 24–48 hours",
  hours: "Pickup window: 9:00 AM – 6:00 PM daily",
  fee: 0,
};

// Delivery Zones (Within Matara: Rs. 300, Outside Matara / Islandwide: Rs. 500)
export const DELIVERY_ZONES: DeliveryZone[] = [
  {
    id: "matara-district",
    label: "Within Matara District",
    area: "Mirissa, Weligama, Matara, Dikwella, Kamburugamuwa & all areas within Matara District",
    variantId: "gid://shopify/ProductVariant/62239369199986",
    fee: 300,
    eta: "Same day or next day delivery",
  },
  {
    id: "outside-matara",
    label: "Areas Away from Matara",
    area: "Galle, Hambantota, Colombo & Islandwide delivery",
    variantId: "gid://shopify/ProductVariant/62239369232754",
    fee: 500,
    eta: "1–3 business days",
  },
];

export const DELIVERY_VARIANT_IDS = DELIVERY_ZONES.map((z) => z.variantId);

export function getZoneByVariantId(variantId: string | null) {
  return DELIVERY_ZONES.find((z) => z.variantId === variantId) ?? null;
}

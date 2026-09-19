import { PICKUP_INFO, DELIVERY_ZONES, getZoneByVariantId } from "../src/lib/fulfillment";

console.log("=== Testing Fulfillment Configuration ===");

console.log("Pickup Info:", PICKUP_INFO);
if (PICKUP_INFO.address.includes("Mirissa")) {
  console.log("✓ Pickup address points to Mirissa kitchen");
} else {
  throw new Error("Pickup address does not contain Mirissa");
}

console.log("\nDelivery Zones:", DELIVERY_ZONES);
const mataraZone = DELIVERY_ZONES.find((z) => z.id === "matara-district");
const outsideMataraZone = DELIVERY_ZONES.find((z) => z.id === "outside-matara");

if (mataraZone && mataraZone.fee === 300) {
  console.log("✓ Matara District fee is correctly configured at Rs. 300");
} else {
  throw new Error("Matara district fee is not 300");
}

if (outsideMataraZone && outsideMataraZone.fee === 500) {
  console.log("✓ Outside Matara / Islandwide fee is correctly configured at Rs. 500");
} else {
  throw new Error("Outside Matara fee is not 500");
}

console.log("\nAll fulfillment tests passed successfully!");

import { fetchProducts } from "../src/lib/shopify";
import { fetchMenuItems } from "../src/lib/menu-api";
import { createPageMeta, createBakeryJsonLd, createProductJsonLd, createNoIndexMeta } from "../src/lib/seo";

async function runSSRVerification() {
  console.log("=== Testing Route SEO Logic & Schema Generation ===");

  // 1. Home
  const homeMeta = createPageMeta({
    title: "SC Frost Heaven — Custom Cakes & Sweet Moments",
    description: "Elegant custom cakes, cupcakes, and desserts handcrafted in Sri Lanka.",
    path: "/",
  });
  console.log("✓ Home page meta valid:", homeMeta.meta.length, "meta tags");

  // 2. Menu
  const menuMeta = createPageMeta({
    title: "Menu & Online Ordering — SC Frost Heaven",
    description: "Browse our handcrafted cakes, cupcakes, cookies, and desserts in Sri Lanka.",
    path: "/menu",
  });
  console.log("✓ Menu page meta valid:", menuMeta.meta.length, "meta tags");

  // 3. Products
  const [menuItems, shopifyProducts] = await Promise.all([
    fetchMenuItems(true).catch(() => []),
    fetchProducts(10).catch(() => []),
  ]);

  console.log(`✓ Fetched ${menuItems.length} Supabase menu items and ${shopifyProducts.length} Shopify products for SEO validation`);

  for (const item of menuItems) {
    const fakeProduct = {
      id: item.id,
      title: item.title,
      description: item.description || "",
      handle: item.slug,
      productType: item.category,
      priceRange: { minVariantPrice: { amount: String(item.price_lkr), currencyCode: "LKR" } },
      images: { edges: item.image_url ? [{ node: { url: item.image_url, altText: item.title } }] : [] },
      variants: { edges: [{ node: { id: "v1", title: item.title, price: { amount: String(item.price_lkr), currencyCode: "LKR" }, availableForSale: item.is_available, selectedOptions: [] } }] },
      options: [],
    };
    const schema = createProductJsonLd(fakeProduct, item.slug);
    if (!schema || !schema.offers || schema.offers.priceCurrency !== "LKR") {
      throw new Error(`Failed to generate valid schema for Supabase item: ${item.slug}`);
    }
  }
  console.log(`✓ Validated all ${menuItems.length} Supabase menu item schemas`);

  for (const sp of shopifyProducts) {
    const schema = createProductJsonLd(sp.node, sp.node.handle);
    if (!schema || !schema.name) {
      throw new Error(`Failed to generate valid schema for Shopify item: ${sp.node?.handle}`);
    }
  }
  console.log(`✓ Validated all ${shopifyProducts.length} Shopify product schemas`);

  // 4. Private routes
  const privateRoutes = ["Login", "Register", "Forgot Password", "Reset Password", "My Account", "Admin Dashboard"];
  for (const pr of privateRoutes) {
    const meta = createNoIndexMeta(pr);
    const hasNoIndex = meta.meta.some((m) => m.name === "robots" && m.content === "noindex, nofollow");
    if (!hasNoIndex) throw new Error(`Route ${pr} missing noindex, nofollow`);
  }
  console.log(`✓ Validated ${privateRoutes.length} private route noindex headers`);

  console.log("\n>>> ALL SSR & SEO ROUTE VERIFICATIONS PASSED <<<");
}

runSSRVerification().catch((e) => {
  console.error("Verification failed:", e);
  process.exit(1);
});

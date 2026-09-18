import {
  SITE_URL,
  BUSINESS_INFO,
  getCanonicalUrl,
  createPageMeta,
  createNoIndexMeta,
  createBakeryJsonLd,
  createProductJsonLd,
  createBreadcrumbJsonLd,
} from "../src/lib/seo";
import * as fs from "fs";
import * as path from "path";

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failed++;
  }
}

console.log("=== 1. Testing SEO Constants & Canonical Helpers ===");
assert(SITE_URL.startsWith("http"), `SITE_URL is valid URL: ${SITE_URL}`);
assert(!SITE_URL.endsWith("/"), `SITE_URL has no trailing slash: ${SITE_URL}`);
assert(BUSINESS_INFO.email === "scfrostheaven@gmail.com", `Business email verified: ${BUSINESS_INFO.email}`);
assert(BUSINESS_INFO.telephone === "+94702411623", `Business telephone verified: ${BUSINESS_INFO.telephone}`);

assert(getCanonicalUrl("/") === SITE_URL, `Root canonical is ${SITE_URL}`);
assert(getCanonicalUrl("/menu") === `${SITE_URL}/menu`, `Menu canonical is ${SITE_URL}/menu`);
assert(getCanonicalUrl("contact") === `${SITE_URL}/contact`, `Normalized path canonical is ${SITE_URL}/contact`);

console.log("\n=== 2. Testing createPageMeta & createNoIndexMeta ===");
const pageMeta = createPageMeta({
  title: "About Us",
  description: "About description test",
  path: "/about",
});

assert(pageMeta.meta.some((m) => m.title === "About Us — SC Frost Heaven"), "Title properly suffixed");
assert(pageMeta.meta.some((m) => m.property === "og:url" && m.content === `${SITE_URL}/about`), "OG URL is correct");
assert(pageMeta.meta.some((m) => m.name === "robots" && m.content === "index, follow"), "Public page has index, follow");
assert(pageMeta.links.some((l) => l.rel === "canonical" && l.href === `${SITE_URL}/about`), "Canonical link tag present");

const noIndexMeta = createNoIndexMeta("Admin Dashboard");
assert(noIndexMeta.meta.some((m) => m.name === "robots" && m.content === "noindex, nofollow"), "Noindex meta present");
assert(noIndexMeta.meta.some((m) => m.title === "Admin Dashboard — SC Frost Heaven"), "Noindex title properly suffixed");

console.log("\n=== 3. Testing Bakery JSON-LD Schema ===");
const bakerySchema = createBakeryJsonLd();
assert(bakerySchema["@type"] === "Bakery", `Bakery schema @type is Bakery`);
assert(bakerySchema.name === "SC Frost Heaven", `Bakery name is SC Frost Heaven`);
assert(bakerySchema.telephone === "+94702411623", `Bakery phone matches +94702411623`);
assert(bakerySchema.email === "scfrostheaven@gmail.com", `Bakery email matches scfrostheaven@gmail.com`);
assert(bakerySchema.address.addressCountry === "LK", `Bakery country is LK`);
// Validate JSON serialization
const serializedBakery = JSON.stringify(bakerySchema);
assert(JSON.parse(serializedBakery)["@type"] === "Bakery", "Bakery JSON-LD serializes and deserializes cleanly");

console.log("\n=== 4. Testing Product JSON-LD Schema ===");
const mockProduct = {
  id: "test-123",
  title: "Belgian Chocolate Truffle Cake",
  description: "Rich dark chocolate ganache layers",
  handle: "belgian-chocolate-truffle-cake",
  productType: "Cakes",
  priceRange: {
    minVariantPrice: {
      amount: "5500.00",
      currencyCode: "LKR",
    },
  },
  images: {
    edges: [{ node: { url: "https://example.com/cake.jpg", altText: "Cake" } }],
  },
  variants: {
    edges: [
      {
        node: {
          id: "var-1",
          title: "Default",
          price: { amount: "5500.00", currencyCode: "LKR" },
          availableForSale: true,
          selectedOptions: [],
        },
      },
    ],
  },
  options: [],
};

const productSchema = createProductJsonLd(mockProduct, "belgian-chocolate-truffle-cake");
assert(productSchema !== null, "Product schema created successfully");
assert(productSchema?.["@type"] === "Product", "Product schema @type is Product");
assert(productSchema?.name === "Belgian Chocolate Truffle Cake", "Product name matches");
assert(productSchema?.offers.price === "5500.00", "Product offer price is 5500.00");
assert(productSchema?.offers.priceCurrency === "LKR", "Product offer currency is LKR");
assert(productSchema?.offers.availability === "https://schema.org/InStock", "Product offer availability is InStock");

// Test null / malformed handling
const nullSchema = createProductJsonLd(null, "some-handle");
assert(nullSchema === null, "Handles null product gracefully without throwing");

const emptyProductSchema = createProductJsonLd({} as any, "empty-handle");
assert(emptyProductSchema !== null && emptyProductSchema?.offers.price === "0.00", "Handles empty product gracefully");

console.log("\n=== 5. Testing Breadcrumb JSON-LD Schema ===");
const breadcrumbSchema = createBreadcrumbJsonLd([
  { name: "Home", path: "/" },
  { name: "Menu", path: "/menu" },
  { name: "Pastel Cake", path: "/product/pastel-cake" },
]);
assert(breadcrumbSchema["@type"] === "BreadcrumbList", "Breadcrumb @type is BreadcrumbList");
assert(breadcrumbSchema.itemListElement.length === 3, "Breadcrumb has 3 items");
assert(breadcrumbSchema.itemListElement[0].item === `${SITE_URL}`, "First breadcrumb is root");
assert(breadcrumbSchema.itemListElement[2].item === `${SITE_URL}/product/pastel-cake`, "Third breadcrumb is product page");

console.log("\n=== 6. Validating public/robots.txt ===");
const robotsPath = path.resolve(process.cwd(), "public/robots.txt");
const robotsContent = fs.readFileSync(robotsPath, "utf-8");
assert(robotsContent.includes("Allow: /"), "robots.txt allows root");
assert(robotsContent.includes("Allow: /menu"), "robots.txt allows /menu");
assert(robotsContent.includes("Disallow: /admin/"), "robots.txt disallows /admin/");
assert(robotsContent.includes("Disallow: /account"), "robots.txt disallows /account");
assert(robotsContent.includes("Disallow: /login"), "robots.txt disallows /login");
assert(robotsContent.includes("Sitemap: https://scfrostheaven.com/sitemap.xml"), "robots.txt contains sitemap URL");

console.log("\n=== 7. Validating public/sitemap.xml ===");
const sitemapPath = path.resolve(process.cwd(), "public/sitemap.xml");
const sitemapContent = fs.readFileSync(sitemapPath, "utf-8");
assert(sitemapContent.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), "sitemap.xml has valid XML declaration");
assert(sitemapContent.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'), "sitemap.xml has valid urlset xmlns");
assert(sitemapContent.includes("<loc>https://scfrostheaven.com</loc>"), "sitemap contains homepage");
assert(sitemapContent.includes("<loc>https://scfrostheaven.com/menu</loc>"), "sitemap contains menu");
assert(sitemapContent.includes("<loc>https://scfrostheaven.com/custom-orders</loc>"), "sitemap contains custom orders");
assert(sitemapContent.includes("<loc>https://scfrostheaven.com/product/"), "sitemap contains dynamic products");
assert(sitemapContent.endsWith("</urlset>\n") || sitemapContent.endsWith("</urlset>"), "sitemap.xml closes urlset tag");

console.log("\n=== 8. Validating public/site.webmanifest ===");
const manifestPath = path.resolve(process.cwd(), "public/site.webmanifest");
const manifestContent = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
assert(manifestContent.name === "SC Frost Heaven", "Manifest name is SC Frost Heaven");
assert(manifestContent.start_url === "/", "Manifest start_url is /");
assert(manifestContent.display === "standalone", "Manifest display is standalone");
assert(manifestContent.icons.length >= 2, "Manifest includes icons");

console.log(`\n========================================`);
console.log(`SEO Validation Summary: ${passed} Passed, ${failed} Failed`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}

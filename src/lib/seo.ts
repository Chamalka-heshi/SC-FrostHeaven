import type { ShopifyProduct } from "./shopify";

/**
 * Production Canonical Base URL
 * Reads from VITE_SITE_URL environment variable if set, otherwise falls back to official domain.
 */
const RAW_SITE_URL =
  (typeof process !== "undefined" && process.env?.["VITE_SITE_URL"]) ||
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_SITE_URL) ||
  "https://scfrostheaven.com";

export const SITE_URL = RAW_SITE_URL.replace(/\/+$/, "");

/**
 * Verified SC Frost Heaven business information
 */
export const BUSINESS_INFO = {
  name: "SC Frost Heaven",
  legalName: "SC Frost Heaven",
  alternateName: "SC Frost Heaven Bakery",
  description:
    "Elegant custom cakes, cupcakes, and handcrafted desserts made with love for birthdays, weddings, and celebrations in Sri Lanka.",
  url: SITE_URL,
  email: "scfrostheaven@gmail.com",
  telephone: "+94702411623",
  displayTelephone: "+94 70 241 1623",
  address: {
    "@type": "PostalAddress",
    streetAddress: '"Chamathka", Wilegodawaththa, Henwala',
    addressLocality: "Mirissa",
    addressRegion: "Matara District, Southern Province",
    postalCode: "81740",
    addressCountry: "LK",
  },
  geo: {
    "@type": "GeoCoordinates",
    addressCountry: "LK",
  },
  priceRange: "LKR",
  currenciesAccepted: "LKR",
  paymentAccepted: "Cash, Credit Card, Bank Transfer",
  logo: `${SITE_URL}/logo.png`,
  image: `${SITE_URL}/logo.png`,
  servesCuisine: "Bakery, Cakes, Desserts, Custom Pastries",
};

/**
 * Generate fully-qualified canonical URL for a path
 */
export function getCanonicalUrl(path: string = "/"): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${cleanPath === "/" ? "" : cleanPath}`;
}

export interface MetaTag {
  title?: string;
  charSet?: string;
  name?: string;
  property?: string;
  content?: string;
}

export interface LinkTag {
  rel: string;
  href: string;
  type?: string;
  sizes?: string;
}

export interface ScriptTag {
  type?: string;
  children?: string;
}

export interface PageMetaOptions {
  title: string;
  description: string;
  path?: string;
  ogImage?: string;
  ogType?: "website" | "article" | "product";
  noIndex?: boolean;
}

/**
 * Generate standard SEO meta tags and canonical link
 */
export function createPageMeta({
  title,
  description,
  path = "/",
  ogImage = `${SITE_URL}/logo.png`,
  ogType = "website",
  noIndex = false,
}: PageMetaOptions): {
  meta: MetaTag[];
  links: LinkTag[];
} {
  const canonicalUrl = getCanonicalUrl(path);
  const fullTitle = title.includes("SC Frost Heaven")
    ? title
    : `${title} — SC Frost Heaven`;

  const meta: MetaTag[] = [
    { title: fullTitle },
    { name: "description", content: description },
    { name: "author", content: BUSINESS_INFO.name },
    // Open Graph
    { property: "og:title", content: fullTitle },
    { property: "og:description", content: description },
    { property: "og:type", content: ogType },
    { property: "og:url", content: canonicalUrl },
    { property: "og:image", content: ogImage },
    { property: "og:site_name", content: BUSINESS_INFO.name },
    { property: "og:locale", content: "en_LK" },
    // Twitter Card
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: fullTitle },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: ogImage },
    { name: "twitter:site", content: "@SCFrostHeaven" },
  ];

  if (noIndex) {
    meta.push({ name: "robots", content: "noindex, nofollow" });
  } else {
    meta.push({ name: "robots", content: "index, follow" });
  }

  const links: LinkTag[] = [{ rel: "canonical", href: canonicalUrl }];

  return { meta, links };
}

/**
 * Generate strict noindex metadata for private, admin, and authentication pages
 */
export function createNoIndexMeta(title: string): {
  meta: MetaTag[];
} {
  const fullTitle = title.includes("SC Frost Heaven")
    ? title
    : `${title} — SC Frost Heaven`;

  return {
    meta: [
      { title: fullTitle },
      { name: "robots", content: "noindex, nofollow" },
    ],
  };
}

/**
 * Structured Data: LocalBusiness / Bakery Schema
 */
export function createBakeryJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Bakery",
    "@id": `${SITE_URL}/#bakery`,
    name: BUSINESS_INFO.name,
    legalName: BUSINESS_INFO.legalName,
    alternateName: BUSINESS_INFO.alternateName,
    url: SITE_URL,
    logo: BUSINESS_INFO.logo,
    image: BUSINESS_INFO.image,
    description: BUSINESS_INFO.description,
    telephone: BUSINESS_INFO.telephone,
    email: BUSINESS_INFO.email,
    priceRange: BUSINESS_INFO.priceRange,
    currenciesAccepted: BUSINESS_INFO.currenciesAccepted,
    paymentAccepted: BUSINESS_INFO.paymentAccepted,
    servesCuisine: BUSINESS_INFO.servesCuisine,
    address: BUSINESS_INFO.address,
    hasMerchantReturnPolicy: {
      "@type": "MerchantReturnPolicy",
      applicableCountry: "LK",
      returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
      merchantReturnDays: 1,
      returnMethod: "https://schema.org/ReturnInStore",
    },
  };
}

/**
 * Structured Data: WebSite Schema
 */
export function createWebSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: BUSINESS_INFO.name,
    url: SITE_URL,
    description: BUSINESS_INFO.description,
    publisher: {
      "@id": `${SITE_URL}/#bakery`,
    },
  };
}

/**
 * Structured Data: Product Schema
 * Derives accurately from Shopify and Supabase data.
 */
export function createProductJsonLd(
  product: ShopifyProduct["node"] | null | undefined,
  handle: string
) {
  if (!product) return null;

  const productUrl = getCanonicalUrl(`/product/${handle}`);
  const images = (product.images?.edges || [])
    .map((e) => e.node?.url)
    .filter(Boolean);

  const primaryImage = images[0] || `${SITE_URL}/logo.png`;
  const priceAmount =
    product.priceRange?.minVariantPrice?.amount ||
    product.variants?.edges?.[0]?.node?.price?.amount ||
    "0.00";
  const currencyCode =
    product.priceRange?.minVariantPrice?.currencyCode ||
    product.variants?.edges?.[0]?.node?.price?.currencyCode ||
    "LKR";

  const firstVariant = product.variants?.edges?.[0]?.node;
  const isAvailable = firstVariant
    ? firstVariant.availableForSale
    : true;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${productUrl}#product`,
    name: product.title,
    description:
      product.description ||
      `Handcrafted ${product.title} from SC Frost Heaven. Freshly baked with premium ingredients.`,
    image: images.length > 0 ? images : [primaryImage],
    url: productUrl,
    category: product.productType || "Cakes",
    brand: {
      "@type": "Brand",
      name: BUSINESS_INFO.name,
    },
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: currencyCode,
      price: parseFloat(priceAmount).toFixed(2),
      priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      itemCondition: "https://schema.org/NewCondition",
      availability: isAvailable
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: {
        "@type": "Organization",
        name: BUSINESS_INFO.name,
      },
    },
  };
}

/**
 * Structured Data: BreadcrumbList Schema
 */
export function createBreadcrumbJsonLd(
  items: Array<{ name: string; path: string }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: getCanonicalUrl(item.path),
    })),
  };
}

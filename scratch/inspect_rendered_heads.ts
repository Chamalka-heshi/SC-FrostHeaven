import { Route as RootRoute } from "../src/routes/__root";
import { Route as IndexRoute } from "../src/routes/index";
import { Route as MenuRoute } from "../src/routes/menu";
import { Route as ProductRoute } from "../src/routes/product.$handle";
import { Route as CustomOrdersRoute } from "../src/routes/custom-orders";
import { Route as AboutRoute } from "../src/routes/about";
import { Route as ContactRoute } from "../src/routes/contact";
import { Route as TestimonialsRoute } from "../src/routes/testimonials";
import { Route as LoginRoute } from "../src/routes/login";
import { Route as AccountRoute } from "../src/routes/account";
import { Route as AdminRoute } from "../src/routes/admin";
import { fetchProductByHandle } from "../src/lib/shopify";
import { fetchMenuItemBySlug, menuItemToShopifyProduct } from "../src/lib/menu-api";

async function inspectRouteHeads() {
  console.log("===============================================================");
  console.log("          RENDERED HEAD AUDIT FOR SC FROST HEAVEN             ");
  console.log("===============================================================\n");

  const results: Record<string, any> = {};

  // 1. Root Route
  const rootHead = (RootRoute.options.head as any)?.({});
  results["__root"] = rootHead;
  console.log("1. ROOT ROUTE (__root.tsx):");
  console.log("  Meta tags count:", rootHead.meta?.length);
  console.log("  Links:", rootHead.links);
  console.log("  Theme Color:", rootHead.meta?.find((m: any) => m.name === "theme-color")?.content);
  console.log("  Root Scripts (Bakery JSON-LD):", rootHead.scripts?.[0]?.children ? "Present (Valid JSON)" : "Missing");

  // 2. Home Route (/)
  const homeHead = (IndexRoute.options.head as any)?.({});
  results["/"] = homeHead;
  console.log("\n2. HOME ROUTE (/):");
  console.log("  Title:", homeHead.meta?.find((m: any) => m.title)?.title);
  console.log("  Description:", homeHead.meta?.find((m: any) => m.name === "description")?.content);
  console.log("  Canonical:", homeHead.links?.find((l: any) => l.rel === "canonical")?.href);
  console.log("  OG Title:", homeHead.meta?.find((m: any) => m.property === "og:title")?.content);
  console.log("  OG URL:", homeHead.meta?.find((m: any) => m.property === "og:url")?.content);
  console.log("  OG Image:", homeHead.meta?.find((m: any) => m.property === "og:image")?.content);
  console.log("  Twitter Card:", homeHead.meta?.find((m: any) => m.name === "twitter:card")?.content);
  console.log("  Home JSON-LD:", homeHead.scripts?.[0]?.children ? JSON.parse(homeHead.scripts[0].children)["@type"] : "Missing");

  // 3. Menu Route (/menu)
  const menuHead = (MenuRoute.options.head as any)?.({});
  results["/menu"] = menuHead;
  console.log("\n3. MENU ROUTE (/menu):");
  console.log("  Title:", menuHead.meta?.find((m: any) => m.title)?.title);
  console.log("  Description:", menuHead.meta?.find((m: any) => m.name === "description")?.content);
  console.log("  Canonical:", menuHead.links?.find((l: any) => l.rel === "canonical")?.href);
  console.log("  OG Title:", menuHead.meta?.find((m: any) => m.property === "og:title")?.content);
  console.log("  Breadcrumbs JSON-LD:", menuHead.scripts?.[0]?.children ? JSON.parse(menuHead.scripts[0].children)["@type"] : "Missing");

  // 4. Product Route (/product/belgian-chocolate-ganache-cake)
  const handle = "belgian-chocolate-ganache-cake";
  let productData = null;
  const menuItem = await fetchMenuItemBySlug(handle).catch(() => null);
  if (menuItem) {
    productData = menuItemToShopifyProduct(menuItem).node;
  } else {
    productData = await fetchProductByHandle(handle).catch(() => null);
  }

  const productHead = (ProductRoute.options.head as any)?.({
    loaderData: productData,
    params: { handle },
  });
  results["/product/" + handle] = productHead;
  console.log(`\n4. PRODUCT DETAIL ROUTE (/product/${handle}):`);
  console.log("  Title:", productHead.meta?.find((m: any) => m.title)?.title);
  console.log("  Description:", productHead.meta?.find((m: any) => m.name === "description")?.content);
  console.log("  Canonical:", productHead.links?.find((l: any) => l.rel === "canonical")?.href);
  console.log("  OG Image:", productHead.meta?.find((m: any) => m.property === "og:image")?.content);
  console.log("  Product JSON-LD:", productHead.scripts?.[0]?.children ? JSON.parse(productHead.scripts[0].children) : "Missing");
  console.log("  Breadcrumbs JSON-LD:", productHead.scripts?.[1]?.children ? JSON.parse(productHead.scripts[1].children) : "Missing");

  // 5. Custom Orders (/custom-orders)
  const customHead = (CustomOrdersRoute.options.head as any)?.({});
  results["/custom-orders"] = customHead;
  console.log("\n5. CUSTOM ORDERS ROUTE (/custom-orders):");
  console.log("  Title:", customHead.meta?.find((m: any) => m.title)?.title);
  console.log("  Description:", customHead.meta?.find((m: any) => m.name === "description")?.content);
  console.log("  Canonical:", customHead.links?.find((l: any) => l.rel === "canonical")?.href);
  console.log("  Breadcrumbs JSON-LD:", customHead.scripts?.[0]?.children ? JSON.parse(customHead.scripts[0].children)["@type"] : "Missing");

  // 6. About (/about)
  const aboutHead = (AboutRoute.options.head as any)?.({});
  results["/about"] = aboutHead;
  console.log("\n6. ABOUT ROUTE (/about):");
  console.log("  Title:", aboutHead.meta?.find((m: any) => m.title)?.title);
  console.log("  Description:", aboutHead.meta?.find((m: any) => m.name === "description")?.content);
  console.log("  Canonical:", aboutHead.links?.find((l: any) => l.rel === "canonical")?.href);

  // 7. Contact (/contact)
  const contactHead = (ContactRoute.options.head as any)?.({});
  results["/contact"] = contactHead;
  console.log("\n7. CONTACT ROUTE (/contact):");
  console.log("  Title:", contactHead.meta?.find((m: any) => m.title)?.title);
  console.log("  Description:", contactHead.meta?.find((m: any) => m.name === "description")?.content);
  console.log("  Canonical:", contactHead.links?.find((l: any) => l.rel === "canonical")?.href);

  // 8. Testimonials (/testimonials)
  const testimonialsHead = (TestimonialsRoute.options.head as any)?.({});
  results["/testimonials"] = testimonialsHead;
  console.log("\n8. TESTIMONIALS ROUTE (/testimonials):");
  console.log("  Title:", testimonialsHead.meta?.find((m: any) => m.title)?.title);
  console.log("  Description:", testimonialsHead.meta?.find((m: any) => m.name === "description")?.content);
  console.log("  Canonical:", testimonialsHead.links?.find((l: any) => l.rel === "canonical")?.href);

  // 9. Login (/login) - Private
  const loginHead = (LoginRoute.options.head as any)?.({});
  results["/login"] = loginHead;
  console.log("\n9. LOGIN ROUTE (/login) [PRIVATE]:");
  console.log("  Title:", loginHead.meta?.find((m: any) => m.title)?.title);
  console.log("  Robots:", loginHead.meta?.find((m: any) => m.name === "robots")?.content);

  // 10. Account (/account) - Private
  const accountHead = (AccountRoute.options.head as any)?.({});
  results["/account"] = accountHead;
  console.log("\n10. ACCOUNT ROUTE (/account) [PRIVATE]:");
  console.log("  Title:", accountHead.meta?.find((m: any) => m.title)?.title);
  console.log("  Robots:", accountHead.meta?.find((m: any) => m.name === "robots")?.content);

  // 11. Admin (/admin) - Private
  const adminHead = (AdminRoute.options.head as any)?.({});
  results["/admin"] = adminHead;
  console.log("\n11. ADMIN ROUTE (/admin) [PRIVATE]:");
  console.log("  Title:", adminHead.meta?.find((m: any) => m.title)?.title);
  console.log("  Robots:", adminHead.meta?.find((m: any) => m.name === "robots")?.content);

  console.log("\n===============================================================");
  console.log("             ALL HEAD METADATA AUDITS COMPLETED                ");
  console.log("===============================================================");
}

inspectRouteHeads().catch((e) => {
  console.error(e);
  process.exit(1);
});

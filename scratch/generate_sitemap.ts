import { fetchProducts } from "../src/lib/shopify";
import { fetchMenuItems } from "../src/lib/menu-api";
import * as fs from "fs";
import * as path from "path";

async function generateSitemap() {
  const baseUrl = "https://scfrostheaven.com";
  const today = new Date().toISOString().split("T")[0];

  const staticRoutes = [
    { loc: "/", priority: "1.0", changefreq: "daily" },
    { loc: "/menu", priority: "0.9", changefreq: "daily" },
    { loc: "/custom-orders", priority: "0.8", changefreq: "weekly" },
    { loc: "/track-order", priority: "0.8", changefreq: "weekly" },
    { loc: "/about", priority: "0.7", changefreq: "monthly" },
    { loc: "/testimonials", priority: "0.7", changefreq: "weekly" },
    { loc: "/contact", priority: "0.6", changefreq: "monthly" },
  ];

  const handles = new Set<string>();

  try {
    const menuItems = await fetchMenuItems(true);
    for (const item of menuItems) {
      if (item.slug) handles.add(item.slug);
    }
  } catch (e) {
    console.warn("Could not fetch Supabase menu items:", e);
  }

  try {
    const shopifyProducts = await fetchProducts(100);
    for (const p of shopifyProducts) {
      if (p.node?.handle) handles.add(p.node.handle);
    }
  } catch (e) {
    console.warn("Could not fetch Shopify products:", e);
  }

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  for (const r of staticRoutes) {
    xml += "  <url>\n";
    xml += `    <loc>${baseUrl}${r.loc === "/" ? "" : r.loc}</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += `    <changefreq>${r.changefreq}</changefreq>\n`;
    xml += `    <priority>${r.priority}</priority>\n`;
    xml += "  </url>\n";
  }

  for (const handle of Array.from(handles).sort()) {
    xml += "  <url>\n";
    xml += `    <loc>${baseUrl}/product/${handle}</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += "    <changefreq>weekly</changefreq>\n";
    xml += "    <priority>0.8</priority>\n";
    xml += "  </url>\n";
  }

  xml += "</urlset>\n";

  const targetPath = path.resolve(process.cwd(), "public/sitemap.xml");
  fs.writeFileSync(targetPath, xml, "utf-8");
  console.log(`Generated sitemap at ${targetPath} with ${staticRoutes.length + handles.size} URLs (${handles.size} product handles)`);
}

generateSitemap();

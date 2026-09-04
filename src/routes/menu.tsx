import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Search, X, Cake, Sparkles, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductCard } from "@/components/product-card";
import { fetchProducts, type ShopifyProduct } from "@/lib/shopify";

export const Route = createFileRoute("/menu")({
  head: () => ({
    meta: [
      { title: "Menu — SC Frost Heaven" },
      {
        name: "description",
        content: "Browse our handcrafted cakes, cupcakes, and desserts available for online ordering.",
      },
      { property: "og:title", content: "Menu — SC Frost Heaven" },
      {
        property: "og:description",
        content: "Browse our handcrafted cakes, cupcakes, and desserts available for online ordering.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      queryKey: ["products", "all"],
      queryFn: () => fetchProducts(100),
    });
  },
  component: MenuPage,
});

function getProductCategory(product: ShopifyProduct): string {
  // 1. If Shopify productType is set, use it
  if (product.node.productType && product.node.productType.trim()) {
    return product.node.productType.trim();
  }

  // 2. Check title keywords to categorize intelligently
  const title = (product.node.title || "").toLowerCase();
  if (title.includes("cupcake")) return "Cupcakes";
  if (title.includes("cookie") || title.includes("biscuit")) return "Cookies";
  if (title.includes("dessert") || title.includes("tart") || title.includes("brownie") || title.includes("macaron")) {
    return "Desserts";
  }
  if (title.includes("wedding") || title.includes("tiered")) return "Wedding Cakes";
  if (title.includes("birthday") || title.includes("bento") || title.includes("cake")) return "Cakes";

  // 3. Fallback
  return "Specialties";
}

function MenuPage() {
  const { data: products } = useSuspenseQuery<ShopifyProduct[]>({
    queryKey: ["products", "all"],
    queryFn: () => fetchProducts(100),
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  // Extract unique categories and their counts
  const categories = useMemo(() => {
    const counts: Record<string, number> = { All: products.length };
    products.forEach((p) => {
      const cat = getProductCategory(p);
      counts[cat] = (counts[cat] || 0) + 1;
    });

    const categoryList = Object.keys(counts).filter((cat) => cat !== "All");
    return [
      { name: "All", count: counts["All"] },
      ...categoryList.map((cat) => ({ name: cat, count: counts[cat] })),
    ];
  }, [products]);

  // Combined Search & Category Filter
  const filteredProducts = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return products.filter((p) => {
      // 1. Category Filter
      if (selectedCategory !== "All") {
        const category = getProductCategory(p);
        if (category !== selectedCategory) return false;
      }

      // 2. Search Query Filter
      if (query) {
        const titleMatch = p.node.title.toLowerCase().includes(query);
        const descriptionMatch = (p.node.description || "").toLowerCase().includes(query);
        const categoryMatch = getProductCategory(p).toLowerCase().includes(query);

        if (!titleMatch && !descriptionMatch && !categoryMatch) {
          return false;
        }
      }

      return true;
    });
  }, [products, searchQuery, selectedCategory]);

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("All");
  };

  const isFiltering = searchQuery.trim().length > 0 || selectedCategory !== "All";

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 space-y-10">
      {/* Page Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blush px-3.5 py-1 text-xs font-semibold text-blush-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          Freshly Baked Daily
        </span>
        <h1 className="text-4xl font-medium text-foreground sm:text-5xl">Our Menu</h1>
        <p className="text-base text-muted-foreground sm:text-lg">
          Handcrafted artisan cakes, cupcakes, and desserts, baked with love in Sri Lanka.
        </p>
      </div>

      {/* Search & Category Filter Controls */}
      <div className="rounded-3xl bg-card p-5 shadow-soft border border-border/70 space-y-4 max-w-4xl mx-auto">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search cakes by name, flavor, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-2xl pl-10 bg-secondary/20 border-border/70 text-sm h-11"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Reset Filters button if active */}
          {isFiltering && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="rounded-full text-xs h-11 px-4 text-muted-foreground hover:text-foreground border-border/80 cursor-pointer"
            >
              Reset Filters
            </Button>
          )}
        </div>

        {/* Dynamic Category Pill Tabs */}
        {categories.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
            <span className="text-xs text-muted-foreground font-medium flex items-center gap-1 mr-1">
              <Filter className="h-3.5 w-3.5" /> Category:
            </span>
            {categories.map((cat) => {
              const isActive = selectedCategory === cat.name;
              return (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`rounded-full px-3.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  {cat.name} <span className="text-[10px] opacity-80">({cat.count})</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Results Header / Counter */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>
          Showing <span className="font-semibold text-foreground">{filteredProducts.length}</span> of{" "}
          <span className="font-semibold text-foreground">{products.length}</span> items
        </span>
        {isFiltering && (
          <span className="text-primary font-medium">Filtered Results</span>
        )}
      </div>

      {/* Product Grid or Empty State */}
      {filteredProducts.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map((product) => (
            <ProductCard key={product.node.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl bg-secondary/30 py-16 px-6 text-center border border-border/60 max-w-md mx-auto space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-card text-muted-foreground shadow-xs">
            <Cake className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-medium text-foreground">No matching cakes found</h2>
            <p className="text-xs text-muted-foreground">
              {searchQuery
                ? `No cakes found matching "${searchQuery}". Try a different keyword or browse all categories.`
                : "No products found in this category."}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="rounded-full text-xs cursor-pointer"
            >
              Clear All Filters
            </Button>
            <Button asChild size="sm" className="rounded-full text-xs bg-primary text-primary-foreground hover:bg-primary/90">
              <Link to="/custom-orders">Custom Order Request</Link>
            </Button>
          </div>
        </div>
      )}

      {/* Custom Cake Banner at bottom of Menu */}
      <div className="rounded-3xl bg-gradient-rose px-6 py-12 text-center text-primary-foreground sm:px-12 mt-12">
        <h2 className="text-2xl font-medium sm:text-3xl">Looking for a specific theme or design?</h2>
        <p className="mt-2 text-sm text-primary-foreground/90 max-w-xl mx-auto">
          We specialize in custom celebration cakes tailored to your unique flavor and design preferences.
        </p>
        <Button asChild size="lg" className="mt-6 rounded-full bg-background text-foreground hover:bg-background/90 shadow-md">
          <Link to="/custom-orders">Request a Custom Cake</Link>
        </Button>
      </div>
    </div>
  );
}

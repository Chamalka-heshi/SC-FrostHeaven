import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ProductCard } from "@/components/product-card";
import { fetchProducts, type ShopifyProduct } from "@/lib/shopify";

export const Route = createFileRoute("/menu")({
  head: () => ({
    meta: [
      { title: "Menu —SC Frost Heaven" },
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

function MenuPage() {
  const { data: products } = useSuspenseQuery<ShopifyProduct[]>({
    queryKey: ["products", "all"],
    queryFn: () => fetchProducts(100),
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-medium text-foreground sm:text-5xl">Our Menu</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Handcrafted cakes and desserts, freshly made to order
        </p>
      </div>

      {products && products.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.node.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-secondary/40 py-20 text-center">
          <h2 className="text-xl font-medium text-foreground">No products found</h2>
          <p className="mt-2 text-muted-foreground">
            Our menu is being freshly prepared. Tell me what cakes you&apos;d like to sell and
            I&apos;ll add them to your Shopify store.
          </p>
        </div>
      )}
    </div>
  );
}

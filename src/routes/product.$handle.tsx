import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Minus, Plus } from "lucide-react";
import { useCartStore } from "@/stores/cart";
import { fetchProductByHandle, type ShopifyProduct } from "@/lib/shopify";

export const Route = createFileRoute("/product/$handle")({
  head: ({ params }) => ({
    meta: [
      { title: `Product — SC Frost Heaven` },
      { name: "description", content: "Handcrafted cake from SC Frost Heaven" },
      { property: "og:title", content: `Product — SC Frost Heaven` },
      { property: "og:description", content: "Handcrafted cake from SC Frost Heaven" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async ({ context, params }) => {
    const product = await context.queryClient.ensureQueryData({
      queryKey: ["product", params.handle],
      queryFn: () => fetchProductByHandle(params.handle),
    });
    if (!product) throw notFound();
    return product as NonNullable<ShopifyProduct["node"]>;
  },
  component: ProductDetailPage,
});

function ProductDetailPage() {
  const product = Route.useLoaderData();

  const addItem = useCartStore((state) => state.addItem);
  const isLoading = useCartStore((state) => state.isLoading);
  const [quantity, setQuantity] = useState(1);

  const variant = product.variants.edges[0]?.node;
  const image = product.images.edges[0]?.node;

  const handleAddToCart = async () => {
    if (!variant) return;
    await addItem({
      product: { node: product },
      variantId: variant.id,
      variantTitle: variant.title,
      price: variant.price,
      quantity,
      selectedOptions: variant.selectedOptions || [],
    });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="grid gap-12 lg:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-3xl bg-muted shadow-soft">
          {image ? (
            <img
              src={image.url}
              alt={image.altText || product.title}
              className="h-full w-full object-cover"
              width={1024}
              height={1024}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              No image
            </div>
          )}
        </div>

        <div className="flex flex-col justify-center">
          <h1 className="text-3xl font-medium text-foreground sm:text-4xl lg:text-5xl">
            {product.title}
          </h1>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            {product.description || "Handcrafted with love using quality ingredients."}
          </p>

          <div className="mt-8">
            <span className="text-3xl font-semibold text-primary">
              {product.priceRange.minVariantPrice.currencyCode}{" "}
              {parseFloat(product.priceRange.minVariantPrice.amount).toFixed(2)}
            </span>
          </div>

          {variant && (
            <div className="mt-8 flex items-center gap-4">
              <div className="flex items-center rounded-full border border-border bg-background p-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-10 text-center font-medium">{quantity}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full"
                  onClick={() => setQuantity((q) => q + 1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <Button
                onClick={handleAddToCart}
                disabled={isLoading || !variant.availableForSale}
                size="lg"
                className="flex-1 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <ShoppingBag className="mr-2 h-5 w-5" />
                {isLoading ? "Adding..." : "Add to Cart"}
              </Button>
            </div>
          )}

          {!variant?.availableForSale && (
            <p className="mt-4 text-sm text-destructive">This product is currently unavailable.</p>
          )}
        </div>
      </div>
    </div>
  );
}

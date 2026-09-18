import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Minus, Plus } from "lucide-react";
import { useCartStore } from "@/stores/cart";
import { fetchProductByHandle, type ShopifyProduct } from "@/lib/shopify";
import { fetchMenuItemBySlug, menuItemToShopifyProduct } from "@/lib/menu-api";
import {
  createPageMeta,
  createProductJsonLd,
  createBreadcrumbJsonLd,
  SITE_URL,
} from "@/lib/seo";
import { toast } from "sonner";

async function getProduct(handle: string): Promise<NonNullable<ShopifyProduct["node"]>> {
  // 1. Check Supabase menu_items first
  try {
    const menuItem = await fetchMenuItemBySlug(handle);
    if (menuItem) {
      return menuItemToShopifyProduct(menuItem).node;
    }
  } catch (err) {
    console.warn("Supabase menu item lookup note:", err);
  }

  // 2. Fallback to Shopify
  const product = await fetchProductByHandle(handle).catch(() => null);
  if (!product) throw notFound();
  return product;
}

export const Route = createFileRoute("/product/$handle")({
  head: ({ loaderData, params }) => {
    const product = loaderData as NonNullable<ShopifyProduct["node"]> | undefined;
    const title = product?.title
      ? `${product.title} — SC Frost Heaven`
      : "Product — SC Frost Heaven";
    const description =
      product?.description ||
      (product?.title
        ? `Order handcrafted ${product.title} online from SC Frost Heaven. Freshly baked in Sri Lanka with premium ingredients.`
        : "Handcrafted cakes, cupcakes, and desserts from SC Frost Heaven in Sri Lanka.");
    const ogImage = product?.images?.edges?.[0]?.node?.url || `${SITE_URL}/logo.png`;

    const { meta, links } = createPageMeta({
      title,
      description,
      path: `/product/${params.handle}`,
      ogImage,
      ogType: "product",
    });

    const scripts: Array<{ type: string; children: string }> = [];

    if (product) {
      const productSchema = createProductJsonLd(product, params.handle);
      if (productSchema) {
        scripts.push({
          type: "application/ld+json",
          children: JSON.stringify(productSchema),
        });
      }
    }

    scripts.push({
      type: "application/ld+json",
      children: JSON.stringify(
        createBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Menu", path: "/menu" },
          {
            name: product?.title || params.handle,
            path: `/product/${params.handle}`,
          },
        ])
      ),
    });

    return {
      meta,
      links,
      scripts,
    };
  },
  loader: async ({ context, params }) => {
    return context.queryClient.ensureQueryData({
      queryKey: ["product", params.handle],
      queryFn: () => getProduct(params.handle),
    });
  },
  component: ProductDetailPage,
});

function ProductDetailPage() {
  const { handle } = Route.useParams();
  const { data: product } = useSuspenseQuery({
    queryKey: ["product", handle],
    queryFn: () => getProduct(handle),
  });

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
    toast.success(`Added ${quantity}x "${product.title}" to cart`, {
      description: `${variant.price.currencyCode} ${(parseFloat(variant.price.amount) * quantity).toFixed(2)}`,
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
                disabled={isLoading}
                size="lg"
                className="flex-1 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
              >
                <ShoppingBag className="mr-2 h-5 w-5" />
                {isLoading ? "Adding..." : "Add to Cart"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

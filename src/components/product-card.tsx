import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ShoppingBag } from "lucide-react";
import { useCartStore } from "@/stores/cart";
import type { ShopifyProduct } from "@/lib/shopify";

interface ProductCardProps {
  product: ShopifyProduct;
}

export function ProductCard({ product }: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem);
  const isLoading = useCartStore((state) => state.isLoading);
  const variant = product.node.variants.edges[0]?.node;

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!variant) return;
    await addItem({
      product,
      variantId: variant.id,
      variantTitle: variant.title,
      price: variant.price,
      quantity: 1,
      selectedOptions: variant.selectedOptions || [],
    });
  };

  const image = product.node.images.edges[0]?.node;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl bg-card shadow-soft transition-all hover:shadow-gold">
      <Link to="/product/$handle" params={{ handle: product.node.handle }} className="block">
        <div className="aspect-square overflow-hidden bg-muted">
          {image ? (
            <img
              src={image.url}
              alt={image.altText || product.node.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-secondary/50 text-muted-foreground">
              No image
            </div>
          )}
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <Link to="/product/$handle" params={{ handle: product.node.handle }}>
          <h3 className="text-lg font-medium text-foreground transition-colors group-hover:text-primary">
            {product.node.title}
          </h3>
        </Link>
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
          {product.node.description || "Handcrafted with love"}
        </p>
        <div className="mt-auto flex items-center justify-between pt-4">
          <span className="text-lg font-semibold text-primary">
            {product.node.priceRange.minVariantPrice.currencyCode}{" "}
            {parseFloat(product.node.priceRange.minVariantPrice.amount).toFixed(2)}
          </span>
          <Button
            onClick={handleAddToCart}
            disabled={isLoading || !variant || !variant.availableForSale}
            size="sm"
            className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <ShoppingBag className="mr-2 h-4 w-4" />
            {isLoading ? "Adding..." : "Add"}
          </Button>
        </div>
      </div>
    </div>
  );
}

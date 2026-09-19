import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Sparkles } from "lucide-react";
import { useCartStore } from "@/stores/cart";
import { toast } from "sonner";
import type { ShopifyProduct } from "@/lib/shopify";

interface ProductCardProps {
  product: ShopifyProduct;
}

export function ProductCard({ product }: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem);
  const variant = product.node.variants.edges[0]?.node;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!variant) return;
    addItem({
      product,
      variantId: variant.id,
      variantTitle: variant.title,
      price: variant.price,
      quantity: 1,
      selectedOptions: variant.selectedOptions || [],
    });
    toast.success(`Added "${product.node.title}" to cart`, {
      description: `${variant.price.currencyCode} ${parseFloat(variant.price.amount).toFixed(2)}`,
    });
  };

  const image = product.node.images.edges[0]?.node;
  const badge = product.node.tags?.[0];

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl bg-card shadow-soft transition-all hover:shadow-gold border border-border/60">
      <Link to="/product/$handle" params={{ handle: product.node.handle }} className="block relative">
        <div className="aspect-square overflow-hidden bg-muted relative">
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
          {badge && (
            <div className="absolute top-3 left-3">
              <Badge className="bg-primary/95 text-primary-foreground font-medium text-[11px] px-2.5 py-0.5 rounded-full shadow-xs backdrop-blur-xs flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                {badge}
              </Badge>
            </div>
          )}
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <Link to="/product/$handle" params={{ handle: product.node.handle }}>
          <h3 className="text-lg font-medium text-foreground transition-colors group-hover:text-primary line-clamp-1">
            {product.node.title}
          </h3>
        </Link>
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
          {product.node.description || "Handcrafted with love using premium ingredients."}
        </p>
        <div className="mt-auto flex items-center justify-between pt-4">
          <span className="text-lg font-semibold text-primary">
            {product.node.priceRange.minVariantPrice.currencyCode}{" "}
            {parseFloat(product.node.priceRange.minVariantPrice.amount).toFixed(2)}
          </span>
          <Button
            onClick={handleAddToCart}
            disabled={!variant}
            size="sm"
            className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
          >
            <ShoppingBag className="mr-2 h-4 w-4" />
            Add to Cart
          </Button>
        </div>
      </div>
    </div>
  );
}

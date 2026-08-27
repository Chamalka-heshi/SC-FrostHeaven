import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/product-card";
import { fetchProducts, type ShopifyProduct } from "@/lib/shopify";
import heroCake from "@/assets/hero-cake.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SC Frost Heaven — Custom Cakes & Sweet Moments" },
      {
        name: "description",
        content:
          "Elegant custom cakes, cupcakes, and desserts handcrafted for birthdays, weddings, and celebrations in Sri Lanka.",
      },
      { property: "og:title", content: "SC Frost Heaven — Custom Cakes & Sweet Moments" },
      {
        property: "og:description",
        content:
          "Elegant custom cakes, cupcakes, and desserts handcrafted for birthdays, weddings, and celebrations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      queryKey: ["products", "featured"],
      queryFn: () => fetchProducts(6),
    });
  },
  component: HomePage,
});

function HomePage() {
  const { data: products } = useSuspenseQuery<ShopifyProduct[]>({
    queryKey: ["products", "featured"],
    queryFn: () => fetchProducts(6),
  });

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-hero">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="max-w-xl">
              <span className="inline-block rounded-full bg-blush px-4 py-1.5 text-xs font-medium text-blush-foreground">
                Handcrafted in Sri Lanka
              </span>
              <h1 className="mt-6 text-4xl font-medium leading-tight text-foreground sm:text-5xl lg:text-6xl">
                Sweet moments, <br />
                <span className="text-primary">beautifully crafted.</span>
              </h1>
              <p className="mt-6 text-lg text-muted-foreground">
                Custom cakes, cupcakes, and desserts made with love for birthdays, weddings, and
                every celebration in between.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Button
                  asChild
                  size="lg"
                  className="rounded-full bg-primary px-8 text-primary-foreground hover:bg-primary/90"
                >
                  <Link to="/menu">Order Online</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="rounded-full border-border px-8 hover:bg-accent"
                >
                  <Link to="/custom-orders">Custom Order</Link>
                </Button>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-[4/3] overflow-hidden rounded-3xl shadow-gold">
                <img
                  src={heroCake}
                  alt="Elegant pink buttercream cake with rose petals and gold leaf"
                  className="h-full w-full object-cover"
                  width={1536}
                  height={1024}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-medium text-foreground sm:text-4xl">From Our Menu</h2>
          <p className="mt-4 text-muted-foreground">A taste of what we bake fresh every day</p>
        </div>

        {products && products.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <ProductCard key={product.node.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-secondary/40 py-16 text-center">
            <p className="text-muted-foreground">
              Our menu is being freshly prepared. Check back soon!
            </p>
            <Button asChild variant="outline" className="mt-4 rounded-full">
              <Link to="/contact">Get in touch</Link>
            </Button>
          </div>
        )}

        <div className="mt-12 text-center">
          <Button
            asChild
            variant="outline"
            size="lg"
            className="rounded-full border-primary px-8 text-primary hover:bg-primary hover:text-primary-foreground"
          >
            <Link to="/menu">View Full Menu</Link>
          </Button>
        </div>
      </section>

      {/* About Teaser */}
      <section className="bg-cream">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-medium text-foreground sm:text-4xl">Baked with Love</h2>
            <p className="mt-6 text-lg text-muted-foreground">
              At SC Frost Heaven, every cake is a little work of art. We use quality ingredients,
              elegant designs, and a whole lot of heart to make your celebrations unforgettable.
            </p>
            <Button
              asChild
              variant="outline"
              className="mt-8 rounded-full border-border hover:bg-accent"
            >
              <Link to="/about">Our Story</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-gradient-rose px-6 py-16 text-center sm:px-12 lg:py-20">
          <h2 className="text-3xl font-medium text-primary-foreground sm:text-4xl">
            Have a dream cake in mind?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-primary-foreground/90">
            Share your vision with us and we&apos;ll create a custom cake that&apos;s uniquely
            yours.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-8 rounded-full bg-background text-foreground hover:bg-background/90"
          >
            <Link to="/custom-orders">Start a Custom Order</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

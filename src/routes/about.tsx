import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import heroCake from "@/assets/hero-cake.jpg";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — SC Frost Heaven" },
      {
        name: "description",
        content: "Learn about SC Frost Heaven, a handcrafted cake boutique in Sri Lanka.",
      },
      { property: "og:title", content: "About — SC Frost Heaven" },
      {
        property: "og:description",
        content: "Learn about SC Frost Heaven, a handcrafted cake boutique in Sri Lanka.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-medium text-foreground sm:text-5xl">About SC Frost Heaven</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Where sweetness meets elegance, one cake at a time
        </p>
      </div>

      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div className="aspect-[4/3] overflow-hidden rounded-3xl shadow-soft">
          <img
            src={heroCake}
            alt="Beautifully decorated cake from SC Frost Heaven"
            className="h-full w-full object-cover"
            width={1536}
            height={1024}
          />
        </div>
        <div className="space-y-6 text-muted-foreground">
          <p className="text-lg leading-relaxed">
            SC Frost Heaven began with a simple love for baking and a passion for making moments
            memorable. What started as a home kitchen hobby has grown into a boutique cake studio
            dedicated to crafting elegant, delicious cakes for every celebration.
          </p>
          <p className="text-lg leading-relaxed">
            We believe every cake should taste as beautiful as it looks. From birthdays and
            weddings to baby showers and intimate gatherings, we pour care, creativity, and the
            finest ingredients into every order.
          </p>
          <p className="text-lg leading-relaxed">
            Our style is soft, feminine, and timeless — inspired by the delicate details that make
            life&apos;s sweetest moments unforgettable.
          </p>
          <Button
            asChild
            className="rounded-full bg-primary px-8 text-primary-foreground hover:bg-primary/90"
          >
            <Link to="/custom-orders">Order a Custom Cake</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { Star } from "lucide-react";

export const Route = createFileRoute("/testimonials")({
  head: () => ({
    meta: [
      { title: "Testimonials — SC Frost Heaven" },
      {
        name: "description",
        content: "Read what customers say about SC Frost Heaven cakes and desserts.",
      },
      { property: "og:title", content: "Testimonials — SC Frost Heaven" },
      {
        property: "og:description",
        content: "Read what customers say about SC Frost Heaven cakes and desserts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TestimonialsPage,
});

function TestimonialsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-medium text-foreground sm:text-5xl">Sweet Words</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          What our customers say about their SC Frost Heaven experience
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl bg-card p-8 shadow-soft">
            <div className="flex gap-1 text-gold">
              {[...Array(5)].map((_, j) => (
                <Star key={j} className="h-4 w-4 fill-current" />
              ))}
            </div>
            <p className="mt-4 italic text-muted-foreground">No reviews yet</p>
            <div className="mt-6">
              <p className="font-medium text-foreground">Customer Name</p>
              <p className="text-sm text-muted-foreground">Occasion</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

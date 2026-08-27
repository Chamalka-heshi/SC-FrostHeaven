import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/custom-orders")({
  head: () => ({
    meta: [
      { title: "Custom Orders — SC Frost Heaven" },
      {
        name: "description",
        content: "Request a custom cake from SC Frost Heaven. Tell us your vision and we'll bring it to life.",
      },
      { property: "og:title", content: "Custom Orders — SC Frost Heaven" },
      {
        property: "og:description",
        content: "Request a custom cake from SC Frost Heaven. Tell us your vision and we'll bring it to life.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CustomOrdersPage,
});

function CustomOrdersPage() {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    toast.success("Custom order request sent! We'll be in touch soon.");
    e.currentTarget.reset();
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-medium text-foreground sm:text-5xl">Custom Orders</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Tell us about your dream cake and we&apos;ll create something unforgettable
        </p>
      </div>

      <form className="space-y-6 rounded-3xl bg-card p-8 shadow-soft">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Your Name</Label>
            <Input id="name" placeholder="Jane Doe" className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="jane@example.com" className="rounded-xl" />
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="event">Event Type</Label>
            <Input id="event" placeholder="Birthday, Wedding, Baby Shower..." className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">Event Date</Label>
            <Input id="date" type="date" className="rounded-xl" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="details">Cake Details</Label>
          <Textarea
            id="details"
            placeholder="Describe your dream cake — flavors, size, colors, theme, and any inspiration..."
            rows={6}
            className="rounded-xl"
          />
        </div>

        <Button
          type="submit"
          className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
          size="lg"
        >
          Send Custom Order Request
        </Button>
      </form>
    </div>
  );
}

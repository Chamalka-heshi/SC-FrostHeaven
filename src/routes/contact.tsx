import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, MapPin, Phone } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — SC Frost Heaven" },
      {
        name: "description",
        content: "Get in touch with SC Frost Heaven for orders, questions, and custom cake inquiries.",
      },
      { property: "og:title", content: "Contact — SC Frost Heaven" },
      {
        property: "og:description",
        content: "Get in touch with SC Frost Heaven for orders, questions, and custom cake inquiries.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    toast.success("Message sent! We'll get back to you soon.");
    e.currentTarget.reset();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-medium text-foreground sm:text-5xl">Get in Touch</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          We&apos;d love to hear from you. Reach out for orders, questions, or just to say hello.
        </p>
      </div>

      <div className="grid gap-12 lg:grid-cols-2">
        <div className="space-y-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blush text-blush-foreground">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">Email</h3>
              <p className="text-muted-foreground">
                <a href="mailto:hello@scfrostheaven.com" className="hover:text-primary">
                  hello@scfrostheaven.com
                </a>
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blush text-blush-foreground">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">Phone</h3>
              <p className="text-muted-foreground">+94 76 123 4567</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blush text-blush-foreground">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">Location</h3>
              <p className="text-muted-foreground">Sri Lanka</p>
            </div>
          </div>
        </div>

        <form className="space-y-6 rounded-3xl bg-card p-8 shadow-soft">
          <div className="space-y-2">
            <Label htmlFor="contact-name">Name</Label>
            <Input id="contact-name" placeholder="Your name" className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-email">Email</Label>
            <Input
              id="contact-email"
              type="email"
              placeholder="your@email.com"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-message">Message</Label>
            <Textarea
              id="contact-message"
              placeholder="How can we help?"
              rows={5}
              className="rounded-xl"
            />
          </div>
          <Button
            type="submit"
            className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
            size="lg"
          >
            Send Message
          </Button>
        </form>
      </div>
    </div>
  );
}

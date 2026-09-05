import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, MapPin, Phone, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

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
  const { user, profile } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Autofill user profile data if available
  useEffect(() => {
    if (profile) {
      if (profile.full_name) setName((prev) => prev || profile.full_name || "");
      if (profile.email) setEmail((prev) => prev || profile.email || "");
      if (profile.phone) setPhone((prev) => prev || profile.phone || "");
    } else if (user?.email) {
      setEmail((prev) => prev || user.email || "");
    }
  }, [profile, user]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Please provide your name.");
      return;
    }
    if (!email.trim()) {
      toast.error("Please provide your email address.");
      return;
    }
    if (!message.trim()) {
      toast.error("Please enter your message.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("contact_inquiries").insert({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        message: message.trim(),
        status: "unread",
      });

      if (error) throw error;

      toast.success("Message sent successfully! Our bakery team will get back to you soon.");
      setMessage("");
      // Retain name/email if user is logged in, otherwise reset
      if (!user) {
        setName("");
        setEmail("");
        setPhone("");
      }
    } catch (err: unknown) {
      console.error("Inquiry submission error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to send message. Please try again or contact us directly.");
    } finally {
      setIsSubmitting(false);
    }
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

        <form onSubmit={handleSubmit} className="space-y-5 rounded-3xl bg-card p-8 shadow-soft border border-border/70">
          <div className="space-y-2">
            <Label htmlFor="contact-name">Name *</Label>
            <Input
              id="contact-name"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-email">Email *</Label>
            <Input
              id="contact-email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-phone">Phone (Optional)</Label>
            <Input
              id="contact-phone"
              type="tel"
              placeholder="+94 77 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-message">Message *</Label>
            <Textarea
              id="contact-message"
              placeholder="How can we help you today?"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              className="rounded-xl resize-none"
            />
          </div>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2 cursor-pointer"
            size="lg"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Sending Message...</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                <span>Send Message</span>
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Upload, X, ImageIcon, CheckCircle2, Copy, Check, ArrowRight, Sparkles, Phone } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { createPageMeta, createBreadcrumbJsonLd } from "@/lib/seo";

export const Route = createFileRoute("/custom-orders")({
  head: () => {
    const { meta, links } = createPageMeta({
      title: "Custom Cake Orders — SC Frost Heaven",
      description:
        "Design and order your dream custom cake with SC Frost Heaven. Share your vision, preferred flavors, and event date for bespoke celebration cakes in Sri Lanka.",
      path: "/custom-orders",
    });

    return {
      meta,
      links,
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(
            createBreadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Custom Orders", path: "/custom-orders" },
            ])
          ),
        },
      ],
    };
  },
  component: CustomOrdersPage,
});

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

interface ImagePreview {
  id: string;
  file: File;
  url: string;
}

function CustomOrdersPage() {
  const { user, profile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<ImagePreview[]>([]);
  const [submittedOrder, setSubmittedOrder] = useState<{
    id: string;
    event: string;
    date: string;
    contact?: string;
  } | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URLs when previews change or component unmounts
  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [previews]);

  const handleCopyOrderId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    toast.success("Order reference copied to clipboard");
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const validFiles: File[] = [];
    const newPreviews: ImagePreview[] = [];

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        toast.error(`"${file.name}" is not an image file. Only image formats are accepted.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast.error(`"${file.name}" exceeds the 5MB file size limit.`);
        continue;
      }
      validFiles.push(file);
      newPreviews.push({
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        url: URL.createObjectURL(file),
      });
    }

    setSelectedFiles((prev) => [...prev, ...validFiles]);
    setPreviews((prev) => [...prev, ...newPreviews]);

    // Reset input value so the same file can be selected again if removed
    e.target.value = "";
  };

  const handleRemoveFile = (indexToRemove: number) => {
    const previewToRemove = previews[indexToRemove];
    if (previewToRemove) {
      URL.revokeObjectURL(previewToRemove.url);
    }
    setSelectedFiles((prev) => prev.filter((_, i) => i !== indexToRemove));
    setPreviews((prev) => prev.filter((_, i) => i !== indexToRemove));
  };

  const clearFiles = () => {
    previews.forEach((p) => URL.revokeObjectURL(p.url));
    setSelectedFiles([]);
    setPreviews([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    const form = e.currentTarget;
    const formData = new FormData(form);

    const name = ((formData.get("name") as string) || "").trim();
    const email = ((formData.get("email") as string) || "").trim();
    const phone = ((formData.get("phone") as string) || "").trim();
    const event = ((formData.get("event") as string) || "").trim();
    const date = ((formData.get("date") as string) || "").trim();
    const details = ((formData.get("details") as string) || "").trim();

    // 1. Validate required name
    if (!name) {
      toast.error("Please enter your name.");
      return;
    }

    // 2. Validate required and valid email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    // 3. Validate required event type
    if (!event) {
      toast.error("Please enter the event type.");
      return;
    }

    // 4. Validate required event date
    if (!date) {
      toast.error("Please select an event date.");
      return;
    }

    // 5. Validate event date must be in the future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(date);
    if (isNaN(selectedDate.getTime()) || selectedDate <= today) {
      toast.error("Event date must be in the future.");
      return;
    }

    // 6. Validate required cake details
    if (!details) {
      toast.error("Please describe your cake details.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Check current Supabase auth session
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      const customerId = currentUser?.id ?? user?.id ?? null;

      // 1. Generate the custom order UUID before inserting
      const orderId = crypto.randomUUID();

      // 2. Insert into public.custom_orders with client-generated ID (no .select needed)
      const { error: orderError } = await supabase.from("custom_orders").insert({
        id: orderId,
        customer_id: customerId,
        customer_name: name,
        customer_email: email.toLowerCase(),
        customer_phone: phone || null,
        event_type: event,
        event_date: date,
        cake_details: details,
      });

      if (orderError) {
        console.error("Supabase insert error:", orderError);
        toast.error(
          orderError.message || "Failed to submit your custom order request. Please try again.",
        );
        return;
      }

      // 2. Upload reference images if any were selected
      if (selectedFiles.length > 0) {
        let uploadedImagesCount = 0;
        const uploadErrors: string[] = [];

        for (const file of selectedFiles) {
          const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
          const sanitizedBaseName = file.name
            .replace(/\.[^/.]+$/, "")
            .replace(/[^a-zA-Z0-9_-]/g, "_")
            .slice(0, 30);
          const uniqueFileName = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}_${sanitizedBaseName}.${fileExt}`;
          const storagePath = `orders/${orderId}/${uniqueFileName}`;

          // Upload image binary to Supabase Storage bucket 'cake-references'
          const { error: storageError } = await supabase.storage
            .from("cake-references")
            .upload(storagePath, file, {
              contentType: file.type,
              upsert: false,
            });

          if (storageError) {
            console.error(`Storage upload error for ${file.name}:`, storageError);
            uploadErrors.push(file.name);
            continue;
          }

          // Insert reference record into public.custom_order_images
          const { error: imageRecordError } = await supabase.from("custom_order_images").insert({
            order_id: orderId,
            storage_path: storagePath,
            file_name: file.name,
            file_size_bytes: file.size,
          });

          if (imageRecordError) {
            console.error(
              `custom_order_images record insert error for ${file.name}:`,
              imageRecordError,
            );
            uploadErrors.push(file.name);
          } else {
            uploadedImagesCount++;
          }
        }

        if (uploadErrors.length > 0) {
          if (uploadedImagesCount === 0) {
            toast.error(
              `Custom order created, but photo uploads failed (${uploadErrors.join(", ")}). Our team will contact you for references.`,
            );
          } else {
            toast.warning(
              `Custom order created with ${uploadedImagesCount} of ${selectedFiles.length} photos uploaded.`,
            );
          }
        } else {
          toast.success("Custom order request sent! We'll be in touch soon.");
        }
      } else {
        toast.success("Custom order request sent! We'll be in touch soon.");
      }

      // 3. Clear files and set submitted state
      clearFiles();
      setSubmittedOrder({
        id: orderId,
        event,
        date,
        contact: email.trim(),
      });
    } catch (err) {
      console.error("Unexpected error submitting custom order:", err);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-medium text-foreground sm:text-5xl">Custom Orders</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Tell us about your dream cake and we&apos;ll create something unforgettable
        </p>
      </div>

      {submittedOrder ? (
        <div className="space-y-6 rounded-3xl bg-card p-8 shadow-soft border border-border text-center animate-in fade-in zoom-in-95">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-600">
            <CheckCircle2 className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-foreground">
              Request Received Successfully!
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              Thank you for ordering with SC Frost Heaven. Our bakery team is reviewing your celebration cake details and will issue your formal quotation shortly.
            </p>
          </div>

          {/* Reference Card */}
          <div className="rounded-2xl bg-secondary/30 p-4 border border-border/60 max-w-md mx-auto text-left text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Order Reference:</span>
              <div className="flex items-center gap-1.5 font-mono font-bold text-foreground">
                <span>#{submittedOrder.id.slice(0, 8).toUpperCase()}</span>
                <button
                  type="button"
                  onClick={() => handleCopyOrderId(submittedOrder.id)}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title="Copy full Order ID"
                >
                  {copiedId ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Occasion:</span>
              <span className="font-semibold text-foreground">{submittedOrder.event} Cake</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Event Date:</span>
              <span className="font-medium text-foreground">{submittedOrder.date}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button
              asChild
              className="w-full sm:w-auto rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-6 h-11 gap-2 font-semibold shadow-xs cursor-pointer"
            >
              <Link
                to="/track-order"
                search={{
                  orderId: submittedOrder.id,
                  contact: submittedOrder.contact,
                }}
              >
                <span>Track Order Live</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            {user && (
              <Button
                asChild
                variant="outline"
                className="w-full sm:w-auto rounded-full px-6 h-11 cursor-pointer text-xs"
              >
                <Link to="/account" search={{ orderId: submittedOrder.id }}>
                  View in My Account
                </Link>
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => setSubmittedOrder(null)}
              className="w-full sm:w-auto rounded-full px-6 h-11 cursor-pointer text-xs"
            >
              Submit Another Request
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl bg-card p-8 shadow-soft">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Your Name</Label>
              <Input
                id="name"
                name="name"
                defaultValue={profile?.full_name || ""}
                placeholder="Jane Doe"
                className="rounded-xl"
                disabled={isSubmitting}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={user?.email || ""}
                placeholder="jane@example.com"
                className="rounded-xl"
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">
                Contact Phone / WhatsApp <span className="text-xs text-muted-foreground">(Optional)</span>
              </Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={profile?.phone || ""}
                placeholder="+94 70 241 1623"
                className="rounded-xl"
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event">Event Type</Label>
              <Input
                id="event"
                name="event"
                placeholder="Birthday, Wedding, Anniversary..."
                className="rounded-xl"
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Event Date</Label>
            <Input
              id="date"
              name="date"
              type="date"
              className="rounded-xl"
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="details">Cake Details</Label>
            <Textarea
              id="details"
              name="details"
              placeholder="Describe your dream cake — flavors, tier size, colors, theme, messages, and any dietary preferences..."
              rows={5}
              className="rounded-xl"
              disabled={isSubmitting}
              required
            />
          </div>

          {/* Reference Image Upload Field */}
          <div className="space-y-2">
            <Label htmlFor="images">Reference & Inspiration Photos (Optional)</Label>
            <div className="rounded-2xl border border-dashed border-border/80 bg-secondary/20 p-4 transition-colors hover:bg-secondary/30">
              <input
                ref={fileInputRef}
                id="images"
                type="file"
                accept="image/*"
                multiple
                disabled={isSubmitting}
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="flex flex-col items-center justify-center gap-2 py-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Upload className="h-6 w-6" />
                </div>
                <div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isSubmitting}
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                  >
                    Click to select reference photos
                  </Button>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    JPG, PNG, WebP up to 5MB each. You can select multiple images.
                  </p>
                </div>
              </div>

              {/* Selected Files Preview Grid */}
              {selectedFiles.length > 0 && (
                <div className="mt-4 border-t border-border/60 pt-4 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <ImageIcon className="h-3.5 w-3.5 text-primary" />
                      Attached Photos ({selectedFiles.length})
                    </span>
                    <button
                      type="button"
                      onClick={clearFiles}
                      disabled={isSubmitting}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                    >
                      Remove all
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                    {selectedFiles.map((file, index) => (
                      <div
                        key={`${file.name}-${index}`}
                        className="group relative aspect-square overflow-hidden rounded-xl bg-muted border border-border/60 shadow-xs"
                      >
                        <img
                          src={previews[index]?.url}
                          alt={file.name || `Reference image ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(index)}
                          disabled={isSubmitting}
                          aria-label={`Remove ${file.name}`}
                          className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm hover:bg-destructive hover:text-destructive-foreground transition-colors cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <div className="absolute bottom-0 inset-x-0 bg-background/90 backdrop-blur-xs px-1.5 py-0.5 text-[10px] text-foreground truncate text-center">
                          {file.name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <Button
            type="submit"
            className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-soft font-semibold h-11"
            size="lg"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting Request...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Send Custom Order Request
              </>
            )}
          </Button>
        </form>
      )}
    </div>
  );
}

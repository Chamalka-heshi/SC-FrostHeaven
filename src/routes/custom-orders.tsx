import { useState, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Upload, X, ImageIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";

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

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

interface ImagePreview {
  id: string;
  file: File;
  url: string;
}

function CustomOrdersPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<ImagePreview[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URLs when previews change or component unmounts
  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [previews]);

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

    const name = (formData.get("name") as string || "").trim();
    const email = (formData.get("email") as string || "").trim();
    const event = (formData.get("event") as string || "").trim();
    const date = (formData.get("date") as string || "").trim();
    const details = (formData.get("details") as string || "").trim();

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
        data: { user },
      } = await supabase.auth.getUser();

      const customerId = user?.id ?? null;

      // 1. Generate the custom order UUID before inserting
      const orderId = crypto.randomUUID();

      // 2. Insert into public.custom_orders with client-generated ID (no .select needed)
      const { error: orderError } = await supabase.from("custom_orders").insert({
        id: orderId,
        customer_id: customerId,
        customer_name: name,
        customer_email: email.toLowerCase(),
        customer_phone: null,
        event_type: event,
        event_date: date,
        cake_details: details,
      });

      if (orderError) {
        console.error("Supabase insert error:", orderError);
        toast.error(orderError.message || "Failed to submit your custom order request. Please try again.");
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
          const { error: imageRecordError } = await supabase
            .from("custom_order_images")
            .insert({
              order_id: orderId,
              storage_path: storagePath,
              file_name: file.name,
              file_size_bytes: file.size,
            });

          if (imageRecordError) {
            console.error(`custom_order_images record insert error for ${file.name}:`, imageRecordError);
            uploadErrors.push(file.name);
          } else {
            uploadedImagesCount++;
          }
        }

        if (uploadErrors.length > 0) {
          if (uploadedImagesCount === 0) {
            toast.error(
              `Custom order created, but photo uploads failed (${uploadErrors.join(", ")}). Our team will contact you for references.`
            );
          } else {
            toast.warning(
              `Custom order created with ${uploadedImagesCount} of ${selectedFiles.length} photos uploaded.`
            );
          }
        } else {
          toast.success("Custom order request sent! We'll be in touch soon.");
        }
      } else {
        toast.success("Custom order request sent! We'll be in touch soon.");
      }

      // 3. Reset form and file selection after successful order completion
      clearFiles();
      form.reset();
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

      <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl bg-card p-8 shadow-soft">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Your Name</Label>
            <Input
              id="name"
              name="name"
              placeholder="Jane Doe"
              className="rounded-xl"
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="jane@example.com"
              className="rounded-xl"
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="event">Event Type</Label>
            <Input
              id="event"
              name="event"
              placeholder="Birthday, Wedding, Baby Shower..."
              className="rounded-xl"
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">Event Date</Label>
            <Input
              id="date"
              name="date"
              type="date"
              className="rounded-xl"
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="details">Cake Details</Label>
          <Textarea
            id="details"
            name="details"
            placeholder="Describe your dream cake — flavors, size, colors, theme, and any inspiration..."
            rows={6}
            className="rounded-xl"
            disabled={isSubmitting}
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
            <label
              htmlFor="images"
              className={`flex flex-col items-center justify-center py-4 text-center ${
                isSubmitting ? "cursor-not-allowed opacity-60" : "cursor-pointer"
              }`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/80 text-primary mb-2">
                <Upload className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium text-foreground">
                Click to browse reference photos
              </span>
              <span className="text-xs text-muted-foreground mt-1">
                PNG, JPG, WEBP up to 5MB each (multiple photos supported)
              </span>
            </label>

            {/* Selected Images Preview Grid */}
            {selectedFiles.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border/40">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5" />
                    {selectedFiles.length} photo{selectedFiles.length !== 1 ? "s" : ""} selected
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
                        alt={file.name}
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
          className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
          size="lg"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending Request...
            </>
          ) : (
            "Send Custom Order Request"
          )}
        </Button>
      </form>
    </div>
  );
}

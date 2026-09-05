import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Star, MessageSquare, Loader2, X, Sparkles, LogIn, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

interface ReviewSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const COMMON_OCCASIONS = [
  "Birthday",
  "Wedding",
  "Anniversary",
  "Baby Shower",
  "Celebration",
  "Custom Order",
];

const RATING_LABELS: Record<number, string> = {
  1: "1 Star — Poor",
  2: "2 Stars — Fair",
  3: "3 Stars — Good",
  4: "4 Stars — Very Good",
  5: "5 Stars — Outstanding!",
};

export function ReviewSubmissionModal({ isOpen, onClose, onSuccess }: ReviewSubmissionModalProps) {
  const { user, profile, loading: authLoading } = useAuth();

  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [occasion, setOccasion] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setRating(5);
      setHoverRating(null);
      setComment("");
      setOccasion("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!user) {
      toast.error("Please sign in to your account to submit a review.");
      return;
    }

    if (!rating || rating < 1 || rating > 5) {
      toast.error("Please select a star rating between 1 and 5.");
      return;
    }

    const trimmedComment = comment.trim();
    if (!trimmedComment || trimmedComment.length < 5) {
      toast.error("Please provide a review comment (minimum 5 characters).");
      return;
    }

    const customerName =
      profile?.full_name?.trim() ||
      (typeof user.user_metadata?.["full_name"] === "string" ? user.user_metadata["full_name"].trim() : "") ||
      user.email?.split("@")[0] ||
      "Valued Customer";

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("reviews").insert({
        customer_id: user.id,
        customer_name: customerName,
        rating,
        comment: trimmedComment,
        occasion: occasion.trim() || null,
        is_approved: false, // Strict: newly submitted reviews always default to pending approval
      });

      if (error) throw error;

      toast.success("Thank you for your review! It has been submitted for approval by our bakery team.");
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error("Review submission error:", err);
      toast.error(err instanceof Error ? err.message : "Unable to submit your review. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
      <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col rounded-3xl bg-card shadow-soft border border-border/80 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-5 bg-card sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blush text-primary shadow-xs">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-foreground">Share Your Experience</h2>
              <p className="text-xs text-muted-foreground">
                Tell us about your celebration with SC Frost Heaven
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/80 text-foreground hover:bg-secondary transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {authLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <p className="text-xs text-muted-foreground">Checking authentication...</p>
            </div>
          ) : !user ? (
            /* Unauthenticated Prompt */
            <div className="rounded-3xl bg-secondary/30 p-6 text-center border border-border/60 space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blush text-primary">
                <LogIn className="h-6 w-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-semibold text-foreground">Sign In to Leave a Review</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  To ensure genuine feedback, please sign in or create an account to share your cake experience with our community.
                </p>
              </div>
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
                <Button asChild className="rounded-full w-full sm:w-auto px-6 bg-primary text-primary-foreground hover:bg-primary/90">
                  <Link to="/login" onClick={onClose}>
                    Sign In
                  </Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full w-full sm:w-auto px-6 border-border/80">
                  <Link to="/register" onClick={onClose}>
                    Create Account
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            /* Authenticated Review Form */
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Reviewer identity badge */}
              <div className="rounded-2xl bg-secondary/20 p-3.5 border border-border/50 flex items-center justify-between text-xs">
                <div>
                  <span className="text-muted-foreground">Reviewing as:</span>
                  <p className="font-semibold text-foreground mt-0.5">
                    {profile?.full_name || user.email}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" />
                  Verified Account
                </span>
              </div>

              {/* Star Rating Selector */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Overall Rating <span className="text-destructive">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((starValue) => {
                      const isFilled = (hoverRating !== null ? hoverRating : rating) >= starValue;
                      return (
                        <button
                          key={starValue}
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => setRating(starValue)}
                          onMouseEnter={() => setHoverRating(starValue)}
                          onMouseLeave={() => setHoverRating(null)}
                          className="p-1 text-amber-500 hover:scale-110 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg cursor-pointer"
                          aria-label={`${starValue} star${starValue > 1 ? "s" : ""}`}
                        >
                          <Star
                            className={`h-7 w-7 transition-colors ${
                              isFilled ? "fill-amber-500 text-amber-500" : "text-muted-foreground/30"
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-xs font-medium text-foreground ml-2">
                    {RATING_LABELS[hoverRating ?? rating]}
                  </span>
                </div>
              </div>

              {/* Occasion / Celebration Type */}
              <div className="space-y-2">
                <Label htmlFor="occasion-input" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Celebration Occasion (Optional)
                </Label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {COMMON_OCCASIONS.map((occ) => (
                    <button
                      key={occ}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setOccasion(occasion === occ ? "" : occ)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                        occasion === occ
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      {occ}
                    </button>
                  ))}
                </div>
                <Input
                  id="occasion-input"
                  placeholder="Or enter custom occasion (e.g. Graduation, Corporate Gala)..."
                  value={occasion}
                  onChange={(e) => setOccasion(e.target.value)}
                  disabled={isSubmitting}
                  className="rounded-xl bg-secondary/20 border-border/70 text-xs"
                  maxLength={50}
                />
              </div>

              {/* Review Comment Textarea */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="comment-textarea" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Your Review <span className="text-destructive">*</span>
                  </Label>
                  <span className="text-[10px] text-muted-foreground">
                    {comment.length} / 1000 characters
                  </span>
                </div>
                <Textarea
                  id="comment-textarea"
                  placeholder="Tell us about your cake — flavor, design, freshness, presentation, and how your guests enjoyed it..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={isSubmitting}
                  rows={4}
                  className="rounded-2xl bg-secondary/20 border-border/70 text-sm leading-relaxed"
                  maxLength={1000}
                  required
                />
              </div>

              {/* Moderation notice */}
              <div className="rounded-2xl bg-blush/30 p-3.5 border border-blush/50 text-[11px] text-muted-foreground">
                <p>
                  To maintain quality, submitted reviews undergo a quick moderation check before appearing publicly on our testimonials page.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={onClose}
                  className="rounded-full text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !comment.trim()}
                  className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-6 text-xs cursor-pointer shadow-xs"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    "Submit Review"
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

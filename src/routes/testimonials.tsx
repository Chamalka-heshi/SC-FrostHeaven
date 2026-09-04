import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Star, MessageSquare, Loader2, Sparkles, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { ReviewSubmissionModal } from "@/components/review-submission-modal";

export const Route = createFileRoute("/testimonials")({
  head: () => ({
    meta: [
      { title: "Testimonials — SC Frost Heaven" },
      {
        name: "description",
        content: "Read what customers say about SC Frost Heaven cakes and desserts handcrafted in Sri Lanka.",
      },
      { property: "og:title", content: "Testimonials — SC Frost Heaven" },
      {
        property: "og:description",
        content: "Read what customers say about SC Frost Heaven cakes and desserts handcrafted in Sri Lanka.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TestimonialsPage,
});

interface PublicReview {
  id: string;
  customer_name: string;
  rating: number;
  comment: string;
  occasion: string | null;
  created_at: string;
}

function TestimonialsPage() {
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchApprovedReviews = async () => {
    try {
      const { data, error } = await supabase
        .from("reviews")
        .select("id, customer_name, rating, comment, occasion, created_at")
        .eq("is_approved", true)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("Could not load reviews:", error.message);
      } else {
        setReviews((data as PublicReview[]) || []);
      }
    } catch (err) {
      console.warn("Unexpected error loading reviews:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovedReviews();
  }, []);

  const formatDate = (dateStr: string) => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 space-y-12">
      {/* Header with Title & Review CTA */}
      <div className="text-center max-w-2xl mx-auto space-y-4">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blush px-3.5 py-1 text-xs font-semibold text-blush-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          Customer Stories
        </span>
        <h1 className="text-4xl font-medium text-foreground sm:text-5xl">Sweet Words</h1>
        <p className="text-base text-muted-foreground sm:text-lg">
          What our wonderful customers say about their handcrafted SC Frost Heaven cakes and desserts.
        </p>
        <div className="pt-2 flex justify-center">
          <Button
            onClick={() => setIsModalOpen(true)}
            className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-6 gap-2 shadow-xs cursor-pointer"
          >
            <PenLine className="h-4 w-4" />
            <span>Share Your Experience</span>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
          <p className="text-sm text-muted-foreground">Loading customer testimonials...</p>
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-3xl bg-card p-12 text-center shadow-soft border border-border/60 max-w-md mx-auto space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
            <MessageSquare className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-medium text-foreground">No reviews yet</h3>
            <p className="text-xs text-muted-foreground">
              Be the first to share your celebration experience with our community!
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button
              onClick={() => setIsModalOpen(true)}
              className="rounded-full text-xs bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
            >
              Write a Review
            </Button>
            <Button asChild variant="outline" className="rounded-full text-xs">
              <Link to="/custom-orders">Order a Custom Cake</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="flex flex-col justify-between rounded-3xl bg-card p-7 shadow-soft border border-border/70 hover:border-primary/40 hover:shadow-md transition-all"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex gap-1 text-amber-500">
                    {[...Array(5)].map((_, j) => (
                      <Star
                        key={j}
                        className={`h-4 w-4 ${
                          j < review.rating ? "fill-amber-500 text-amber-500" : "text-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </div>
                  {review.occasion && (
                    <span className="rounded-full bg-blush/60 px-2.5 py-0.5 text-[11px] font-semibold text-blush-foreground">
                      {review.occasion}
                    </span>
                  )}
                </div>

                <p className="text-sm text-foreground/90 leading-relaxed italic">
                  &ldquo;{review.comment}&rdquo;
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-border/40 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-foreground">{review.customer_name}</p>
                  <p className="text-[11px] text-muted-foreground">{formatDate(review.created_at)}</p>
                </div>
                <span className="text-[11px] font-medium text-primary">Verified Order</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Call to action */}
      <div className="rounded-3xl bg-gradient-rose px-6 py-12 text-center text-primary-foreground sm:px-12">
        <h2 className="text-2xl font-medium sm:text-3xl">Ready to create your own sweet memory?</h2>
        <p className="mt-2 text-sm text-primary-foreground/90 max-w-xl mx-auto">
          From birthdays to weddings, our artisan bakers are ready to bring your dream cake to life.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="rounded-full bg-background text-foreground hover:bg-background/90 shadow-md">
            <Link to="/custom-orders">Start Your Custom Order</Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => setIsModalOpen(true)}
            className="rounded-full border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10 cursor-pointer"
          >
            Leave a Review
          </Button>
        </div>
      </div>

      {/* Review Submission Modal */}
      <ReviewSubmissionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}

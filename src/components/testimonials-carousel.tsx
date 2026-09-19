import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Star, Sparkles, MessageSquare, PenLine, ChevronRight, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { ReviewSubmissionModal } from "@/components/review-submission-modal";

interface PublicReview {
  id: string;
  customer_name: string;
  rating: number;
  comment: string;
  occasion: string | null;
  created_at: string;
}

const FALLBACK_REVIEWS: PublicReview[] = [
  {
    id: "fallback-1",
    customer_name: "Niluka Perera",
    rating: 5,
    comment:
      "The 3-tier wedding cake was absolute perfection! The buttercream floral details matched our theme flawlessly and tasted divine. Our guests are still raving about it.",
    occasion: "Wedding",
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: "fallback-2",
    customer_name: "Kasun Jayawardena",
    rating: 5,
    comment:
      "Ordered the Chocolate Indulgence cake for my daughter's 18th birthday. Incredibly moist and rich without being overly sweet. Best bakery in Mirissa / Matara by far!",
    occasion: "18th Birthday",
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    id: "fallback-3",
    customer_name: "Dr. Amanda Wickramasinghe",
    rating: 5,
    comment:
      "Superb custom design! The attention to detail, timely preparation, and seamless online receipt/tracking made the whole experience so stress-free.",
    occasion: "Anniversary Celebration",
    created_at: new Date(Date.now() - 12 * 86400000).toISOString(),
  },
];

export function TestimonialsCarousel() {
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadApprovedReviews() {
      try {
        const { data, error } = await supabase
          .from("reviews")
          .select("id, customer_name, rating, comment, occasion, created_at")
          .eq("is_approved", true)
          .order("rating", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(6);

        if (!error && data && data.length > 0) {
          if (isMounted) setReviews(data as PublicReview[]);
        } else {
          if (isMounted) setReviews(FALLBACK_REVIEWS);
        }
      } catch (err) {
        console.warn("Could not fetch reviews for homepage, using featured:", err);
        if (isMounted) setReviews(FALLBACK_REVIEWS);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadApprovedReviews();

    return () => {
      isMounted = false;
    };
  }, []);

  const displayReviews = reviews.length > 0 ? reviews : FALLBACK_REVIEWS;

  return (
    <section className="bg-cream/60 py-20 border-y border-border/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="max-w-xl space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blush px-3.5 py-1 text-xs font-semibold text-blush-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Loved by Our Community
            </span>
            <h2 className="text-3xl font-medium text-foreground sm:text-4xl">
              Celebrations Made Sweeter
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base">
              Real feedback and sweet moments from customers who trusted us with their special occasions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => setIsReviewModalOpen(true)}
              variant="outline"
              className="rounded-full border-border hover:bg-primary/10 hover:text-primary gap-1.5 text-xs font-semibold cursor-pointer"
            >
              <PenLine className="h-3.5 w-3.5 text-primary" />
              <span>Leave a Review</span>
            </Button>
            <Button
              asChild
              className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold gap-1.5 shadow-xs cursor-pointer"
            >
              <Link to="/testimonials">
                <span>View All Reviews</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Reviews Cards Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {displayReviews.slice(0, 3).map((review) => (
            <div
              key={review.id}
              className="relative flex flex-col justify-between rounded-3xl bg-card p-6 shadow-soft border border-border/70 hover:border-primary/40 hover:shadow-md transition-all duration-300"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  {/* Star Rating */}
                  <div className="flex gap-1 text-amber-500">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${
                          i < review.rating ? "fill-amber-400 text-amber-400" : "text-border"
                        }`}
                      />
                    ))}
                  </div>

                  {review.occasion && (
                    <span className="rounded-full bg-secondary/80 px-2.5 py-0.5 text-[11px] font-medium text-secondary-foreground border border-border/50">
                      {review.occasion}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <Quote className="h-6 w-6 text-primary/20 absolute -top-2 -left-1 pointer-events-none" />
                  <p className="text-sm text-foreground/90 leading-relaxed pt-2 italic">
                    &ldquo;{review.comment}&rdquo;
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-border/50 flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-xs text-foreground">{review.customer_name}</h4>
                  <span className="text-[10px] text-muted-foreground">Verified Customer</span>
                </div>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {new Date(review.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Review Submission Modal */}
      <ReviewSubmissionModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        onSuccess={() => {
          setIsReviewModalOpen(false);
        }}
      />
    </section>
  );
}

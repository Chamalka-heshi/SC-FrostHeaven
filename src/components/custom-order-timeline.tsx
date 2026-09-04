import { CheckCircle2, Clock, Sparkles, ChefHat, PackageCheck, AlertCircle, XCircle, FileText } from "lucide-react";

export interface CustomOrderTimelineProps {
  status: string;
  className?: string;
  showExplanation?: boolean;
}

interface TimelineStage {
  id: number;
  label: string;
  shortLabel: string;
  icon: typeof Clock;
  description: string;
  matchingStatuses: string[];
}

const TIMELINE_STAGES: TimelineStage[] = [
  {
    id: 1,
    label: "Request Submitted",
    shortLabel: "Submitted",
    icon: FileText,
    description: "Request received",
    matchingStatuses: ["submitted"],
  },
  {
    id: 2,
    label: "Bakery Review",
    shortLabel: "Review",
    icon: Clock,
    description: "Reviewing design & date",
    matchingStatuses: ["under_review"],
  },
  {
    id: 3,
    label: "Quoted & Confirmed",
    shortLabel: "Confirmed",
    icon: Sparkles,
    description: "Quote ready or confirmed",
    matchingStatuses: ["quoted", "accepted"],
  },
  {
    id: 4,
    label: "In Baking & Decorating",
    shortLabel: "Baking",
    icon: ChefHat,
    description: "Artisan kitchen production",
    matchingStatuses: ["in_baking"],
  },
  {
    id: 5,
    label: "Ready / Completed",
    shortLabel: "Ready",
    icon: PackageCheck,
    description: "Pickup, delivery or fulfilled",
    matchingStatuses: ["ready", "completed"],
  },
];

export const STATUS_LABELS: Record<string, string> = {
  submitted: "Request Submitted",
  under_review: "Bakery Review",
  quoted: "Quote Ready",
  accepted: "Order Confirmed",
  in_baking: "In Baking & Decorating",
  ready: "Ready for Pickup / Delivery",
  completed: "Completed",
  declined: "Declined",
  cancelled: "Cancelled",
};

export const STATUS_EXPLANATIONS: Record<string, string> = {
  submitted:
    "Your request has been received. Our bakery team will review your cake details and event date.",
  under_review:
    "Our bakery team is reviewing your design, requirements, and event date availability.",
  quoted:
    "Your cake request has been reviewed and a quotation or instructions are available below.",
  accepted:
    "Your order has been confirmed and is scheduled for preparation.",
  in_baking:
    "Your cake is currently being prepared and decorated by our bakery team.",
  ready:
    "Your cake is ready for pickup or delivery.",
  completed:
    "Your custom cake order has been completed.",
  declined:
    "We are unable to fulfill this custom order request at this time.",
  cancelled:
    "This custom order request has been cancelled.",
};

function getStageIndex(status: string): number {
  const s = status.toLowerCase();
  if (s === "submitted") return 0;
  if (s === "under_review") return 1;
  if (s === "quoted" || s === "accepted") return 2;
  if (s === "in_baking") return 3;
  if (s === "ready" || s === "completed") return 4;
  return -1; // terminal or unknown
}

export function CustomOrderTimeline({
  status,
  className = "",
  showExplanation = true,
}: CustomOrderTimelineProps) {
  const s = status.toLowerCase();
  const isTerminal = s === "declined" || s === "cancelled";
  const currentStageIndex = getStageIndex(s);
  const explanation = STATUS_EXPLANATIONS[s] || "Order details are being processed.";

  if (isTerminal) {
    const isDeclined = s === "declined";
    return (
      <div className={`space-y-3 ${className}`}>
        <div
          className={`flex items-start gap-3 rounded-2xl p-4 border text-xs ${
            isDeclined
              ? "bg-rose-500/10 border-rose-500/20 text-rose-800 dark:text-rose-300"
              : "bg-zinc-500/10 border-zinc-500/20 text-zinc-800 dark:text-zinc-300"
          }`}
        >
          {isDeclined ? (
            <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
          ) : (
            <XCircle className="h-5 w-5 text-zinc-600 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <h4 className="font-semibold text-sm">
              {isDeclined ? "Order Request Declined" : "Order Request Cancelled"}
            </h4>
            <p className="mt-1 text-xs opacity-90 leading-relaxed">{explanation}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 5-Stage Stepper Container */}
      <nav aria-label="Order Progress" className="w-full">
        <ol className="grid grid-cols-5 gap-1.5 sm:gap-2">
          {TIMELINE_STAGES.map((stage, idx) => {
            const isCompleted = currentStageIndex > idx;
            const isCurrent = currentStageIndex === idx;
            const isUpcoming = currentStageIndex < idx;

            const Icon = stage.icon;

            return (
              <li
                key={stage.id}
                className="relative flex flex-col items-center text-center"
                aria-current={isCurrent ? "step" : undefined}
              >
                {/* Connecting Line between steps */}
                {idx > 0 && (
                  <div
                    className={`absolute top-4 -left-1/2 right-1/2 h-0.5 -z-1 transition-colors ${
                      currentStageIndex >= idx ? "bg-primary" : "bg-border/60"
                    }`}
                    aria-hidden="true"
                  />
                )}

                {/* Stage Icon Node */}
                <div
                  className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full transition-all ${
                    isCompleted
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : isCurrent
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/20 shadow-sm animate-pulse"
                      : "bg-secondary text-muted-foreground/60 border border-border/60"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
                  ) : (
                    <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  )}
                </div>

                {/* Stage Label */}
                <div className="mt-2 space-y-0.5">
                  <span
                    className={`block text-[11px] sm:text-xs font-medium leading-tight ${
                      isCurrent
                        ? "text-primary font-bold"
                        : isCompleted
                        ? "text-foreground font-semibold"
                        : "text-muted-foreground/70"
                    }`}
                  >
                    <span className="hidden sm:inline">{stage.label}</span>
                    <span className="sm:hidden">{stage.shortLabel}</span>
                  </span>
                  <span className="hidden md:block text-[10px] text-muted-foreground/80 leading-tight">
                    {stage.description}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Current Contextual Status Explanation Banner */}
      {showExplanation && (
        <div className="rounded-2xl bg-secondary/30 p-3.5 sm:p-4 border border-border/60 text-xs">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-primary animate-ping" />
            <span className="font-semibold text-foreground">
              Current Stage: {STATUS_LABELS[s] || status}
            </span>
          </div>
          <p className="mt-1 text-muted-foreground leading-relaxed pl-4">{explanation}</p>
        </div>
      )}
    </div>
  );
}

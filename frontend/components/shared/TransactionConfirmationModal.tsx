import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PathStep } from "@/types";
import {
  TransactionStatus,
  TransactionTimelineEvent,
  TimelineEventState,
  TimelinePhase,
} from "@/types/transaction";
import {
  ArrowDown,
  CheckCircle2,
  XCircle,
  Loader2,
  Wallet,
  ExternalLink,
  ChevronRight,
  Clock3,
  ShieldCheck,
} from "lucide-react";

interface TransactionTimelineLocale {
  timelineLabel: string;
  timelineDescription: string;
  phaseLabel: Record<TimelinePhase, string>;
  stateLabel: Record<TimelineEventState, string>;
  sourceLabel: {
    wallet: string;
    api: string;
    chain: string;
  };
  titleMap: Record<string, string>;
  descriptionMap: Record<string, string>;
  details: {
    walletRequestId: string;
    apiRequestId: string;
    txHash: string;
    replacedTxHash: string;
    attempt: string;
  };
}

const DEFAULT_LOCALE: TransactionTimelineLocale = {
  timelineLabel: "Transaction timeline",
  timelineDescription:
    "Live transaction lifecycle from wallet signature to chain finality.",
  phaseLabel: {
    signature: "Wallet Signature",
    submit: "API Submission",
    inclusion: "Chain Inclusion",
    finality: "Finality",
  },
  stateLabel: {
    active: "In progress",
    success: "Completed",
    failed: "Failed",
    retrying: "Retrying",
  },
  sourceLabel: {
    wallet: "Wallet",
    api: "API",
    chain: "Chain",
  },
  titleMap: {
    "timeline.signature.requested": "Awaiting wallet approval",
    "timeline.signature.approved": "Wallet signature approved",
    "timeline.submit.requested": "Submitting transaction request",
    "timeline.submit.retry": "Submission retry in progress",
    "timeline.submit.accepted": "Submission accepted",
    "timeline.submit.replaced": "Replacement transaction submitted",
    "timeline.inclusion.pending": "Waiting for block inclusion",
    "timeline.inclusion.confirmed": "Transaction included on-chain",
    "timeline.finality.pending": "Awaiting finality confirmations",
    "timeline.finality.confirmed": "Transaction reached finality",
    "timeline.finality.failed": "Finality failed",
  },
  descriptionMap: {
    "timeline.signature.requested": "Confirm this swap in your wallet to continue.",
    "timeline.submit.requested": "Forwarding the signed payload to the API service.",
    "timeline.submit.retry": "A transient error occurred, automatically retrying submission.",
    "timeline.submit.replaced": "Replacement strategy produced a new transaction hash.",
    "timeline.inclusion.pending": "Broadcast complete, waiting for ledger inclusion.",
    "timeline.finality.pending": "Waiting for final confirmations before settlement.",
    "timeline.finality.failed": "Transaction did not finalize. You may retry safely.",
  },
  details: {
    walletRequestId: "Wallet Request",
    apiRequestId: "API Request",
    txHash: "Tx Hash",
    replacedTxHash: "Replaces",
    attempt: "Attempt",
  },
};

const PHASE_ORDER: TimelinePhase[] = [
  "signature",
  "submit",
  "inclusion",
  "finality",
];

const STATE_CLASS: Record<TimelineEventState, string> = {
  active: "text-primary",
  success: "text-success",
  failed: "text-destructive",
  retrying: "text-amber-500",
};

function resolveCopy(
  locale: TransactionTimelineLocale,
  key: string,
  fallback: string,
): string {
  return locale.titleMap[key] ?? locale.descriptionMap[key] ?? fallback;
}

function renderTimelineSection(
  locale: TransactionTimelineLocale,
  phaseSnapshots: Array<{
    phase: TimelinePhase;
    latest?: TransactionTimelineEvent;
    events: TransactionTimelineEvent[];
  }>,
) {
  return (
    <section
      aria-label={locale.timelineLabel}
      aria-live="polite"
      className="rounded-lg border bg-muted/20 p-3 text-left"
    >
      <p className="text-sm font-medium">{locale.timelineLabel}</p>
      <p className="text-xs text-muted-foreground mt-1">
        {locale.timelineDescription}
      </p>

      <ol className="mt-4 space-y-3" role="list">
        {phaseSnapshots.map(({ phase, latest, events }) => {
          const state: TimelineEventState = latest?.state ?? "active";
          const icon =
            phase === "signature" ? (
              <Wallet className="w-4 h-4" aria-hidden="true" />
            ) : phase === "finality" ? (
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Clock3 className="w-4 h-4" aria-hidden="true" />
            );

          return (
            <li key={phase} className="text-sm">
              <div className="flex items-start gap-3">
                <span className={STATE_CLASS[state]}>{icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{locale.phaseLabel[phase]}</span>
                    <span className={`text-xs ${STATE_CLASS[state]}`}>
                      {locale.stateLabel[state]}
                    </span>
                  </div>

                  {latest && (
                    <>
                      <p className="text-xs mt-1">
                        {resolveCopy(locale, latest.titleKey, latest.titleKey)}
                      </p>
                      {latest.descriptionKey && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {resolveCopy(
                            locale,
                            latest.descriptionKey,
                            latest.descriptionKey,
                          )}
                        </p>
                      )}

                      <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                        <span>{locale.details.attempt}</span>
                        <span className="font-mono">{latest.attempt}</span>

                        <span>{locale.details.walletRequestId}</span>
                        <span className="font-mono truncate">
                          {latest.correlation.walletRequestId}
                        </span>

                        {latest.correlation.apiRequestId && (
                          <>
                            <span>{locale.details.apiRequestId}</span>
                            <span className="font-mono truncate">
                              {latest.correlation.apiRequestId}
                            </span>
                          </>
                        )}

                        {(latest.txHash ?? latest.correlation.txHash) && (
                          <>
                            <span>{locale.details.txHash}</span>
                            <span className="font-mono truncate">
                              {latest.txHash ?? latest.correlation.txHash}
                            </span>
                          </>
                        )}

                        {latest.replacedTxHash && (
                          <>
                            <span>{locale.details.replacedTxHash}</span>
                            <span className="font-mono truncate">
                              {latest.replacedTxHash}
                            </span>
                          </>
                        )}
                      </div>

                      {events.length > 1 && (
                        <p className="text-[11px] text-muted-foreground mt-2">
                          {events.length} lifecycle updates recorded for this phase.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

interface TransactionConfirmationModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  // Trade details
  fromAsset: string;
  fromAmount: string;
  toAsset: string;
  toAmount: string;
  exchangeRate: string;
  priceImpact: string;
  minReceived: string;
  networkFee: string;
  routePath: PathStep[];
  // Actions
  onConfirm: () => void;
  onCancel?: () => void;
  // State
  status: TransactionStatus | "review";
  errorMessage?: string;
  txHash?: string;
  timelineEvents?: TransactionTimelineEvent[];
  timelineLocale?: Partial<TransactionTimelineLocale>;
}

export function TransactionConfirmationModal({
  isOpen,
  onOpenChange,
  fromAsset,
  fromAmount,
  toAsset,
  toAmount,
  exchangeRate,
  priceImpact,
  minReceived,
  networkFee,
  routePath,
  onConfirm,
  onCancel,
  status,
  errorMessage,
  txHash,
  timelineEvents = [],
  timelineLocale,
}: TransactionConfirmationModalProps) {
  const [countdown, setCountdown] = useState(15);
  const locale: TransactionTimelineLocale = {
    ...DEFAULT_LOCALE,
    ...timelineLocale,
    phaseLabel: {
      ...DEFAULT_LOCALE.phaseLabel,
      ...(timelineLocale?.phaseLabel ?? {}),
    },
    stateLabel: {
      ...DEFAULT_LOCALE.stateLabel,
      ...(timelineLocale?.stateLabel ?? {}),
    },
    sourceLabel: {
      ...DEFAULT_LOCALE.sourceLabel,
      ...(timelineLocale?.sourceLabel ?? {}),
    },
    titleMap: {
      ...DEFAULT_LOCALE.titleMap,
      ...(timelineLocale?.titleMap ?? {}),
    },
    descriptionMap: {
      ...DEFAULT_LOCALE.descriptionMap,
      ...(timelineLocale?.descriptionMap ?? {}),
    },
    details: {
      ...DEFAULT_LOCALE.details,
      ...(timelineLocale?.details ?? {}),
    },
  };

  const phaseSnapshots = PHASE_ORDER.map((phase) => {
    const events = timelineEvents.filter((event) => event.phase === phase);
    const latest = events[events.length - 1];
    return {
      phase,
      latest,
      events,
    };
  });

  // Auto-refresh mock timer during review state
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isOpen && status === "review") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCountdown(15);
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) return 15; // Reset loop for demo
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isOpen, status]);

  const handleOpenChange = (open: boolean) => {
    // Only allow manual closing during review or terminal states
    if (status === "review" || status === "success" || status === "failed") {
      onOpenChange(open);
      if (!open && onCancel) onCancel();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        {/* REVIEW STATE */}
        {status === "review" && (
          <>
            <DialogHeader>
              <DialogTitle>Confirm Swap</DialogTitle>
              <DialogDescription>
                Review your transaction details before signing.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Swap Summary */}
              <div className="p-4 rounded-lg bg-muted/30 border space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">
                    You Pay
                  </span>
                  <div className="text-right">
                    <p className="text-lg font-bold">
                      {fromAmount} {fromAsset}
                    </p>
                  </div>
                </div>

                <div className="flex justify-center -my-2 relative z-10">
                  <div className="bg-background border rounded-full p-1">
                    <ArrowDown className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">
                    You Receive
                  </span>
                  <div className="text-right">
                    <p className="text-lg font-bold text-success">
                      ~{toAmount} {toAsset}
                    </p>
                  </div>
                </div>
              </div>

              {/* Trade Details */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rate</span>
                  <span>
                    1 {fromAsset} = {exchangeRate} {toAsset}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price Impact</span>
                  <span
                    className={
                      parseFloat(priceImpact) > 1
                        ? "text-destructive font-medium"
                        : "text-success font-medium"
                    }
                  >
                    {priceImpact}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Minimum Received</span>
                  <span>
                    {minReceived} {toAsset}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Network Fee</span>
                  <span>{networkFee} XLM</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-muted-foreground">Route</span>
                  <div className="flex items-center gap-1 text-xs">
                    {routePath.map((step, idx) => {
                      const from = step.from_asset.asset_type === 'native' ? 'XLM' : step.from_asset.asset_code;
                      const to = step.to_asset.asset_type === 'native' ? 'XLM' : step.to_asset.asset_code;
                       return (
                         <span key={idx} className="flex items-center gap-1">
                           {idx === 0 && <span>{from}</span>}
                           <ChevronRight className="w-3 h-3 text-muted-foreground" />
                           <span>{to}</span>
                         </span>
                       )
                    })}
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-col gap-2">
              <Button onClick={onConfirm} className="w-full" size="lg">
                Confirm Swap
              </Button>
              <div className="text-center text-xs text-muted-foreground">
                Quote refreshes in {countdown}s
              </div>
            </DialogFooter>
          </>
        )}

        {/* AWAITING SIGNATURE STATE */}
        {status === "pending" && (
          <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
              <div className="bg-primary/10 p-4 rounded-full relative">
                 <Wallet className="w-12 h-12 text-primary" />
              </div>
            </div>
            <div>
              <DialogTitle className="text-xl mb-2">
                Awaiting Signature
              </DialogTitle>
              <DialogDescription>
                Please confirm the transaction in your wallet to continue.
              </DialogDescription>
            </div>
          </div>
        )}

        {/* SUBMITTING / PROCESSING STATE */}
        {(status === "submitting" || status === "processing") && (
          <div className="py-8 space-y-5">
            <div className="flex flex-col items-center justify-center space-y-3 text-center">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <div>
                <DialogTitle className="text-xl mb-2">
                  {status === "submitting" ? "Submitting..." : "Processing..."}
                </DialogTitle>
                <DialogDescription>
                  Waiting for network confirmation. This should only take a few seconds.
                </DialogDescription>
              </div>
            </div>

            {renderTimelineSection(locale, phaseSnapshots)}
          </div>
        )}

        {/* SUCCESS STATE */}
        {status === "success" && (
          <div className="py-8 flex flex-col items-center justify-center space-y-6 text-center">
            <div className="bg-success/10 p-4 rounded-full">
               <CheckCircle2 className="w-16 h-16 text-success" />
            </div>
            <div>
              <DialogTitle className="text-2xl mb-2">Swap Successful!</DialogTitle>
              <DialogDescription>
                You received{" "}
                <span className="font-bold text-foreground">
                  {toAmount} {toAsset}
                </span>
              </DialogDescription>
            </div>
            
            {txHash && (
              <a
                href={`https://stellar.expert/explorer/public/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                View on Stellar Expert <ExternalLink className="w-4 h-4" />
              </a>
            )}

            <div className="w-full">{renderTimelineSection(locale, phaseSnapshots)}</div>

            <Button onClick={() => handleOpenChange(false)} className="w-full mt-4">
              Done
            </Button>
          </div>
        )}

        {/* FAILED STATE */}
        {status === "failed" && (
          <div className="py-8 flex flex-col items-center justify-center space-y-6 text-center">
            <div className="bg-destructive/10 p-4 rounded-full">
               <XCircle className="w-16 h-16 text-destructive" />
            </div>
            <div>
              <DialogTitle className="text-xl mb-2">Transaction Failed</DialogTitle>
              <DialogDescription className="text-destructive max-w-[280px] mx-auto">
                {errorMessage || "An unknown error occurred while processing your transaction."}
              </DialogDescription>
            </div>

            <div className="w-full">{renderTimelineSection(locale, phaseSnapshots)}</div>
            
            <div className="w-full space-y-2 mt-4">
              <Button onClick={() => handleOpenChange(false)} className="w-full" variant="outline">
                Dismiss
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

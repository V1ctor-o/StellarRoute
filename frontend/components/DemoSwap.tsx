"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TransactionConfirmationModal } from "@/components/shared/TransactionConfirmationModal";
import { useTransactionHistory } from "@/hooks/useTransactionHistory";
import {
  TransactionCorrelationIds,
  TransactionStatus,
  TransactionTimelineEvent,
  TimelinePhase,
  TimelineEventState,
  TimelineEventSource,
} from "@/types/transaction";
import { toast } from "sonner";
import { PathStep } from "@/types";

// Mock wallet address for demo purposes
const MOCK_WALLET = "GBSU...XYZ9";

export function DemoSwap() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [txStatus, setTxStatus] = useState<TransactionStatus | "review">("review");
  const [errorMessage, setErrorMessage] = useState<string>();
  const [txHash, setTxHash] = useState<string>();
  const [timelineEvents, setTimelineEvents] = useState<TransactionTimelineEvent[]>([]);

  const { addTransaction, updateTransactionStatus } = useTransactionHistory(MOCK_WALLET);
  const timeoutRefs = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach((timerId) => window.clearTimeout(timerId));
      timeoutRefs.current = [];
    };
  }, []);

  // Mock Route Data
  const mockRoute: PathStep[] = [
    {
      from_asset: { asset_type: "native" },
      to_asset: { asset_type: "credit_alphanum4", asset_code: "USDC", asset_issuer: "GA5Z..." },
      price: "0.105",
      source: "sdex"
    }
  ];

  const handleSwapClick = () => {
    setTxStatus("review");
    setErrorMessage(undefined);
    setTxHash(undefined);
    setTimelineEvents([]);
    setIsModalOpen(true);
  };

  const randomId = (prefix: string): string =>
    `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

  const schedule = (callback: () => void, delay: number) => {
    const timeoutId = window.setTimeout(callback, delay);
    timeoutRefs.current.push(timeoutId);
  };

  const toStatus = (phase: TimelinePhase, state: TimelineEventState): TransactionStatus => {
    if (phase === "finality" && state === "failed") {
      return "failed";
    }
    if (phase === "finality" && state === "success") {
      return "success";
    }
    if (phase === "signature") {
      return "pending";
    }
    if (phase === "submit") {
      return "submitting";
    }
    return "processing";
  };

  const makeEvent = (
    phase: TimelinePhase,
    source: TimelineEventSource,
    state: TimelineEventState,
    titleKey: string,
    correlation: TransactionCorrelationIds,
    attempt: number,
    options?: {
      descriptionKey?: string;
      txHash?: string;
      replacedTxHash?: string;
      errorMessage?: string;
      errorCode?: string;
    },
  ): TransactionTimelineEvent => ({
    id: randomId("timeline"),
    phase,
    source,
    state,
    timestamp: Date.now(),
    titleKey,
    descriptionKey: options?.descriptionKey,
    correlation,
    attempt,
    txHash: options?.txHash,
    replacedTxHash: options?.replacedTxHash,
    errorMessage: options?.errorMessage,
    errorCode: options?.errorCode,
  });

  const handleConfirm = () => {
    const transactionId = randomId("tx");
    const walletRequestId = randomId("wreq");
    const apiRequestId = randomId("areq");
    const primaryHash = randomId("mocktx");

    const shouldRetry = Math.random() > 0.55;
    const shouldReplace = shouldRetry && Math.random() > 0.5;
    const replacementHash = shouldReplace ? randomId("replace") : undefined;
    const isSuccess = Math.random() > 0.2;

    let retryCount = 0;
    let replacementCount = 0;
    let events: TransactionTimelineEvent[] = [];
    let correlation: TransactionCorrelationIds = {
      walletRequestId,
      apiRequestId,
      txHash: primaryHash,
      replacementTxHash: replacementHash,
    };

    const pushEvent = (
      event: TransactionTimelineEvent,
      options?: {
        status?: TransactionStatus;
        hash?: string;
        errorMessage?: string;
      },
    ) => {
      events = [...events, event];
      setTimelineEvents(events);

      const status = options?.status ?? toStatus(event.phase, event.state);
      setTxStatus(status);

      if (options?.hash) {
        setTxHash(options.hash);
      }
      if (options?.errorMessage) {
        setErrorMessage(options.errorMessage);
      }

      updateTransactionStatus(transactionId, status, {
        hash: options?.hash,
        errorMessage: options?.errorMessage,
        timeline: events,
        correlation,
        retryCount,
        replacementCount,
      });
    };

    addTransaction({
      id: transactionId,
      timestamp: Date.now(),
      fromAsset: "XLM",
      fromAmount: "100",
      toAsset: "USDC",
      toAmount: "10.5",
      exchangeRate: "0.105",
      priceImpact: "0.1%",
      minReceived: "10.45",
      networkFee: "0.00001",
      routePath: mockRoute,
      status: "pending",
      walletAddress: MOCK_WALLET,
      timeline: [],
      correlation,
      retryCount,
      replacementCount,
    });

    pushEvent(
      makeEvent(
        "signature",
        "wallet",
        "active",
        "timeline.signature.requested",
        correlation,
        1,
        { descriptionKey: "timeline.signature.requested" },
      ),
      { status: "pending" },
    );

    schedule(() => {
      pushEvent(
        makeEvent(
          "signature",
          "wallet",
          "success",
          "timeline.signature.approved",
          correlation,
          1,
        ),
      );

      pushEvent(
        makeEvent(
          "submit",
          "api",
          "active",
          "timeline.submit.requested",
          correlation,
          1,
          { descriptionKey: "timeline.submit.requested" },
        ),
        { status: "submitting" },
      );
    }, 1200);

    schedule(() => {
      if (!shouldRetry) {
        return;
      }

      retryCount = 1;
      pushEvent(
        makeEvent(
          "submit",
          "api",
          "retrying",
          "timeline.submit.retry",
          correlation,
          2,
          { descriptionKey: "timeline.submit.retry", errorCode: "E_RETRYABLE" },
        ),
        { status: "submitting" },
      );
    }, 2200);

    schedule(() => {
      if (shouldReplace && replacementHash) {
        replacementCount = 1;
        correlation = {
          ...correlation,
          txHash: replacementHash,
          replacementTxHash: replacementHash,
        };

        pushEvent(
          makeEvent(
            "submit",
            "api",
            "success",
            "timeline.submit.replaced",
            correlation,
            2,
            {
              descriptionKey: "timeline.submit.replaced",
              txHash: replacementHash,
              replacedTxHash: primaryHash,
            },
          ),
          { status: "submitting", hash: replacementHash },
        );
      } else {
        pushEvent(
          makeEvent(
            "submit",
            "api",
            "success",
            "timeline.submit.accepted",
            correlation,
            retryCount > 0 ? 2 : 1,
            { txHash: primaryHash },
          ),
          { status: "submitting", hash: primaryHash },
        );
      }

      pushEvent(
        makeEvent(
          "inclusion",
          "chain",
          "active",
          "timeline.inclusion.pending",
          correlation,
          1,
          {
            descriptionKey: "timeline.inclusion.pending",
            txHash: correlation.txHash,
          },
        ),
        { status: "processing", hash: correlation.txHash },
      );
    }, 3200);

    schedule(() => {
      pushEvent(
        makeEvent(
          "inclusion",
          "chain",
          "success",
          "timeline.inclusion.confirmed",
          correlation,
          1,
          { txHash: correlation.txHash },
        ),
      );

      pushEvent(
        makeEvent(
          "finality",
          "chain",
          "active",
          "timeline.finality.pending",
          correlation,
          1,
          { descriptionKey: "timeline.finality.pending", txHash: correlation.txHash },
        ),
      );
    }, 4600);

    schedule(() => {
      if (isSuccess) {
        pushEvent(
          makeEvent(
            "finality",
            "chain",
            "success",
            "timeline.finality.confirmed",
            correlation,
            1,
            { txHash: correlation.txHash },
          ),
          { status: "success", hash: correlation.txHash },
        );

        toast.success("Transaction Successful!", {
          description: "You have swapped 100 XLM for 10.5 USDC",
        });
        return;
      }

      const failureReason = "Network congestion prevented final settlement.";
      pushEvent(
        makeEvent(
          "finality",
          "chain",
          "failed",
          "timeline.finality.failed",
          correlation,
          1,
          {
            descriptionKey: "timeline.finality.failed",
            errorCode: "E_FINALITY_TIMEOUT",
            errorMessage: failureReason,
            txHash: correlation.txHash,
          },
        ),
        { status: "failed", errorMessage: failureReason, hash: correlation.txHash },
      );

      toast.error("Transaction Failed", {
        description: failureReason,
      });
    }, 6200);
  };

  const handleCancel = () => {
    setTxStatus("review");
    timeoutRefs.current.forEach((timerId) => window.clearTimeout(timerId));
    timeoutRefs.current = [];
    console.log("Transaction cancelled");
  };

  return (
    <Card className="p-6 max-w-sm mx-auto shadow-lg mt-8 border-primary/20 bg-background/50 backdrop-blur-sm">
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold mb-1">Swap Tokens</h2>
          <p className="text-sm text-muted-foreground">Demo swap interface</p>
        </div>
        
        <div className="space-y-4 bg-muted/20 p-4 rounded-lg border">
          <div>
            <span className="text-sm font-medium">Pay</span>
            <div className="text-2xl font-bold mt-1">100 XLM</div>
          </div>
          <div>
            <span className="text-sm font-medium">Receive</span>
            <div className="text-2xl font-bold mt-1 text-success">~10.5 USDC</div>
          </div>
        </div>

        <Button className="w-full text-lg h-12" onClick={handleSwapClick}>
          Review Swap
        </Button>
      </div>

      <TransactionConfirmationModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        fromAsset="XLM"
        fromAmount="100"
        toAsset="USDC"
        toAmount="10.5"
        exchangeRate="0.105"
        priceImpact="0.1%"
        minReceived="10.45"
        networkFee="0.00001"
        routePath={mockRoute}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        status={txStatus}
        errorMessage={errorMessage}
        txHash={txHash}
        timelineEvents={timelineEvents}
        timelineLocale={{
          timelineLabel: "Transaction timeline",
          timelineDescription:
            "Status is correlated with wallet, API, and chain identifiers.",
        }}
      />
    </Card>
  );
}

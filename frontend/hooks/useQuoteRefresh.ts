'use client';

/**
 * Quote fetching with manual refresh (cooldown), optional auto-refresh, and stale detection.
 *
 * Uses `stellarRouteClient.getQuote` as the only HTTP path for quotes (same as `useQuote`).
 *
 * Extension point — real-time updates: when the API exposes WebSocket (or SSE) quote streams,
 * subscribe here alongside or instead of the auto-refresh interval; update `data` and reset
 * `lastQuotedAtMs` from pushed payloads while keeping manual refresh as a fallback.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  StellarRouteApiError,
  stellarRouteClient,
} from '@/lib/api/client';
import {
  isQuoteStale,
  QUOTE_AMOUNT_DEBOUNCE_MS,
  QUOTE_AUTO_REFRESH_INTERVAL_MS,
  QUOTE_MANUAL_REFRESH_COOLDOWN_MS,
  QUOTE_STALE_AFTER_MS,
} from '@/lib/quote-stale';
import type { PriceQuote, QuoteType } from '@/types';
import type { UseApiState } from '@/hooks/useApi';

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export interface UseQuoteRefreshOptions {
  staleAfterMs?: number;
  autoRefreshIntervalMs?: number;
  manualRefreshCooldownMs?: number;
  debounceMs?: number;
}

export type UseQuoteRefreshState = UseApiState<PriceQuote> & {
  /** Manual refresh; blocked during cooldown or while inputs are invalid. */
  refresh: () => void;
  /** True after a manual refresh until the cooldown elapses. */
  manualRefreshCoolingDown: boolean;
  autoRefreshEnabled: boolean;
  setAutoRefreshEnabled: (enabled: boolean) => void;
  /** True when we have a quote and it is older than the stale TTL. */
  isStale: boolean;
  /** Wall-clock time of the last successful quote fetch, or null. */
  lastQuotedAtMs: number | null;
};

export function useQuoteRefresh(
  base: string,
  quoteAsset: string,
  amount: number | undefined,
  type: QuoteType = 'sell',
  options?: UseQuoteRefreshOptions,
): UseQuoteRefreshState {
  const staleAfterMs = options?.staleAfterMs ?? QUOTE_STALE_AFTER_MS;
  const autoRefreshIntervalMs =
    options?.autoRefreshIntervalMs ?? QUOTE_AUTO_REFRESH_INTERVAL_MS;
  const manualRefreshCooldownMs =
    options?.manualRefreshCooldownMs ?? QUOTE_MANUAL_REFRESH_COOLDOWN_MS;
  const debounceMs = options?.debounceMs ?? QUOTE_AMOUNT_DEBOUNCE_MS;

  const debouncedAmount = useDebounced(amount, debounceMs);
  const [tick, setTick] = useState(0);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [state, setState] = useState<UseApiState<PriceQuote>>({
    data: undefined,
    loading: false,
    error: null,
  });
  const [manualCooldownUntil, setManualCooldownUntil] = useState(0);
  const [lastQuotedAtMs, setLastQuotedAtMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const canRequest =
    Boolean(base) &&
    Boolean(quoteAsset) &&
    debouncedAmount !== undefined &&
    Number.isFinite(debouncedAmount) &&
    debouncedAmount > 0;

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!canRequest) return;

    const controller = new AbortController();
    // Same pattern as `useFetch` in useApi.ts: set loading before starting the request.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional loading transition before async getQuote
    setState((prev) => ({ ...prev, loading: true, error: null }));

    stellarRouteClient
      .getQuote(base, quoteAsset, debouncedAmount, type, {
        signal: controller.signal,
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          const t = Date.now();
          setLastQuotedAtMs(t);
          setState({ data, loading: false, error: null });
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            data: undefined,
            loading: false,
            error:
              err instanceof StellarRouteApiError || err instanceof Error
                ? err
                : new Error(String(err)),
          });
        }
      });

    return () => controller.abort();
  }, [base, quoteAsset, debouncedAmount, type, tick, canRequest]);

  useEffect(() => {
    if (manualCooldownUntil === 0) return;
    const remaining = manualCooldownUntil - Date.now();
    const id = setTimeout(
      () => setManualCooldownUntil(0),
      Math.max(0, remaining),
    );
    return () => clearTimeout(id);
  }, [manualCooldownUntil]);

  const refresh = useCallback(() => {
    if (!canRequest) return;
    const t = Date.now();
    if (t < manualCooldownUntil) return;
    setManualCooldownUntil(t + manualRefreshCooldownMs);
    setTick((n) => n + 1);
  }, [canRequest, manualCooldownUntil, manualRefreshCooldownMs]);

  useEffect(() => {
    if (!autoRefreshEnabled || !canRequest) return;

    let ws: WebSocket | null = null;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;

    const startFallback = () => {
      if (fallbackInterval) return;
      fallbackInterval = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
          return;
        }
        setTick((n) => n + 1);
      }, autoRefreshIntervalMs);
    };

    const stopFallback = () => {
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
        fallbackInterval = null;
      }
    };

    const connectWs = () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
        const wsUrl = baseUrl.replace(/^http/, 'ws').replace(/\/$/, '') + '/ws';
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          stopFallback();
          ws?.send(JSON.stringify({
            action: 'subscribe',
            subscription: {
              type: 'quote',
              base,
              quote: quoteAsset,
              amount: debouncedAmount,
              quote_type: type,
            }
          }));
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'quote_update' && message.data) {
              if (
                message.subscription?.base === base &&
                message.subscription?.quote === quoteAsset
              ) {
                setLastQuotedAtMs(message.timestamp || Date.now());
                setState((prev) => ({
                  ...prev,
                  data: message.data,
                  loading: false,
                  error: null,
                }));
              }
            }
          } catch (err) {
            // ignore
          }
        };

        ws.onclose = () => {
          startFallback();
        };

        ws.onerror = () => {
          startFallback();
        };
      } catch (err) {
        startFallback();
      }
    };

    startFallback();
    connectWs();

    return () => {
      stopFallback();
      if (ws) {
        ws.close();
      }
    };
  }, [autoRefreshEnabled, autoRefreshIntervalMs, canRequest, base, quoteAsset, debouncedAmount, type]);

  const manualRefreshCoolingDown =
    manualCooldownUntil > 0 && nowMs < manualCooldownUntil;

  const data = canRequest ? state.data : undefined;
  const loading = canRequest && state.loading;
  const error = canRequest ? state.error : null;

  const isStale =
    data !== undefined && isQuoteStale(lastQuotedAtMs, nowMs, staleAfterMs);

  return {
    data,
    loading,
    error,
    refresh,
    manualRefreshCoolingDown,
    autoRefreshEnabled,
    setAutoRefreshEnabled,
    isStale,
    lastQuotedAtMs,
  };
}

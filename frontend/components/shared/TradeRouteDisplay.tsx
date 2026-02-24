'use client';

import { useState, useEffect } from 'react';
import { RouteVisualization } from './RouteVisualization';
import { SplitRouteVisualization } from './SplitRouteVisualization';
import { PathStep, PriceQuote } from '@/types';
import { SplitRouteData, RouteMetrics } from '@/types/route';

interface TradeRouteDisplayProps {
  quote: PriceQuote | null;
  isLoading?: boolean;
  error?: string;
  className?: string;
}

function isSplitRoute(path: PathStep[]): boolean {
  // For now, we assume all routes are single-path
  // In the future, the API might return split route information
  return false;
}

function convertToSplitRoute(path: PathStep[]): SplitRouteData {
  // Placeholder conversion - actual implementation would parse API response
  return {
    paths: [
      {
        percentage: 100,
        steps: path,
      },
    ],
    totalOutput: '0',
  };
}

function calculateMetrics(quote: PriceQuote): RouteMetrics {
  // Calculate metrics from quote data
  const totalFees = '0.0001'; // Placeholder - would calculate from path
  const totalPriceImpact = '0.1%'; // Placeholder - would calculate from path
  const netOutput = quote.total;
  const averageRate = quote.price;

  return {
    totalFees,
    totalPriceImpact,
    netOutput,
    averageRate,
  };
}

export function TradeRouteDisplay({
  quote,
  isLoading = false,
  error,
  className,
}: TradeRouteDisplayProps) {
  const [displayError, setDisplayError] = useState<string | undefined>(error);

  useEffect(() => {
    setDisplayError(error);
  }, [error]);

  // Loading state
  if (isLoading) {
    return (
      <RouteVisualization path={[]} isLoading={true} className={className} />
    );
  }

  // Error state
  if (displayError) {
    return (
      <RouteVisualization
        path={[]}
        error={displayError}
        className={className}
      />
    );
  }

  // No quote
  if (!quote) {
    return <RouteVisualization path={[]} className={className} />;
  }

  // Check if split route
  if (isSplitRoute(quote.path)) {
    const splitRoute = convertToSplitRoute(quote.path);
    const metrics = calculateMetrics(quote);
    return (
      <SplitRouteVisualization
        splitRoute={splitRoute}
        metrics={metrics}
        className={className}
      />
    );
  }

  // Regular single-path route
  return <RouteVisualization path={quote.path} className={className} />;
}

export function TradeRouteExample() {
  const [quote, setQuote] = useState<PriceQuote | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();

  // Example: Fetch quote from API
  const fetchQuote = async (
    baseAsset: string,
    quoteAsset: string,
    amount: string
  ) => {
    try {
      setIsLoading(true);
      setError(undefined);

      // Replace with actual API call
      const response = await fetch(
        `/api/quote?base=${baseAsset}&quote=${quoteAsset}&amount=${amount}&type=sell`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch quote');
      }

      const data: PriceQuote = await response.json();
      setQuote(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <TradeRouteDisplay quote={quote} isLoading={isLoading} error={error} />
    </div>
  );
}

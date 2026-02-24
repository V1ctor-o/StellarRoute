'use client';

import { useState } from 'react';
import { SplitRouteData, RouteMetrics } from '@/types/route';
import { PathStep } from '@/types';
import {
  ChevronDown,
  ChevronUp,
  Info,
  TrendingRight,
  Split,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface SplitRouteVisualizationProps {
  splitRoute: SplitRouteData;
  metrics?: RouteMetrics;
  isLoading?: boolean;
  error?: string;
  className?: string;
}

function getAssetCode(asset: any): string {
  if (asset.asset_type === 'native') return 'XLM';
  return asset.asset_code || 'UNKNOWN';
}

function parseSource(source: string): { isSDEX: boolean; poolName?: string } {
  if (source === 'sdex') {
    return { isSDEX: true };
  }
  if (source.startsWith('amm:')) {
    const poolAddress = source.substring(4);
    return {
      isSDEX: false,
      poolName: `Pool ${poolAddress.substring(0, 8)}...`,
    };
  }
  return { isSDEX: false, poolName: source };
}

function PathVisualization({
  steps,
  percentage,
  pathIndex,
}: {
  steps: PathStep[];
  percentage: number;
  pathIndex: number;
}) {
  if (steps.length === 0) return null;

  const sourceAsset = steps[0].from_asset;
  const destAsset = steps[steps.length - 1].to_asset;
  const sourceCode = getAssetCode(sourceAsset);
  const destCode = getAssetCode(destAsset);

  return (
    <div className="relative p-4 border rounded-lg bg-muted/20">
      {/* Path Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Path {pathIndex + 1}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {sourceCode} → {destCode}
          </span>
        </div>
        <Badge className="bg-blue-500 text-white">{percentage}%</Badge>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2 overflow-x-auto">
        {steps.map((step, index) => {
          const { isSDEX, poolName } = parseSource(step.source);
          const fromCode = getAssetCode(step.from_asset);
          const toCode = getAssetCode(step.to_asset);

          return (
            <div key={index} className="flex items-center gap-2 flex-shrink-0">
              {index === 0 && (
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full border-2 border-blue-500 flex items-center justify-center bg-background">
                    <span className="text-xs font-semibold">
                      {fromCode.substring(0, 2)}
                    </span>
                  </div>
                  <span className="text-xs mt-1">{fromCode}</span>
                </div>
              )}

              <div className="flex flex-col items-center px-2">
                <TrendingRight className="w-4 h-4 text-muted-foreground" />
                <Badge
                  variant="secondary"
                  className={cn(
                    'text-xs mt-1',
                    isSDEX
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-purple-100 text-purple-700'
                  )}
                >
                  {isSDEX ? 'SDEX' : poolName || 'AMM'}
                </Badge>
              </div>

              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full border-2 flex items-center justify-center bg-background',
                    index === steps.length - 1
                      ? 'border-green-500'
                      : 'border-neutral-300'
                  )}
                >
                  <span className="text-xs font-semibold">
                    {toCode.substring(0, 2)}
                  </span>
                </div>
                <span className="text-xs mt-1">{toCode}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricsSummary({ metrics }: { metrics: RouteMetrics }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border rounded-lg bg-muted/10">
      <div>
        <span className="text-xs text-muted-foreground">Total Fees</span>
        <p className="text-sm font-semibold">{metrics.totalFees}</p>
      </div>
      <div>
        <span className="text-xs text-muted-foreground">Price Impact</span>
        <p className="text-sm font-semibold">{metrics.totalPriceImpact}</p>
      </div>
      <div>
        <span className="text-xs text-muted-foreground">Net Output</span>
        <p className="text-sm font-semibold">{metrics.netOutput}</p>
      </div>
      <div>
        <span className="text-xs text-muted-foreground">Avg Rate</span>
        <p className="text-sm font-semibold">{metrics.averageRate}</p>
      </div>
    </div>
  );
}

export function SplitRouteVisualization({
  splitRoute,
  metrics,
  isLoading = false,
  error,
  className,
}: SplitRouteVisualizationProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Loading state
  if (isLoading) {
    return (
      <Card className={cn('p-6', className)}>
        <Skeleton className="w-full h-32 mb-4" />
        <Skeleton className="w-full h-32" />
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={cn('p-6 border-destructive', className)}>
        <div className="flex items-center gap-2 text-destructive">
          <Info className="w-5 h-5" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      </Card>
    );
  }

  // No route found
  if (!splitRoute || splitRoute.paths.length === 0) {
    return (
      <Card className={cn('p-6', className)}>
        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Info className="w-8 h-8" />
          <span className="text-sm">No route found</span>
        </div>
      </Card>
    );
  }

  const isSplit = splitRoute.paths.length > 1;
  const totalHops = splitRoute.paths.reduce(
    (sum, path) => sum + path.steps.length,
    0
  );

  return (
    <Card className={cn('p-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Trade Route</h3>
          {isSplit && (
            <Badge variant="default" className="bg-blue-500">
              <Split className="w-3 h-3 mr-1" />
              Split Route
            </Badge>
          )}
          <Badge variant="outline">
            {totalHops} {totalHops === 1 ? 'Hop' : 'Hops'}
          </Badge>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Details
          {isExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Split Paths */}
      <div className="space-y-3">
        {splitRoute.paths.map((path, index) => (
          <PathVisualization
            key={index}
            steps={path.steps}
            percentage={path.percentage}
            pathIndex={index}
          />
        ))}
      </div>

      {/* Metrics Summary */}
      {metrics && (
        <div className="mt-4">
          <MetricsSummary metrics={metrics} />
        </div>
      )}

      {/* Expanded Details */}
      {isExpanded && (
        <div className="mt-6 space-y-4 border-t pt-4">
          <h4 className="text-sm font-semibold">Detailed Breakdown</h4>
          {splitRoute.paths.map((path, pathIndex) => (
            <div key={pathIndex} className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Path {pathIndex + 1}</Badge>
                <span className="text-xs text-muted-foreground">
                  {path.percentage}% allocation
                </span>
                {path.outputAmount && (
                  <span className="text-xs text-muted-foreground">
                    Output: {path.outputAmount}
                  </span>
                )}
              </div>
              {path.steps.map((step, stepIndex) => {
                const { isSDEX, poolName } = parseSource(step.source);
                const fromCode = getAssetCode(step.from_asset);
                const toCode = getAssetCode(step.to_asset);

                return (
                  <div
                    key={stepIndex}
                    className="pl-4 p-3 border-l-2 border-muted"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">
                        Hop {stepIndex + 1}: {fromCode} → {toCode}
                      </span>
                      <Badge
                        variant={isSDEX ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {isSDEX ? 'SDEX' : poolName || 'AMM'}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Rate: {parseFloat(step.price).toFixed(6)}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

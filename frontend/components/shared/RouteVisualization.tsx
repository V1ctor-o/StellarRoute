'use client';

import { useState } from 'react';
import { PathStep, Asset } from '@/types';
import { ChevronDown, ChevronUp, Info, TrendingRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface RouteVisualizationProps {
  path: PathStep[];
  isLoading?: boolean;
  error?: string;
  className?: string;
}

interface RouteNode {
  asset: Asset;
  amount?: string;
  isSource: boolean;
  isDestination: boolean;
}

interface RouteEdge {
  step: PathStep;
  isSDEX: boolean;
  poolName?: string;
}

function getAssetCode(asset: Asset): string {
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

function buildRouteGraph(path: PathStep[]): {
  nodes: RouteNode[];
  edges: RouteEdge[];
} {
  if (path.length === 0) {
    return { nodes: [], edges: [] };
  }

  const nodes: RouteNode[] = [];
  const edges: RouteEdge[] = [];

  // First node (source)
  nodes.push({
    asset: path[0].from_asset,
    isSource: true,
    isDestination: false,
  });

  // Process each step
  path.forEach((step, index) => {
    const { isSDEX, poolName } = parseSource(step.source);

    edges.push({
      step,
      isSDEX,
      poolName,
    });

    nodes.push({
      asset: step.to_asset,
      isSource: false,
      isDestination: index === path.length - 1,
    });
  });

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Sub-Components
// ---------------------------------------------------------------------------

function RouteNodeComponent({ node }: { node: RouteNode }) {
  const assetCode = getAssetCode(node.asset);

  return (
    <div className="flex flex-col items-center gap-2 min-w-[80px]">
      <div
        className={cn(
          'flex items-center justify-center w-12 h-12 rounded-full border-2 bg-background',
          node.isSource && 'border-blue-500 ring-2 ring-blue-500/20',
          node.isDestination && 'border-green-500 ring-2 ring-green-500/20',
          !node.isSource && !node.isDestination && 'border-neutral-300'
        )}
      >
        <span className="text-sm font-semibold">
          {assetCode.substring(0, 3)}
        </span>
      </div>
      <span className="text-xs font-medium text-center">{assetCode}</span>
      {node.amount && (
        <span className="text-xs text-muted-foreground">{node.amount}</span>
      )}
    </div>
  );
}

function RouteEdgeComponent({
  edge,
  isAnimated,
}: {
  edge: RouteEdge;
  isAnimated: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 relative">
      <div className="relative w-full h-[2px] overflow-hidden">
        <div
          className={cn(
            'absolute inset-0',
            edge.isSDEX ? 'bg-blue-500' : 'bg-purple-500'
          )}
        />
        {isAnimated && (
          <div
            className={cn(
              'absolute inset-0 w-8 h-full opacity-60 animate-flow',
              edge.isSDEX ? 'bg-blue-300' : 'bg-purple-300'
            )}
          />
        )}
      </div>
      <TrendingRight className="absolute w-4 h-4 text-muted-foreground" />
      <Badge
        variant="secondary"
        className={cn(
          'mt-2 text-xs',
          edge.isSDEX
            ? 'bg-blue-100 text-blue-700'
            : 'bg-purple-100 text-purple-700'
        )}
      >
        {edge.isSDEX ? 'SDEX' : edge.poolName || 'AMM'}
      </Badge>
    </div>
  );
}

function RouteDetails({ step, index }: { step: PathStep; index: number }) {
  const { isSDEX, poolName } = parseSource(step.source);
  const fromCode = getAssetCode(step.from_asset);
  const toCode = getAssetCode(step.to_asset);

  return (
    <div className="p-3 border rounded-lg bg-muted/30">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">
          Hop {index + 1}: {fromCode} → {toCode}
        </span>
        <Badge variant={isSDEX ? 'default' : 'secondary'}>
          {isSDEX ? 'SDEX' : poolName || 'AMM Pool'}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground">Exchange Rate:</span>
          <p className="font-medium">{parseFloat(step.price).toFixed(6)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Source:</span>
          <p className="font-medium">{step.source}</p>
        </div>
      </div>
    </div>
  );
}

export function RouteVisualization({
  path,
  isLoading = false,
  error,
  className,
}: RouteVisualizationProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAnimated, setIsAnimated] = useState(true);

  // Loading state
  if (isLoading) {
    return (
      <Card className={cn('p-6', className)}>
        <div className="flex is-center gap-4 overflow-x-auto">
          <Skeleton className="w-12 h-12 rounded-full" />
          <Skeleton className="w-24 h-8" />
          <Skeleton className="w-12 h-12 rounded-full" />
          <Skeleton className="w-24 h-8" />
          <Skeleton className="w-12 h-12 rounded-full" />
        </div>
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
  if (!path || path.length === 0) {
    return (
      <Card className={cn('p-6', className)}>
        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Info className="w-8 h-8" />
          <span className="text-sm">No route found</span>
        </div>
      </Card>
    );
  }

  const { nodes, edges } = buildRouteGraph(path);
  const hopCount = path.length;

  return (
    <Card className={cn('p-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Trade Route</h3>
          <Badge variant="outline">
            {hopCount} {hopCount === 1 ? 'Hop' : 'Hops'}
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

      {/* Route Diagram - Desktop (Horizontal) */}
      <div className="hidden md:flex items-center justify-start gap-0 overflow-x-auto pb-2">
        {nodes.map((node, index) => (
          <div key={index} className="flex items-center">
            <RouteNodeComponent node={node} />
            {index < edges.length && (
              <RouteEdgeComponent edge={edges[index]} isAnimated={isAnimated} />
            )}
          </div>
        ))}
      </div>

      {/* Route Diagram - Mobile (Vertical) */}
      <div className="flex md:hidden flex-col items-center gap-2">
        {nodes.map((node, index) => (
          <div key={index} className="flex flex-col items-center w-full">
            <RouteNodeComponent node={node} />
            {index < edges.length && (
              <div className="flex flex-col items-center py-2">
                <div className="h-8 w-[2px] bg-gradient-to-b from-transparent via-current to-transparent opacity-30" />
                <Badge
                  variant="secondary"
                  className={cn(
                    'text-xs',
                    edges[index].isSDEX
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-purple-100 text-purple-700'
                  )}
                >
                  {edges[index].isSDEX
                    ? 'SDEX'
                    : edges[index].poolName || 'AMM'}
                </Badge>
                <div className="h-8 w-[2px] bg-gradient-to-b from-transparent via-current to-transparent opacity-30" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="mt-6 space-y-3 border-t pt-4">
          <h4 className="text-sm font-semibold mb-3">Route Details</h4>
          {path.map((step, index) => (
            <RouteDetails key={index} step={step} index={index} />
          ))}
        </div>
      )}

      {/* Animation CSS */}
      <style jsx>{`
        @keyframes flow {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(400%);
          }
        }
        .animate-flow {
          animation: flow 2s linear infinite;
        }
      `}</style>
    </Card>
  );
}

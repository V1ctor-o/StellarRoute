'use client';

import { useState } from 'react';
import { RouteVisualization } from '@/components/shared/RouteVisualization';
import { SplitRouteVisualization } from '@/components/shared/SplitRouteVisualization';
import { PathStep } from '@/types';
import { SplitRouteData, RouteMetrics } from '@/types/route';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const singleHopPath: PathStep[] = [
  {
    from_asset: { asset_type: 'native' },
    to_asset: {
      asset_type: 'credit_alphanum4',
      asset_code: 'USDC',
      asset_issuer: 'GA5Z...',
    },
    price: '0.0850',
    source: 'sdex',
  },
];

const multiHopPath: PathStep[] = [
  {
    from_asset: { asset_type: 'native' },
    to_asset: {
      asset_type: 'credit_alphanum4',
      asset_code: 'USDC',
      asset_issuer: 'GA5Z...',
    },
    price: '0.0850',
    source: 'sdex',
  },
  {
    from_asset: {
      asset_type: 'credit_alphanum4',
      asset_code: 'USDC',
      asset_issuer: 'GA5Z...',
    },
    to_asset: {
      asset_type: 'credit_alphanum4',
      asset_code: 'BTC',
      asset_issuer: 'GBVOL...',
    },
    price: '0.000015',
    source: 'amm:CDQR7XQJUGQP3VXV3YKQJMVXQXQXQXQXQXQXQXQXQXQXQXQXQXQXQXQX',
  },
];

const complexPath: PathStep[] = [
  {
    from_asset: { asset_type: 'native' },
    to_asset: {
      asset_type: 'credit_alphanum4',
      asset_code: 'USDC',
      asset_issuer: 'GA5Z...',
    },
    price: '0.0850',
    source: 'sdex',
  },
  {
    from_asset: {
      asset_type: 'credit_alphanum4',
      asset_code: 'USDC',
      asset_issuer: 'GA5Z...',
    },
    to_asset: {
      asset_type: 'credit_alphanum4',
      asset_code: 'EURC',
      asset_issuer: 'GBBD...',
    },
    price: '0.92',
    source: 'amm:CDQR7XQJUGQP3VXV3YKQJMVXQXQXQXQXQXQXQXQXQXQXQXQXQXQXQXQX',
  },
  {
    from_asset: {
      asset_type: 'credit_alphanum4',
      asset_code: 'EURC',
      asset_issuer: 'GBBD...',
    },
    to_asset: {
      asset_type: 'credit_alphanum4',
      asset_code: 'BTC',
      asset_issuer: 'GBVOL...',
    },
    price: '0.000016',
    source: 'sdex',
  },
];

const splitRouteData: SplitRouteData = {
  paths: [
    {
      percentage: 60,
      steps: [
        {
          from_asset: { asset_type: 'native' },
          to_asset: {
            asset_type: 'credit_alphanum4',
            asset_code: 'USDC',
            asset_issuer: 'GA5Z...',
          },
          price: '0.0850',
          source: 'sdex',
        },
        {
          from_asset: {
            asset_type: 'credit_alphanum4',
            asset_code: 'USDC',
            asset_issuer: 'GA5Z...',
          },
          to_asset: {
            asset_type: 'credit_alphanum4',
            asset_code: 'BTC',
            asset_issuer: 'GBVOL...',
          },
          price: '0.000015',
          source: 'sdex',
        },
      ],
      outputAmount: '0.000765',
    },
    {
      percentage: 40,
      steps: [
        {
          from_asset: { asset_type: 'native' },
          to_asset: {
            asset_type: 'credit_alphanum4',
            asset_code: 'BTC',
            asset_issuer: 'GBVOL...',
          },
          price: '0.00000128',
          source:
            'amm:CDQR7XQJUGQP3VXV3YKQJMVXQXQXQXQXQXQXQXQXQXQXQXQXQXQXQXQX',
        },
      ],
      outputAmount: '0.000512',
    },
  ],
  totalOutput: '0.001277',
  totalFees: '0.00001',
  totalPriceImpact: '0.15%',
};

const mockMetrics: RouteMetrics = {
  totalFees: '0.00001 BTC',
  totalPriceImpact: '0.15%',
  netOutput: '0.001267 BTC',
  averageRate: '0.00000127',
};

export default function RouteVisualizationDemo() {
  const [isLoading, setIsLoading] = useState(false);
  const [showError, setShowError] = useState(false);

  const simulateLoading = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 2000);
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Route Visualization Demo</h1>
        <p className="text-muted-foreground">
          Interactive demo of the multi-hop trade route visualization component
        </p>
      </div>

      <Tabs defaultValue="single" className="space-y-6">
        <TabsList>
          <TabsTrigger value="single">Single Hop</TabsTrigger>
          <TabsTrigger value="multi">Multi-Hop</TabsTrigger>
          <TabsTrigger value="complex">Complex Route</TabsTrigger>
          <TabsTrigger value="split">Split Route</TabsTrigger>
          <TabsTrigger value="states">States</TabsTrigger>
        </TabsList>

        <TabsContent value="single" className="space-y-4">
          <Card className="p-4">
            <h2 className="text-lg font-semibold mb-2">Single Hop Route</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Direct swap from XLM to USDC via SDEX orderbook
            </p>
          </Card>
          <RouteVisualization path={singleHopPath} />
        </TabsContent>

        <TabsContent value="multi" className="space-y-4">
          <Card className="p-4">
            <h2 className="text-lg font-semibold mb-2">Multi-Hop Route</h2>
            <p className="text-sm text-muted-foreground mb-4">
              XLM → USDC (SDEX) → BTC (AMM Pool)
            </p>
          </Card>
          <RouteVisualization path={multiHopPath} />
        </TabsContent>

        <TabsContent value="complex" className="space-y-4">
          <Card className="p-4">
            <h2 className="text-lg font-semibold mb-2">Complex 3-Hop Route</h2>
            <p className="text-sm text-muted-foreground mb-4">
              XLM → USDC (SDEX) → EURC (AMM) → BTC (SDEX)
            </p>
          </Card>
          <RouteVisualization path={complexPath} />
        </TabsContent>

        <TabsContent value="split" className="space-y-4">
          <Card className="p-4">
            <h2 className="text-lg font-semibold mb-2">Split Route</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Trade split across multiple paths for optimal execution: 60% via
              SDEX multi-hop, 40% via direct AMM
            </p>
          </Card>
          <SplitRouteVisualization
            splitRoute={splitRouteData}
            metrics={mockMetrics}
          />
        </TabsContent>

        <TabsContent value="states" className="space-y-6">
          <Card className="p-4">
            <h2 className="text-lg font-semibold mb-2">Component States</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Test different states of the visualization component
            </p>
            <div className="flex gap-2">
              <Button onClick={simulateLoading} variant="outline" size="sm">
                Simulate Loading
              </Button>
              <Button
                onClick={() => setShowError(!showError)}
                variant="outline"
                size="sm"
              >
                Toggle Error
              </Button>
            </div>
          </Card>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-2">Loading State</h3>
              <RouteVisualization path={[]} isLoading={isLoading} />
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Error State</h3>
              <RouteVisualization
                path={[]}
                error={showError ? 'Failed to fetch route data' : undefined}
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">No Route Found</h3>
              <RouteVisualization path={[]} />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

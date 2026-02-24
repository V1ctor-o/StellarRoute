import { PathStep } from './index';

export interface SplitPath {
  /** Percentage of trade allocated to this path (0-100) */
  percentage: number;
  /** The route steps for this path */
  steps: PathStep[];
  /** Expected output amount for this path */
  outputAmount?: string;
}

export interface SplitRouteData {
  /** Array of parallel paths */
  paths: SplitPath[];
  /** Total expected output across all paths */
  totalOutput: string;
  /** Total fees across all paths */
  totalFees?: string;
  /** Total price impact across all paths */
  totalPriceImpact?: string;
}

export interface RouteMetrics {
  /** Total fees paid across the route */
  totalFees: string;
  /** Total price impact percentage */
  totalPriceImpact: string;
  /** Net output amount after fees */
  netOutput: string;
  /** Average exchange rate */
  averageRate: string;
}

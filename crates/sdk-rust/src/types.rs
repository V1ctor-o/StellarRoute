//! Common types for SDK

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub timestamp: String,
    pub version: String,
    pub components: std::collections::HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradingPair {
    pub base: String,
    pub counter: String,
    pub base_asset: String,
    pub counter_asset: String,
    pub offer_count: i64,
    pub last_updated: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PairsResponse {
    pub pairs: Vec<TradingPair>,
    pub total: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetInfo {
    pub asset_type: String,
    pub asset_code: Option<String>,
    pub asset_issuer: Option<String>,
}

impl AssetInfo {
    pub fn display_name(&self) -> String {
        match (&self.asset_code, &self.asset_issuer) {
            (Some(code), Some(issuer)) => format!("{code}:{issuer}"),
            (Some(code), None) => code.clone(),
            (None, _) => "native".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderbookLevel {
    pub price: String,
    pub amount: String,
    pub total: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderbookResponse {
    pub base_asset: AssetInfo,
    pub quote_asset: AssetInfo,
    pub bids: Vec<OrderbookLevel>,
    pub asks: Vec<OrderbookLevel>,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathStep {
    pub from_asset: AssetInfo,
    pub to_asset: AssetInfo,
    pub price: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuoteResponse {
    pub base_asset: AssetInfo,
    pub quote_asset: AssetInfo,
    pub amount: String,
    pub price: String,
    pub total: String,
    pub quote_type: String,
    pub path: Vec<PathStep>,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub error: String,
    pub message: String,
    pub details: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Copy)]
pub enum QuoteType {
    Sell,
    Buy,
}

impl QuoteType {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Sell => "sell",
            Self::Buy => "buy",
        }
    }
}

#[derive(Debug, Clone)]
pub struct QuoteRequest<'a> {
    pub base: &'a str,
    pub quote: &'a str,
    pub amount: Option<&'a str>,
    pub quote_type: QuoteType,
}

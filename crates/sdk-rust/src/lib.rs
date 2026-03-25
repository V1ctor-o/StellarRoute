//! StellarRoute Rust SDK
//!
//! Rust SDK for integrating StellarRoute into backend services.

pub mod client;
pub mod error;
pub mod types;

/// StellarRoute client
pub use client::StellarRouteClient;
pub use error::{Result, SdkError};
pub use types::{
    AssetInfo, HealthResponse, OrderbookLevel, OrderbookResponse, PairsResponse, PathStep,
    QuoteRequest, QuoteResponse, QuoteType, TradingPair,
};

//! Shared application state

use sqlx::PgPool;
use std::sync::atomic::{AtomicU64, Ordering};
use std::{sync::Arc, time::Duration};
use tokio::sync::Mutex;

use crate::cache::{CacheManager, SingleFlight};
use crate::models::{QuoteResponse, RoutesResponse};
use crate::replay::capture::CaptureHook;
use crate::graph::GraphManager;
use crate::routes::ws::WsState;
use stellarroute_routing::health::circuit_breaker::{CircuitBreakerRegistry, BreakerConfig};

use crate::worker::{JobQueue, RouteWorkerPool, WorkerPoolConfig};

/// Cache policy configuration
#[derive(Debug, Clone)]
pub struct CachePolicy {
    pub quote_ttl: Duration,
}

impl Default for CachePolicy {
    fn default() -> Self {
        Self {
            quote_ttl: Duration::from_secs(2),
        }
    }
}

/// In-process cache metrics
pub struct CacheMetrics {
    quote_hits: AtomicU64,
    quote_misses: AtomicU64,
    stale_quote_rejections: AtomicU64,
    stale_inputs_excluded: AtomicU64,
}

impl Default for CacheMetrics {
    fn default() -> Self {
        Self {
            quote_hits: AtomicU64::new(0),
            quote_misses: AtomicU64::new(0),
            stale_quote_rejections: AtomicU64::new(0),
            stale_inputs_excluded: AtomicU64::new(0),
        }
    }
}

impl CacheMetrics {
    pub fn inc_quote_hit(&self) {
        self.quote_hits.fetch_add(1, Ordering::Relaxed);
    }

    pub fn inc_quote_miss(&self) {
        self.quote_misses.fetch_add(1, Ordering::Relaxed);
    }

    pub fn inc_stale_rejection(&self) {
        self.stale_quote_rejections.fetch_add(1, Ordering::Relaxed);
    }

    pub fn add_stale_inputs_excluded(&self, n: u64) {
        self.stale_inputs_excluded.fetch_add(n, Ordering::Relaxed);
    }

    pub fn snapshot(&self) -> (u64, u64) {
        (
            self.quote_hits.load(Ordering::Relaxed),
            self.quote_misses.load(Ordering::Relaxed),
        )
    }

    pub fn snapshot_staleness(&self) -> (u64, u64) {
        (
            self.stale_quote_rejections.load(Ordering::Relaxed),
            self.stale_inputs_excluded.load(Ordering::Relaxed),
        )
    }
}

/// Shared API state
#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub cache: Option<Arc<Mutex<CacheManager>>>,
    pub version: String,
    pub cache_policy: CachePolicy,
    pub cache_metrics: Arc<CacheMetrics>,
    pub worker_pool: Arc<RouteWorkerPool>,
    pub quote_single_flight: Arc<SingleFlight<crate::error::Result<QuoteResponse>>>,
    pub replay_capture: Option<Arc<CaptureHook>>,
    pub routes_single_flight: Arc<SingleFlight<crate::error::Result<RoutesResponse>>>,
    pub graph_manager: Arc<GraphManager>,
    pub ws: Option<Arc<WsState>>,
    pub circuit_breaker: Arc<CircuitBreakerRegistry>,
}

impl AppState {
    pub fn new(db: PgPool) -> Self {
        Self::new_with_policy(db, CachePolicy::default())
    }

    pub fn new_with_policy(db: PgPool, cache_policy: CachePolicy) -> Self {
        let worker_pool = Self::create_worker_pool(db.clone());
        let graph_manager = Arc::new(GraphManager::new(db.clone()));
        graph_manager.clone().start_sync();

        Self {
            db,
            cache: None,
            version: env!("CARGO_PKG_VERSION").to_string(),
            cache_policy,
            cache_metrics: Arc::new(CacheMetrics::default()),
            worker_pool,
            quote_single_flight: Arc::new(SingleFlight::new()),
            replay_capture: None,
            routes_single_flight: Arc::new(SingleFlight::new()),
            graph_manager,
            ws: None,
            circuit_breaker: Arc::new(CircuitBreakerRegistry::default()),
        }
    }

    pub fn with_cache(db: PgPool, cache: CacheManager) -> Self {
        Self::with_cache_and_policy(db, cache, CachePolicy::default())
    }

    pub fn with_cache_and_policy(
        db: PgPool,
        cache: CacheManager,
        cache_policy: CachePolicy,
    ) -> Self {
        let worker_pool = Self::create_worker_pool(db.clone());
        let graph_manager = Arc::new(GraphManager::new(db.clone()));
        graph_manager.clone().start_sync();

        Self {
            db,
            cache: Some(Arc::new(Mutex::new(cache))),
            version: env!("CARGO_PKG_VERSION").to_string(),
            cache_policy,
            cache_metrics: Arc::new(CacheMetrics::default()),
            worker_pool,
            quote_single_flight: Arc::new(SingleFlight::new()),
            replay_capture: None,
            routes_single_flight: Arc::new(SingleFlight::new()),
            graph_manager,
            ws: None,
            circuit_breaker: Arc::new(CircuitBreakerRegistry::default()),
        }
    }

    fn create_worker_pool(db: PgPool) -> Arc<RouteWorkerPool> {
        let queue = JobQueue::new(db);
        let config = WorkerPoolConfig::default();
        Arc::new(RouteWorkerPool::new(config, queue))
    }

    pub fn into_arc(self) -> Arc<Self> {
        Arc::new(self)
    }

    pub fn has_cache(&self) -> bool {
        self.cache.is_some()
    }

    pub fn with_replay_capture(mut self, hook: CaptureHook) -> Self {
        self.replay_capture = Some(Arc::new(hook));
        self
    }

    pub fn with_ws(mut self, ws: Arc<WsState>) -> Self {
        self.ws = Some(ws);
        self
    }
}
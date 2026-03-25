//! StellarRoute API client

use reqwest::Url;

use crate::{
    error::{Result, SdkError},
    types::{
        ErrorResponse, HealthResponse, OrderbookResponse, PairsResponse, QuoteRequest,
        QuoteResponse,
    },
};

pub struct StellarRouteClient {
    base_url: Url,
    http: reqwest::Client,
}

impl StellarRouteClient {
    pub fn new(api_url: &str) -> Result<Self> {
        let mut base_url = Url::parse(api_url)
            .map_err(|e| SdkError::InvalidConfig(format!("Invalid API URL '{api_url}': {e}")))?;

        if !base_url.path().ends_with('/') {
            let next_path = format!("{}/", base_url.path());
            base_url.set_path(&next_path);
        }

        Ok(Self {
            base_url,
            http: reqwest::Client::new(),
        })
    }

    pub async fn health(&self) -> Result<HealthResponse> {
        self.get_json("health").await
    }

    pub async fn pairs(&self) -> Result<PairsResponse> {
        self.get_json("api/v1/pairs").await
    }

    pub async fn orderbook(&self, base: &str, quote: &str) -> Result<OrderbookResponse> {
        let path = format!("api/v1/orderbook/{base}/{quote}");
        self.get_json(&path).await
    }

    pub async fn quote(&self, request: QuoteRequest<'_>) -> Result<QuoteResponse> {
        let path = format!("api/v1/quote/{}/{}", request.base, request.quote);
        let mut req = self.http.get(self.url(&path)?);

        if let Some(amount) = request.amount {
            req = req.query(&[("amount", amount)]);
        }

        req = req.query(&[("quote_type", request.quote_type.as_str())]);

        self.execute(req).await
    }

    fn url(&self, path: &str) -> Result<Url> {
        self.base_url
            .join(path)
            .map_err(|e| SdkError::InvalidConfig(format!("Invalid request path '{path}': {e}")))
    }

    async fn get_json<T>(&self, path: &str) -> Result<T>
    where
        T: serde::de::DeserializeOwned,
    {
        let req = self.http.get(self.url(path)?);
        self.execute(req).await
    }

    async fn execute<T>(&self, request: reqwest::RequestBuilder) -> Result<T>
    where
        T: serde::de::DeserializeOwned,
    {
        let response = request
            .send()
            .await
            .map_err(|e| SdkError::Http(format!("Request failed: {e}")))?;

        let status = response.status();
        let body = response
            .text()
            .await
            .map_err(|e| SdkError::Http(format!("Failed to read response body: {e}")))?;

        if !status.is_success() {
            let message = match serde_json::from_str::<ErrorResponse>(&body) {
                Ok(error) => error.message,
                Err(_) => format!("API request failed with status {status}"),
            };

            return Err(SdkError::Api(message));
        }

        serde_json::from_str(&body).map_err(Into::into)
    }
}

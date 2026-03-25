//! Error types for SDK

use thiserror::Error;

#[derive(Error, Debug)]
pub enum SdkError {
    #[error("{0}")]
    Http(String),

    #[error("{0}")]
    Api(String),

    #[error("Failed to parse API response: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("{0}")]
    InvalidConfig(String),
}

pub type Result<T> = std::result::Result<T, SdkError>;

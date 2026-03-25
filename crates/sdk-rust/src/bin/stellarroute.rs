use clap::{builder::TypedValueParser, CommandFactory, Parser, Subcommand, ValueEnum};
use std::ffi::OsStr;
use std::num::NonZeroUsize;
use stellarroute_sdk::{QuoteRequest, QuoteType, StellarRouteClient};

#[derive(Parser, Debug)]
#[command(
    name = "stellarroute",
    about = "Query the StellarRoute API from the terminal",
    long_about = "Query the StellarRoute API from terminal workflows with concise, human-readable output.",
    version
)]
struct Cli {
    #[arg(
        long,
        global = true,
        env = "STELLARROUTE_API_URL",
        default_value = "http://127.0.0.1:3000",
        help = "Base URL for the StellarRoute API"
    )]
    api_url: String,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand, Debug)]
enum Commands {
    #[command(about = "Check API health")]
    Health,
    #[command(about = "List available trading pairs")]
    Pairs {
        #[arg(long, default_value_t = 10, help = "Maximum number of pairs to print")]
        limit: usize,
    },
    #[command(about = "Get a price quote for a trading pair")]
    Quote {
        #[arg(
            value_parser = parse_asset,
            help = "Base asset: native, CODE, or CODE:ISSUER"
        )]
        base: String,
        #[arg(
            value_parser = parse_asset,
            help = "Quote asset: native, CODE, or CODE:ISSUER"
        )]
        quote: String,
        #[arg(
            long,
            value_parser = PositiveAmountParser,
            help = "Trade amount as a positive decimal string"
        )]
        amount: Option<String>,
        #[arg(
            long,
            value_enum,
            default_value_t = QuoteTypeArg::Sell,
            help = "Whether the amount is for selling or buying the base asset"
        )]
        quote_type: QuoteTypeArg,
    },
    #[command(about = "Show the orderbook for a trading pair")]
    Orderbook {
        #[arg(
            value_parser = parse_asset,
            help = "Base asset: native, CODE, or CODE:ISSUER"
        )]
        base: String,
        #[arg(
            value_parser = parse_asset,
            help = "Quote asset: native, CODE, or CODE:ISSUER"
        )]
        quote: String,
        #[arg(
            long,
            default_value_t = NonZeroUsize::new(10).expect("non-zero"),
            help = "Maximum number of levels to print per side"
        )]
        levels: NonZeroUsize,
    },
}

#[derive(Clone, Copy, Debug, ValueEnum)]
enum QuoteTypeArg {
    Sell,
    Buy,
}

impl From<QuoteTypeArg> for QuoteType {
    fn from(value: QuoteTypeArg) -> Self {
        match value {
            QuoteTypeArg::Sell => QuoteType::Sell,
            QuoteTypeArg::Buy => QuoteType::Buy,
        }
    }
}

#[derive(Clone)]
struct PositiveAmountParser;

impl TypedValueParser for PositiveAmountParser {
    type Value = String;

    fn parse_ref(
        &self,
        cmd: &clap::Command,
        arg: Option<&clap::Arg>,
        value: &OsStr,
    ) -> Result<Self::Value, clap::Error> {
        let raw = value.to_str().ok_or_else(|| {
            clap::Error::raw(
                clap::error::ErrorKind::InvalidUtf8,
                "Amount must be valid UTF-8",
            )
        })?;

        match raw.parse::<f64>() {
            Ok(amount) if amount.is_finite() && amount > 0.0 => Ok(raw.to_string()),
            _ => {
                let mut cmd = cmd.clone();
                Err(cmd.error(
                    clap::error::ErrorKind::ValueValidation,
                    format!(
                        "{} must be a positive number",
                        arg.map(|a| a.to_string())
                            .unwrap_or_else(|| "amount".to_string())
                    ),
                ))
            }
        }
    }
}

#[tokio::main]
async fn main() {
    Cli::command().debug_assert();

    let cli = Cli::parse();
    let client = match StellarRouteClient::new(&cli.api_url) {
        Ok(client) => client,
        Err(error) => exit_with_error(&error.to_string()),
    };

    let result = match cli.command {
        Commands::Health => render_health(&client).await,
        Commands::Pairs { limit } => render_pairs(&client, limit).await,
        Commands::Quote {
            base,
            quote,
            amount,
            quote_type,
        } => {
            render_quote(
                &client,
                QuoteRequest {
                    base: &base,
                    quote: &quote,
                    amount: amount.as_deref(),
                    quote_type: quote_type.into(),
                },
            )
            .await
        }
        Commands::Orderbook {
            base,
            quote,
            levels,
        } => render_orderbook(&client, &base, &quote, levels.get()).await,
    };

    if let Err(error) = result {
        exit_with_error(&error.to_string());
    }
}

async fn render_health(client: &StellarRouteClient) -> Result<(), stellarroute_sdk::SdkError> {
    let response = client.health().await?;

    println!("status: {}", response.status);
    println!("version: {}", response.version);
    println!("timestamp: {}", response.timestamp);

    if !response.components.is_empty() {
        println!("components:");
        let mut components = response.components.into_iter().collect::<Vec<_>>();
        components.sort_by(|a, b| a.0.cmp(&b.0));
        for (name, status) in components {
            println!("  {name}: {status}");
        }
    }

    Ok(())
}

async fn render_pairs(
    client: &StellarRouteClient,
    limit: usize,
) -> Result<(), stellarroute_sdk::SdkError> {
    let response = client.pairs().await?;
    let shown = response.pairs.iter().take(limit);

    println!("total pairs: {}", response.total);
    for pair in shown {
        println!(
            "{} / {} | offers: {} | canonical: {} / {}",
            pair.base, pair.counter, pair.offer_count, pair.base_asset, pair.counter_asset
        );
    }

    Ok(())
}

async fn render_quote(
    client: &StellarRouteClient,
    request: QuoteRequest<'_>,
) -> Result<(), stellarroute_sdk::SdkError> {
    let response = client.quote(request).await?;

    println!(
        "pair: {} / {}",
        response.base_asset.display_name(),
        response.quote_asset.display_name()
    );
    println!("amount: {}", response.amount);
    println!("quote type: {}", response.quote_type);
    println!("price: {}", response.price);
    println!("total: {}", response.total);
    println!("route steps: {}", response.path.len());

    for (index, step) in response.path.iter().enumerate() {
        println!(
            "{}. {} -> {} @ {} via {}",
            index + 1,
            step.from_asset.display_name(),
            step.to_asset.display_name(),
            step.price,
            step.source
        );
    }

    Ok(())
}

async fn render_orderbook(
    client: &StellarRouteClient,
    base: &str,
    quote: &str,
    levels: usize,
) -> Result<(), stellarroute_sdk::SdkError> {
    let response = client.orderbook(base, quote).await?;

    println!(
        "pair: {} / {}",
        response.base_asset.display_name(),
        response.quote_asset.display_name()
    );
    println!("timestamp: {}", response.timestamp);
    println!("asks:");
    for level in response.asks.iter().take(levels) {
        println!(
            "  price={} amount={} total={}",
            level.price, level.amount, level.total
        );
    }

    println!("bids:");
    for level in response.bids.iter().take(levels) {
        println!(
            "  price={} amount={} total={}",
            level.price, level.amount, level.total
        );
    }

    Ok(())
}

fn exit_with_error(message: &str) -> ! {
    eprintln!("Error: {message}");
    std::process::exit(1);
}

fn parse_asset(value: &str) -> Result<String, String> {
    if value == "native" {
        return Ok(value.to_string());
    }

    let parts: Vec<&str> = value.split(':').collect();
    if parts.is_empty() || parts.len() > 2 {
        return Err(format!(
            "invalid asset '{value}'; expected native, CODE, or CODE:ISSUER"
        ));
    }

    let code = parts[0];
    if code.is_empty() || code.len() > 12 || !code.chars().all(|c| c.is_ascii_alphanumeric()) {
        return Err(format!(
            "invalid asset '{value}'; asset code must be 1-12 ASCII letters or digits"
        ));
    }

    if let Some(issuer) = parts.get(1) {
        if issuer.len() != 56 || !issuer.chars().all(|c| c.is_ascii_alphanumeric()) {
            return Err(format!(
                "invalid asset '{value}'; issuer must be a 56-character Stellar account id"
            ));
        }
    }

    Ok(value.to_uppercase())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clap_help_is_well_formed() {
        Cli::command().debug_assert();
    }

    #[test]
    fn parses_valid_quote_command() {
        let cli = Cli::try_parse_from([
            "stellarroute",
            "quote",
            "native",
            "USDC:GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
            "--amount",
            "10.5",
            "--quote-type",
            "buy",
        ])
        .expect("command should parse");

        match cli.command {
            Commands::Quote {
                base,
                quote,
                amount,
                quote_type,
            } => {
                assert_eq!(base, "native");
                assert_eq!(
                    quote,
                    "USDC:GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
                );
                assert_eq!(amount.as_deref(), Some("10.5"));
                assert!(matches!(quote_type, QuoteTypeArg::Buy));
            }
            _ => panic!("expected quote command"),
        }
    }

    #[test]
    fn rejects_invalid_amount() {
        let error =
            Cli::try_parse_from(["stellarroute", "quote", "native", "USDC", "--amount", "0"])
                .expect_err("amount should fail");

        assert_eq!(error.kind(), clap::error::ErrorKind::ValueValidation);
    }

    #[test]
    fn rejects_invalid_asset() {
        let error =
            Cli::try_parse_from(["stellarroute", "orderbook", "bad:too:many:parts", "USDC"])
                .expect_err("asset should fail");

        assert_eq!(error.kind(), clap::error::ErrorKind::ValueValidation);
    }
}

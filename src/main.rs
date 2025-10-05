#![allow(dead_code)]
mod model;
mod server;

use crate::server::train_live_status;
use axum::http::Method;
use axum::routing::get;
use axum::{Router, serve};
use tokio::net::TcpListener;
use tower::ServiceBuilder;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;
use tracing::Level;
use tracing_subscriber::FmtSubscriber;

#[tokio::main]
async fn main() {
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .finish();
    tracing::subscriber::set_global_default(subscriber).expect("setting default subscriber failed");

    let cors = CorsLayer::new()
        .allow_methods([Method::GET])
        .allow_origin(Any);

    let app = Router::new()
        .route("/running/status", get(train_live_status))
        .fallback_service(ServeDir::new("static"))
        .layer(ServiceBuilder::new().layer(cors));

    let listener = TcpListener::bind("0.0.0.0:3000").await.unwrap();
    println!("Started server running on http://localhost:3000");
    serve(listener, app).await.unwrap();
}

use crate::model::{TrainStatusData, TrainStatusResponse, TrainStatusResult};
use anyhow::Error;
use axum::Json;
use axum::extract::Query;
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct TrainStatusQuery {
    pub journey_date: String,
    pub train_number: String,
}

pub async fn get_train_status(params: TrainStatusQuery) -> Result<TrainStatusResult, Error> {
    let url = format!(
        "https://railradar.in/api/v1/trains/{}?journeyDate={}",
        params.train_number, params.journey_date
    );
    let client = Client::new();
    let api_key = std::env::var("RAIL_RADAR_API_KEY").unwrap();
    let response = client.get(&url).header("X-Api-Key", api_key).send().await?;
    let txt = response.text().await?;
    println!("{}", txt);
    let train_resp: TrainStatusResponse = serde_json::from_str(&txt)?;
    Ok(train_resp.into())
}

pub async fn train_live_status(
    Query(params): Query<TrainStatusQuery>,
) -> Result<Json<TrainStatusData>, Json<String>> {
    let result = get_train_status(params)
        .await
        .map_err(|e| Json(e.to_string()))?;
    match result {
        TrainStatusResult::Data(data) => Ok(Json(*data)),
        TrainStatusResult::Error(e) => Err(Json(e.message)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tracing::info;

    #[tokio::test]
    async fn test_get_train_status() {
        let query = TrainStatusQuery {
            journey_date: "2025-10-02".to_string(),
            train_number: "12301".to_string(),
        };
        let result = get_train_status(query).await.unwrap();
        info!("train status response: {:#?}", result);
    }
}

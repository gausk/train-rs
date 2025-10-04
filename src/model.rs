use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Train {
    pub train_number: String,
    pub train_name: String,
    #[serde(rename = "type")]
    pub type_: String,
    pub zone: String,
    pub source_station_code: String,
    pub source_station_name: String,
    pub destination_station_code: String,
    pub destination_station_name: String,
    pub running_days_bitmap: u32,
    pub return_train_number: String,
    pub travel_time_minutes: u32,
    pub total_halts: u32,
    pub distance_km: u32,
    pub avg_speed_kmph: u32,
    pub rake_details: String,
    pub other_details: String,
    pub news: String,
    pub images: String,
    pub scraped_at: f64,
    pub source_url: String,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RouteInfo {
    pub id: Option<u64>,
    pub sequence: u32,
    pub station_code: String,
    pub station_name: String,
    pub is_halt: u8,
    pub scheduled_arrival: Option<u32>,
    pub scheduled_departure: Option<u32>,
    pub halt_duration_minutes: u32,
    pub platform: Option<String>,
    pub day: u8,
    pub speed_on_section_kmph: Option<u32>,
    pub track_type: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Station {
    pub code: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveRouteInfo {
    pub station: Station,
    pub scheduled_arrival: u64,
    pub scheduled_departure: Option<u64>,
    pub actual_arrival: Option<u64>,
    pub actual_departure: Option<u64>,
    pub delay_arrival_minutes: Option<i32>,
    pub delay_departure_minutes: Option<i32>,
    pub platform: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainLiveData {
    pub train_number: String,
    pub journey_date: String,
    pub last_updated_at: String,
    pub current_location: CurrentLocation,
    pub data_source: String,
    pub status_summary: String,
    pub route: Vec<LiveRouteInfo>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CurrentLocation {
    pub latitude: f64,
    pub longitude: f64,
    pub station_code: String,
    pub status: String,
    pub distance_from_origin_km: f64,
    pub distance_from_last_station_km: f64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainStatusData {
    pub train: Train,
    pub route: Vec<RouteInfo>,
    pub live_data: Option<TrainLiveData>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainError {
    pub code: String,
    pub message: String,
    pub status_code: Option<u16>,
    pub timestamp: Option<String>,
    pub retryable: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainStatusResponse {
    pub success: bool,
    pub data: Option<TrainStatusData>,
    pub error: Option<TrainError>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum TrainStatusResult {
    Data(TrainStatusData),
    Error(TrainError),
}

impl From<TrainStatusResponse> for TrainStatusResult {
    fn from(status: TrainStatusResponse) -> Self {
        if status.success {
            TrainStatusResult::Data(status.data.unwrap())
        } else {
            TrainStatusResult::Error(status.error.unwrap())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_deserialize_success() {
        for data in [
            include_str!("../data/train_data1.json"),
            include_str!("../data/train_data2.json"),
        ] {
            let response: TrainStatusResponse = serde_json::from_str(data).unwrap();
            assert!(response.success);
            assert!(response.error.is_none());
            assert!(response.data.is_some());
        }
    }

    #[test]
    fn test_deserialize_error() {
        for data in [
            include_str!("../data/error1.json"),
            include_str!("../data/error2.json"),
        ] {
            let response: TrainStatusResponse = serde_json::from_str(data).unwrap();
            assert!(!response.success);
            assert!(response.error.is_some());
            assert!(response.data.is_none());
        }
    }
}

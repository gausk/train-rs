use bitflags::bitflags;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

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
    pub running_days_bitmap: u8,
    #[serde(skip_deserializing)]
    pub running_days: String,
    pub return_train_number: String,
    pub travel_time_minutes: u32,
    pub total_halts: u32,
    pub distance_km: u32,
    pub avg_speed_kmph: u32,
}

impl Train {
    fn with_running_days(mut self) -> Self {
        self.running_days = RunningDays::from_bits(self.running_days_bitmap)
            .unwrap()
            .as_names();
        self
    }
}

bitflags! {
    #[derive(Serialize, Deserialize)]
    #[serde(transparent)]
    pub struct RunningDays: u8 {
        const SUNDAY    = 1 << 0;
        const MONDAY    = 1 << 1;
        const TUESDAY   = 1 << 2;
        const WEDNESDAY = 1 << 3;
        const THURSDAY  = 1 << 4;
        const FRIDAY    = 1 << 5;
        const SATURDAY  = 1 << 6;
    }
}
impl RunningDays {
    fn as_names(&self) -> String {
        let mut result = String::new();
        if self.contains(RunningDays::SUNDAY) {
            result.push_str("Su ");
        }
        if self.contains(RunningDays::MONDAY) {
            result.push_str("Mo ");
        }
        if self.contains(RunningDays::TUESDAY) {
            result.push_str("Tu ");
        }
        if self.contains(RunningDays::WEDNESDAY) {
            result.push_str("We ");
        }
        if self.contains(RunningDays::THURSDAY) {
            result.push_str("Th ");
        }
        if self.contains(RunningDays::FRIDAY) {
            result.push_str("Fr ");
        }
        if self.contains(RunningDays::SATURDAY) {
            result.push_str("Sa ");
        }
        result.trim_end().to_string()
    }
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
    pub name: Option<String>,
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
    #[serde(skip_deserializing)]
    pub status: LiveStatus,
}

impl LiveRouteInfo {
    pub fn update_station_name(&mut self, map: &HashMap<String, String>) {
        self.station.name = map.get(&self.station.code).cloned();
    }

    pub fn update_status(&mut self, curr_time: u64) {
        if self.actual_departure.is_some_and(|t| t < curr_time) {
            self.status = LiveStatus::Departed
        } else if self.actual_arrival.is_some_and(|t| t <= curr_time) {
            self.status = LiveStatus::Arrived
        } else if self.actual_arrival.is_some_and(|t| t > curr_time) {
            self.status = LiveStatus::Upcoming
        }
    }
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub enum LiveStatus {
    Departed,
    #[default]
    None,
    Arrived,
    Upcoming,
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

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct TrainLiveStatus {
    pub train: Train,
    pub live_data: Option<TrainLiveData>,
}

impl From<TrainStatusData> for TrainLiveStatus {
    fn from(train_status_data: TrainStatusData) -> Self {
        let map: HashMap<String, String> = train_status_data
            .route
            .into_iter()
            .map(|route| (route.station_code, route.station_name))
            .collect();
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("Time went backwards")
            .as_secs();

        let live_data = train_status_data.live_data.map(|mut live_data| {
            live_data.route.iter_mut().for_each(|route| {
                route.update_station_name(&map);
                route.update_status(now);
            });
            live_data
        });
        Self {
            train: Train::with_running_days(train_status_data.train),
            live_data,
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum TrainStatusResult {
    Data(Box<TrainLiveStatus>),
    Error(TrainError),
}

impl From<TrainStatusResponse> for TrainStatusResult {
    fn from(status: TrainStatusResponse) -> Self {
        if status.success {
            TrainStatusResult::Data(Box::new(status.data.unwrap().into()))
        } else {
            TrainStatusResult::Error(status.error.unwrap())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::path::Path;

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
            let final_data = TrainLiveStatus::from(response.data.unwrap());
            let file = File::create(Path::new("data/output.json")).unwrap();
            serde_json::to_writer_pretty(&file, &final_data).unwrap();
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

use serde::Deserialize;

#[derive(Deserialize)]
pub struct ProcessorDes {
    pub kind: String,
    pub id: String,
    pub format: String,
}

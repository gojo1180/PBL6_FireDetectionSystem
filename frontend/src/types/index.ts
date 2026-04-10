export interface SensorLog {
  id: string; device_id: string; cng_level: number; co_level: number;
  lpg_level: number; flame_detected: boolean; smoke_detected: boolean; recorded_at: string;
}

export interface VisionLog {
  id: string; device_id: string; fire_confidence: number;
  smoke_confidence: number; image_url: string | null; recorded_at: string;
}

export interface FusionAlert {
  id: string; device_id: string; risk_level: string; fusion_score: number;
  alert_message: string; is_resolved: boolean; triggered_at: string;
}

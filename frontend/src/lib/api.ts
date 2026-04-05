export const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

// Shared interfaces resolving to Backend Schemas
export interface SensorLog {
  id: string;
  device_id: string;
  cng_level: number;
  co_level: number;
  lpg_level: number;
  flame_detected: boolean;
  smoke_detected: boolean;
  recorded_at: string;
}

export interface VisionLog {
  id: string;
  device_id: string;
  fire_confidence: number;
  smoke_confidence: number;
  image_url: string | null;
  recorded_at: string;
}

export interface FusionAlert {
  id: string;
  device_id: string;
  risk_level: string;
  fusion_score: number;
  alert_message: string;
  is_resolved: boolean;
  triggered_at: string;
}

// Data Fetchers
export const getLatestSensor = async (): Promise<SensorLog | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/sensors/latest`, { cache: 'no-store' });
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    console.error("Error fetching latest sensor:", err);
    return null;
  }
};

export const getActiveAlerts = async (): Promise<FusionAlert[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/alerts/active`, { cache: 'no-store' });
    if (!response.ok) return [];
    return await response.json();
  } catch (err) {
    console.error("Error fetching active alerts:", err);
    return [];
  }
};

export const getLatestVision = async (): Promise<VisionLog | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/vision/latest`, { cache: 'no-store' });
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    console.error("Error fetching latest vision logs:", err);
    return null;
  }
};

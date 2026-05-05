import { getToken, removeToken } from "./auth";
import { Device, SensorLog, VisionLog, FusionAlert } from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

export async function apiFetch<T = unknown>(
  path: string,
  opts: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, auth = true } = opts;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (auth) {
    const token = getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Handle 401 Unauthorized — clear token and redirect to login
  if (res.status === 401) {
    console.log("[apiFetch] 401 Unauthorized — redirecting to /login");
    removeToken();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

// ─── API Wrapper Functions ─────────────────────────────────────────

export async function getDevices(): Promise<Device[]> {
  return apiFetch<Device[]>("/api/v1/devices");
}

export async function createDevice(device: Partial<Device>): Promise<Device> {
  return apiFetch<Device>("/api/v1/devices/", {
    method: "POST",
    body: device,
  });
}

export async function updateDevice(id: string, device: Partial<Device>): Promise<Device> {
  return apiFetch<Device>(`/api/v1/devices/${id}`, {
    method: "PUT",
    body: device,
  });
}

export async function deleteDevice(id: string): Promise<void> {
  return apiFetch<void>(`/api/v1/devices/${id}`, { method: "DELETE" });
}

export async function login(credentials: any): Promise<{ access_token: string }> {
  return apiFetch<{ access_token: string }>("/api/v1/auth/login", {
    method: "POST",
    body: credentials,
    auth: false,
  });
}

export async function register(credentials: any): Promise<{ access_token: string }> {
  return apiFetch<{ access_token: string }>("/api/v1/auth/register", {
    method: "POST",
    body: credentials,
    auth: false,
  });
}

export async function getDashboardSensors(deviceId: string, limit: number = 15): Promise<SensorLog[]> {
  return apiFetch<SensorLog[]>(`/api/v1/sensors?limit=${limit}&device_id=${deviceId}`);
}

export async function getLatestSensor(deviceId: string): Promise<SensorLog | null> {
  return apiFetch<SensorLog | null>(`/api/v1/sensors/latest/${deviceId}`);
}

export async function getLatestVision(): Promise<VisionLog | null> {
  return apiFetch<VisionLog | null>("/api/v1/vision/latest");
}

export interface CalibrationStatus {
  fase_aktif: string;
  error_saat_ini: number;
  threshold_dinamis: number;
  counter_pesan: number;
  sampling_seconds: number;
  toleransi_threshold: number;
}

export async function getCalibrationStatus(): Promise<CalibrationStatus> {
  return apiFetch<CalibrationStatus>("/api/v1/sensors/calibration");
}

export async function setCalibrationConfig(toleransi_threshold: number): Promise<any> {
  return apiFetch<any>("/api/v1/sensors/calibration/config", {
    method: "POST",
    body: { toleransi_threshold },
  });
}

export async function getAlerts(limit: number = 10): Promise<FusionAlert[]> {
  return apiFetch<FusionAlert[]>(`/api/v1/alerts?limit=${limit}`);
}

export async function resolveAlert(alertId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/alerts/${alertId}/resolve`, { method: "PATCH" });
}

// ─── News Interfaces ────────────────────────────────────────────────
export interface NewsArticle {
  title: string;
  link: string;
  image_url: string | null;
  description: string | null;
  source: string | null;
  pubDate: string | null;
}

export interface SummarizeResponse {
  url: string;
  full_text: string;
  summary: string;
}

export async function getNews(): Promise<{ status: string; total: number; articles: NewsArticle[] }> {
  return apiFetch<{ status: string; total: number; articles: NewsArticle[] }>("/api/v1/news");
}

export async function extractNews(url: string): Promise<{ full_text: string }> {
  return apiFetch<{ full_text: string }>("/api/v1/news/extract", {
    method: "POST",
    body: { url },
  });
}

export async function summarizeNews(url: string, fullText: string | null): Promise<SummarizeResponse> {
  return apiFetch<SummarizeResponse>("/api/v1/news/summarize", {
    method: "POST",
    body: { url, full_text: fullText },
  });
}

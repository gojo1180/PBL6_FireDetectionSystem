import os
import requests

def send_push_to_all(title: str, body: str, url: str = "/dashboard"):
    """
    Mengirim push notification ke semua Subscribed Users via OneSignal REST API.
    Dipanggil dari mqtt_client.py saat anomali terdeteksi.
    """
    app_id = os.getenv("ONESIGNAL_APP_ID")
    api_key = os.getenv("ONESIGNAL_REST_API_KEY")

    if not app_id or not api_key:
        print("[Push] OneSignal credentials not configured, skipping push.")
        return

    api_url = "https://onesignal.com/api/v1/notifications"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Basic {api_key}"
    }

    # Pastikan url menjadi full URL
    full_url = url if url.startswith("http") else f"https://bombaai.site{url}"

    payload = {
        "app_id": app_id,
        "included_segments": ["Subscribed Users"],
        "headings": {"en": title},
        "contents": {"en": body},
        "url": full_url
    }

    try:
        response = requests.post(api_url, json=payload, headers=headers)
        response.raise_for_status()
        result = response.json()
        print(f"[Push] OneSignal notification sent! Response: {result}")
    except requests.exceptions.RequestException as e:
        print(f"[Push] Failed to send OneSignal notification. Error: {e}")
        if e.response is not None:
            print(f"[Push] Response details: {e.response.text}")


# Alias agar backward-compatible jika ada kode lain yang memanggil nama lama
def send_anomaly_notification(title: str, message: str):
    """Backward-compatible alias."""
    send_push_to_all(title=title, body=message)

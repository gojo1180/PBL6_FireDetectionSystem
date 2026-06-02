import os
import requests

def send_anomaly_notification(title: str, message: str):
    app_id = os.getenv("ONESIGNAL_APP_ID")
    api_key = os.getenv("ONESIGNAL_REST_API_KEY")

    if not app_id or not api_key:
        print("⚠️ OneSignal credentials not configured, skipping push.")
        return

    url = "https://onesignal.com/api/v1/notifications"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Basic {api_key}"
    }

    payload = {
        "app_id": app_id,
        "included_segments": ["Subscribed Users"],
        "headings": {"en": title},
        "contents": {"en": message},
        "url": "https://cctv-dashboard.vercel.app/"
    }

    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        print(f"✅ Push notification sent successfully: {response.json()}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to send OneSignal push notification. Error: {e}")
        if e.response is not None:
            print(f"Response details: {e.response.text}")

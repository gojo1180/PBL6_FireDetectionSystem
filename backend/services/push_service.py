import os
import json
from pywebpush import webpush, WebPushException
from core.config import settings

SUBSCRIPTIONS_FILE = "push_subscriptions.json"

def get_all_subscriptions():
    if os.path.exists(SUBSCRIPTIONS_FILE):
        try:
            with open(SUBSCRIPTIONS_FILE, "r") as f:
                return json.load(f)
        except json.JSONDecodeError:
            return []
    return []

def save_subscription(subscription_data: dict):
    subs = get_all_subscriptions()
    # Check if already exists based on endpoint
    if not any(s.get("endpoint") == subscription_data.get("endpoint") for s in subs):
        subs.append(subscription_data)
        with open(SUBSCRIPTIONS_FILE, "w") as f:
            json.dump(subs, f)

def send_push_to_all(title: str, body: str, url: str = "/dashboard"):
    vapid_private_key = settings.VAPID_PRIVATE_KEY
    vapid_subject = settings.VAPID_SUBJECT
    
    if not vapid_private_key or not vapid_subject:
        print("⚠️ VAPID keys not configured, skipping push.")
        return

    payload = json.dumps({
        "title": title,
        "body": body,
        "url": url,
    })

    subs = get_all_subscriptions()
    if not subs:
        print("⚠️ No push subscriptions found.")
        return
        
    valid_subs = []
    
    for sub in subs:
        try:
            webpush(
                subscription_info=sub,
                data=payload,
                vapid_private_key=vapid_private_key,
                vapid_claims={"sub": vapid_subject},
                ttl=86400, # 24 jam time-to-live
                headers={
                    "urgency": "high", 
                    "topic": "pbl6-alert"
                }, # Paksa HP bangun dari sleep/doze mode
            )
            valid_subs.append(sub)
        except WebPushException as e:
            # If 410 Gone, the user unsubscribed. We omit it from valid_subs
            if e.response is not None and e.response.status_code == 410:
                print("⚠️ Subscription expired or unsubscribed, removing it.")
            else:
                print(f"❌ Failed to send to a subscriber. Error: {e}")
                # Keep it if it's a temporary network error
                valid_subs.append(sub)
    
    # Save back the valid ones if any were removed
    if len(valid_subs) != len(subs):
        with open(SUBSCRIPTIONS_FILE, "w") as f:
            json.dump(valid_subs, f)

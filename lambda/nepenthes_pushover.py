import json
import os
import requests

PUSHOVER_API_KEY = os.environ["PUSHOVER_API_KEY"]
PAGEE_USER_KEY = os.environ["PAGEE_USER_KEY"]
API_URL = "https://api.pushover.net/1/messages.json"

def _default(o):
    if hasattr(o, "astimezone") and hasattr(o, "isoformat"):
        return o.astimezone().isoformat()
    else:
        return str(o)

def _parse_message(event):
    return json.dumps({
        "Event": event,
    }, indent=4, sort_keys=True, default=_default)

def lambda_handler(event, _):
    print("Event: " + str(event))
    headers = {
        'content-type': 'application/x-www-form-urlencoded',
    }
    data = {
        "token": PUSHOVER_API_KEY,
        "user": PAGEE_USER_KEY,
        "message": _parse_message(event),
        "priority": 2, # Critical Alert
        "retry": 120, # 2min
        "expire": 900, # 15min
        "sound": "Narita",
    }
    response = requests.post(API_URL, headers=headers, data=data, timeout=10)
    try:
        body = json.loads(response.text)
    except json.JSONDecodeError:
        body = {"raw": response.text}
    return {
        'statusCode': response.status_code,
        'body': body
    }

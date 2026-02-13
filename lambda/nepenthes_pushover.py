import json
import logging
import os
import requests

from alarm_formatter import format_alarm

logger = logging.getLogger(__name__)

PUSHOVER_API_KEY = os.environ["PUSHOVER_API_KEY"]
PAGEE_USER_KEY = os.environ["PAGEE_USER_KEY"]
API_URL = "https://api.pushover.net/1/messages.json"


def lambda_handler(event, _):
    logger.info("Event: %s", event)

    record = event.get("Records", [{}])[0]
    formatted = format_alarm(record)

    # Skip sending Pushover for OK (recovery) state transitions
    if formatted.get("state") == "OK":
        logger.info("Skipping Pushover for OK state")
        return {"statusCode": 200, "body": "skipped OK state"}

    headers = {
        'content-type': 'application/x-www-form-urlencoded',
    }
    data = {
        "token": PUSHOVER_API_KEY,
        "user": PAGEE_USER_KEY,
        "title": formatted["title"],
        "message": formatted["body"],
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

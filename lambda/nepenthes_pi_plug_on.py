import os
import requests

from switchbot import build_headers, call_with_retry, DEVICE_SEND_CMD_ENDPOINT_FORMAT

SB_TOKEN = os.environ["SB_TOKEN"]
SB_SECRET_KEY = os.environ["SB_SECRET_KEY"]

PI_DEVICE_NAME = "N. Pi"

def _turn_plug_on(device_id):
    device_status_endpoint = DEVICE_SEND_CMD_ENDPOINT_FORMAT.format(device_id)
    headers=build_headers(SB_TOKEN, SB_SECRET_KEY)
    response = requests.post(device_status_endpoint, headers=headers, timeout=10, json={
        "command": "turnOn",
        "parameter": "default",
        "commandType": "command",
    }).json()
    if response.get("statusCode", 0) != 100:
        raise RuntimeError("Unable to status of device id: {}, response: {}".format(device_id, response))
    return response.get("body", {})

def lambda_handler(event, context):
    return call_with_retry(SB_TOKEN, SB_SECRET_KEY, PI_DEVICE_NAME, _turn_plug_on)

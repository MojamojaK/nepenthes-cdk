import os
import requests

from switchbot import build_headers, get_device_id, invalidate_device_id, DEVICE_SEND_CMD_ENDPOINT_FORMAT

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
    try:
        pi_device_id = get_device_id(SB_TOKEN, SB_SECRET_KEY, PI_DEVICE_NAME)
        try:
            response = _turn_plug_on(pi_device_id)
        except Exception:
            print("Retrying with fresh device id for {}".format(PI_DEVICE_NAME))
            invalidate_device_id(PI_DEVICE_NAME)
            pi_device_id = get_device_id(SB_TOKEN, SB_SECRET_KEY, PI_DEVICE_NAME)
            print("{} device id (refreshed): {}".format(PI_DEVICE_NAME, pi_device_id))
            response = _turn_plug_on(pi_device_id)
        print(response)
    except Exception as e:
        print(e)
        raise e
    return response

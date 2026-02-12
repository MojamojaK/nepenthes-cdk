import os
import requests

from switchbot import build_headers, GET_DEVICES_ENDPOINT, DEVICE_SEND_CMD_ENDPOINT_FORMAT

SB_TOKEN = os.environ["SB_TOKEN"]
SB_SECRET_KEY = os.environ["SB_SECRET_KEY"]

DEVICE_TYPE_PLUG_MINI_JP = "Plug Mini (JP)"

PI_DEVICE_NAME = "N. Pi"

def _get_device_id(name, type=DEVICE_TYPE_PLUG_MINI_JP):
    headers=build_headers(SB_TOKEN, SB_SECRET_KEY)
    response = requests.get(GET_DEVICES_ENDPOINT, headers=headers, timeout=10).json()
    if response.get("statusCode", 0) != 100:
        raise RuntimeError("Unable to fetch Device IDs. Response: {}".format(response))
    for d in response.get("body", {}).get("deviceList", []):
        if not d["enableCloudService"]:
            continue
        if d["deviceType"] != type:
            continue
        if d["deviceName"] != name:
            continue
        return d["deviceId"]
    raise RuntimeError("Unable to fetch Device ID of {}".format(PI_DEVICE_NAME))

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
        pi_device_id = _get_device_id(PI_DEVICE_NAME)
        response = _turn_plug_on(pi_device_id)
        print(response)
    except Exception as e:
        print(e)
        raise e
    return response

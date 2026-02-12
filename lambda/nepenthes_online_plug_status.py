import os
import requests
from cloudwatch import put_cloudwatch
from switchbot import build_headers, GET_DEVICES_ENDPOINT, DEVICE_STATUS_ENDPOINT_FORMAT

SB_TOKEN = os.environ["SB_TOKEN"]
SB_SECRET_KEY = os.environ["SB_SECRET_KEY"]
METRIC_NAMESPACE = os.environ["METRIC_NAMESPACE"]

DEVICE_TYPE_PLUG_MINI_JP = "Plug Mini (JP)"

DEVICES = [{
    "Name": "N. Pi",
    "Id": os.environ.get("SB_PI_DEVICE_ID", ""),
}, {
    "Name": "N. Fan",
    "Id": os.environ.get("SB_FAN_DEVICE_ID", ""),
}]

def _get_device_id(name, type=DEVICE_TYPE_PLUG_MINI_JP):
    response = requests.get(GET_DEVICES_ENDPOINT, headers=build_headers(SB_TOKEN, SB_SECRET_KEY), timeout=10).json()
    if response.get("statusCode", 0) != 100:
        raise RuntimeError("Unable to fetch Device IDs. Response: {}".format(response))
    print(response)
    for d in response.get("body", {}).get("deviceList", []):
        if not d["enableCloudService"]:
            continue
        if d["deviceType"] != type:
            continue
        if d["deviceName"] != name:
            continue
        return d["deviceId"]
    raise RuntimeError("Unable to fetch Device ID of {}".format(name))

def _get_device_status(device_id):
    device_status_endpoint = DEVICE_STATUS_ENDPOINT_FORMAT.format(device_id)
    response = requests.get(device_status_endpoint, headers=build_headers(SB_TOKEN, SB_SECRET_KEY), timeout=10).json()
    if response.get("statusCode", 0) != 100:
        raise RuntimeError("Unable to status of device id: {}, response: {}".format(device_id, response))
    return response.get("body", {})

def lambda_handler(event, context):
    for device in DEVICES:
        device_name = device["Name"]
        dimensions = [{
            "Name": "Plug",
            "Value": device_name.replace(" ", ""),
        }]
        try:
            device_id = _get_device_id(device_name) if not device["Id"] else device["Id"]
            print("{} device id: {}".format(device_name, device_id))
            response = _get_device_status(device_id)
            print(response)
        except Exception as e:
            print(e)
            put_cloudwatch(METRIC_NAMESPACE, "Valid", False, "None", dimensions=dimensions)
            raise e
        put_cloudwatch(METRIC_NAMESPACE, "Valid", True, "None", dimensions=dimensions)
        put_cloudwatch(METRIC_NAMESPACE, "Switch", response["power"] == "on", "None", dimensions=dimensions)
        put_cloudwatch(METRIC_NAMESPACE, "Power", response["electricCurrent"] if response["power"] == "on" else 0, "None", dimensions=dimensions)
    return response

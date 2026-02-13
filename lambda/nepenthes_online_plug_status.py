import os
import requests
from cloudwatch import put_cloudwatch
from switchbot import build_headers, call_with_retry, DEVICE_STATUS_ENDPOINT_FORMAT

SB_TOKEN = os.environ["SB_TOKEN"]
SB_SECRET_KEY = os.environ["SB_SECRET_KEY"]
METRIC_NAMESPACE = os.environ["METRIC_NAMESPACE"]

DEVICE_NAMES = ["N. Pi", "N. Fan"]

def _get_device_status(device_id):
    device_status_endpoint = DEVICE_STATUS_ENDPOINT_FORMAT.format(device_id)
    response = requests.get(device_status_endpoint, headers=build_headers(SB_TOKEN, SB_SECRET_KEY), timeout=10).json()
    if response.get("statusCode", 0) != 100:
        raise RuntimeError("Unable to status of device id: {}, response: {}".format(device_id, response))
    return response.get("body", {})

def lambda_handler(event, context):
    for device_name in DEVICE_NAMES:
        dimensions = [{
            "Name": "Plug",
            "Value": device_name.replace(" ", ""),
        }]
        try:
            response = call_with_retry(SB_TOKEN, SB_SECRET_KEY, device_name, _get_device_status)
        except Exception as e:
            put_cloudwatch(METRIC_NAMESPACE, "Valid", False, "None", dimensions=dimensions)
            raise e
        put_cloudwatch(METRIC_NAMESPACE, "Valid", True, "None", dimensions=dimensions)
        put_cloudwatch(METRIC_NAMESPACE, "Switch", response["power"] == "on", "None", dimensions=dimensions)
        put_cloudwatch(METRIC_NAMESPACE, "Power", response["electricCurrent"] if response["power"] == "on" else 0, "None", dimensions=dimensions)
    return response

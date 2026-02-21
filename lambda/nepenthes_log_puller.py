import datetime
import logging
import os
from cloudwatch import put_cloudwatch

logger = logging.getLogger(__name__)

METRIC_NAMESPACE = os.environ["METRIC_NAMESPACE"]

def lambda_handler(event, context):
    logger.info("Event: %s", event)
    meters = event.get("meters", {}).get("v0", {})
    plugs = event.get("plugs", {}).get("v0", {})
    should_heartbeat = event["should_heartbeat"]
    
    # Publish Heartbeat metric
    put_cloudwatch(METRIC_NAMESPACE, "Heartbeat", should_heartbeat, "None")

    # Publish Cooler Frozen metric
    cooler_frozen = event.get("cooler_frozen")
    if cooler_frozen is not None:
        put_cloudwatch(METRIC_NAMESPACE, "CoolerFrozen", cooler_frozen, "None")

    # Publish Meter metrics
    for alias, data in meters.items():
        dimensions = [{
            "Name": "Meter",
            "Value": alias
        }]
        valid = data["Valid"]
        timestamp = datetime.datetime.fromisoformat(data["Datetime"]) if "Datetime" in data else datetime.datetime.now()
        put_cloudwatch(METRIC_NAMESPACE, "Valid", valid, "None", timestamp=timestamp, dimensions=dimensions)
        if not valid:
            continue
        if timestamp.hour in [0, 6, 12, 18] and timestamp.minute < 15:
            put_cloudwatch(METRIC_NAMESPACE, "Battery", data["BatteryVoltage"], "Percent", timestamp=timestamp, dimensions=dimensions)
        put_cloudwatch(METRIC_NAMESPACE, "Humidity", data["Humidity"], "Percent", timestamp=timestamp, dimensions=dimensions)
        put_cloudwatch(METRIC_NAMESPACE, "Temperature", data["Temperature"], "None", timestamp=timestamp, dimensions=dimensions)
        
    # Publish Plug metrics
    for alias, data in plugs.items():
        dimensions = [{
            "Name": "Plug",
            "Value": alias
        }]
        valid = data["Valid"]
        timestamp = datetime.datetime.fromisoformat(data["Datetime"]) if "Datetime" in data else datetime.datetime.now()
        put_cloudwatch(METRIC_NAMESPACE, "Valid", valid, "None", timestamp=timestamp, dimensions=dimensions)
        if not valid:
            continue
        put_cloudwatch(METRIC_NAMESPACE, "Switch", data["Switch"], "None", timestamp=timestamp, dimensions=dimensions)
        put_cloudwatch(METRIC_NAMESPACE, "Power", data["Power"], "None", timestamp=timestamp, dimensions=dimensions)

    return

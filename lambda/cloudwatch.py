import boto3
import datetime
import logging

logger = logging.getLogger(__name__)

cloud_watch = boto3.client('cloudwatch')

def put_cloudwatch(metricNamespace, metricName, value, unit, timestamp=None, dimensions=None):
    metricName = metricName.replace(" ", "")
    value = (1 if value else 0) if type(value) == bool else value
    if not timestamp:
        timestamp = datetime.datetime.now()
    try:
        data = {
            "MetricName" : metricName,
            "Timestamp"  : timestamp,
            "Value"      : value,
            "Unit"       : unit
        }
        if dimensions:
            data["Dimensions"] = dimensions
        cloud_watch.put_metric_data(
            Namespace  = metricNamespace,
            MetricData = [data]
        )
    except Exception as e:
        logger.error("Failed to put metric %s: %s", metricName, e)
        raise

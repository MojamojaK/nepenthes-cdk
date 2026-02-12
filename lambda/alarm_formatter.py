import json


COMPARISON_SYMBOLS = {
    "GreaterThanOrEqualToThreshold": ">=",
    "GreaterThanThreshold": ">",
    "LessThanOrEqualToThreshold": "<=",
    "LessThanThreshold": "<",
    "GreaterThanUpperThreshold": "> upper",
    "LessThanLowerThreshold": "< lower",
}


def _format_period(seconds):
    if seconds >= 3600:
        return f"{seconds // 3600}h"
    if seconds >= 60:
        return f"{seconds // 60}m"
    return f"{seconds}s"


def format_alarm(sns_record):
    """Parse an SNS record containing a CloudWatch alarm and return a formatted dict.

    Returns:
        dict with "title" (short summary) and "body" (detailed message).
    """
    sns_message = sns_record.get("Sns", {})
    subject = sns_message.get("Subject", "")

    try:
        alarm = json.loads(sns_message.get("Message", "{}"))
    except (json.JSONDecodeError, TypeError):
        return {"title": subject or "Alarm Notification", "body": str(sns_message)}

    alarm_name = alarm.get("AlarmName", "Unknown")
    new_state = alarm.get("NewStateValue", "Unknown")
    old_state = alarm.get("OldStateValue", "Unknown")
    reason = alarm.get("NewStateReason", "")
    state_change_time = alarm.get("StateChangeTime", "")

    trigger = alarm.get("Trigger", {})
    metric_name = trigger.get("MetricName", "Unknown")
    dimensions = trigger.get("Dimensions", [])
    threshold = trigger.get("Threshold")
    comparison = trigger.get("ComparisonOperator", "")
    statistic = trigger.get("Statistic", "")
    period = trigger.get("Period", 0)
    datapoints_to_alarm = trigger.get("DatapointsToAlarm", "")
    evaluation_periods = trigger.get("EvaluationPeriods", "")
    treat_missing = trigger.get("TreatMissingData", "")

    # Format dimensions as "Value (Name)" pairs
    dims_parts = [
        f"{d.get('value', '?')} ({d.get('name', '?')})"
        for d in dimensions
    ]
    dims_str = ", ".join(dims_parts) if dims_parts else "None"

    comp_symbol = COMPARISON_SYMBOLS.get(comparison, comparison)
    period_str = _format_period(period)

    title = f"{new_state}: {alarm_name}"

    body_lines = [
        f"State:     {old_state} -> {new_state}",
        f"Time:      {state_change_time}",
        f"Reason:    {reason}",
        f"",
        f"Metric:    {metric_name}",
        f"Device:    {dims_str}",
        f"Condition: {statistic} {comp_symbol} {threshold}",
        f"Period:    {period_str} ({datapoints_to_alarm}/{evaluation_periods} datapoints)",
        f"Missing:   treated as {treat_missing}",
    ]

    return {"title": title, "body": "\n".join(body_lines)}

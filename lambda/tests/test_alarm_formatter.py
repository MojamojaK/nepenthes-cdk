import json

from alarm_formatter import format_alarm, _format_period, _extract_recent_values, COMPARISON_SYMBOLS


class TestFormatPeriod:
    def test_seconds(self):
        assert _format_period(30) == "30s"

    def test_minutes(self):
        assert _format_period(120) == "2m"

    def test_hours(self):
        assert _format_period(7200) == "2h"


class TestExtractRecentValues:
    def test_extracts_values_from_reason(self):
        reason = "Threshold Crossed: 30 out of 30 datapoints were greater than the threshold (26.0). The most recent datapoints which crossed the threshold: [27.3, 27.1, 26.8]."
        assert _extract_recent_values(reason) == "27.3, 27.1, 26.8"

    def test_single_value(self):
        reason = "Threshold Crossed: 1 out of 1 datapoints [5.0] was less than the threshold."
        assert _extract_recent_values(reason) == "5.0"

    def test_returns_none_when_no_values(self):
        assert _extract_recent_values("Threshold crossed") is None

    def test_returns_none_for_empty_string(self):
        assert _extract_recent_values("") is None


class TestFormatAlarm:
    def _make_sns_record(self, alarm_dict):
        return {
            "Sns": {
                "Subject": "ALARM: test-alarm",
                "Message": json.dumps(alarm_dict),
            }
        }

    def test_basic_alarm(self):
        alarm = {
            "AlarmName": "HighTemp",
            "NewStateValue": "ALARM",
            "OldStateValue": "OK",
            "NewStateReason": "Threshold crossed",
            "StateChangeTime": "2024-01-15T12:00:00Z",
            "Trigger": {
                "MetricName": "Temperature",
                "Dimensions": [{"name": "Meter", "value": "Meter1"}],
                "Threshold": 35,
                "ComparisonOperator": "GreaterThanThreshold",
                "Statistic": "Maximum",
                "Period": 300,
                "DatapointsToAlarm": 1,
                "EvaluationPeriods": 1,
                "TreatMissingData": "missing",
            },
        }
        result = format_alarm(self._make_sns_record(alarm))
        assert result["title"] == "ALARM: HighTemp"
        assert result["state"] == "ALARM"
        assert "Temperature" in result["body"]
        assert "Meter1 (Meter)" in result["body"]
        assert "> 35" in result["body"]

    def test_state_returned_for_ok(self):
        alarm = {"NewStateValue": "OK", "AlarmName": "Test"}
        result = format_alarm(self._make_sns_record(alarm))
        assert result["state"] == "OK"

    def test_missing_fields_use_defaults(self):
        result = format_alarm(self._make_sns_record({}))
        assert result["title"] == "Unknown: Unknown"
        assert result["state"] == "Unknown"
        assert "Unknown" in result["body"]

    def test_invalid_json_message(self):
        record = {"Sns": {"Subject": "Test", "Message": "not-json"}}
        result = format_alarm(record)
        assert result["title"] == "Test"

    def test_empty_sns_record(self):
        result = format_alarm({})
        assert result["title"] == "Unknown: Unknown"

    def test_no_dimensions(self):
        alarm = {"Trigger": {"Dimensions": []}}
        result = format_alarm(self._make_sns_record(alarm))
        assert "None" in result["body"]

    def test_recent_values_included_when_present(self):
        alarm = {
            "NewStateReason": "Threshold Crossed: datapoints [27.3, 27.1, 26.8].",
            "Trigger": {"Threshold": 26},
        }
        result = format_alarm(self._make_sns_record(alarm))
        assert "Recent:    27.3, 27.1, 26.8" in result["body"]

    def test_recent_values_omitted_when_absent(self):
        alarm = {
            "NewStateReason": "Threshold crossed",
            "Trigger": {"Threshold": 26},
        }
        result = format_alarm(self._make_sns_record(alarm))
        assert "Recent:" not in result["body"]

    def test_all_comparison_symbols(self):
        for operator, symbol in COMPARISON_SYMBOLS.items():
            alarm = {"Trigger": {"ComparisonOperator": operator, "Threshold": 10}}
            result = format_alarm(self._make_sns_record(alarm))
            assert symbol in result["body"]

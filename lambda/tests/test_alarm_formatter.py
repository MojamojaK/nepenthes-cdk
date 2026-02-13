import json

from alarm_formatter import format_alarm, _format_period, COMPARISON_SYMBOLS


class TestFormatPeriod:
    def test_seconds(self):
        assert _format_period(30) == "30s"

    def test_minutes(self):
        assert _format_period(120) == "2m"

    def test_hours(self):
        assert _format_period(7200) == "2h"


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

    def test_all_comparison_symbols(self):
        for operator, symbol in COMPARISON_SYMBOLS.items():
            alarm = {"Trigger": {"ComparisonOperator": operator, "Threshold": 10}}
            result = format_alarm(self._make_sns_record(alarm))
            assert symbol in result["body"]

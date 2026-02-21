import os
import datetime
from unittest.mock import patch, call

os.environ["METRIC_NAMESPACE"] = "TestNamespace"

from nepenthes_log_puller import lambda_handler


class TestLogPullerHandler:
    @patch("nepenthes_log_puller.put_cloudwatch")
    def test_heartbeat_published(self, mock_cw):
        event = {"should_heartbeat": 1, "meters": {"v0": {}}, "plugs": {"v0": {}}}
        lambda_handler(event, None)
        mock_cw.assert_any_call("TestNamespace", "Heartbeat", 1, "None")

    @patch("nepenthes_log_puller.put_cloudwatch")
    def test_valid_meter_publishes_all_metrics(self, mock_cw):
        event = {
            "should_heartbeat": 1,
            "meters": {
                "v0": {
                    "Meter 1": {
                        "Valid": True,
                        "Temperature": 22.5,
                        "Humidity": 75.0,
                        "BatteryVoltage": 95,
                        "Datetime": "2024-01-15T12:00:00",
                    }
                }
            },
            "plugs": {"v0": {}},
        }
        lambda_handler(event, None)

        # Should publish Valid, Humidity, Temperature (not Battery since hour 12, minute 0 < 15)
        call_args_list = [c.args for c in mock_cw.call_args_list]
        metric_names = [args[1] for args in call_args_list]
        assert "Heartbeat" in metric_names
        assert "Valid" in metric_names
        assert "Temperature" in metric_names
        assert "Humidity" in metric_names
        assert "Battery" in metric_names  # hour 12, minute 0 < 15

    @patch("nepenthes_log_puller.put_cloudwatch")
    def test_invalid_meter_only_publishes_valid(self, mock_cw):
        event = {
            "should_heartbeat": 0,
            "meters": {
                "v0": {
                    "Meter 1": {
                        "Valid": False,
                        "Datetime": "2024-01-15T14:30:00",
                    }
                }
            },
            "plugs": {"v0": {}},
        }
        lambda_handler(event, None)

        call_args_list = [c.args for c in mock_cw.call_args_list]
        metric_names = [args[1] for args in call_args_list]
        assert "Valid" in metric_names
        assert "Temperature" not in metric_names
        assert "Humidity" not in metric_names

    @patch("nepenthes_log_puller.put_cloudwatch")
    def test_valid_plug_publishes_switch_and_power(self, mock_cw):
        event = {
            "should_heartbeat": 0,
            "meters": {"v0": {}},
            "plugs": {
                "v0": {
                    "N.Pi": {
                        "Valid": True,
                        "Switch": True,
                        "Power": 5.2,
                        "Datetime": "2024-01-15T12:00:00",
                    }
                }
            },
        }
        lambda_handler(event, None)

        call_args_list = [c.args for c in mock_cw.call_args_list]
        metric_names = [args[1] for args in call_args_list]
        assert "Valid" in metric_names
        assert "Switch" in metric_names
        assert "Power" in metric_names

    @patch("nepenthes_log_puller.put_cloudwatch")
    def test_invalid_plug_only_publishes_valid(self, mock_cw):
        event = {
            "should_heartbeat": 0,
            "meters": {"v0": {}},
            "plugs": {
                "v0": {
                    "N.Pi": {
                        "Valid": False,
                        "Datetime": "2024-01-15T12:00:00",
                    }
                }
            },
        }
        lambda_handler(event, None)

        call_args_list = [c.args for c in mock_cw.call_args_list]
        metric_names = [args[1] for args in call_args_list]
        assert "Valid" in metric_names
        assert "Switch" not in metric_names
        assert "Power" not in metric_names

    @patch("nepenthes_log_puller.put_cloudwatch")
    def test_cooler_frozen_published_when_true(self, mock_cw):
        event = {"should_heartbeat": 1, "cooler_frozen": True, "meters": {"v0": {}}, "plugs": {"v0": {}}}
        lambda_handler(event, None)
        mock_cw.assert_any_call("TestNamespace", "CoolerFrozen", True, "None")

    @patch("nepenthes_log_puller.put_cloudwatch")
    def test_cooler_frozen_published_when_false(self, mock_cw):
        event = {"should_heartbeat": 1, "cooler_frozen": False, "meters": {"v0": {}}, "plugs": {"v0": {}}}
        lambda_handler(event, None)
        mock_cw.assert_any_call("TestNamespace", "CoolerFrozen", False, "None")

    @patch("nepenthes_log_puller.put_cloudwatch")
    def test_cooler_frozen_not_published_when_absent(self, mock_cw):
        event = {"should_heartbeat": 1, "meters": {"v0": {}}, "plugs": {"v0": {}}}
        lambda_handler(event, None)
        call_args_list = [c.args for c in mock_cw.call_args_list]
        metric_names = [args[1] for args in call_args_list]
        assert "CoolerFrozen" not in metric_names

    @patch("nepenthes_log_puller.put_cloudwatch")
    def test_battery_not_published_outside_schedule(self, mock_cw):
        event = {
            "should_heartbeat": 0,
            "meters": {
                "v0": {
                    "Meter 1": {
                        "Valid": True,
                        "Temperature": 22.5,
                        "Humidity": 75.0,
                        "BatteryVoltage": 95,
                        "Datetime": "2024-01-15T14:30:00",  # hour 14, not in [0,6,12,18]
                    }
                }
            },
            "plugs": {"v0": {}},
        }
        lambda_handler(event, None)

        call_args_list = [c.args for c in mock_cw.call_args_list]
        metric_names = [args[1] for args in call_args_list]
        assert "Battery" not in metric_names

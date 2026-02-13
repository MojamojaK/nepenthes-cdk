import os
import pytest
from unittest.mock import patch, MagicMock

os.environ["SB_TOKEN"] = "test-token"
os.environ["SB_SECRET_KEY"] = "test-secret"
os.environ["METRIC_NAMESPACE"] = "TestNamespace"

from nepenthes_online_plug_status import lambda_handler, _get_device_status


class TestLambdaHandler:
    @patch("nepenthes_online_plug_status.put_cloudwatch")
    @patch("nepenthes_online_plug_status.call_with_retry")
    def test_publishes_metrics_for_online_plug(self, mock_retry, mock_cw):
        mock_retry.return_value = {"power": "on", "electricCurrent": 5.2}

        lambda_handler({}, None)

        metric_names = [c.args[1] for c in mock_cw.call_args_list]
        assert "Valid" in metric_names
        assert "Switch" in metric_names
        assert "Power" in metric_names

    @patch("nepenthes_online_plug_status.put_cloudwatch")
    @patch("nepenthes_online_plug_status.call_with_retry")
    def test_publishes_zero_power_when_off(self, mock_retry, mock_cw):
        mock_retry.return_value = {"power": "off", "electricCurrent": 0}

        lambda_handler({}, None)

        power_calls = [c for c in mock_cw.call_args_list if c.args[1] == "Power"]
        assert power_calls[0].args[2] == 0

    @patch("nepenthes_online_plug_status.put_cloudwatch")
    @patch("nepenthes_online_plug_status.call_with_retry")
    def test_calls_retry_for_each_device(self, mock_retry, mock_cw):
        mock_retry.return_value = {"power": "on", "electricCurrent": 1}

        lambda_handler({}, None)

        device_names = [c.args[2] for c in mock_retry.call_args_list]
        assert "N. Pi" in device_names
        assert "N. Fan" in device_names

    @patch("nepenthes_online_plug_status.put_cloudwatch")
    @patch("nepenthes_online_plug_status.call_with_retry")
    def test_publishes_valid_false_on_failure(self, mock_retry, mock_cw):
        mock_retry.side_effect = RuntimeError("Cannot find device")

        try:
            lambda_handler({}, None)
        except RuntimeError:
            pass

        valid_calls = [c for c in mock_cw.call_args_list if c.args[1] == "Valid"]
        assert any(c.args[2] is False for c in valid_calls)


class TestGetDeviceStatus:
    @patch("nepenthes_online_plug_status.build_headers")
    @patch("nepenthes_online_plug_status.requests.get")
    def test_returns_response_body(self, mock_get, mock_headers):
        mock_headers.return_value = {"Authorization": "tok"}
        mock_get.return_value.json.return_value = {
            "statusCode": 100,
            "body": {"power": "on", "electricCurrent": 5.2},
        }

        result = _get_device_status("device-123")
        assert result == {"power": "on", "electricCurrent": 5.2}

    @patch("nepenthes_online_plug_status.build_headers")
    @patch("nepenthes_online_plug_status.requests.get")
    def test_raises_on_api_error(self, mock_get, mock_headers):
        mock_headers.return_value = {"Authorization": "tok"}
        mock_get.return_value.json.return_value = {
            "statusCode": 190,
            "body": {},
        }

        with pytest.raises(RuntimeError):
            _get_device_status("device-123")

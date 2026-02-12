import os
from unittest.mock import patch, MagicMock

os.environ["SB_TOKEN"] = "test-token"
os.environ["SB_SECRET_KEY"] = "test-secret"
os.environ["METRIC_NAMESPACE"] = "TestNamespace"

from nepenthes_online_plug_status import lambda_handler


class TestLambdaHandler:
    @patch("nepenthes_online_plug_status.put_cloudwatch")
    @patch("nepenthes_online_plug_status.get_device_id")
    @patch("nepenthes_online_plug_status.requests.get")
    def test_publishes_metrics_for_online_plug(self, mock_get, mock_get_id, mock_cw):
        mock_get_id.return_value = "device-123"
        mock_get.return_value.json.return_value = {
            "statusCode": 100,
            "body": {"power": "on", "electricCurrent": 5.2},
        }

        lambda_handler({}, None)

        metric_names = [c.args[1] for c in mock_cw.call_args_list]
        assert "Valid" in metric_names
        assert "Switch" in metric_names
        assert "Power" in metric_names

    @patch("nepenthes_online_plug_status.put_cloudwatch")
    @patch("nepenthes_online_plug_status.get_device_id")
    @patch("nepenthes_online_plug_status.requests.get")
    def test_publishes_zero_power_when_off(self, mock_get, mock_get_id, mock_cw):
        mock_get_id.return_value = "device-123"
        mock_get.return_value.json.return_value = {
            "statusCode": 100,
            "body": {"power": "off", "electricCurrent": 0},
        }

        lambda_handler({}, None)

        power_calls = [c for c in mock_cw.call_args_list if c.args[1] == "Power"]
        assert power_calls[0].args[2] == 0

    @patch("nepenthes_online_plug_status.put_cloudwatch")
    @patch("nepenthes_online_plug_status.get_device_id")
    @patch("nepenthes_online_plug_status.requests.get")
    def test_retries_with_fresh_device_id(self, mock_get, mock_get_id, mock_cw):
        mock_get_id.return_value = "device-123"
        success = {"statusCode": 100, "body": {"power": "on", "electricCurrent": 1}}
        # First call raises (triggers retry for device 1), rest succeed
        mock_get.return_value.json.side_effect = [
            RuntimeError("API error"), success, success,
        ]

        with patch("nepenthes_online_plug_status.invalidate_device_id") as mock_inv:
            lambda_handler({}, None)
            mock_inv.assert_called()

    @patch("nepenthes_online_plug_status.put_cloudwatch")
    @patch("nepenthes_online_plug_status.get_device_id")
    @patch("nepenthes_online_plug_status.requests.get")
    def test_publishes_valid_false_on_failure(self, mock_get, mock_get_id, mock_cw):
        mock_get_id.side_effect = RuntimeError("Cannot find device")

        try:
            lambda_handler({}, None)
        except RuntimeError:
            pass

        valid_calls = [c for c in mock_cw.call_args_list if c.args[1] == "Valid"]
        assert any(c.args[2] is False for c in valid_calls)

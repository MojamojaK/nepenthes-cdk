import os
from unittest.mock import patch, MagicMock

os.environ["SB_TOKEN"] = "test-token"
os.environ["SB_SECRET_KEY"] = "test-secret"

from nepenthes_pi_plug_on import lambda_handler


class TestLambdaHandler:
    @patch("nepenthes_pi_plug_on.get_device_id")
    @patch("nepenthes_pi_plug_on.requests.post")
    def test_turns_plug_on(self, mock_post, mock_get_id):
        mock_get_id.return_value = "device-123"
        mock_post.return_value.json.return_value = {
            "statusCode": 100,
            "body": {"items": []},
        }

        result = lambda_handler({}, None)

        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args.kwargs
        assert call_kwargs["json"]["command"] == "turnOn"

    @patch("nepenthes_pi_plug_on.get_device_id")
    @patch("nepenthes_pi_plug_on.requests.post")
    def test_returns_response_body(self, mock_post, mock_get_id):
        mock_get_id.return_value = "device-123"
        mock_post.return_value.json.return_value = {
            "statusCode": 100,
            "body": {"items": ["ok"]},
        }

        result = lambda_handler({}, None)
        assert result == {"items": ["ok"]}

    @patch("nepenthes_pi_plug_on.invalidate_device_id")
    @patch("nepenthes_pi_plug_on.get_device_id")
    @patch("nepenthes_pi_plug_on.requests.post")
    def test_retries_with_fresh_device_id(self, mock_post, mock_get_id, mock_inv):
        mock_get_id.return_value = "device-123"
        # First call fails, second succeeds
        mock_post.return_value.json.side_effect = [
            RuntimeError("API error"),
            {"statusCode": 100, "body": {"items": []}},
        ]

        lambda_handler({}, None)
        mock_inv.assert_called_once_with("N. Pi")

    @patch("nepenthes_pi_plug_on.get_device_id")
    @patch("nepenthes_pi_plug_on.requests.post")
    def test_raises_on_api_error(self, mock_post, mock_get_id):
        mock_get_id.return_value = "device-123"
        mock_post.return_value.json.return_value = {
            "statusCode": 190,
            "body": {},
        }

        try:
            lambda_handler({}, None)
            assert False, "Expected RuntimeError"
        except RuntimeError:
            pass

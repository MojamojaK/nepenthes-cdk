import os
import pytest
from unittest.mock import patch, MagicMock

os.environ["SB_TOKEN"] = "test-token"
os.environ["SB_SECRET_KEY"] = "test-secret"

from nepenthes_pi_plug_on import lambda_handler, _turn_plug_on


class TestLambdaHandler:
    @patch("nepenthes_pi_plug_on.call_with_retry")
    def test_returns_response_from_call_with_retry(self, mock_retry):
        mock_retry.return_value = {"items": ["ok"]}

        result = lambda_handler({}, None)

        assert result == {"items": ["ok"]}

    @patch("nepenthes_pi_plug_on.call_with_retry")
    def test_passes_pi_device_name(self, mock_retry):
        mock_retry.return_value = {"items": []}

        lambda_handler({}, None)

        assert mock_retry.call_args.args[2] == "N. Pi"

    @patch("nepenthes_pi_plug_on.call_with_retry")
    def test_passes_turn_plug_on_operation(self, mock_retry):
        mock_retry.return_value = {"items": []}

        lambda_handler({}, None)

        # The 4th argument is the operation function
        operation = mock_retry.call_args.args[3]
        assert callable(operation)

    @patch("nepenthes_pi_plug_on.call_with_retry")
    def test_raises_when_retry_fails(self, mock_retry):
        mock_retry.side_effect = RuntimeError("All retries failed")

        with pytest.raises(RuntimeError, match="All retries failed"):
            lambda_handler({}, None)


class TestTurnPlugOn:
    @patch("nepenthes_pi_plug_on.build_headers")
    @patch("nepenthes_pi_plug_on.requests.post")
    def test_sends_turn_on_command(self, mock_post, mock_headers):
        mock_headers.return_value = {"Authorization": "tok"}
        mock_post.return_value.json.return_value = {
            "statusCode": 100,
            "body": {"items": []},
        }

        result = _turn_plug_on("device-123")

        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args.kwargs
        assert call_kwargs["json"]["command"] == "turnOn"
        assert result == {"items": []}

    @patch("nepenthes_pi_plug_on.build_headers")
    @patch("nepenthes_pi_plug_on.requests.post")
    def test_raises_on_api_error(self, mock_post, mock_headers):
        mock_headers.return_value = {"Authorization": "tok"}
        mock_post.return_value.json.return_value = {
            "statusCode": 190,
            "body": {},
        }

        with pytest.raises(RuntimeError):
            _turn_plug_on("device-123")

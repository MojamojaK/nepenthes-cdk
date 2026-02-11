import os
import json
from unittest.mock import patch, MagicMock

os.environ["PUSHOVER_API_KEY"] = "test-api-key"
os.environ["PAGEE_USER_KEY"] = "test-user-key"

from nepenthes_pushover import lambda_handler, _parse_message, _default


class TestDefault:
    def test_datetime_like_object(self):
        mock_dt = MagicMock()
        mock_dt.astimezone.return_value.isoformat.return_value = "2024-01-15T12:00:00+09:00"
        result = _default(mock_dt)
        assert result == "2024-01-15T12:00:00+09:00"

    def test_non_datetime_object(self):
        result = _default(42)
        assert result == "42"


class TestParseMessage:
    def test_returns_valid_json(self):
        event = {"key": "value"}
        result = _parse_message(event)
        parsed = json.loads(result)
        assert parsed["Event"] == {"key": "value"}


class TestLambdaHandler:
    @patch("nepenthes_pushover.requests.post")
    def test_sends_pushover_request(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = '{"status": 1}'
        mock_post.return_value = mock_response

        result = lambda_handler({"test": "event"}, None)

        mock_post.assert_called_once()
        call_args = mock_post.call_args
        assert call_args.args[0] == "https://api.pushover.net/1/messages.json"
        data = call_args.kwargs["data"]
        assert data["token"] == "test-api-key"
        assert data["user"] == "test-user-key"
        assert data["priority"] == 2
        assert data["retry"] == 120
        assert data["expire"] == 900

    @patch("nepenthes_pushover.requests.post")
    def test_returns_status_and_body(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = '{"status": 1}'
        mock_post.return_value = mock_response

        result = lambda_handler({}, None)
        assert result["statusCode"] == 200
        assert result["body"]["status"] == 1

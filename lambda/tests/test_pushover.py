import os
import json
from unittest.mock import patch, MagicMock

os.environ["PUSHOVER_API_KEY"] = "test-api-key"
os.environ["PAGEE_USER_KEY"] = "test-user-key"

from nepenthes_pushover import lambda_handler


def _make_event(state="ALARM"):
    alarm = {"NewStateValue": state, "AlarmName": "TestAlarm", "Trigger": {}}
    return {"Records": [{"Sns": {"Subject": state, "Message": json.dumps(alarm)}}]}


class TestLambdaHandler:
    @patch("nepenthes_pushover.requests.post")
    def test_sends_pushover_request(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = '{"status": 1}'
        mock_post.return_value = mock_response

        lambda_handler(_make_event("ALARM"), None)

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

        result = lambda_handler(_make_event("ALARM"), None)
        assert result["statusCode"] == 200
        assert result["body"]["status"] == 1

    @patch("nepenthes_pushover.requests.post")
    def test_handles_non_json_response(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"
        mock_post.return_value = mock_response

        result = lambda_handler(_make_event("ALARM"), None)
        assert result["statusCode"] == 500
        assert result["body"] == {"raw": "Internal Server Error"}

    @patch("nepenthes_pushover.requests.post")
    def test_skips_ok_state(self, mock_post):
        result = lambda_handler(_make_event("OK"), None)

        mock_post.assert_not_called()
        assert result["statusCode"] == 200
        assert result["body"] == "skipped OK state"

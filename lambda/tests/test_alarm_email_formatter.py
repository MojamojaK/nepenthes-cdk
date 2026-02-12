import os
import json
from unittest.mock import patch, MagicMock

os.environ["FORMATTED_TOPIC_ARN"] = "arn:aws:sns:us-west-2:123456789:test-topic"

from nepenthes_alarm_email_formatter import lambda_handler


class TestLambdaHandler:
    @patch("nepenthes_alarm_email_formatter.sns_client")
    def test_publishes_to_sns(self, mock_sns):
        mock_sns.publish.return_value = {"MessageId": "abc123"}
        event = {"Records": [{"Sns": {"Subject": "ALARM", "Message": "{}"}}]}

        result = lambda_handler(event, None)

        mock_sns.publish.assert_called_once()
        call_kwargs = mock_sns.publish.call_args.kwargs
        assert call_kwargs["TopicArn"] == "arn:aws:sns:us-west-2:123456789:test-topic"

    @patch("nepenthes_alarm_email_formatter.sns_client")
    def test_returns_200(self, mock_sns):
        mock_sns.publish.return_value = {"MessageId": "abc123"}
        event = {"Records": [{"Sns": {"Subject": "ALARM", "Message": "{}"}}]}

        result = lambda_handler(event, None)
        assert result["statusCode"] == 200

    @patch("nepenthes_alarm_email_formatter.sns_client")
    def test_subject_truncated_to_100_chars(self, mock_sns):
        mock_sns.publish.return_value = {"MessageId": "abc123"}
        alarm = {"AlarmName": "A" * 200, "NewStateValue": "ALARM"}
        event = {"Records": [{"Sns": {"Subject": "ALARM", "Message": json.dumps(alarm)}}]}

        lambda_handler(event, None)

        call_kwargs = mock_sns.publish.call_args.kwargs
        assert len(call_kwargs["Subject"]) <= 100

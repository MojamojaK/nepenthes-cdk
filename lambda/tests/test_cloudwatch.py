import datetime
from unittest.mock import patch, MagicMock
from cloudwatch import put_cloudwatch


class TestPutCloudwatch:
    @patch("cloudwatch.cloud_watch")
    def test_basic_metric(self, mock_cw):
        put_cloudwatch("TestNamespace", "TestMetric", 42.0, "None")
        mock_cw.put_metric_data.assert_called_once()
        call_args = mock_cw.put_metric_data.call_args
        assert call_args.kwargs["Namespace"] == "TestNamespace"
        metric_data = call_args.kwargs["MetricData"][0]
        assert metric_data["MetricName"] == "TestMetric"
        assert metric_data["Value"] == 42.0
        assert metric_data["Unit"] == "None"

    @patch("cloudwatch.cloud_watch")
    def test_boolean_true_converts_to_1(self, mock_cw):
        put_cloudwatch("NS", "Metric", True, "None")
        metric_data = mock_cw.put_metric_data.call_args.kwargs["MetricData"][0]
        assert metric_data["Value"] == 1

    @patch("cloudwatch.cloud_watch")
    def test_boolean_false_converts_to_0(self, mock_cw):
        put_cloudwatch("NS", "Metric", False, "None")
        metric_data = mock_cw.put_metric_data.call_args.kwargs["MetricData"][0]
        assert metric_data["Value"] == 0

    @patch("cloudwatch.cloud_watch")
    def test_custom_timestamp(self, mock_cw):
        ts = datetime.datetime(2024, 1, 15, 12, 0, 0)
        put_cloudwatch("NS", "Metric", 1, "None", timestamp=ts)
        metric_data = mock_cw.put_metric_data.call_args.kwargs["MetricData"][0]
        assert metric_data["Timestamp"] == ts

    @patch("cloudwatch.cloud_watch")
    def test_default_timestamp_is_set(self, mock_cw):
        put_cloudwatch("NS", "Metric", 1, "None")
        metric_data = mock_cw.put_metric_data.call_args.kwargs["MetricData"][0]
        assert isinstance(metric_data["Timestamp"], datetime.datetime)

    @patch("cloudwatch.cloud_watch")
    def test_with_dimensions(self, mock_cw):
        dims = [{"Name": "Meter", "Value": "Meter 1"}]
        put_cloudwatch("NS", "Metric", 1, "None", dimensions=dims)
        metric_data = mock_cw.put_metric_data.call_args.kwargs["MetricData"][0]
        assert metric_data["Dimensions"] == dims

    @patch("cloudwatch.cloud_watch")
    def test_without_dimensions(self, mock_cw):
        put_cloudwatch("NS", "Metric", 1, "None")
        metric_data = mock_cw.put_metric_data.call_args.kwargs["MetricData"][0]
        assert "Dimensions" not in metric_data

    @patch("cloudwatch.cloud_watch")
    def test_metric_name_spaces_removed(self, mock_cw):
        put_cloudwatch("NS", "My Metric", 1, "None")
        metric_data = mock_cw.put_metric_data.call_args.kwargs["MetricData"][0]
        assert metric_data["MetricName"] == "MyMetric"

    @patch("cloudwatch.cloud_watch")
    def test_exception_is_reraised(self, mock_cw):
        mock_cw.put_metric_data.side_effect = Exception("CloudWatch error")
        try:
            put_cloudwatch("NS", "Metric", 1, "None")
            assert False, "Should have raised"
        except Exception as e:
            assert str(e) == "CloudWatch error"

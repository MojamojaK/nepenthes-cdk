import base64
import hashlib
import hmac
import pytest
from unittest.mock import patch, MagicMock
from switchbot import build_headers, get_device_id, invalidate_device_id, _device_id_cache, GET_DEVICES_ENDPOINT, DEVICE_STATUS_ENDPOINT_FORMAT, DEVICE_SEND_CMD_ENDPOINT_FORMAT


class TestBuildHeaders:
    def test_returns_required_keys(self):
        headers = build_headers("test-token", "test-secret")
        assert "Authorization" in headers
        assert "sign" in headers
        assert "t" in headers
        assert "nonce" in headers
        assert "Content-Type" in headers

    def test_authorization_is_token(self):
        headers = build_headers("my-token", "my-secret")
        assert headers["Authorization"] == "my-token"

    def test_content_type(self):
        headers = build_headers("token", "secret")
        assert headers["Content-Type"] == "application/json; charset=utf-8"

    def test_sign_is_valid_hmac(self):
        token = "test-token"
        secret = "test-secret"
        headers = build_headers(token, secret)

        # Verify sign is valid base64
        sign = headers["sign"]
        decoded = base64.b64decode(sign)
        assert len(decoded) == 32  # SHA-256 produces 32 bytes

    def test_timestamp_is_numeric(self):
        headers = build_headers("token", "secret")
        assert headers["t"].isdigit()

    def test_nonce_is_uuid_format(self):
        headers = build_headers("token", "secret")
        parts = headers["nonce"].split("-")
        assert len(parts) == 5  # UUID has 5 parts


def _make_api_response(devices):
    return MagicMock(json=MagicMock(return_value={
        "statusCode": 100,
        "body": {"deviceList": devices},
    }))

FAKE_DEVICE_LIST = [
    {"deviceName": "N. Pi", "deviceId": "pi-123", "deviceType": "Plug Mini (JP)", "enableCloudService": True},
    {"deviceName": "N. Fan", "deviceId": "fan-456", "deviceType": "Plug Mini (JP)", "enableCloudService": True},
]


class TestGetDeviceId:
    def setup_method(self):
        _device_id_cache.clear()

    @patch("switchbot.requests.get")
    def test_fetches_from_api_and_returns_id(self, mock_get):
        mock_get.return_value = _make_api_response(FAKE_DEVICE_LIST)
        result = get_device_id("tok", "sec", "N. Pi")
        assert result == "pi-123"
        mock_get.assert_called_once()

    @patch("switchbot.requests.get")
    def test_caches_all_matching_devices_in_single_call(self, mock_get):
        mock_get.return_value = _make_api_response(FAKE_DEVICE_LIST)
        get_device_id("tok", "sec", "N. Pi")
        result = get_device_id("tok", "sec", "N. Fan")
        assert result == "fan-456"
        mock_get.assert_called_once()

    @patch("switchbot.requests.get")
    def test_returns_cached_id_without_api_call(self, mock_get):
        _device_id_cache["N. Pi"] = "cached-id"
        result = get_device_id("tok", "sec", "N. Pi")
        assert result == "cached-id"
        mock_get.assert_not_called()

    @patch("switchbot.requests.get")
    def test_skips_devices_with_cloud_service_disabled(self, mock_get):
        devices = [
            {"deviceName": "N. Pi", "deviceId": "pi-123", "deviceType": "Plug Mini (JP)", "enableCloudService": False},
        ]
        mock_get.return_value = _make_api_response(devices)
        with pytest.raises(RuntimeError, match="Unable to fetch Device ID of N. Pi"):
            get_device_id("tok", "sec", "N. Pi")

    @patch("switchbot.requests.get")
    def test_skips_devices_with_wrong_type(self, mock_get):
        devices = [
            {"deviceName": "N. Pi", "deviceId": "pi-123", "deviceType": "Bot", "enableCloudService": True},
        ]
        mock_get.return_value = _make_api_response(devices)
        with pytest.raises(RuntimeError, match="Unable to fetch Device ID of N. Pi"):
            get_device_id("tok", "sec", "N. Pi")

    @patch("switchbot.requests.get")
    def test_raises_on_api_error(self, mock_get):
        mock_get.return_value = MagicMock(json=MagicMock(return_value={"statusCode": 500}))
        with pytest.raises(RuntimeError, match="Unable to fetch Device IDs"):
            get_device_id("tok", "sec", "N. Pi")

    @patch("switchbot.requests.get")
    def test_raises_when_device_not_found(self, mock_get):
        mock_get.return_value = _make_api_response([])
        with pytest.raises(RuntimeError, match="Unable to fetch Device ID of N. Pi"):
            get_device_id("tok", "sec", "N. Pi")


class TestInvalidateDeviceId:
    def setup_method(self):
        _device_id_cache.clear()

    def test_removes_cached_entry(self):
        _device_id_cache["N. Pi"] = "pi-123"
        invalidate_device_id("N. Pi")
        assert "N. Pi" not in _device_id_cache

    def test_no_error_when_name_not_cached(self):
        invalidate_device_id("nonexistent")

    @patch("switchbot.requests.get")
    def test_forces_refetch_on_next_get(self, mock_get):
        _device_id_cache["N. Pi"] = "old-id"
        invalidate_device_id("N. Pi")
        mock_get.return_value = _make_api_response(FAKE_DEVICE_LIST)
        result = get_device_id("tok", "sec", "N. Pi")
        assert result == "pi-123"
        mock_get.assert_called_once()


class TestEndpoints:
    def test_get_devices_endpoint(self):
        assert GET_DEVICES_ENDPOINT == "https://api.switch-bot.com/v1.1/devices"

    def test_device_status_endpoint_format(self):
        result = DEVICE_STATUS_ENDPOINT_FORMAT.format("ABC123")
        assert result == "https://api.switch-bot.com/v1.1/devices/ABC123/status"

    def test_device_send_cmd_endpoint_format(self):
        result = DEVICE_SEND_CMD_ENDPOINT_FORMAT.format("ABC123")
        assert result == "https://api.switch-bot.com/v1.1/devices/ABC123/commands"

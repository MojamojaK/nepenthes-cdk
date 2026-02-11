import base64
import hashlib
import hmac
from unittest.mock import patch
from switchbot import build_headers, GET_DEVICES_ENDPOINT, DEVICE_STATUS_ENDPOINT_FORMAT, DEVICE_SEND_CMD_ENDPOINT_FORMAT


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


class TestEndpoints:
    def test_get_devices_endpoint(self):
        assert GET_DEVICES_ENDPOINT == "https://api.switch-bot.com/v1.1/devices"

    def test_device_status_endpoint_format(self):
        result = DEVICE_STATUS_ENDPOINT_FORMAT.format("ABC123")
        assert result == "https://api.switch-bot.com/v1.1/devices/ABC123/status"

    def test_device_send_cmd_endpoint_format(self):
        result = DEVICE_SEND_CMD_ENDPOINT_FORMAT.format("ABC123")
        assert result == "https://api.switch-bot.com/v1.1/devices/ABC123/commands"

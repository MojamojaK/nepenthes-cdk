import logging
import time
import hashlib
import hmac
import base64
import uuid

import requests

logger = logging.getLogger(__name__)

def build_headers(token, secret_key):
    def make_secret(secret_key):
        secret_key = bytes(secret_key, 'utf-8')
        return secret_key

    def make_sign(secret_key, t, nonce):
        string_to_sign = '{}{}{}'.format(token, t, nonce)
        string_to_sign = bytes(string_to_sign, 'utf-8')
        sign = base64.b64encode(hmac.new(secret_key, msg=string_to_sign, digestmod=hashlib.sha256).digest())
        return sign

    def make_t():
        t = int(round(time.time() * 1000))
        return str(t)

    def make_nonce():
        nonce = str(uuid.uuid4())
        return nonce
    t = make_t()
    nonce = make_nonce()
    return {
        "Authorization": token,
        "sign": make_sign(make_secret(secret_key), t, nonce),
        "t": t,
        "nonce": nonce,
        "Content-Type": "application/json; charset=utf-8"
    }

GET_DEVICES_ENDPOINT = "https://api.switch-bot.com/v1.1/devices"
DEVICE_STATUS_ENDPOINT_FORMAT = "https://api.switch-bot.com/v1.1/devices/{}/status"
DEVICE_SEND_CMD_ENDPOINT_FORMAT = "https://api.switch-bot.com/v1.1/devices/{}/commands"

_device_id_cache = {}

def invalidate_device_id(name):
    _device_id_cache.pop(name, None)

def get_device_id(token, secret_key, name, type="Plug Mini (JP)"):
    if name in _device_id_cache:
        return _device_id_cache[name]

    response = requests.get(GET_DEVICES_ENDPOINT, headers=build_headers(token, secret_key), timeout=10).json()
    if response.get("statusCode", 0) != 100:
        raise RuntimeError("Unable to fetch Device IDs. Response: {}".format(response))
    for d in response.get("body", {}).get("deviceList", []):
        if not d["enableCloudService"]:
            continue
        if d["deviceType"] != type:
            continue
        _device_id_cache[d["deviceName"]] = d["deviceId"]

    if name not in _device_id_cache:
        raise RuntimeError("Unable to fetch Device ID of {}".format(name))
    return _device_id_cache[name]


def call_with_retry(token, secret_key, device_name, operation, max_retries=2, base_delay=0.5):
    """Call operation(device_id) with exponential backoff and cache invalidation on failure.

    First attempt uses the (possibly cached) device ID. On failure, invalidates
    the cache, waits with exponential backoff, and retries with a fresh device ID.
    """
    last_exception = None
    for attempt in range(1 + max_retries):
        if attempt > 0:
            delay = base_delay * (2 ** (attempt - 1))
            logger.warning("Retry %d/%d for %s after %.1fs backoff", attempt, max_retries, device_name, delay)
            time.sleep(delay)
            invalidate_device_id(device_name)
        try:
            device_id = get_device_id(token, secret_key, device_name)
            return operation(device_id)
        except Exception as e:
            last_exception = e
    raise last_exception

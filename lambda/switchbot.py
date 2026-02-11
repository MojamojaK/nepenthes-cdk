import time
import hashlib
import hmac
import base64
import uuid

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

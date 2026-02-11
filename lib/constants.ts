import * as dotenv from 'dotenv';
dotenv.config();

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

// Secrets (loaded from .env locally, from environment variables in CI)
export const PUSHOVER_API_KEY = requireEnv("PUSHOVER_API_KEY");
export const PAGEE_USER_KEY = requireEnv("PAGEE_USER_KEY");
export const EMAIL_ADDRESS = requireEnv("EMAIL_ADDRESS");
export const SB_TOKEN = requireEnv("SB_TOKEN");
export const SB_SECRET_KEY = requireEnv("SB_SECRET_KEY");
export const SB_PI_DEVICE_ID = requireEnv("SB_PI_DEVICE_ID");
export const SB_FAN_DEVICE_ID = requireEnv("SB_FAN_DEVICE_ID");

// Metric constants (not secrets)
export const METRIC_NAMESPACE = "NHomeZero";
export const METRIC_NAME_HEARTBEAT = "Heartbeat";
export const METRIC_NAME_TEMPERATURE = "Temperature";
export const METRIC_NAME_HUMIDITY = "Humidity";
export const METRIC_NAME_BATTERY = "Battery";
export const METRIC_NAME_VALID = "Valid";
export const METRIC_NAME_SWITCH = "Switch";
export const METRIC_NAME_POWER = "Power";

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

// Metric constants (not secrets)
export const METRIC_NAMESPACE = "NHomeZero";
export const METRIC_NAME_HEARTBEAT = "Heartbeat";
export const METRIC_NAME_TEMPERATURE = "Temperature";
export const METRIC_NAME_HUMIDITY = "Humidity";
export const METRIC_NAME_BATTERY = "Battery";
export const METRIC_NAME_VALID = "Valid";
export const METRIC_NAME_SWITCH = "Switch";
export const METRIC_NAME_POWER = "Power";
export const METRIC_NAME_COOLER_FROZEN = "CoolerFrozen";

// Alarm thresholds (single source of truth for alarms and dashboard annotations)
export const THRESHOLD_TEMPERATURE_HIGH = 26.0;
export const THRESHOLD_TEMPERATURE_LOW = 10.0;
export const THRESHOLD_HUMIDITY_LOW = 50.0;
export const THRESHOLD_BATTERY_LOW = 5;

// Device names (single source of truth for alarms, dashboard, and Lambda config)
export const METERS = ["N. Meter 1", "N. Meter 2"];
export const PLUGS = ["N.Pi", "N.Fan"];
export const PI_PLUG_NAME = "N.Pi";
export const FAN_PLUG_NAME = "N.Fan";

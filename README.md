# Nepenthes CDK

AWS CDK infrastructure for the Nepenthes home monitoring system. Deploys Lambda functions, IoT rules, EventBridge schedules, SNS topics, and CloudWatch alarms to monitor and manage Nepenthes (tropical pitcher plant) growing conditions.

## Architecture

- **Lambda Functions** (Python 3.12)
  - `nepenthes_log_puller` — Processes IoT messages and publishes CloudWatch metrics
  - `nepenthes_pushover` — Sends formatted alarm notifications via Pushover
  - `nepenthes_alarm_email_formatter` — Formats CloudWatch alarms and republishes to a dedicated SNS topic for readable email delivery
  - `nepenthes_online_plug_status` — Checks SwitchBot smart plug status every 2 minutes (discovers device IDs dynamically via SwitchBot API)
  - `nepenthes_pi_plug_on` — Powers on the Pi device via SwitchBot API when offline
  - `alarm_formatter` — Shared module that parses raw CloudWatch alarm JSON into human-readable titles and bodies
  - `switchbot` — SwitchBot API client with dynamic device ID discovery and caching
- **AWS IoT** — Topic rule subscribing to `log/nepenthes/nhome`
- **EventBridge** — Cron schedule (every 2 min) for plug status checks
- **SNS** — Alarm topic (triggers Pushover + email formatter Lambdas), formatted alarm topic (email delivery), and Pi low-severity topic
- **CloudWatch Alarms** — Temperature, humidity, battery, heartbeat, plug power/status

## Related Repository

This repo is the **cloud-side infrastructure** — it deploys AWS resources that ingest sensor data, evaluate alarms, and send notifications. The companion repo [**sb-nepenthes-environment**](https://github.com/MojamojaK/sb-nepenthes-environment) is the **device-side application** that runs on a Raspberry Pi Zero W, scanning SwitchBot sensors over BLE, evaluating growing conditions, toggling smart plugs, and pushing telemetry to the cloud via MQTT.

### Data Flow

```
Raspberry Pi Zero W (sb-nepenthes-environment)          AWS (nepenthes-cdk)
┌──────────────────────────────────────────┐    ┌──────────────────────────────────────────────┐
│                                          │    │                                              │
│  BLE scan (SwitchBot sensors)            │    │  IoT Core                                    │
│       │                                  │    │    │  topic: log/nepenthes/nhome              │
│       ▼                                  │    │    ▼                                          │
│  Evaluate conditions                     │    │  nepenthes_log_puller Lambda                  │
│  (heartbeat, thresholds)                 │    │    │                                          │
│       │                                  │    │    ▼                                          │
│       ├──▶ Toggle plugs (BLE)            │    │  CloudWatch Metrics & Alarms                  │
│       │                                  │    │    │                                          │
│       ▼                                  │    │    ├──▶ NAlarmTopic (SNS)                     │
│  log_push.py ── MQTT ──────────────────────────▶   │    ├──▶ nepenthes_pushover Lambda       │
│                                          │    │    │    └──▶ nepenthes_alarm_email_formatter  │
│                                          │    │    │              └──▶ Email (SNS)            │
│                                          │    │    │                                          │
│                                          │    │    └──▶ NPiInvalidLowSevTopic (SNS)          │
│                  ◀── SwitchBot API ──────────────────── nepenthes_pi_plug_on Lambda           │
│                                          │    │         (power-cycle Pi)                      │
│                                          │    │                                              │
│                                          │    │  EventBridge (every 5 min)                    │
│                                          │    │    └──▶ nepenthes_online_plug_status Lambda   │
│                  ◀── SwitchBot API ──────────────────── (check plug power/status)             │
│                                          │    │                                              │
└──────────────────────────────────────────┘    └──────────────────────────────────────────────┘
```

### Integration Points

| Integration | Device Side (sb-nepenthes-environment) | Cloud Side (nepenthes-cdk) |
|---|---|---|
| **MQTT telemetry** | `executors/log_push.py` publishes state JSON to AWS IoT Core | IoT topic rule on `log/nepenthes/nhome` triggers `nepenthes_log_puller` Lambda, which pushes metrics to CloudWatch |
| **Heartbeat** | `evaluators/heartbeat.py` includes a heartbeat flag in the MQTT payload | CloudWatch alarm on missing heartbeat triggers `nepenthes_pi_plug_on` to power-cycle the Pi via SwitchBot API |
| **SwitchBot API credentials** | Uses `SB_TOKEN` / `SB_SECRET_KEY` for BLE device discovery and local plug control | Same credentials used by `nepenthes_online_plug_status` and `nepenthes_pi_plug_on` Lambdas |
| **Device naming** | Aliases like *N. Meter 1*, *N. Peltier Upper* defined in `config/desired_states.py` | Same names appear in `lib/constants.ts` as CloudWatch metric dimensions |
| **Monitoring & alerting** | Reads sensors and pushes raw state to the cloud | Processes telemetry into CloudWatch metrics/alarms; sends Pushover + email alerts via SNS |

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [uv](https://docs.astral.sh/uv/) (`brew install uv`)
- [AWS CDK CLI](https://docs.aws.amazon.com/cdk/v2/guide/cli.html) (`npm install -g aws-cdk`)
- [dotenvx](https://dotenvx.com/) (`brew install dotenvx/brew/dotenvx`)
- AWS credentials configured (`aws configure` or environment variables)
- CDK bootstrap completed in your target account/region

## Setup

1. **Clone the repo**

   ```sh
   git clone https://github.com/MojamojaK/nepenthes-cdk.git
   cd nepenthes-cdk
   ```

2. **Install dependencies**

   ```sh
   npm install
   ```

3. **Set up secrets**

   The `.env` file in the repo is encrypted with [dotenvx](https://dotenvx.com/). To decrypt it locally, you need the `.env.keys` file containing the private key. Obtain this from a team member or your password manager, then place it in the project root.

   To create a new `.env` from scratch:

   ```sh
   # Create a plaintext .env with your secrets
   cat > .env << EOF
   PUSHOVER_API_KEY=your_pushover_api_key
   PAGEE_USER_KEY=your_pagee_user_key
   EMAIL_ADDRESS=your_email@example.com
   SB_TOKEN=your_switchbot_token
   SB_SECRET_KEY=your_switchbot_secret
   EOF

   # Encrypt it
   dotenvx encrypt
   ```

   This generates an encrypted `.env` (safe to commit) and a `.env.keys` file (do NOT commit).

4. **Bootstrap CDK** (first time only)

   ```sh
   npx cdk bootstrap
   ```

## Build

```sh
npm run build
```

## Test

Both CDK and Python tests enforce 80% code coverage thresholds.

```sh
# CDK (TypeScript) tests with coverage
npm run test

# Lambda (Python) tests with coverage
cd lambda && uv run pytest tests/ -v
```

## Deploy

### Local deployment

```sh
# Preview changes
npx cdk diff

# Deploy
npx cdk deploy
```

`dotenvx run` is configured in `cdk.json` as the app command prefix, so secrets are automatically decrypted from the `.env` file before CDK runs.

### Automated deployment (CI)

Pushes to `main` trigger a GitHub Actions workflow that:

1. Checks out the code
2. Installs uv, dotenvx, and npm dependencies
3. Builds the TypeScript
4. Runs CDK tests (Jest) with coverage
5. Runs Python tests (pytest) with coverage
6. Authenticates to AWS via OIDC
7. Runs `cdk diff` and `cdk deploy`

Tests must pass before deployment proceeds.

Secrets are decrypted in CI using the `DOTENV_PRIVATE_KEY` GitHub secret.

#### GitHub secrets required

| Secret | Description |
|---|---|
| `AWS_ROLE_ARN` | IAM role ARN for OIDC authentication |
| `DOTENV_PRIVATE_KEY` | Private key to decrypt the `.env` file |

## Project Structure

```
.
├── bin/
│   └── nepenthes_cdk.ts          # CDK app entry point
├── lib/
│   ├── nepenthes_cdk-stack.ts    # Main stack (IoT, EventBridge, SNS)
│   ├── lambda-functions.ts       # Lambda function definitions
│   ├── nepenthes-alarms.ts       # CloudWatch alarm definitions
│   └── constants.ts              # Environment variables and metric names
├── lambda/                       # Python Lambda function source code
│   ├── nepenthes_log_puller.py
│   ├── nepenthes_pushover.py
│   ├── nepenthes_alarm_email_formatter.py
│   ├── nepenthes_online_plug_status.py
│   ├── nepenthes_pi_plug_on.py
│   ├── alarm_formatter.py         # Shared alarm formatting logic
│   ├── cloudwatch.py
│   ├── switchbot.py               # SwitchBot API client with dynamic device discovery
│   ├── tests/                     # Python unit tests (pytest)
│   └── pyproject.toml             # Python dev dependencies and coverage config (uv)
├── test/                         # CDK Jest tests
├── .env                          # Encrypted secrets (safe to commit)
├── .github/workflows/deploy.yml  # CI/CD pipeline
├── cdk.json                      # CDK configuration
├── package.json
└── tsconfig.json
```

## Useful Commands

| Command | Description |
|---|---|
| `npm run build` | Compile TypeScript |
| `npm run watch` | Watch mode — recompile on changes |
| `npm run test` | Run CDK unit tests with coverage |
| `cd lambda && uv run pytest tests/ -v` | Run Python unit tests with coverage |
| `npx cdk synth` | Emit CloudFormation template |
| `npx cdk diff` | Compare deployed stack with local |
| `npx cdk deploy` | Deploy to AWS |
| `dotenvx set KEY value` | Add/update a secret (auto-encrypts) |
| `dotenvx get KEY` | Read a decrypted secret value |

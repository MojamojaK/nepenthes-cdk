# Nepenthes CDK

AWS CDK infrastructure for the Nepenthes home monitoring system. Deploys Lambda functions, IoT rules, EventBridge schedules, SNS topics, and CloudWatch alarms to monitor and manage Nepenthes (tropical pitcher plant) growing conditions.

## Architecture

- **Lambda Functions** (Python 3.12)
  - `nepenthes_log_puller` — Processes IoT messages and publishes CloudWatch metrics
  - `nepenthes_pushover` — Sends alarm notifications via Pushover
  - `nepenthes_online_plug_status` — Checks SwitchBot smart plug status every 2 minutes
  - `nepenthes_pi_plug_on` — Powers on the Pi device via SwitchBot API when offline
- **AWS IoT** — Topic rule subscribing to `log/nepenthes/nhome`
- **EventBridge** — Cron schedule (every 2 min) for plug status checks
- **SNS** — Alarm notification topics (email + Pushover)
- **CloudWatch Alarms** — Temperature, humidity, battery, heartbeat, plug power/status

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
   SB_PI_DEVICE_ID=your_pi_device_id
   SB_FAN_DEVICE_ID=your_fan_device_id
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

```sh
# CDK (TypeScript) tests
npm run test

# Lambda (Python) tests
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
2. Installs dotenvx and npm dependencies
3. Builds the TypeScript
4. Authenticates to AWS via OIDC
5. Runs `cdk diff` and `cdk deploy`

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
│   ├── nepenthes_online_plug_status.py
│   ├── nepenthes_pi_plug_on.py
│   ├── cloudwatch.py
│   ├── switchbot.py
│   └── pyproject.toml             # Python dev dependencies (uv)
├── test/                         # Jest tests
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
| `npm run test` | Run Jest unit tests |
| `cd lambda && uv run pytest tests/ -v` | Run Python unit tests |
| `npx cdk synth` | Emit CloudFormation template |
| `npx cdk diff` | Compare deployed stack with local |
| `npx cdk deploy` | Deploy to AWS |
| `dotenvx set KEY value` | Add/update a secret (auto-encrypts) |
| `dotenvx get KEY` | Read a decrypted secret value |

# CLAUDE.md

## Project Overview

Nepenthes-CDK is an AWS CDK (TypeScript) project that monitors a Nepenthes (tropical pitcher plant) growing environment. It ingests IoT sensor data, publishes CloudWatch metrics, triggers alarms, and sends notifications via Pushover and email.

## Architecture

```
IoT Device --> AWS IoT Rule --> log_puller Lambda --> CloudWatch Metrics --> Alarms
                                                                              |
                                                          +-------------------+-------------------+
                                                          |                                       |
                                                    NAlarmTopic                             NOkActionTopic
                                                     /        \                                   |
                                            Pushover Lambda   Email Formatter Lambda    Email Formatter Lambda
                                                  |                    |                          |
                                          Pushover App         NFormattedAlarmTopic        NFormattedAlarmTopic
                                                                       |                          |
                                                                   Email (SNS)               Email (SNS)

EventBridge (*/5 min) --> online_plug_status Lambda --> SwitchBot API --> CloudWatch Metrics
Pi Low-Sev Alarm --> pi_plug_on Lambda --> SwitchBot turnOn (auto-recovery)
```

## Build & Test

```bash
# Install dependencies
npm ci

# Build TypeScript
npm run build

# Run CDK tests (Jest, 80% coverage threshold)
npm run test

# Run Python Lambda tests (pytest, 80% coverage threshold)
cd lambda && uv sync && uv run pytest tests/ -v

# CDK operations
npx cdk diff
npx cdk deploy --all --require-approval never
```

Secrets are encrypted with dotenvx in `.env`. They are decrypted at build time via `dotenvx run` (configured in `cdk.json`). Locally you need `.env.keys`; in CI the `DOTENV_PRIVATE_KEY` environment variable is used.

## Project Structure

- `bin/nepenthes_cdk.ts` - CDK app entry point (includes cdk-nag)
- `lib/constants.ts` - Single source of truth: secrets, metric names, thresholds, device names
- `lib/nepenthes_cdk-stack.ts` - Main stack: IoT rule, EventBridge, SNS topics, IAM policies
- `lib/lambda-functions.ts` - All 5 Lambda function definitions (Python 3.14, ARM64)
- `lib/nepenthes-alarms.ts` - 13 CloudWatch alarms across 4 categories
- `lib/nepenthes-dashboard.ts` - CloudWatch Dashboard (NHome-Nepenthes)
- `lambda/` - Python Lambda source code and tests
- `test/` - CDK unit tests (Jest)
- `.github/workflows/deploy.yml` - CI/CD: test then deploy on push to main

## Lambda Functions

| Function | Trigger | Purpose |
|---|---|---|
| `nepenthes_log_puller` | IoT Rule (`log/nepenthes/nhome`) | Parses IoT messages, publishes metrics (Heartbeat, Valid, Temperature, Humidity, Battery, Switch, Power) |
| `nepenthes_pushover` | SNS (NAlarmTopic) | Sends critical Pushover notifications (priority 2, skips OK state) |
| `nepenthes_alarm_email_formatter` | SNS (NAlarmTopic + NOkActionTopic) | Formats alarm JSON into readable email, publishes to NFormattedAlarmTopic |
| `nepenthes_online_plug_status` | EventBridge (every 5 min) | Queries SwitchBot API for plug status, publishes Switch/Power/Valid metrics |
| `nepenthes_pi_plug_on` | SNS (NPiInvalidLowSevTopic) | Auto-recovers N.Pi by sending SwitchBot turnOn command |

## CloudWatch Metrics

- **Namespace**: `NHomeZero`
- **Metric types**: Heartbeat, Valid, Temperature, Humidity, Battery, Switch, Power
- **Dimensions**: `Meter` (sensor devices) or `Plug` (smart plugs)
- **Key devices**: N. Meter 1, N. Meter 2 (meters); N.Pi, N.Fan (plugs)

## AWS CLI

AWS credentials may be configured via AWS CLI profiles (`aws configure` / `aws sso login`), instance roles, or environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`) as a fallback. Region is `us-west-2`. Install the CLI with `pip install awscli` if not present. Verify access with `aws sts get-caller-identity`.

### Useful commands

```bash
# CloudFormation stack status
aws cloudformation describe-stack-events --stack-name NepenthesCDKStack \
  --query 'StackEvents[:10].[Timestamp,ResourceStatus,LogicalResourceId,ResourceStatusReason]' --output table

# List custom metrics
aws cloudwatch list-metrics --namespace "NHomeZero" \
  --query 'Metrics[*].[MetricName, Dimensions[0].Name, Dimensions[0].Value]' --output table

# Query a metric (e.g. Temperature for N. Meter 1, last hour)
aws cloudwatch get-metric-data \
  --metric-data-queries '[{"Id":"m1","MetricStat":{"Metric":{"Namespace":"NHomeZero","MetricName":"Temperature","Dimensions":[{"Name":"Meter","Value":"N. Meter 1"}]},"Period":300,"Stat":"Average"},"ReturnData":true}]' \
  --start-time "$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ)" \
  --end-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --output json

# Query plug power (e.g. N. Pump)
aws cloudwatch get-metric-data \
  --metric-data-queries '[{"Id":"p1","MetricStat":{"Metric":{"Namespace":"NHomeZero","MetricName":"Power","Dimensions":[{"Name":"Plug","Value":"N. Pump"}]},"Period":300,"Stat":"Average"},"ReturnData":true}]' \
  --start-time "$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ)" \
  --end-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --output json

# Check alarm states
aws cloudwatch describe-alarms --state-value ALARM --output table

# List all alarms
aws cloudwatch describe-alarms \
  --query 'MetricAlarms[*].[AlarmName,StateValue,MetricName]' --output table

# Invoke a Lambda function (e.g. test Pushover with a mock alarm)
aws lambda invoke --function-name <function-name> --payload file://payload.json /tmp/response.json

# List Lambda functions in the stack
aws lambda list-functions \
  --query 'Functions[?starts_with(FunctionName, `NepenthesCDKStack`)].FunctionName' --output table

# View recent Lambda logs
aws logs tail /aws/lambda/<function-name> --since 1h
```

### Invoking the Pushover Lambda for testing

The Pushover Lambda expects an SNS-wrapped CloudWatch alarm event. Example test payload:

```json
{
  "Records": [{
    "Sns": {
      "Subject": "ALARM: Test Notification",
      "Message": "{\"AlarmName\":\"Test Alarm\",\"NewStateValue\":\"ALARM\",\"OldStateValue\":\"OK\",\"NewStateReason\":\"Threshold Crossed: 1 out of 1 datapoints [99.0] was >= threshold (42.0).\",\"StateChangeTime\":\"2026-01-01T00:00:00.000+0000\",\"Trigger\":{\"MetricName\":\"Humidity\",\"Dimensions\":[{\"name\":\"Meter\",\"value\":\"N. Meter 1\"}],\"Threshold\":42.0,\"ComparisonOperator\":\"GreaterThanOrEqualToThreshold\",\"Statistic\":\"Average\",\"Period\":300,\"DatapointsToAlarm\":1,\"EvaluationPeriods\":1,\"TreatMissingData\":\"missing\"}}"
    }
  }]
}
```

**Warning**: The Pushover Lambda sends priority 2 (critical) notifications that repeat every 2 minutes until acknowledged. Only invoke for genuine testing.

## Key Constants (lib/constants.ts)

All metric names, alarm thresholds, and device names are centralized in `lib/constants.ts`. When adding new devices or changing thresholds, update this file — alarms, dashboard, and Lambda config all derive from it.

- Thresholds: Temperature high 26.0 / low 10.0, Humidity low 50.0, Battery low 5
- Meters: "N. Meter 1", "N. Meter 2"
- Plugs: "N.Pi", "N.Fan"

## CI/CD

GitHub Actions workflow (`.github/workflows/deploy.yml`):
1. **Test job**: Build + Jest CDK tests + pytest Lambda tests (both require 80% coverage)
2. **Deploy job**: AWS OIDC auth, `cdk diff`, `cdk deploy`

Triggers on push to `main` only. GitHub Actions logs require admin repo access to download via API.

## Coding Conventions

- CDK infrastructure in TypeScript (strict mode)
- Lambda functions in Python (3.14 runtime, ARM64 architecture)
- All Lambdas share a single code asset from the `lambda/` directory
- Use `logging` module (not `print()`) in Lambda code
- Dependencies bundled at deploy time (no Lambda layers)
- cdk-nag (AWS Solutions) enforced — suppression requires explicit reason
- Commit messages: imperative mood, concise single-line summary of the change

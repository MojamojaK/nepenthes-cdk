import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { NepenthesCDKStack } from '../lib/nepenthes_cdk-stack';

let template: Template;

beforeAll(() => {
    const app = new cdk.App();
    const stack = new NepenthesCDKStack(app, 'TestStack');
    template = Template.fromStack(stack);
});

describe('Constants', () => {
    test('requireEnv throws when environment variable is missing', () => {
        const original = process.env.PUSHOVER_API_KEY;
        delete process.env.PUSHOVER_API_KEY;
        expect(() => {
            jest.isolateModules(() => {
                require('../lib/constants');
            });
        }).toThrow('Missing required environment variable: PUSHOVER_API_KEY');
        process.env.PUSHOVER_API_KEY = original;
    });
});

describe('Lambda Functions', () => {
    test('creates 5 Lambda functions with Python 3.14 runtime', () => {
        template.resourceCountIs('AWS::Lambda::Function', 5);

        template.hasResourceProperties('AWS::Lambda::Function', {
            Runtime: 'python3.14',
        });
    });

    test('log puller function has correct handler and timeout', () => {
        template.hasResourceProperties('AWS::Lambda::Function', {
            Handler: 'nepenthes_log_puller.lambda_handler',
            Timeout: 7,
        });
    });

    test('pushover function has correct handler and env vars', () => {
        template.hasResourceProperties('AWS::Lambda::Function', {
            Handler: 'nepenthes_pushover.lambda_handler',
            Environment: {
                Variables: {
                    PUSHOVER_API_KEY: 'test-pushover-key',
                    PAGEE_USER_KEY: 'test-pagee-key',
                },
            },
        });
    });

    test('online plug status function has correct handler and timeout', () => {
        template.hasResourceProperties('AWS::Lambda::Function', {
            Handler: 'nepenthes_online_plug_status.lambda_handler',
            Timeout: 10,
        });
    });

    test('pi plug on function has correct handler', () => {
        template.hasResourceProperties('AWS::Lambda::Function', {
            Handler: 'nepenthes_pi_plug_on.lambda_handler',
        });
    });

    test('alarm email formatter function has correct handler', () => {
        template.hasResourceProperties('AWS::Lambda::Function', {
            Handler: 'nepenthes_alarm_email_formatter.lambda_handler',
        });
    });

    test('all functions use ARM64 architecture', () => {
        const functions = template.findResources('AWS::Lambda::Function');
        for (const [, resource] of Object.entries(functions)) {
            const props = resource.Properties as Record<string, unknown>;
            expect(props.Architectures).toEqual(['arm64']);
        }
    });

    test('no functions use external Lambda layers', () => {
        const functions = template.findResources('AWS::Lambda::Function');
        for (const [, resource] of Object.entries(functions)) {
            const props = resource.Properties as Record<string, unknown>;
            expect(props.Layers).toBeUndefined();
        }
    });
});

describe('Log Groups', () => {
    test('creates 5 log groups with 60-day retention', () => {
        template.resourceCountIs('AWS::Logs::LogGroup', 5);

        template.hasResourceProperties('AWS::Logs::LogGroup', {
            RetentionInDays: 60,
        });
    });
});

describe('IoT Rule', () => {
    test('creates IoT topic rule with correct SQL', () => {
        template.resourceCountIs('AWS::IoT::TopicRule', 1);

        template.hasResourceProperties('AWS::IoT::TopicRule', {
            TopicRulePayload: {
                Sql: "SELECT * FROM 'log/nepenthes/nhome'",
                AwsIotSqlVersion: '2016-03-23',
                RuleDisabled: false,
            },
        });
    });
});

describe('EventBridge', () => {
    test('creates schedule rule with 5-minute cron', () => {
        template.hasResourceProperties('AWS::Events::Rule', {
            ScheduleExpression: 'cron(*/5 * * * ? *)',
        });
    });
});

describe('SNS Topics', () => {
    test('creates 4 SNS topics (alarm, formatted, ok-action, low-sev)', () => {
        template.resourceCountIs('AWS::SNS::Topic', 4);
    });

    test('has email subscription on formatted alarm topic', () => {
        template.hasResourceProperties('AWS::SNS::Subscription', {
            Protocol: 'email',
            Endpoint: 'test@example.com',
        });
    });

    test('has Lambda subscriptions', () => {
        template.hasResourceProperties('AWS::SNS::Subscription', {
            Protocol: 'lambda',
        });
    });
});

describe('CloudWatch Alarms', () => {
    test('creates heartbeat missing alarm', () => {
        template.hasResourceProperties('AWS::CloudWatch::Alarm', {
            Namespace: 'NHomeZero',
            MetricName: 'Heartbeat',
            TreatMissingData: 'breaching',
            Period: 900,
            Statistic: 'Maximum',
        });
    });

    test('creates temperature alarms for both meters', () => {
        // Temperature alarms use metric math (actual - desired / desired - actual)
        const allAlarms = template.findResources('AWS::CloudWatch::Alarm');
        const tempAlarms = Object.entries(allAlarms).filter(([key]) =>
            key.includes('Temperature')
        );
        // 2 high + 2 low = 4 temperature alarms
        expect(tempAlarms.length).toBe(4);

        // Verify they use metric math expressions
        for (const [, resource] of tempAlarms) {
            const props = resource.Properties as Record<string, unknown>;
            const metrics = props.Metrics as Array<Record<string, unknown>>;
            expect(metrics).toBeDefined();
            const expressions = metrics.filter(m => m.Expression);
            expect(expressions.length).toBe(1);
        }
    });

    test('creates humidity alarms for both meters', () => {
        const alarms = template.findResources('AWS::CloudWatch::Alarm', {
            Properties: {
                MetricName: 'Humidity',
                Namespace: 'NHomeZero',
            },
        });
        expect(Object.keys(alarms).length).toBe(2);
    });

    test('creates battery alarms for both meters', () => {
        const alarms = template.findResources('AWS::CloudWatch::Alarm', {
            Properties: {
                MetricName: 'Battery',
                Namespace: 'NHomeZero',
            },
        });
        expect(Object.keys(alarms).length).toBe(2);
    });

    test('creates cooler frozen alarm', () => {
        const alarms = template.findResources('AWS::CloudWatch::Alarm', {
            Properties: {
                MetricName: 'CoolerFrozen',
                Namespace: 'NHomeZero',
            },
        });
        expect(Object.keys(alarms).length).toBe(1);
    });

    test('creates Pi and Fan switch/power alarms', () => {
        const switchAlarms = template.findResources('AWS::CloudWatch::Alarm', {
            Properties: {
                MetricName: 'Switch',
                Namespace: 'NHomeZero',
            },
        });
        // N.Pi high sev + N.Pi low sev + N.Fan turned off = 3
        expect(Object.keys(switchAlarms).length).toBe(3);

        const powerAlarms = template.findResources('AWS::CloudWatch::Alarm', {
            Properties: {
                MetricName: 'Power',
                Namespace: 'NHomeZero',
            },
        });
        expect(Object.keys(powerAlarms).length).toBe(1);
    });

    test('all alarms have actions enabled', () => {
        const alarms = template.findResources('AWS::CloudWatch::Alarm');
        for (const [, resource] of Object.entries(alarms)) {
            const props = resource.Properties as Record<string, unknown>;
            expect(props.ActionsEnabled).toBe(true);
        }
    });

    test('high-severity alarms have OK actions for email recovery notifications', () => {
        const alarms = template.findResources('AWS::CloudWatch::Alarm');
        // All alarms in the main alarms list should have OKActions
        let alarmsWithOkActions = 0;
        for (const [, resource] of Object.entries(alarms)) {
            const props = resource.Properties as Record<string, unknown>;
            if (Array.isArray(props.OKActions) && (props.OKActions as unknown[]).length > 0) {
                alarmsWithOkActions++;
            }
        }
        // 13 high-severity alarms have OK actions (all except the low-sev Pi alarm)
        expect(alarmsWithOkActions).toBe(13);
    });
});

describe('Dashboard', () => {
    test('creates a CloudWatch dashboard', () => {
        template.resourceCountIs('AWS::CloudWatch::Dashboard', 1);

        template.hasResourceProperties('AWS::CloudWatch::Dashboard', {
            DashboardName: 'NHome-Nepenthes',
        });
    });
});

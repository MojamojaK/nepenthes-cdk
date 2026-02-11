import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { NepenthesCDKStack } from '../lib/nepenthes_cdk-stack';

let template: Template;

beforeAll(() => {
    const app = new cdk.App();
    const stack = new NepenthesCDKStack(app, 'TestStack');
    template = Template.fromStack(stack);
});

describe('Lambda Functions', () => {
    test('creates 4 Lambda functions with Python 3.12 runtime', () => {
        template.resourceCountIs('AWS::Lambda::Function', 4);

        template.hasResourceProperties('AWS::Lambda::Function', {
            Runtime: 'python3.12',
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

    test('all functions use the requests layer', () => {
        const functions = template.findResources('AWS::Lambda::Function');
        for (const [, resource] of Object.entries(functions)) {
            const props = resource.Properties as Record<string, unknown>;
            expect(props).toHaveProperty('Layers');
            expect(props.Layers).toEqual(
                expect.arrayContaining(['arn:aws:lambda:us-west-2:770693421928:layer:Klayers-p312-requests:2'])
            );
        }
    });
});

describe('Log Groups', () => {
    test('creates 4 log groups with 60-day retention', () => {
        template.resourceCountIs('AWS::Logs::LogGroup', 4);

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
    test('creates schedule rule with 2-minute cron', () => {
        template.hasResourceProperties('AWS::Events::Rule', {
            ScheduleExpression: 'cron(*/2 * * * ? *)',
        });
    });
});

describe('SNS Topics', () => {
    test('creates 2 SNS topics', () => {
        template.resourceCountIs('AWS::SNS::Topic', 2);
    });

    test('has email subscription', () => {
        template.hasResourceProperties('AWS::SNS::Subscription', {
            Protocol: 'email-json',
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
        // High temp alarms (Meter 1 and Meter 2)
        const alarms = template.findResources('AWS::CloudWatch::Alarm', {
            Properties: {
                MetricName: 'Temperature',
                Namespace: 'NHomeZero',
            },
        });
        // 2 high + 2 low = 4 temperature alarms
        expect(Object.keys(alarms).length).toBe(4);
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
});

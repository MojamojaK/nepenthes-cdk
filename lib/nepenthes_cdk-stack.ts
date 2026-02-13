import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';
import { LambdaFunctions } from './lambda-functions';
import { EMAIL_ADDRESS, METRIC_NAMESPACE } from './constants';
import { NepenthesAlarms } from './nepenthes-alarms';
import { NepenthesDashboard } from './nepenthes-dashboard';

export class NepenthesCDKStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a Lambda function with code from the "src/lambda" directory
    const lambdaFunctions = new LambdaFunctions(this);

    // Build Log Puller AWS IOT Topic Rule
    const logPullerTopicRule = new cdk.aws_iot.CfnTopicRule(this, "NLogPullerPublishRule", {
      topicRulePayload: {
        description: "Log Puller for N.Home",
        actions: [{
          lambda: {
            functionArn: lambdaFunctions.nepenthesLogPullerFunction.functionArn
          }
        }],
        ruleDisabled: false,
        sql: "SELECT * FROM 'log/nepenthes/nhome'",
        awsIotSqlVersion: "2016-03-23",
      }
    });
    // Link AWS IOT Topic Rule to log puller Lambda function
    lambdaFunctions.nepenthesLogPullerFunction.addPermission(
        'AddIotTopicRuleTrigger',
        {
          principal: new cdk.aws_iam.ServicePrincipal("iot.amazonaws.com"),
          sourceArn: logPullerTopicRule.attrArn,
        }
    );
    // Grant CloudWatch PutMetricData scoped to our namespace
    const putMetricPolicy = new cdk.aws_iam.PolicyStatement({
      actions: ['cloudwatch:PutMetricData'],
      resources: ['*'],
      conditions: {
        StringEquals: { 'cloudwatch:namespace': METRIC_NAMESPACE },
      },
    });
    lambdaFunctions.nepenthesLogPullerFunction.role!.addToPrincipalPolicy(putMetricPolicy);
    lambdaFunctions.nepenthesOnlinePlugStatusFunction.role!.addToPrincipalPolicy(putMetricPolicy);

    // Suppress IAM5: log stream ARNs require logGroupArn:* suffix (tightest scope possible),
    // and cloudwatch:PutMetricData does not support resource-level permissions (scoped by namespace condition)
    NagSuppressions.addResourceSuppressionsByPath(this, [
      `/${id}/NLogPullerRole/DefaultPolicy/Resource`,
      `/${id}/NPushoverRole/DefaultPolicy/Resource`,
      `/${id}/NAlarmEmailFormatterRole/DefaultPolicy/Resource`,
      `/${id}/NOnlinePlugStatusRole/DefaultPolicy/Resource`,
      `/${id}/NPiPlugOnRole/DefaultPolicy/Resource`,
    ], [{
      id: 'AwsSolutions-IAM5',
      reason: 'Log stream ARNs require logGroupArn:* suffix; PutMetricData does not support resource-level permissions (scoped by namespace condition)',
    }]);

    // Suppress L1: Python 3.13 is the latest runtime available on AWS Lambda;
    // cdk-nag flags it because CDK defines 3.14 but AWS has not shipped it yet
    NagSuppressions.addStackSuppressions(this, [{
      id: 'AwsSolutions-L1',
      reason: 'Python 3.13 is the latest Lambda runtime available; 3.14 is defined in CDK but not yet supported by AWS Lambda',
    }]);

    // Setup Schedule to run Online Plug Status Lambda Function per cron schedule
    const onlineMetricSchedule = new cdk.aws_events.Rule(this, "NOnlineMetricRule", {schedule: cdk.aws_events.Schedule.cron({minute: "*/5"})});
    onlineMetricSchedule.addTarget(new cdk.aws_events_targets.LambdaFunction(lambdaFunctions.nepenthesOnlinePlugStatusFunction));

    // Setup SNS to alarm
    const nepenthesAlams = new NepenthesAlarms(this);
    const alarmSNSTopic = new cdk.aws_sns.Topic(this, "NAlarmTopic", { enforceSSL: true });
    alarmSNSTopic.addSubscription(new cdk.aws_sns_subscriptions.LambdaSubscription(lambdaFunctions.nepenthesPushoverFunction));
    nepenthesAlams.alarms.forEach((alarm) => alarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(alarmSNSTopic)));

    // Format alarm notifications for email delivery
    const formattedAlarmSNSTopic = new cdk.aws_sns.Topic(this, "NFormattedAlarmTopic", { enforceSSL: true });
    formattedAlarmSNSTopic.addSubscription(new cdk.aws_sns_subscriptions.EmailSubscription(EMAIL_ADDRESS));
    formattedAlarmSNSTopic.grantPublish(lambdaFunctions.nepenthesAlarmEmailFormatterFunction);
    lambdaFunctions.nepenthesAlarmEmailFormatterFunction.addEnvironment("FORMATTED_TOPIC_ARN", formattedAlarmSNSTopic.topicArn);
    alarmSNSTopic.addSubscription(new cdk.aws_sns_subscriptions.LambdaSubscription(lambdaFunctions.nepenthesAlarmEmailFormatterFunction));

    // Send recovery (OK) notifications via email only (not Pushover)
    const okActionSNSTopic = new cdk.aws_sns.Topic(this, "NOkActionTopic", { enforceSSL: true });
    okActionSNSTopic.addSubscription(new cdk.aws_sns_subscriptions.LambdaSubscription(lambdaFunctions.nepenthesAlarmEmailFormatterFunction));
    nepenthesAlams.alarms.forEach((alarm) => alarm.addOkAction(new cdk.aws_cloudwatch_actions.SnsAction(okActionSNSTopic)));

    // Setup trigger lambda when N.Pi is offline for 5 minutes
    const nPiInvalidLowSevSNSTopic = new cdk.aws_sns.Topic(this, "NPiInvalidLowSevTopic", { enforceSSL: true });
    nPiInvalidLowSevSNSTopic.addSubscription(new cdk.aws_sns_subscriptions.LambdaSubscription(lambdaFunctions.nepenthesPiPlugOnFunction));
    nepenthesAlams.nPiInvalidLowSevAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(nPiInvalidLowSevSNSTopic));

    // CloudWatch Dashboard for at-a-glance monitoring
    new NepenthesDashboard(this);
  }
}

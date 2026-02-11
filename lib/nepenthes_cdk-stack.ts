import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { LambdaFunctions } from './lambda-functions';
import { EMAIL_ADDRESS, METRIC_NAMESPACE, METRIC_NAME_VALID } from './constants';
import { NepenthesAlarms } from './nepenthes-alarms';

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
    // Grant Cloud watch put metric permission to relevant lambda functions
    cdk.aws_cloudwatch.Metric.grantPutMetricData(lambdaFunctions.nepenthesLogPullerFunction.grantPrincipal);
    cdk.aws_cloudwatch.Metric.grantPutMetricData(lambdaFunctions.nepenthesOnlinePlugStatusFunction.grantPrincipal);

    // Setup Schedule to run Online Plug Status Lambda Function per cron schedule
    const onlineMetricSchedule = new cdk.aws_events.Rule(this, "NOnlineMetricRule", {schedule: cdk.aws_events.Schedule.cron({minute: "*/2"})});
    onlineMetricSchedule.addTarget(new cdk.aws_events_targets.LambdaFunction(lambdaFunctions.nepenthesOnlinePlugStatusFunction));

    // Setup SNS to alarm
    const nepenthesAlams = new NepenthesAlarms(this);
    const alarmSNSTopic = new cdk.aws_sns.Topic(this, "NAlarmTopic");
    alarmSNSTopic.addSubscription(new cdk.aws_sns_subscriptions.EmailSubscription(EMAIL_ADDRESS, {json: true}));
    alarmSNSTopic.addSubscription(new cdk.aws_sns_subscriptions.LambdaSubscription(lambdaFunctions.nepenthesPushoverFunction));
    nepenthesAlams.alarms.forEach((alarm) => alarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(alarmSNSTopic)));

    // Setup trigger lambda when N.Pi is offline for 5 minutes
    const nPiInvalidLowSevSNSTopic = new cdk.aws_sns.Topic(this, "NPiInvalidLowSevTopic");
    nPiInvalidLowSevSNSTopic.addSubscription(new cdk.aws_sns_subscriptions.LambdaSubscription(lambdaFunctions.nepenthesPiPlugOnFunction));
    nepenthesAlams.nPiInvalidLowSevAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(nPiInvalidLowSevSNSTopic));
  }
}

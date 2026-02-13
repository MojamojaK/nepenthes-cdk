import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { METRIC_NAMESPACE, METRIC_NAME_BATTERY, METRIC_NAME_HEARTBEAT, METRIC_NAME_HUMIDITY,
         METRIC_NAME_POWER, METRIC_NAME_SWITCH, METRIC_NAME_TEMPERATURE } from './constants';


export class NepenthesAlarms {

    public readonly alarms: cdk.aws_cloudwatch.AlarmBase[];
    public readonly nPiInvalidLowSevAlarm: cdk.aws_cloudwatch.AlarmBase;

    constructor(scope: Construct) {
        const heartBeatMissingAlarm = new cdk.aws_cloudwatch.Alarm(scope, "NHomeHeartbeatMissingAlarm", {
            actionsEnabled: true,
            datapointsToAlarm: 1,
            evaluationPeriods: 1,
            treatMissingData: cdk.aws_cloudwatch.TreatMissingData.BREACHING,
            comparisonOperator: cdk.aws_cloudwatch.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
            threshold: 0,
            metric: new cdk.aws_cloudwatch.Metric({
                namespace: METRIC_NAMESPACE,
                metricName: METRIC_NAME_HEARTBEAT,
                period: cdk.Duration.minutes(15),
                statistic: cdk.aws_cloudwatch.Stats.MAXIMUM,
            }),
        });

        const METERS = ["N. Meter 1", "N. Meter 2"]

        const highTemperatureAlarms = METERS.map((meterAlias) => {
            const escapedAlias = meterAlias.replace(/ /g, "")
            return new cdk.aws_cloudwatch.Alarm(scope, `${escapedAlias}TemperatureHighAlarm`, {
                actionsEnabled: true,
                datapointsToAlarm: 30,
                evaluationPeriods: 30,
                treatMissingData: cdk.aws_cloudwatch.TreatMissingData.IGNORE,
                comparisonOperator:  cdk.aws_cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
                threshold: 26.0,
                metric: new cdk.aws_cloudwatch.Metric({
                    namespace: METRIC_NAMESPACE,
                    metricName: METRIC_NAME_TEMPERATURE,
                    dimensionsMap: {
                        "Meter": meterAlias,
                    },
                    period: cdk.Duration.minutes(2),
                    statistic: cdk.aws_cloudwatch.Stats.MINIMUM,
                }),
            })
        });

        const lowTemperatureAlarms = METERS.map((meterAlias) => {
            const escapedAlias = meterAlias.replace(/ /g, "")
            return new cdk.aws_cloudwatch.Alarm(scope, `${escapedAlias}TemperatureLowAlarm`, {
                actionsEnabled: true,
                datapointsToAlarm: 30,
                evaluationPeriods: 30,
                treatMissingData: cdk.aws_cloudwatch.TreatMissingData.IGNORE,
                comparisonOperator:  cdk.aws_cloudwatch.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
                threshold: 10.0,
                metric: new cdk.aws_cloudwatch.Metric({
                    namespace: METRIC_NAMESPACE,
                    metricName: METRIC_NAME_TEMPERATURE,
                    dimensionsMap: {
                        "Meter": meterAlias,
                    },
                    period: cdk.Duration.minutes(2),
                    statistic: cdk.aws_cloudwatch.Stats.MAXIMUM,
                }),
            })
        });

        const lowHumidityAlarms = METERS.map((meterAlias) => {
            const escapedAlias = meterAlias.replace(/ /g, "")
            return new cdk.aws_cloudwatch.Alarm(scope, `${escapedAlias}HumidityLowAlarm`, {
                actionsEnabled: true,
                datapointsToAlarm: 30,
                evaluationPeriods: 30,
                treatMissingData: cdk.aws_cloudwatch.TreatMissingData.IGNORE,
                comparisonOperator:  cdk.aws_cloudwatch.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
                threshold: 50.0,
                metric: new cdk.aws_cloudwatch.Metric({
                    namespace: METRIC_NAMESPACE,
                    metricName: METRIC_NAME_HUMIDITY,
                    dimensionsMap: {
                        "Meter": meterAlias,
                    },
                    period: cdk.Duration.minutes(2),
                    statistic: cdk.aws_cloudwatch.Stats.MAXIMUM,
                }),
            })
        });

        const lowBatteryAlarms = METERS.map((meterAlias) => {
            const escapedAlias = meterAlias.replace(/ /g, "")
            return new cdk.aws_cloudwatch.Alarm(scope, `${escapedAlias}BatteryLowAlarm`, {
                actionsEnabled: true,
                datapointsToAlarm: 1,
                evaluationPeriods: 24,
                treatMissingData: cdk.aws_cloudwatch.TreatMissingData.IGNORE,
                comparisonOperator:  cdk.aws_cloudwatch.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
                threshold: 5,
                metric: new cdk.aws_cloudwatch.Metric({
                    namespace: METRIC_NAMESPACE,
                    metricName: METRIC_NAME_BATTERY,
                    dimensionsMap: {
                        "Meter": meterAlias,
                    },
                    period: cdk.Duration.hours(1),
                    statistic: cdk.aws_cloudwatch.Stats.MAXIMUM,
                }),
            })
        });

        const piOffline = new cdk.aws_cloudwatch.Alarm(scope, "NPiInvalidHighSev", {
            actionsEnabled: true,
            datapointsToAlarm: 3,
            evaluationPeriods: 3,
            treatMissingData: cdk.aws_cloudwatch.TreatMissingData.BREACHING,
            comparisonOperator:  cdk.aws_cloudwatch.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
            threshold: 0,
            metric: new cdk.aws_cloudwatch.Metric({
                namespace: METRIC_NAMESPACE,
                metricName: METRIC_NAME_SWITCH,
                dimensionsMap: {
                    "Plug": "N.Pi",
                },
                period: cdk.Duration.minutes(5),
                statistic: cdk.aws_cloudwatch.Stats.MAXIMUM,
            }),
        });

        const fanNotDrawingPower = new cdk.aws_cloudwatch.Alarm(scope, "NFanNotDrawingPower", {
            actionsEnabled: true,
            datapointsToAlarm: 3,
            evaluationPeriods: 3,
            treatMissingData: cdk.aws_cloudwatch.TreatMissingData.BREACHING,
            comparisonOperator:  cdk.aws_cloudwatch.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
            threshold: 0,
            metric: new cdk.aws_cloudwatch.Metric({
                namespace: METRIC_NAMESPACE,
                metricName: METRIC_NAME_POWER,
                dimensionsMap: {
                    "Plug": "N.Fan",
                },
                period: cdk.Duration.minutes(5),
                statistic: cdk.aws_cloudwatch.Stats.MAXIMUM,
            }),
        });

        const fanOffline = new cdk.aws_cloudwatch.Alarm(scope, "NFanTurnedOff", {
            actionsEnabled: true,
            datapointsToAlarm: 3,
            evaluationPeriods: 3,
            treatMissingData: cdk.aws_cloudwatch.TreatMissingData.BREACHING,
            comparisonOperator:  cdk.aws_cloudwatch.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
            threshold: 0,
            metric: new cdk.aws_cloudwatch.Metric({
                namespace: METRIC_NAMESPACE,
                metricName: METRIC_NAME_SWITCH,
                dimensionsMap: {
                    "Plug": "N.Fan",
                },
                period: cdk.Duration.minutes(5),
                statistic: cdk.aws_cloudwatch.Stats.MAXIMUM,
            }),
        })

        this.alarms = [
            heartBeatMissingAlarm,
            ...highTemperatureAlarms,
            ...lowTemperatureAlarms,
            ...lowHumidityAlarms,
            ...lowBatteryAlarms,
            piOffline,
            fanNotDrawingPower,
            fanOffline,
        ];

        this.nPiInvalidLowSevAlarm = new cdk.aws_cloudwatch.Alarm(scope, "NPiInvalidLowSev", {
            actionsEnabled: true,
            datapointsToAlarm: 1,
            evaluationPeriods: 1,
            treatMissingData: cdk.aws_cloudwatch.TreatMissingData.BREACHING,
            comparisonOperator:  cdk.aws_cloudwatch.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
            threshold: 0,
            metric: new cdk.aws_cloudwatch.Metric({
                namespace: METRIC_NAMESPACE,
                metricName: METRIC_NAME_SWITCH,
                dimensionsMap: {
                    "Plug": "N.Pi",
                },
                period: cdk.Duration.minutes(5),
                statistic: cdk.aws_cloudwatch.Stats.MAXIMUM,
            }),
        });
    }
}

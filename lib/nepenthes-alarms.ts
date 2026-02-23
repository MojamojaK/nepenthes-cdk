import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { METRIC_NAMESPACE, METRIC_NAME_BATTERY, METRIC_NAME_COOLER_FROZEN, METRIC_NAME_HEARTBEAT,
         METRIC_NAME_HUMIDITY, METRIC_NAME_POWER, METRIC_NAME_SWITCH, METRIC_NAME_TEMPERATURE,
         METRIC_NAME_TEMPERATURE_DIFF,
         THRESHOLD_TEMPERATURE_HIGH, THRESHOLD_TEMPERATURE_LOW, THRESHOLD_TEMPERATURE_OFFSET,
         THRESHOLD_HUMIDITY_LOW, THRESHOLD_BATTERY_LOW,
         METERS, PI_PLUG_NAME, FAN_PLUG_NAME } from './constants';


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

        const highTemperatureAlarms = METERS.map((meterAlias) => {
            const escapedAlias = meterAlias.replace(/ /g, "")
            return new cdk.aws_cloudwatch.Alarm(scope, `${escapedAlias}TemperatureHighAlarm`, {
                actionsEnabled: true,
                datapointsToAlarm: 30,
                evaluationPeriods: 30,
                treatMissingData: cdk.aws_cloudwatch.TreatMissingData.IGNORE,
                comparisonOperator:  cdk.aws_cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
                threshold: THRESHOLD_TEMPERATURE_HIGH,
                metric: new cdk.aws_cloudwatch.Metric({
                    namespace: METRIC_NAMESPACE,
                    metricName: METRIC_NAME_TEMPERATURE,
                    dimensionsMap: { "Meter": meterAlias },
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
                threshold: THRESHOLD_TEMPERATURE_LOW,
                metric: new cdk.aws_cloudwatch.Metric({
                    namespace: METRIC_NAMESPACE,
                    metricName: METRIC_NAME_TEMPERATURE,
                    dimensionsMap: { "Meter": meterAlias },
                    period: cdk.Duration.minutes(2),
                    statistic: cdk.aws_cloudwatch.Stats.MAXIMUM,
                }),
            })
        });

        // TemperatureDiff = desired - actual (published by IoT device per meter)
        // Too hot: diff <= -OFFSET, Too cold: diff >= OFFSET
        const highTemperatureDiffAlarms = METERS.map((meterAlias) => {
            const escapedAlias = meterAlias.replace(/ /g, "")
            return new cdk.aws_cloudwatch.Alarm(scope, `${escapedAlias}TemperatureHighDiffAlarm`, {
                actionsEnabled: true,
                datapointsToAlarm: 30,
                evaluationPeriods: 30,
                treatMissingData: cdk.aws_cloudwatch.TreatMissingData.IGNORE,
                comparisonOperator: cdk.aws_cloudwatch.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
                threshold: -THRESHOLD_TEMPERATURE_OFFSET,
                metric: new cdk.aws_cloudwatch.Metric({
                    namespace: METRIC_NAMESPACE,
                    metricName: METRIC_NAME_TEMPERATURE_DIFF,
                    dimensionsMap: { "Meter": meterAlias },
                    period: cdk.Duration.minutes(2),
                    statistic: cdk.aws_cloudwatch.Stats.MAXIMUM,
                }),
            })
        });

        const lowTemperatureDiffAlarms = METERS.map((meterAlias) => {
            const escapedAlias = meterAlias.replace(/ /g, "")
            return new cdk.aws_cloudwatch.Alarm(scope, `${escapedAlias}TemperatureLowDiffAlarm`, {
                actionsEnabled: true,
                datapointsToAlarm: 30,
                evaluationPeriods: 30,
                treatMissingData: cdk.aws_cloudwatch.TreatMissingData.IGNORE,
                comparisonOperator: cdk.aws_cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
                threshold: THRESHOLD_TEMPERATURE_OFFSET,
                metric: new cdk.aws_cloudwatch.Metric({
                    namespace: METRIC_NAMESPACE,
                    metricName: METRIC_NAME_TEMPERATURE_DIFF,
                    dimensionsMap: { "Meter": meterAlias },
                    period: cdk.Duration.minutes(2),
                    statistic: cdk.aws_cloudwatch.Stats.MINIMUM,
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
                threshold: THRESHOLD_HUMIDITY_LOW,
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
                threshold: THRESHOLD_BATTERY_LOW,
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
                    "Plug": PI_PLUG_NAME,
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
                    "Plug": FAN_PLUG_NAME,
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
                    "Plug": FAN_PLUG_NAME,
                },
                period: cdk.Duration.minutes(5),
                statistic: cdk.aws_cloudwatch.Stats.MAXIMUM,
            }),
        })

        const coolerFrozenAlarm = new cdk.aws_cloudwatch.Alarm(scope, "NCoolerFrozenAlarm", {
            actionsEnabled: true,
            datapointsToAlarm: 1,
            evaluationPeriods: 1,
            treatMissingData: cdk.aws_cloudwatch.TreatMissingData.IGNORE,
            comparisonOperator: cdk.aws_cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            threshold: 1,
            metric: new cdk.aws_cloudwatch.Metric({
                namespace: METRIC_NAMESPACE,
                metricName: METRIC_NAME_COOLER_FROZEN,
                period: cdk.Duration.minutes(5),
                statistic: cdk.aws_cloudwatch.Stats.MAXIMUM,
            }),
        });

        this.alarms = [
            heartBeatMissingAlarm,
            ...highTemperatureAlarms,
            ...lowTemperatureAlarms,
            ...highTemperatureDiffAlarms,
            ...lowTemperatureDiffAlarms,
            ...lowHumidityAlarms,
            ...lowBatteryAlarms,
            piOffline,
            fanNotDrawingPower,
            fanOffline,
            coolerFrozenAlarm,
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
                    "Plug": PI_PLUG_NAME,
                },
                period: cdk.Duration.minutes(5),
                statistic: cdk.aws_cloudwatch.Stats.MAXIMUM,
            }),
        });
    }
}

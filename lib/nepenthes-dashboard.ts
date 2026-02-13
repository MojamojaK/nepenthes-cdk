import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { METRIC_NAMESPACE, THRESHOLD_TEMPERATURE_HIGH, THRESHOLD_TEMPERATURE_LOW,
         THRESHOLD_HUMIDITY_LOW, THRESHOLD_BATTERY_LOW } from './constants';

export class NepenthesDashboard {
    constructor(scope: Construct, alarms: cdk.aws_cloudwatch.AlarmBase[]) {
        const dashboard = new cdk.aws_cloudwatch.Dashboard(scope, 'NHomeDashboard', {
            dashboardName: 'NHome-Nepenthes',
        });

        const METERS = ['N. Meter 1', 'N. Meter 2'];
        const PLUGS = ['N.Pi', 'N.Fan'];

        // Temperature graph with alarm thresholds
        const temperatureWidget = new cdk.aws_cloudwatch.GraphWidget({
            title: 'Temperature',
            left: METERS.map(meter => new cdk.aws_cloudwatch.Metric({
                namespace: METRIC_NAMESPACE,
                metricName: 'Temperature',
                dimensionsMap: { Meter: meter },
                period: cdk.Duration.minutes(2),
                statistic: cdk.aws_cloudwatch.Stats.AVERAGE,
                label: meter,
            })),
            leftAnnotations: [
                { value: THRESHOLD_TEMPERATURE_HIGH, color: '#d62728', label: 'High threshold' },
                { value: THRESHOLD_TEMPERATURE_LOW, color: '#1f77b4', label: 'Low threshold' },
            ],
            width: 12,
            height: 6,
        });

        // Humidity graph with alarm threshold
        const humidityWidget = new cdk.aws_cloudwatch.GraphWidget({
            title: 'Humidity',
            left: METERS.map(meter => new cdk.aws_cloudwatch.Metric({
                namespace: METRIC_NAMESPACE,
                metricName: 'Humidity',
                dimensionsMap: { Meter: meter },
                period: cdk.Duration.minutes(2),
                statistic: cdk.aws_cloudwatch.Stats.AVERAGE,
                label: meter,
            })),
            leftAnnotations: [
                { value: THRESHOLD_HUMIDITY_LOW, color: '#ff7f0e', label: 'Low threshold' },
            ],
            width: 12,
            height: 6,
        });

        // Battery levels
        const batteryWidget = new cdk.aws_cloudwatch.GraphWidget({
            title: 'Battery',
            left: METERS.map(meter => new cdk.aws_cloudwatch.Metric({
                namespace: METRIC_NAMESPACE,
                metricName: 'Battery',
                dimensionsMap: { Meter: meter },
                period: cdk.Duration.hours(1),
                statistic: cdk.aws_cloudwatch.Stats.MAXIMUM,
                label: meter,
            })),
            leftAnnotations: [
                { value: THRESHOLD_BATTERY_LOW, color: '#d62728', label: 'Low threshold' },
            ],
            width: 12,
            height: 6,
        });

        // Device power/switch status
        const deviceStatusWidget = new cdk.aws_cloudwatch.GraphWidget({
            title: 'Device Status (Switch)',
            left: PLUGS.map(plug => new cdk.aws_cloudwatch.Metric({
                namespace: METRIC_NAMESPACE,
                metricName: 'Switch',
                dimensionsMap: { Plug: plug },
                period: cdk.Duration.minutes(5),
                statistic: cdk.aws_cloudwatch.Stats.MAXIMUM,
                label: plug,
            })),
            width: 12,
            height: 6,
        });

        // Heartbeat
        const heartbeatWidget = new cdk.aws_cloudwatch.SingleValueWidget({
            title: 'Heartbeat',
            metrics: [new cdk.aws_cloudwatch.Metric({
                namespace: METRIC_NAMESPACE,
                metricName: 'Heartbeat',
                period: cdk.Duration.minutes(15),
                statistic: cdk.aws_cloudwatch.Stats.MAXIMUM,
            })],
            width: 6,
            height: 3,
        });

        // Fan power draw
        const fanPowerWidget = new cdk.aws_cloudwatch.GraphWidget({
            title: 'Fan Power Draw',
            left: [new cdk.aws_cloudwatch.Metric({
                namespace: METRIC_NAMESPACE,
                metricName: 'Power',
                dimensionsMap: { Plug: 'N.Fan' },
                period: cdk.Duration.minutes(5),
                statistic: cdk.aws_cloudwatch.Stats.AVERAGE,
                label: 'N.Fan',
            })],
            width: 6,
            height: 3,
        });

        // Alarm status overview
        const alarmWidget = new cdk.aws_cloudwatch.AlarmStatusWidget({
            title: 'Alarm Status',
            alarms: alarms,
            width: 12,
            height: 3,
        });

        dashboard.addWidgets(temperatureWidget, humidityWidget);
        dashboard.addWidgets(batteryWidget, deviceStatusWidget);
        dashboard.addWidgets(heartbeatWidget, fanPowerWidget, alarmWidget);
    }
}

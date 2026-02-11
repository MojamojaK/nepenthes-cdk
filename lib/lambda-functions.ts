import { Asset } from 'aws-cdk-lib/aws-s3-assets';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import { Duration, aws_logs } from 'aws-cdk-lib';
import * as CONSTANTS from './constants';

export class LambdaFunctions {

    public nepenthesLogPullerFunction: lambda.Function;
    public nepenthesPushoverFunction: lambda.Function;
    public nepenthesOnlinePlugStatusFunction: lambda.Function;
    public nepenthesPiPlugOnFunction: lambda.Function;

    constructor(scope: Construct) {
        const assetLambdaCode = new Asset(scope, 'AssetLambdaCode', {
            path: path.join(__dirname, '../lambda')
        });
        
        const requestsLayer3_12 = lambda.LayerVersion.fromLayerVersionArn(scope,
            "requestsLayer3_12", "arn:aws:lambda:us-west-2:770693421928:layer:Klayers-p312-requests:2");

        this.nepenthesLogPullerFunction = new lambda.Function(scope, 'NLogPullerAssetLambda', {
            runtime: lambda.Runtime.PYTHON_3_12,
            handler: 'nepenthes_log_puller.lambda_handler',
            code: lambda.Code.fromBucket(assetLambdaCode.bucket, assetLambdaCode.s3ObjectKey),
            timeout: Duration.seconds(7),
            environment: {
                "METRIC_NAMESPACE": CONSTANTS.METRIC_NAMESPACE
            },
            logRetention: aws_logs.RetentionDays.TWO_MONTHS,
            retryAttempts: 0,
            layers: [requestsLayer3_12],
        });

        this.nepenthesPushoverFunction = new lambda.Function(scope, 'NPushoverAssetLambda', {
            runtime: lambda.Runtime.PYTHON_3_12,
            handler: 'nepenthes_pushover.lambda_handler',
            code: lambda.Code.fromBucket(assetLambdaCode.bucket, assetLambdaCode.s3ObjectKey),
            environment: {
                "PUSHOVER_API_KEY": CONSTANTS.PUSHOVER_API_KEY,
                "PAGEE_USER_KEY": CONSTANTS.PAGEE_USER_KEY,
            },
            logRetention: aws_logs.RetentionDays.TWO_MONTHS,
            retryAttempts: 1,
            layers: [requestsLayer3_12],
        });

        this.nepenthesOnlinePlugStatusFunction = new lambda.Function(scope, "NOnlinePlugStatusLambda", {
            runtime: lambda.Runtime.PYTHON_3_12,
            handler: 'nepenthes_online_plug_status.lambda_handler',
            code: lambda.Code.fromBucket(assetLambdaCode.bucket, assetLambdaCode.s3ObjectKey),
            timeout: Duration.seconds(10),
            environment: {
                "SB_TOKEN": CONSTANTS.SB_TOKEN,
                "SB_SECRET_KEY": CONSTANTS.SB_SECRET_KEY,
                "SB_PI_DEVICE_ID": CONSTANTS.SB_PI_DEVICE_ID,
                "SB_FAN_DEVICE_ID": CONSTANTS.SB_FAN_DEVICE_ID,
                "METRIC_NAMESPACE": CONSTANTS.METRIC_NAMESPACE,
            },
            logRetention: aws_logs.RetentionDays.TWO_MONTHS,
            retryAttempts: 0,
            layers: [requestsLayer3_12],
        });

        this.nepenthesPiPlugOnFunction = new lambda.Function(scope, "NPiPlugOnLambda", {
            runtime: lambda.Runtime.PYTHON_3_12,
            handler: 'nepenthes_pi_plug_on.lambda_handler',
            code: lambda.Code.fromBucket(assetLambdaCode.bucket, assetLambdaCode.s3ObjectKey),
            timeout: Duration.seconds(10),
            environment: {
                "SB_TOKEN": CONSTANTS.SB_TOKEN,
                "SB_SECRET_KEY": CONSTANTS.SB_SECRET_KEY,
            },
            logRetention: aws_logs.RetentionDays.TWO_MONTHS,
            retryAttempts: 0,
            layers: [requestsLayer3_12],
        });
    }
}

import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'path';
import { BundlingOutput, Duration, ILocalBundling, RemovalPolicy } from 'aws-cdk-lib';
import { execSync } from 'child_process';
import { copyFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import * as CONSTANTS from './constants';

function copyDirRecursive(src: string, dest: string): void {
    mkdirSync(dest, { recursive: true });
    for (const entry of readdirSync(src)) {
        const srcPath = path.join(src, entry);
        const destPath = path.join(dest, entry);
        if (statSync(srcPath).isDirectory()) {
            copyDirRecursive(srcPath, destPath);
        } else {
            copyFileSync(srcPath, destPath);
        }
    }
}

function createLambdaRole(scope: Construct, id: string, logGroup: logs.LogGroup): iam.Role {
    const role = new iam.Role(scope, id, {
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });
    role.addToPolicy(new iam.PolicyStatement({
        actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: [logGroup.logGroupArn, `${logGroup.logGroupArn}:*`],
    }));
    return role;
}

export class LambdaFunctions {

    public nepenthesLogPullerFunction: lambda.Function;
    public nepenthesPushoverFunction: lambda.Function;
    public nepenthesAlarmEmailFormatterFunction: lambda.Function;
    public nepenthesOnlinePlugStatusFunction: lambda.Function;
    public nepenthesPiPlugOnFunction: lambda.Function;

    constructor(scope: Construct) {
        const lambdaDir = path.join(__dirname, '../lambda');
        const localBundling: ILocalBundling = {
            tryBundle(outputDir: string): boolean {
                try {
                    execSync(`pip install requests -t "${outputDir}"`, { stdio: 'pipe' });
                } catch {
                    try {
                        execSync(`pip3 install requests -t "${outputDir}"`, { stdio: 'pipe' });
                    } catch {
                        return false;
                    }
                }
                copyDirRecursive(lambdaDir, outputDir);
                return true;
            },
        };

        const lambdaCode = lambda.Code.fromAsset(lambdaDir, {
            bundling: {
                image: lambda.Runtime.PYTHON_3_14.bundlingImage,
                platform: 'linux/arm64',
                command: [
                    'bash', '-c',
                    'pip install requests -t /asset-output && cp -au . /asset-output',
                ],
                outputType: BundlingOutput.NOT_ARCHIVED,
                local: localBundling,
            },
        });

        const logPullerLogGroup = new logs.LogGroup(scope, 'NLogPullerLogGroup', {
            retention: logs.RetentionDays.TWO_MONTHS,
            removalPolicy: RemovalPolicy.DESTROY,
        });
        this.nepenthesLogPullerFunction = new lambda.Function(scope, 'NLogPullerAssetLambda', {
            runtime: lambda.Runtime.PYTHON_3_14,
            architecture: lambda.Architecture.ARM_64,
            handler: 'nepenthes_log_puller.lambda_handler',
            code: lambdaCode,
            timeout: Duration.seconds(7),
            environment: {
                "METRIC_NAMESPACE": CONSTANTS.METRIC_NAMESPACE
            },
            logGroup: logPullerLogGroup,
            role: createLambdaRole(scope, 'NLogPullerRole', logPullerLogGroup),
            retryAttempts: 0,
        });

        const pushoverLogGroup = new logs.LogGroup(scope, 'NPushoverLogGroup', {
            retention: logs.RetentionDays.TWO_MONTHS,
            removalPolicy: RemovalPolicy.DESTROY,
        });
        this.nepenthesPushoverFunction = new lambda.Function(scope, 'NPushoverAssetLambda', {
            runtime: lambda.Runtime.PYTHON_3_14,
            architecture: lambda.Architecture.ARM_64,
            handler: 'nepenthes_pushover.lambda_handler',
            code: lambdaCode,
            environment: {
                "PUSHOVER_API_KEY": CONSTANTS.PUSHOVER_API_KEY,
                "PAGEE_USER_KEY": CONSTANTS.PAGEE_USER_KEY,
            },
            logGroup: pushoverLogGroup,
            role: createLambdaRole(scope, 'NPushoverRole', pushoverLogGroup),
            retryAttempts: 1,
        });

        const emailFormatterLogGroup = new logs.LogGroup(scope, 'NAlarmEmailFormatterLogGroup', {
            retention: logs.RetentionDays.TWO_MONTHS,
            removalPolicy: RemovalPolicy.DESTROY,
        });
        this.nepenthesAlarmEmailFormatterFunction = new lambda.Function(scope, 'NAlarmEmailFormatterLambda', {
            runtime: lambda.Runtime.PYTHON_3_14,
            architecture: lambda.Architecture.ARM_64,
            handler: 'nepenthes_alarm_email_formatter.lambda_handler',
            code: lambdaCode,
            logGroup: emailFormatterLogGroup,
            role: createLambdaRole(scope, 'NAlarmEmailFormatterRole', emailFormatterLogGroup),
            retryAttempts: 1,
        });

        const onlinePlugStatusLogGroup = new logs.LogGroup(scope, 'NOnlinePlugStatusLogGroup', {
            retention: logs.RetentionDays.TWO_MONTHS,
            removalPolicy: RemovalPolicy.DESTROY,
        });
        this.nepenthesOnlinePlugStatusFunction = new lambda.Function(scope, "NOnlinePlugStatusLambda", {
            runtime: lambda.Runtime.PYTHON_3_14,
            architecture: lambda.Architecture.ARM_64,
            handler: 'nepenthes_online_plug_status.lambda_handler',
            code: lambdaCode,
            timeout: Duration.seconds(10),
            environment: {
                "SB_TOKEN": CONSTANTS.SB_TOKEN,
                "SB_SECRET_KEY": CONSTANTS.SB_SECRET_KEY,
                "METRIC_NAMESPACE": CONSTANTS.METRIC_NAMESPACE,
            },
            logGroup: onlinePlugStatusLogGroup,
            role: createLambdaRole(scope, 'NOnlinePlugStatusRole', onlinePlugStatusLogGroup),
            retryAttempts: 0,
        });

        const piPlugOnLogGroup = new logs.LogGroup(scope, 'NPiPlugOnLogGroup', {
            retention: logs.RetentionDays.TWO_MONTHS,
            removalPolicy: RemovalPolicy.DESTROY,
        });
        this.nepenthesPiPlugOnFunction = new lambda.Function(scope, "NPiPlugOnLambda", {
            runtime: lambda.Runtime.PYTHON_3_14,
            architecture: lambda.Architecture.ARM_64,
            handler: 'nepenthes_pi_plug_on.lambda_handler',
            code: lambdaCode,
            timeout: Duration.seconds(10),
            environment: {
                "SB_TOKEN": CONSTANTS.SB_TOKEN,
                "SB_SECRET_KEY": CONSTANTS.SB_SECRET_KEY,
            },
            logGroup: piPlugOnLogGroup,
            role: createLambdaRole(scope, 'NPiPlugOnRole', piPlugOnLogGroup),
            retryAttempts: 0,
        });
    }
}

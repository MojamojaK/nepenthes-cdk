import json
import os
import boto3

from alarm_formatter import format_alarm

FORMATTED_TOPIC_ARN = os.environ["FORMATTED_TOPIC_ARN"]
sns_client = boto3.client("sns")


def lambda_handler(event, _):
    print("Event: " + str(event))

    record = event.get("Records", [{}])[0]
    formatted = format_alarm(record)

    response = sns_client.publish(
        TopicArn=FORMATTED_TOPIC_ARN,
        Subject=formatted["title"][:100],  # SNS subject max 100 chars
        Message=formatted["body"],
    )

    return {
        'statusCode': 200,
        'body': json.dumps(response, default=str),
    }

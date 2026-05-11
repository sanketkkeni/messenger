# 14 - CloudWatch Monitoring

## Overview

CloudWatch is used to monitor all AWS resources in the family messenger application.

## Log Groups

### Lambda Functions
- `/aws/lambda/family-messenger-connect-handler`
- `/aws/lambda/family-messenger-disconnect-handler`
- `/aws/lambda/family-messenger-message-handler`
- `/aws/lambda/family-messenger-users-handler`
- `/aws/lambda/family-messenger-history-handler`
- `/aws/lambda/family-messenger-authorizer`

### API Gateway
- `/aws/apigateway/family-messenger/websocket` - WebSocket API access logs
- `/aws/apigateway/family-messenger/rest` - REST API access logs

### Cognito
- `/aws/cognito/family-messenger-users` - User pool operations

## Key Metrics to Monitor

### Lambda Metrics
- Invocations (count)
- Duration (ms)
- Errors (count)
- Throttles (count)

### API Gateway Metrics
- Connection Count (WebSocket)
- Message Count (WebSocket)
- Integration Latency
- 4XX/5XX Error Rates

### DynamoDB Metrics
- Consumed Read/Write Capacity
- Throttling Events
- Latency

## Viewing Logs

```bash
# Get recent log events from message handler
aws logs filter-log-events \
  --log-group-name /aws/lambda/family-messenger-message-handler \
  --start-time $(date -d '1 hour ago' +%s)000 \
  --query 'events[*].[timestamp,message]' \
  --output text

# Filter for errors only
aws logs filter-log-events \
  --log-group-name /aws/lambda/family-messenger-message-handler \
  --filter-pattern "ERROR"
```

## Dashboard

Create a custom dashboard to monitor:
1. Lambda invocation rates and errors
2. API Gateway connection counts
3. DynamoDB capacity consumption
4. Cognito sign-up/sign-in events

## Alerts (Recommended)

- Lambda Error Rate > 1%
- Lambda Duration > 3000ms
- API Gateway 5XX Error Rate > 1%
- DynamoDB Throttle Count > 0

## CloudWatch Pricing Notes

- First 5 GB per month of logs is free
- Beyond 5 GB: $0.03 per GB
- Metrics: First 10 dashboards free, $3/dashboard/month after
- For family use, costs should remain minimal
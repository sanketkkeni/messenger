# 20 - Cost Estimation

## Overview

This document estimates the monthly cost of running the family messenger application on AWS.

## AWS Services and Costs

### DynamoDB

**Table Structure**:
- `family-messenger-messages`: Stores message history
- `family-messenger-connections`: Stores WebSocket connections

**Cost Model**: On-demand (pay-per-request)

| Operation | Est. Monthly Volume | Cost per Million | Monthly Cost |
|------------|--------------------:|----------------:|------------:|
| Write (messages) | 10,000 writes/day | $1.25 | ~$0.38 |
| Read (history) | 50,000 reads/day | $0.25 | ~$1.25 |
| Storage (~10MB) | 10 MB | $0.25/GB | ~$0.003 |

**Total DynamoDB**: ~$1.63/month

### Lambda

**Functions**: 5 handlers (authorizer, connect, disconnect, message, users, history)

| Metric | Est. Value |
|--------|-----------|
| Invocations/day | ~1,000 |
| Avg duration | 100ms |
| Memory | 256 MB |

**Calculation**:
- Requests: 1,000/day = 30,000/month
- Compute: 30,000 × 0.1s × 256MB = 768 GB-seconds
- Free tier: 400,000 GB-seconds/month
- **Lambda Cost**: $0.00 (within free tier)

### API Gateway

**WebSocket API**:
- Connections: ~500/month
- Messages: ~10,000/month

| Charge | Amount | Rate | Cost |
|--------|-------:|-----:|-----:|
| Connections | 500 | $0.05/million | ~$0.00003 |
| Messages | 10,000 | $0.05/million | ~$0.0005 |

**REST API**:
- Requests: ~5,000/month (history, users)

| Charge | Amount | Rate | Cost |
|--------|-------:|-----:|-----:|
| REST Requests | 5,000 | $0.00 first 1M | $0.00 |

**Total API Gateway**: ~$0.001/month

### Cognito

**User Pool**: Free tier eligible

| Resource | Usage | Cost |
|----------|------:|-----:|
| Monthly Active Users | 5 | Free (first 50,000) |
| Active Users (beyond free) | 0 | $0.00 |
| Federated Identities | 0 | N/A |

**Total Cognito**: $0.00

### CloudWatch

**Logs Volume Estimate**:
- Lambda logs: ~50 MB/month
- API Gateway logs: ~10 MB/month
- Total: ~60 MB/month

| Resource | Usage | Cost |
|----------|------:|-----:|
| First 5 GB/month | 5 GB | Free |
| Beyond 5 GB | 0 GB | $0.00 |

**Total CloudWatch**: $0.00

### Data Transfer

**Estimated**:
- Frontend to API Gateway: ~500 MB/month
- API Gateway to Lambda: ~100 MB/month

| Resource | Usage | Cost |
|----------|------:|-----:|
| First 100 GB/month | 0.6 GB | Free |

**Total Data Transfer**: $0.00

## Total Estimated Cost

| Service | Monthly Cost |
|---------|-------------:|
| DynamoDB | $1.63 |
| Lambda | $0.00 |
| API Gateway | $0.001 |
| Cognito | $0.00 |
| CloudWatch | $0.00 |
| Data Transfer | $0.00 |
| **TOTAL** | **~$1.63/month** |

## Cost Optimization Tips

1. **DynamoDB**: Use on-demand mode (auto-scales with usage)
2. **Lambda**: Memory is sufficient at 256MB
3. **CloudWatch**: Logs should auto-expire (set retention policy)
4. **API Gateway**: Already using most cost-effective tier

## Heavy Usage Scenario

If usage increases 100x (100 users, 10x messages):

| Service | Monthly Cost |
|---------|-------------:|
| DynamoDB | ~$163 |
| Lambda | ~$0.00 |
| API Gateway | ~$0.10 |
| Total | **~$163/month** |

## Monitoring Costs

Set up AWS Budget Alerts:
```bash
aws budgets create-budget \
  --account 123456789012 \
  --budget file://budget.json \
  --notifications-with-subscribers file://notifications.json
```

## Conclusion

For family use (2-10 users), the application should cost approximately **$2-5/month** in AWS fees, staying well within free tier limits.
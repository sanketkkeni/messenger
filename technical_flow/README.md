# Technical Documentation - Family Messenger

This directory contains in-depth technical documentation for the Family Messenger application. It describes every component, flow, and configuration in detail.

## Documentation Index

### Architecture & Overview
1. [Architecture Overview](01_architecture_overview.md) - High-level system architecture
2. [AWS Services](02_aws_services.md) - Detailed breakdown of AWS services used

### Authentication & Sessions
3. [User Authentication](03_user_authentication.md) - Signup, login, Cognito flows
4. [Session Persistence](04_session_persistence.md) - Token refresh, localStorage

### Real-Time Messaging
5. [WebSocket Connection](05_websocket_connection.md) - $connect, $disconnect routes
6. [Messaging Flow](06_messaging_flow.md) - Message routing, real-time delivery
7. [Message History](07_message_history.md) - Chat history retrieval

### APIs & Backend
8. [API Endpoints](08_api_endpoints.md) - REST API endpoints, request/response formats
9. [Lambda Functions](09_lambda_functions.md) - Each Lambda function explained
10. [DynamoDB Tables](10_dynamodb_tables.md) - Data model, access patterns
11. [API Gateway](11_api_gateway.md) - WebSocket + REST APIs, CORS, throttling
12. [IAM Permissions](12_iam_permissions.md) - IAM roles and policies
13. [Cognito Configuration](13_cognito_config.md) - User pool and client settings

### Operations & Maintenance
14. [CloudWatch Monitoring](14_cloudwatch_monitoring.md) - Log groups, metrics, alerts
15. [Security](15_security.md) - Best practices, token security, IAM
16. [Deployment](16_deployment.md) - Terraform, Lambda, Vercel deployment
17. [Environment Variables](17_environment_variables.md) - Configuration management

### Development & Support
18. [Troubleshooting](18_troubleshooting.md) - Common issues, solutions, debugging
19. [Local Development](19_local_development.md) - Dev environment setup
20. [Cost Estimation](20_cost_estimation.md) - AWS cost breakdown
21. [Architecture Diagrams](21_architecture_diagrams.md) - ASCII system diagrams

### Visual Architecture
[architecture_diagram.md](architecture_diagram.md) - Mermaid-based visual diagrams showing system architecture, authentication flows, messaging flows, data models, Terraform infrastructure, and deployment workflows (GitHub renders Mermaid diagrams automatically)

## Quick Reference

### Resource Names
- **Project Name**: `family-messenger`
- **Environment**: `dev`
- **AWS Region**: `us-east-1`

### DynamoDB Tables
- `family-messenger-connections` - WebSocket connection storage
- `family-messenger-messages` - Chat message persistence

### Lambda Functions
- `family-messenger-authorizer`
- `family-messenger-connect-handler`
- `family-messenger-disconnect-handler`
- `family-messenger-message-handler`
- `family-messenger-users-handler`
- `family-messenger-history-handler`

### API Gateways
- **WebSocket API**: `family-messenger-websocket` (ID: `7477wqg01f`)
- **REST API**: `family-messenger-rest` (ID: `wka1crhece`)

### Cognito
- **User Pool**: `us-east-1_tQ9N9Y8LF`
- **App Client**: `6pbdutoj0p9bhrp2hia7qcflj6`

### CloudWatch Log Groups
- `/aws/lambda/family-messenger-authorizer`
- `/aws/lambda/family-messenger-connect-handler`
- `/aws/lambda/family-messenger-disconnect-handler`
- `/aws/lambda/family-messenger-message-handler`
- `/aws/lambda/family-messenger-users-handler`
- `/aws/lambda/family-messenger-history-handler`
- `/aws/apigateway/family-messenger/websocket`
- `/aws/apigateway/family-messenger/rest`
- `/aws/cognito/family-messenger-users`

### Deployment URLs
- **Frontend (Vercel)**: https://sanketmessenger.vercel.app
- **WebSocket**: `wss://7477wqg01f.execute-api.us-east-1.amazonaws.com/$default`
- **REST API**: `https://wka1crhece.execute-api.us-east-1.amazonaws.com`

## Future Scope
See WIKI.md for planned future enhancements including:
- Rate limiting / throttling
- Cost estimation
- Monitoring & alerts
- Backup & recovery
- Multi-device support

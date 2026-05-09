# Cognito Outputs
output "user_pool_id" {
  description = "The ID of the Cognito User Pool"
  value       = aws_cognito_user_pool.family_messenger.id
}

output "user_pool_arn" {
  description = "The ARN of the Cognito User Pool"
  value       = aws_cognito_user_pool.family_messenger.arn
}

output "user_pool_client_id" {
  description = "The ID of the Cognito User Pool Client"
  value       = aws_cognito_user_pool_client.family_messenger_client.id
}

# DynamoDB Outputs
output "connections_table_name" {
  description = "The name of the Connections DynamoDB table"
  value       = aws_dynamodb_table.connections.name
}

output "connections_table_arn" {
  description = "The ARN of the Connections DynamoDB table"
  value       = aws_dynamodb_table.connections.arn
}

output "messages_table_name" {
  description = "The name of the Messages DynamoDB table"
  value       = aws_dynamodb_table.messages.name
}

output "messages_table_arn" {
  description = "The ARN of the Messages DynamoDB table"
  value       = aws_dynamodb_table.messages.arn
}

# API Gateway Outputs
output "websocket_api_id" {
  description = "The ID of the WebSocket API Gateway"
  value       = aws_apigatewayv2_api.websocket_api.id
}

output "websocket_api_endpoint" {
  description = "The WebSocket API endpoint URL"
  value       = aws_apigatewayv2_api.websocket_api.api_endpoint
}

output "websocket_stage_name" {
  description = "The WebSocket API stage name"
  value       = aws_apigatewayv2_stage.websocket_stage.name
}

output "rest_api_id" {
  description = "The ID of the REST API Gateway"
  value       = aws_apigatewayv2_api.rest_api.id
}

output "rest_api_endpoint" {
  description = "The REST API endpoint URL"
  value       = aws_apigatewayv2_api.rest_api.api_endpoint
}

output "rest_stage_name" {
  description = "The REST API stage name"
  value       = aws_apigatewayv2_stage.rest_stage.name
}

# Lambda Function Outputs
output "authorizer_function_name" {
  description = "The name of the Authorizer Lambda function"
  value       = aws_lambda_function.authorizer.function_name
}

output "authorizer_function_arn" {
  description = "The ARN of the Authorizer Lambda function"
  value       = aws_lambda_function.authorizer.arn
}

output "connect_handler_function_name" {
  description = "The name of the Connect Handler Lambda function"
  value       = aws_lambda_function.connect_handler.function_name
}

output "connect_handler_function_arn" {
  description = "The ARN of the Connect Handler Lambda function"
  value       = aws_lambda_function.connect_handler.arn
}

output "disconnect_handler_function_name" {
  description = "The name of the Disconnect Handler Lambda function"
  value       = aws_lambda_function.disconnect_handler.function_name
}

output "message_handler_function_name" {
  description = "The name of the Message Handler Lambda function"
  value       = aws_lambda_function.message_handler.function_name
}

output "users_handler_function_name" {
  description = "The name of the Users Handler Lambda function"
  value       = aws_lambda_function.users_handler.function_name
}

# IAM Role Output
output "lambda_role_arn" {
  description = "The ARN of the Lambda execution role"
  value       = aws_iam_role.lambda_role.arn
}

# Frontend Configuration
output "frontend_config" {
  description = "Configuration values needed for frontend setup"
  value = {
    user_pool_id         = aws_cognito_user_pool.family_messenger.id
    user_pool_client_id  = aws_cognito_user_pool_client.family_messenger_client.id
    websocket_endpoint  = aws_apigatewayv2_api.websocket_api.api_endpoint
    rest_api_endpoint   = aws_apigatewayv2_api.rest_api.api_endpoint
  }
}
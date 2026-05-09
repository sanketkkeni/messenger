# WebSocket API for Real-time Messaging
resource "aws_apigatewayv2_api" "websocket_api" {
  name          = var.websocket_api_name
  protocol_type = "WEBSOCKET"
  route_selection_expression = "$request.body.action"

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# WebSocket API Stages
resource "aws_apigatewayv2_stage" "websocket_stage" {
  api_id      = aws_apigatewayv2_api.websocket_api.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    detailed_metrics_enabled = true
    logging_level            = "INFO"
    data_trace_enabled       = true
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# WebSocket API Routes
resource "aws_apigatewayv2_route" "connect_route" {
  api_id    = aws_apigatewayv2_api.websocket_api.id
  route_key = "$connect"
  target    = "integrations/${aws_apigatewayv2_integration.connect_integration.id}"
}

resource "aws_apigatewayv2_route" "disconnect_route" {
  api_id    = aws_apigatewayv2_api.websocket_api.id
  route_key = "$disconnect"
  target    = "integrations/${aws_apigatewayv2_integration.disconnect_integration.id}"
}

resource "aws_apigatewayv2_route" "send_message_route" {
  api_id    = aws_apigatewayv2_api.websocket_api.id
  route_key = "sendMessage"
  target    = "integrations/${aws_apigatewayv2_integration.message_integration.id}"
}

# WebSocket API Integrations
resource "aws_apigatewayv2_integration" "connect_integration" {
  api_id           = aws_apigatewayv2_api.websocket_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.connect_handler.arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "disconnect_integration" {
  api_id           = aws_apigatewayv2_api.websocket_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.disconnect_handler.arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "message_integration" {
  api_id           = aws_apigatewayv2_api.websocket_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.message_handler.arn
  payload_format_version = "2.0"
}

# Permissions for API Gateway to invoke Lambda functions
resource "aws_lambda_permission" "allow_apigateway_connect" {
  statement_id  = "AllowAPIGatewayConnect"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.connect_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "allow_apigateway_disconnect" {
  statement_id  = "AllowAPIGatewayDisconnect"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.disconnect_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "allow_apigateway_message" {
  statement_id  = "AllowAPIGatewayMessage"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.message_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket_api.execution_arn}/*/*"
}

# REST API for User Discovery
resource "aws_apigatewayv2_api" "rest_api" {
  name          = var.rest_api_name
  protocol_type = "HTTP"

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# REST API Stages
resource "aws_apigatewayv2_stage" "rest_stage" {
  api_id      = aws_apigatewayv2_api.rest_api.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    detailed_metrics_enabled = true
    logging_level            = "INFO"
    data_trace_enabled       = true
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# REST API Routes
resource "aws_apigatewayv2_route" "users_route" {
  api_id    = aws_apigatewayv2_api.rest_api.id
  route_key = "GET /users"
  target    = "integrations/${aws_apigatewayv2_integration.users_integration.id}"
}

# REST API Integration
resource "aws_apigatewayv2_integration" "users_integration" {
  api_id           = aws_apigatewayv2_api.rest_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.users_handler.arn
  payload_format_version = "2.0"
}

# Permissions for REST API Gateway to invoke Lambda function
resource "aws_lambda_permission" "allow_rest_apigateway_users" {
  statement_id  = "AllowRESTAPIGatewayUsers"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.users_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.rest_api.execution_arn}/*/*"
}
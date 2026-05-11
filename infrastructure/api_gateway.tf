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

# API Gateway Account Settings for CloudWatch Logging
resource "aws_api_gateway_account" "main" {
  cloudwatch_role_arn = aws_iam_role.apigateway_logging.arn
}

# WebSocket API Stages
resource "aws_apigatewayv2_stage" "websocket_stage" {
  api_id      = aws_apigatewayv2_api.websocket_api.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = 1000
    throttling_rate_limit   = 500
  }

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.websocket_access_logs.arn
    format = jsonencode({
      requestId = "$context.requestId"
      ip = "$context.identity.sourceIp"
      caller = "$context.identity.caller"
      user = "$context.identity.user"
      requestTime = "$context.requestTime"
      httpMethod = "$context.httpMethod"
      resourcePath = "$context.resourcePath"
      status = "$context.status"
      protocol = "$context.protocol"
      responseLength = "$context.responseLength"
      routeKey = "$context.routeKey"
      connectedAt = "$context.connectedAt"
      connectionId = "$context.connectionId"
    })
  }

  depends_on = [aws_api_gateway_account.main]

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# WebSocket API Authorizer
# NOTE: For WebSocket APIs, identity_sources MUST only use route.request.querystring.Authorization
# Using both header and query string causes 401 because WebSocket upgrade requests
# cannot easily set custom headers. Only query string is supported for $connect auth.
resource "aws_apigatewayv2_authorizer" "websocket_authorizer" {
  api_id           = aws_apigatewayv2_api.websocket_api.id
  authorizer_type  = "REQUEST"
  name             = "websocket-authorizer"
  authorizer_uri   = "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/${aws_lambda_function.authorizer.arn}/invocations"
  identity_sources = ["route.request.querystring.Authorization"]
}

# WebSocket API Routes
resource "aws_apigatewayv2_route" "connect_route" {
  api_id             = aws_apigatewayv2_api.websocket_api.id
  route_key          = "$connect"
  target             = "integrations/${aws_apigatewayv2_integration.connect_integration.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.websocket_authorizer.id
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
}

resource "aws_apigatewayv2_integration" "disconnect_integration" {
  api_id           = aws_apigatewayv2_api.websocket_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.disconnect_handler.arn
}

resource "aws_apigatewayv2_integration" "message_integration" {
  api_id           = aws_apigatewayv2_api.websocket_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.message_handler.arn
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

resource "aws_lambda_permission" "allow_apigateway_authorizer" {
  statement_id  = "AllowAPIGatewayAuthorizer"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.authorizer.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket_api.execution_arn}/*/*"
}

# REST API for User Discovery
resource "aws_apigatewayv2_api" "rest_api" {
  name          = var.rest_api_name
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization", "X-Requested-With"]
    expose_headers = []
    max_age = 3600
  }

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
    throttling_burst_limit = 1000
    throttling_rate_limit   = 500
  }

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.rest_access_logs.arn
    format = jsonencode({
      requestId = "$context.requestId"
      ip = "$context.identity.sourceIp"
      caller = "$context.identity.caller"
      user = "$context.identity.user"
      requestTime = "$context.requestTime"
      httpMethod = "$context.httpMethod"
      resourcePath = "$context.resourcePath"
      status = "$context.status"
      protocol = "$context.protocol"
      responseLength = "$context.responseLength"
      integrationErrorMessage = "$context.integrationErrorMessage"
    })
  }

  depends_on = [aws_api_gateway_account.main]

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

resource "aws_apigatewayv2_route" "cors_preflight_users" {
  api_id      = aws_apigatewayv2_api.rest_api.id
  route_key   = "OPTIONS /users"
  target      = "integrations/${aws_apigatewayv2_integration.users_integration.id}"
}

resource "aws_apigatewayv2_route" "cors_preflight" {
  api_id      = aws_apigatewayv2_api.rest_api.id
  route_key   = "OPTIONS /{proxy}"
  target      = "integrations/${aws_apigatewayv2_integration.users_integration.id}"
}

# History API Routes
resource "aws_apigatewayv2_route" "history_route" {
  api_id    = aws_apigatewayv2_api.rest_api.id
  route_key = "GET /conversations/{conversationId}/messages"
  target    = "integrations/${aws_apigatewayv2_integration.history_integration.id}"
}

resource "aws_apigatewayv2_route" "cors_preflight_history" {
  api_id      = aws_apigatewayv2_api.rest_api.id
  route_key   = "OPTIONS /conversations/{conversationId}/messages"
  target      = "integrations/${aws_apigatewayv2_integration.history_integration.id}"
}

# REST API Integration
resource "aws_apigatewayv2_integration" "users_integration" {
  api_id           = aws_apigatewayv2_api.rest_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.users_handler.arn
}

# History API Integration
resource "aws_apigatewayv2_integration" "history_integration" {
  api_id           = aws_apigatewayv2_api.rest_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.history_handler.arn
}

# Permissions for REST API Gateway to invoke Lambda function
resource "aws_lambda_permission" "allow_rest_apigateway_users" {
  statement_id  = "AllowRESTAPIGatewayUsers"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.users_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.rest_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "allow_rest_apigateway_history" {
  statement_id  = "AllowRESTAPIGatewayHistory"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.history_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.rest_api.execution_arn}/*/*"
}
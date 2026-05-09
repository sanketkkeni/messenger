# CloudWatch Log Group for API Gateway Access Logs
resource "aws_cloudwatch_log_group" "websocket_access_logs" {
  name              = "/aws/apigateway/${var.project_name}/websocket"
  retention_in_days = 30

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_cloudwatch_log_group" "rest_access_logs" {
  name              = "/aws/apigateway/${var.project_name}/rest"
  retention_in_days = 30

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# CloudWatch Log Group for Lambda Functions
resource "aws_cloudwatch_log_group" "authorizer_logs" {
  name              = "/aws/lambda/${var.project_name}-authorizer"
  retention_in_days = 30

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_cloudwatch_log_group" "connect_handler_logs" {
  name              = "/aws/lambda/${var.project_name}-connect-handler"
  retention_in_days = 30

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_cloudwatch_log_group" "disconnect_handler_logs" {
  name              = "/aws/lambda/${var.project_name}-disconnect-handler"
  retention_in_days = 30

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_cloudwatch_log_group" "message_handler_logs" {
  name              = "/aws/lambda/${var.project_name}-message-handler"
  retention_in_days = 30

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_cloudwatch_log_group" "users_handler_logs" {
  name              = "/aws/lambda/${var.project_name}-users-handler"
  retention_in_days = 30

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# CloudWatch Dashboard
resource "aws_cloudwatch_dashboard" "messenger_dashboard" {
  dashboard_name = "${var.project_name}-dashboard"
  dashboard_body = jsonencode({
    widgets = [
      {
        type = "text"
        x = 0
        y = 0
        width = 24
        height = 3
        properties = {
          markdown = "# Family Messenger Monitoring Dashboard"
        }
      },
      {
        type = "metric"
        x = 0
        y = 3
        width = 12
        height = 6
        properties = {
          title = "Lambda Invocations"
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", aws_lambda_function.authorizer.function_name],
            [".", "Invocations", "FunctionName", aws_lambda_function.connect_handler.function_name],
            [".", "Invocations", "FunctionName", aws_lambda_function.disconnect_handler.function_name],
            [".", "Invocations", "FunctionName", aws_lambda_function.message_handler.function_name],
            [".", "Invocations", "FunctionName", aws_lambda_function.users_handler.function_name]
          ]
          period = 300
          stat = "Sum"
          region = var.aws_region
        }
      },
      {
        type = "metric"
        x = 12
        y = 3
        width = 12
        height = 6
        properties = {
          title = "Lambda Errors"
          metrics = [
            ["AWS/Lambda", "Errors", "FunctionName", aws_lambda_function.authorizer.function_name],
            [".", "Errors", "FunctionName", aws_lambda_function.connect_handler.function_name],
            [".", "Errors", "FunctionName", aws_lambda_function.disconnect_handler.function_name],
            [".", "Errors", "FunctionName", aws_lambda_function.message_handler.function_name],
            [".", "Errors", "FunctionName", aws_lambda_function.users_handler.function_name]
          ]
          period = 300
          stat = "Sum"
          region = var.aws_region
        }
      },
      {
        type = "metric"
        x = 0
        y = 9
        width = 12
        height = 6
        properties = {
          title = "API Gateway Request Count"
          metrics = [
            ["AWS/ApiGateway", "Count", "ApiId", aws_apigatewayv2_api.websocket_api.id],
            [".", "Count", "ApiId", aws_apigatewayv2_api.rest_api.id]
          ]
          period = 300
          stat = "Sum"
          region = var.aws_region
        }
      },
      {
        type = "metric"
        x = 12
        y = 9
        width = 12
        height = 6
        properties = {
          title = "DynamoDB Capacity Units"
          metrics = [
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", aws_dynamodb_table.connections.name],
            [".", "ConsumedWriteCapacityUnits", "TableName", aws_dynamodb_table.connections.name],
            [".", "ConsumedReadCapacityUnits", "TableName", aws_dynamodb_table.messages.name],
            [".", "ConsumedWriteCapacityUnits", "TableName", aws_dynamodb_table.messages.name]
          ]
          period = 300
          stat = "Sum"
          region = var.aws_region
        }
      }
    ]
  })
}

# CloudWatch Alarms for Lambda Errors
resource "aws_cloudwatch_metric_alarm" "connect_handler_errors" {
  alarm_name          = "${var.project_name}-connect-handler-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "This alarm triggers when connect handler has errors"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.connect_handler.function_name
  }
}

resource "aws_cloudwatch_metric_alarm" "message_handler_errors" {
  alarm_name          = "${var.project_name}-message-handler-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "This alarm triggers when message handler has errors"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.message_handler.function_name
  }
}

# CloudWatch Alarms for API Gateway 5xx Errors
resource "aws_cloudwatch_metric_alarm" "websocket_api_5xx_errors" {
  alarm_name          = "${var.project_name}-websocket-api-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGateway"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "This alarm triggers when WebSocket API returns 5xx errors"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiId = aws_apigatewayv2_api.websocket_api.id
  }
}

resource "aws_cloudwatch_metric_alarm" "rest_api_5xx_errors" {
  alarm_name          = "${var.project_name}-rest-api-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGateway"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "This alarm triggers when REST API returns 5xx errors"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiId = aws_apigatewayv2_api.rest_api.id
  }
}

output "cloudwatch_log_groups" {
  description = "CloudWatch Log Group names"
  value = {
    websocket_access_logs   = aws_cloudwatch_log_group.websocket_access_logs.name
    rest_access_logs        = aws_cloudwatch_log_group.rest_access_logs.name
    authorizer_logs         = aws_cloudwatch_log_group.authorizer_logs.name
    connect_handler_logs    = aws_cloudwatch_log_group.connect_handler_logs.name
    disconnect_handler_logs = aws_cloudwatch_log_group.disconnect_handler_logs.name
    message_handler_logs    = aws_cloudwatch_log_group.message_handler_logs.name
    users_handler_logs      = aws_cloudwatch_log_group.users_handler_logs.name
  }
}

output "dashboard_url" {
  description = "CloudWatch Dashboard URL"
  value       = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${var.project_name}-dashboard"
}
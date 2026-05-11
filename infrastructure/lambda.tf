# Lambda Function: Authorizer
resource "aws_lambda_function" "authorizer" {
  function_name = "${var.project_name}-authorizer"
  runtime       = var.lambda_runtime
  handler       = "authorizer.lambda_handler"
  role          = aws_iam_role.lambda_role.arn
  timeout       = var.lambda_timeout
  memory_size   = var.lambda_memory_size
  
  # Package the Lambda function from local directory
  filename = "${path.module}/authorizer.zip"
  
  # Environment variables
  environment {
    variables = {
      USER_POOL_ID           = aws_cognito_user_pool.family_messenger.id
      USER_POOL_APP_CLIENT_ID = aws_cognito_user_pool_client.family_messenger_client.id
      LOG_LEVEL             = "INFO"
    }
  }
  
  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# Lambda Function: Connect Handler
resource "aws_lambda_function" "connect_handler" {
  function_name = "${var.project_name}-connect-handler"
  runtime       = var.lambda_runtime
  handler       = "connect_handler.lambda_handler"
  role          = aws_iam_role.lambda_role.arn
  timeout       = var.lambda_timeout
  memory_size   = var.lambda_memory_size
  
  # Package the Lambda function from local directory
  filename = "${path.module}/connect_handler.zip"
  
  # Environment variables
  environment {
    variables = {
      CONNECTIONS_TABLE_NAME = aws_dynamodb_table.connections.name
      LOG_LEVEL              = "INFO"
    }
  }
  
  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# Lambda Function: Disconnect Handler
resource "aws_lambda_function" "disconnect_handler" {
  function_name = "${var.project_name}-disconnect-handler"
  runtime       = var.lambda_runtime
  handler       = "disconnect_handler.lambda_handler"
  role          = aws_iam_role.lambda_role.arn
  timeout       = var.lambda_timeout
  memory_size   = var.lambda_memory_size
  
  # Package the Lambda function from local directory
  filename = "${path.module}/disconnect_handler.zip"
  
  # Environment variables
  environment {
    variables = {
      CONNECTIONS_TABLE_NAME = aws_dynamodb_table.connections.name
      LOG_LEVEL              = "INFO"
    }
  }
  
  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# Lambda Function: Message Handler
resource "aws_lambda_function" "message_handler" {
  function_name = "${var.project_name}-message-handler"
  runtime       = var.lambda_runtime
  handler       = "message_handler.lambda_handler"
  role          = aws_iam_role.lambda_role.arn
  timeout       = var.lambda_timeout
  memory_size   = var.lambda_memory_size
  
  # Package the Lambda function from local directory
  filename = "${path.module}/message_handler.zip"
  
  # Environment variables
  environment {
    variables = {
      CONNECTIONS_TABLE_NAME = aws_dynamodb_table.connections.name
      MESSAGES_TABLE_NAME    = aws_dynamodb_table.messages.name
      LOG_LEVEL              = "INFO"
    }
  }
  
  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# Lambda Function: Users Handler
# Updated to include CORS multiValueHeaders support - v2
# Zip hash: NDEXMjQ3Rjg4MUQwQ0Y5NTAyRTlBQkUxNDRGRDVFNzU=
resource "aws_lambda_function" "users_handler" {
  function_name = "${var.project_name}-users-handler"
  runtime       = var.lambda_runtime
  handler       = "users_handler.lambda_handler"
  role          = aws_iam_role.lambda_role.arn
  timeout       = var.lambda_timeout
  memory_size   = var.lambda_memory_size

  description   = "Handles user list requests with CORS support - v2"

  # Package the Lambda function from local directory
  filename = "${path.module}/users_handler.zip"

  # Environment variables
  environment {
    variables = {
      USER_POOL_ID = aws_cognito_user_pool.family_messenger.id
      LOG_LEVEL    = "INFO"
    }
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# Lambda Function: History Handler
resource "aws_lambda_function" "history_handler" {
  function_name = "${var.project_name}-history-handler"
  runtime       = var.lambda_runtime
  handler       = "history_handler.lambda_handler"
  role          = aws_iam_role.lambda_role.arn
  timeout       = var.lambda_timeout
  memory_size   = var.lambda_memory_size

  description   = "Retrieves chat message history from DynamoDB"

  # Package the Lambda function from local directory
  filename = "${path.module}/history_handler.zip"

  # Environment variables
  environment {
    variables = {
      MESSAGES_TABLE_NAME = aws_dynamodb_table.messages.name
      LOG_LEVEL           = "INFO"
    }
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# Data resources for zip files (assuming we'll create them separately)
# In practice, these would be built by a separate process or CI/CD pipeline
# For now, we'll rely on manual zipping or a build step
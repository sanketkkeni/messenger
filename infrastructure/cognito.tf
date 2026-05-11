# Cognito User Pool
resource "aws_cognito_user_pool" "family_messenger" {
  name = var.cognito_user_pool_name

  username_attributes = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length = 8
    require_uppercase = true
    require_lowercase = true
    require_numbers = true
    require_symbols = false
  }

  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# NOTE: Cognito CloudWatch logging is managed via AWS CLI (set-log-delivery-configuration)
# because Terraform AWS provider doesn't fully support Cognito log delivery configuration.
# To enable logging, run: aws cognito-idp set-log-delivery-configuration ...

# CloudWatch Log Group for Cognito
resource "aws_cloudwatch_log_group" "cognito_logs" {
  name              = "/aws/cognito/${var.cognito_user_pool_name}"
  retention_in_days = 30

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# IAM Role for Cognito CloudWatch logging
resource "aws_iam_role" "cognito_logging" {
  name = "${var.project_name}-cognito-logging"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "cognito-idp.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "cognito_logging" {
  name = "${var.project_name}-cognito-logging-policy"
  role = aws_iam_role.cognito_logging.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams"
        ]
        Resource = aws_cloudwatch_log_group.cognito_logs.arn
      }
    ]
  })
}

# Cognito User Pool Client
resource "aws_cognito_user_pool_client" "family_messenger_client" {
  name         = var.cognito_client_name
  user_pool_id = aws_cognito_user_pool.family_messenger.id

  generate_secret = false
  explicit_auth_flows = ["ADMIN_NO_SRP_AUTH", "USER_PASSWORD_AUTH"]

  # Token validity
  access_token_validity  = 1    # 1 hour
  id_token_validity      = 1    # 1 hour
  refresh_token_validity = 30   # 30 days

  # OAuth callback URLs
  callback_urls = ["${var.frontend_url}/api/auth/callback/cognito"]
  logout_urls   = [var.frontend_url]
}
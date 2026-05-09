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

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
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

  # OAuth settings (if needed)
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes = ["email", "openid", "profile"]
  allowed_oauth_flows = ["code", "implicit"]
}
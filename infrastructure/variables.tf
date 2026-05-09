variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "family-messenger"
}

# Cognito variables
variable "cognito_user_pool_name" {
  description = "Name for the Cognito User Pool"
  type        = string
  default     = "family-messenger-users"
}

variable "cognito_client_name" {
  description = "Name for the Cognito User Pool Client"
  type        = string
  default     = "family-messenger-client"
}

# DynamoDB variables
variable "connections_table_name" {
  description = "Name for the Connections DynamoDB table"
  type        = string
  default     = "family-messenger-connections"
}

variable "messages_table_name" {
  description = "Name for the Messages DynamoDB table"
  type        = string
  default     = "family-messenger-messages"
}

# API Gateway variables
variable "websocket_api_name" {
  description = "Name for the WebSocket API"
  type        = string
  default     = "family-messenger-websocket"
}

variable "rest_api_name" {
  description = "Name for the REST API"
  type        = string
  default     = "family-messenger-rest"
}

# Lambda variables
variable "lambda_runtime" {
  description = "Runtime for Lambda functions"
  type        = string
  default     = "python3.13"
}

variable "lambda_timeout" {
  description = "Timeout for Lambda functions in seconds"
  type        = number
  default     = 30
}

variable "lambda_memory_size" {
  description = "Memory size for Lambda functions in MB"
  type        = number
  default     = 256
}
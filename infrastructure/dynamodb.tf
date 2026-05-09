# DynamoDB Table for Connections
resource "aws_dynamodb_table" "connections" {
  name           = var.connections_table_name
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "UserId"
  range_key      = "connectionId"

  attribute {
    name = "UserId"
    type = "S"
  }

  attribute {
    name = "connectionId"
    type = "S"
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# DynamoDB Table for Messages
resource "aws_dynamodb_table" "messages" {
  name           = var.messages_table_name
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "conversationId"
  range_key      = "timestamp"

  attribute {
    name = "conversationId"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "N"
  }

  # Optional: Global Secondary Index for querying by recipientId and timestamp
  # We can add a GSI if needed, but for now, we'll keep it simple.

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}
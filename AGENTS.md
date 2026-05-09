# Agent Rules - Serverless Messaging Project

## Terraform Commands
- **NEVER run `terraform plan` on your own** - always wait for user instruction
- Always run terraform plan with: `terraform plan -no-color > plan_output.txt`
- Always review the plan output file before proceeding
- Run `terraform init` when working with a new infrastructure directory

## Terraform Configuration
- Do NOT add `tags` block to `aws_cognito_user_pool_client` resource (not supported)
- Do NOT use deprecated `schema {}` block in Cognito user pool (use `username_attributes` instead)
- CloudWatch Dashboard uses `dashboard_body` (JSON string), NOT `widget {}` blocks
- All outputs must be unique across all .tf files (no duplicates between cognito.tf, api_gateway.tf, outputs.tf)
- Use Terraform Cloud workspace with `cloud {}` block for remote execution
- Organization: "sanket-poc", Workspaces: use workspace-specific names (e.g., "messenger")

## Python Lambda Backend
- Python 3.13 runtime
- Create zip files for each Lambda function: `zip <name>.zip <handler>.py utils.py`
- Each handler file must have a `lambda_handler(event, context)` function
- Always include utils.py in every Lambda zip since handlers depend on shared functions

## Code Quality
- Remove duplicate output definitions before running terraform init/plan
- Use proper AWS provider syntax (check AWS provider docs for correct arguments)
- Always follow existing project patterns (e.g., Lambda timeout=30, memory_size=256)

## Workflow
1. Make file changes first
2. Run `terraform plan -no-color > plan_output.txt`
3. Review plan with user before `terraform apply`
4. Only run apply when explicitly requested

## Common Terraform Errors & Fixes
- "Duplicate output definition" = Remove outputs from individual .tf files, keep only in outputs.tf
- "Unsupported argument: tags" on Cognito client = Remove tags block (not supported)
- "Missing required argument: attribute_data_type" in schema = Remove schema block, use username_attributes
- "widget blocks not expected" in dashboard = Use dashboard_body with JSON string instead

## Project Structure
- infrastructure/ - Terraform .tf files
- backend/ - Python Lambda functions and zip files
- frontend/ - Next.js application
- Root level: README.md, PLAN.md, AGENTS.md
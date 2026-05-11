# Agent Rules - Serverless Messaging Project

## General Guidelines
- **ALWAYS ask a follow-up question** if you have any doubts or need clarification
- **DO NOT assume** on your own - ask the user to clarify when unsure
- When presented with multiple options or unclear requirements, ask the user to choose

## Terraform Commands
- **NEVER run `terraform plan` on your own** - always wait for user instruction
- **NEVER run `terraform apply` or any command that modifies state** without explicit user confirmation
- **NEVER modify infrastructure via AWS CLI/SDK directly** - always use Terraform
- **Use AWS CLI in read-only mode only** - for checking/verifying resources, not making changes
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
- **API Gateway v2 access logging**: Requires account-level CloudWatch Logs role via `aws_api_gateway_account` resource (not iam_role_arn in stage)
- **All infrastructure must be defined in Terraform** - including IAM roles, account settings, and any AWS resource configuration

## Python Lambda Backend
- Python 3.13 runtime
- Create zip files for each Lambda function: `zip <name>.zip <handler>.py utils.py`
- Each handler file must have a `lambda_handler(event, context)` function
- Always include utils.py in every Lambda zip since handlers depend on shared functions
- **Lambda code changes workflow**:
  1. Make code changes in `backend/<handler>.py`
  2. Create zip: `cd backend; python -c "import zipfile, os; z = zipfile.ZipFile('connect_handler.zip', 'w', zipfile.ZIP_DEFLATED); [z.write(os.path.join(r,f)) for r,d,files in os.walk('.') for f in files if f.endswith('.py')]; z.close()"`
  3. Deploy via AWS CLI: `aws lambda update-function-code --function-name <name> --zip-file fileb://infrastructure/<handler>.zip --no-cli-pager`
  4. Only run terraform plan/apply if there are infrastructure changes (IAM, API Gateway, etc.)

## WebSocket Authentication
- WebSocket `$connect` route uses `AuthorizationType: CUSTOM` with custom authorizer
- Authorizer identity source: `route.request.querystring.Authorization` (only - multiple sources cause 401)
- Authorizer returns IAM policy format (not `isAuthorized: true`) for WebSocket APIs
- Connect handler extracts userId from authorizer context OR falls back to query param
- Token validation: decode JWT payload, extract `cognito:username` or `sub` as userId
- Frontend sends token as query param: `?Authorization=<jwt_token>`
- WebSocket URL must include stage: `wss://<api-id>.execute-api.<region>.amazonaws.com/$default`
- **sendMessage/$disconnect**: Use connection-based auth (DynamoDB lookup of connectionId -> userId)

## AWS CLI Usage
- **Read-only**: Describe resources, check logs, verify state
- **Lambda updates**: Update Lambda code via AWS CLI after creating local zip files
- **NEVER use AWS CLI** to configure infrastructure (IAM roles, API Gateway settings, CloudWatch, etc.) - always use Terraform

## Code Quality
- Remove duplicate output definitions before running terraform init/plan
- Use proper AWS provider syntax (check AWS provider docs for correct arguments)
- Always follow existing project patterns (e.g., Lambda timeout=30, memory_size=256)
- **NEVER commit changes automatically** - only commit when explicitly requested by user

## Git Workflow
- **NEVER run `git add`, `git commit`, or `git push` without explicit user instruction**
- If user asks "should I commit?" or "do you want to commit?", wait for explicit confirmation
- If user says "commit these changes", proceed with add and commit

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
- Root level: README.md, PLAN.md, WIKI.md, AGENTS.md

## Frontend Testing
- **Jest**: Unit/integration tests in `frontend/__tests__/`
  - `cmd /c "npm test"` - Run all tests
- **Playwright**: E2E tests in `frontend/tests/`
  - `cmd /c "npx playwright test"` - Run E2E tests
  - Useful for WebSocket debugging
- Always mock external dependencies (auth context, router, AWS SDK)
- Use `waitFor` from testing-library for async operations
- Coverage target: aim for 70%+ on critical components

## Debugging WebSocket Issues
When WebSocket shows "Disconnected":
1. Check Playwright test output for connection errors
2. View CloudWatch logs: `aws logs filter-log-events --log-group-name /aws/lambda/family-messenger-connect-handler --start-time <timestamp>`
3. Check API Gateway access logs: `/aws/apigateway/family-messenger/websocket`
4. Verify Lambda zip includes all Python dependencies (pyjwt, jose, etc.)
5. Test Lambda directly: `aws lambda invoke --function-name <name> --payload file://test.json --cli-binary-format raw-in-base64-out output.txt`

## Documentation
- **Wiki**: Document all issues, solutions, and architecture decisions in `WIKI.md`
- When resolving issues or making significant architectural decisions:
  1. Add entry to `WIKI.md` with date, problem description, attempted solutions, and final solution
  2. Include relevant code snippets and configuration
  3. Add testing/debugging commands if applicable
- Keep wiki updated as the project evolves
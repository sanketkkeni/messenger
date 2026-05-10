# Agent Rules - Serverless Messaging Project

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

## WebSocket Authentication (Important)
- WebSocket `$connect` route uses `AuthorizationType: NONE` for simplicity
- Connect handler extracts JWT from `queryStringParameters.Authorization`
- Token validation: decode JWT payload, extract `cognito:username` or `sub` as userId
- Frontend sends token as query param: `?Authorization=<jwt_token>`
- WebSocket URL must include stage: `wss://<api-id>.execute-api.<region>.amazonaws.com/$default`

## AWS CLI Usage
- **Read-only**: Describe resources, check logs, verify state
- **Lambda updates**: Update Lambda code via AWS CLI after creating local zip files
- **NEVER use AWS CLI** to configure infrastructure (IAM roles, API Gateway settings, CloudWatch, etc.) - always use Terraform

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
- Root level: README.md, PLAN.md, WIKI.md, AGENTS.md

## Frontend Testing
- Use Jest + React Testing Library for unit/integration tests
- Test config: `jest.config.js`, `jest.setup.js`
- Test files location: `frontend/__tests__/`
- Test commands:
  - `npm test` - Run all tests
  - `npm run test:watch` - Watch mode
  - `npm run test:coverage` - With coverage report
- Always mock external dependencies (auth context, router, AWS SDK)
- Use `waitFor` from testing-library for async operations
- Coverage target: aim for 70%+ on critical components

## Frontend Code Quality
- Use Next.js 14 with App Router conventions
- Use `router.query` instead of `useSearchParams()` to avoid Suspense issues
- Import ConfirmSignUpCommand directly (not dynamically)
- Pin dependency versions in package.json (avoid "latest")
- Run `npm install` in frontend directory for dependencies
- Add NODE_PATH or use `C:\Program Files\nodejs` if PATH issues arise

## Documentation
- **Wiki**: Document all issues, solutions, and architecture decisions in `WIKI.md`
- When resolving issues or making significant architectural decisions:
  1. Add entry to `WIKI.md` with date, problem description, attempted solutions, and final solution
  2. Include relevant code snippets and configuration
  3. Add testing/debugging commands if applicable
- Keep wiki updated as the project evolves
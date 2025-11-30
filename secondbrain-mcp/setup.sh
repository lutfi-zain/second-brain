#!/bin/bash

# Second Brain MCP Server Setup Script
# This script creates the necessary Cloudflare resources for the Second Brain MCP Server

set -e

echo "🚀 Setting up Second Brain MCP Server resources..."

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="second-brain-mcp"
MEMORY_DB_NAME="${PROJECT_NAME}-db"
VECTOR_INDEX_NAME="${PROJECT_NAME}-vectors"
CACHE_NAMESPACE="${PROJECT_NAME}-cache"
MEMORY_INDEX_DIMENSION=768 # Dimensions for @cf/baai/bge-base-en-v1.5 model

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    print_error "Wrangler CLI is not installed. Please install it first:"
    echo "npm install -g wrangler"
    exit 1
fi

# Check if user is logged in to Cloudflare
print_status "Checking Cloudflare authentication..."
if ! wrangler whoami &> /dev/null; then
    print_error "You are not logged in to Cloudflare. Please run:"
    echo "wrangler auth login"
    exit 1
fi

print_success "Cloudflare authentication confirmed"

# Create D1 database
print_status "Creating D1 database: ${MEMORY_DB_NAME}..."
if wrangler d1 create "${MEMORY_DB_NAME}" --legacy-compat; then
    print_success "D1 database created successfully"
else
    print_warning "D1 database might already exist or creation failed"
fi

# Execute database schema
print_status "Setting up database schema..."
if wrangler d1 execute "${MEMORY_DB_NAME}" --file="${SCRIPT_DIR}/src/db/schema.sql" --legacy-compat; then
    print_success "Database schema executed successfully"
else
    print_error "Failed to execute database schema"
    exit 1
fi

# Create Vectorize index
print_status "Creating Vectorize index: ${VECTOR_INDEX_NAME}..."
if wrangler vectorize create "${VECTOR_INDEX_NAME}" --dimensions="${MEMORY_INDEX_DIMENSION}" --metric=cosine; then
    print_success "Vectorize index created successfully"
else
    print_warning "Vectorize index might already exist or creation failed"
fi

# Create KV namespace
print_status "Creating KV namespace: ${CACHE_NAMESPACE}..."
if wrangler kv:namespace create "${CACHE_NAMESPACE}"; then
    print_success "KV namespace created successfully"
else
    print_warning "KV namespace might already exist or creation failed"
fi

# Update wrangler.toml with the correct binding names
print_status "Updating wrangler.toml configuration..."
cat > "${SCRIPT_DIR}/wrangler.toml" << EOF
name = "${PROJECT_NAME}"
main = "src/index.ts"
compatibility_date = "2024-04-03"
compatibility_flags = ["nodejs_compat"]

[env.production]
[[env.production.d1_databases]]
binding = "DB"
database_name = "${MEMORY_DB_NAME}"
database_id = "$(wrangler d1 list --legacy-compat | jq -r '.[] | select(.name=="'"${MEMORY_DB_NAME}"') | .id')"

[[env.production.vectorize]]
binding = "VECTORIZE"
index_name = "${VECTOR_INDEX_NAME}"

[[env.production.kv_namespaces]]
binding = "CACHE"
id = "$(wrangler kv:namespace list | jq -r '.[] | select(.title=="'"${CACHE_NAMESPACE}"') | .id')"
preview_id = "$(wrangler kv:namespace list | jq -r '.[] | select(.title=="'"${CACHE_NAMESPACE}"') | .preview_id')"
EOF

# Get the actual database ID and update it
DATABASE_ID=$(wrangler d1 list --legacy-compat | jq -r '.[] | select(.name=="'"${MEMORY_DB_NAME}"') | .id')
if [ -n "$DATABASE_ID" ]; then
    sed -i "s/database_id = \"\$(wrangler d1 list --legacy-compat | jq -r '\\.\\[\\] | select(.name==\"'\"'\"'\"'${MEMORY_DB_NAME}\"'\"'\"') | .id')\"/database_id = \"$DATABASE_ID\"/" "${SCRIPT_DIR}/wrangler.toml"
    print_success "Database ID updated in wrangler.toml"
fi

# Get the actual KV namespace ID and update it
KV_ID=$(wrangler kv:namespace list | jq -r '.[] | select(.title=="'"${CACHE_NAMESPACE}"') | .id')
if [ -n "$KV_ID" ]; then
    sed -i "s/id = \"\$(wrangler kv:namespace list | jq -r '\\.\\[\\] | select(.title==\"'\"'\"'\"'${CACHE_NAMESPACE}\"'\"'\"') | .id')\"/id = \"$KV_ID\"/" "${SCRIPT_DIR}/wrangler.toml"
    print_success "KV namespace ID updated in wrangler.toml"
fi

# Install dependencies
print_status "Installing dependencies..."
if npm install; then
    print_success "Dependencies installed successfully"
else
    print_error "Failed to install dependencies"
    exit 1
fi

# Test the build
print_status "Testing build..."
if npm run build; then
    print_success "Build successful"
else
    print_error "Build failed"
    exit 1
fi

# Create deployment checklist
print_status "Creating deployment checklist..."
cat > "${SCRIPT_DIR}/DEPLOY.md" << EOF
# Deployment Checklist: Second Brain MCP Server

## Pre-deployment Checks

- [ ] All tests are passing: \`npm test\`
- [ ] Database schema is up to date: \`wrangler d1 execute ${MEMORY_DB_NAME} --file=src/db/schema.sql --legacy-compat\`
- [ ] Vectorize index is configured correctly
- [ ] Environment variables are set in wrangler.toml

## Deployment Commands

1. **Deploy to Cloudflare Workers:**
   \`\`\`bash
   wrangler deploy --env production
   \`\`\`

2. **Test the deployment:**
   \`\`\`bash
   # Test health endpoint
   curl https://your-worker-subdomain.workers.dev/

   # Test MCP tools listing
   curl https://your-worker-subdomain.workers.dev/mcp
   \`\`\`

## Post-deployment Verification

- [ ] Health endpoint returns success
- [ ] MCP tools listing returns all 4 tools
- [ ] Test storing a memory
- [ ] Test searching memories
- [ ] Test listing memories
- [ ] Test deleting a memory

## Environment Variables (if needed)

Add any additional environment variables to your \`wrangler.toml\`:

\`\`\`toml
[env.production.vars]
# Add your environment variables here
\`\`\`

## Troubleshooting

- **Database connection issues:** Check that the D1 database is properly bound
- **Vectorize issues:** Verify the vector index name and dimensions
- **AI binding issues:** Ensure the AI binding is available in your region
- **Build issues:** Check TypeScript compilation errors in the build output
EOF

print_success "Setup completed successfully!"
echo
print_status "Next steps:"
echo "1. Review and update the generated wrangler.toml file if needed"
echo "2. Deploy using: wrangler deploy --env production"
echo "3. Follow the DEPLOY.md checklist for deployment verification"
echo
print_warning "Note: Make sure to update your wrangler.toml with your actual Worker name and any custom configuration"
echo
print_success "🎉 Second Brain MCP Server setup is complete!"
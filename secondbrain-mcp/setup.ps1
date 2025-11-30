# Second Brain MCP Server Setup Script for Windows PowerShell
# This script creates the necessary Cloudflare resources for the Second Brain MCP Server

param(
    [string]$ConfigFile = ".env"
)

# Configuration - Load from .env if exists
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$PROJECT_NAME = "second-brain-mcp"
$MEMORY_DB_NAME = "d1_secondbrain"
$VECTOR_INDEX_NAME = "vec_secondbrain_memories"
$CACHE_NAMESPACE = "CACHE"
$DOMAIN_BRAIN = "brain.maftia.tech"
$ZONE_NAME = "maftia.tech"
$MEMORY_INDEX_DIMENSION = 768 # Dimensions for @cf/baai/bge-base-en-v1.5 model

# Load .env file if it exists
if (Test-Path $ConfigFile) {
    $envContent = Get-Content $ConfigFile | Where-Object { $_ -match '^[^#]' -and $_ -match '=' }
    foreach ($line in $envContent) {
        $key, $value = $line -split '=', 2
        $key = $key.Trim()
        $value = $value.Trim()
        if ($key -eq "CLOUDFLARE_API_TOKEN") { $env:CLOUDFLARE_API_TOKEN = $value }
        if ($key -eq "D1_DATABASE_NAME") { $MEMORY_DB_NAME = $value }
        if ($key -eq "VECTORIZE_INDEX_NAME") { $VECTOR_INDEX_NAME = $value }
        if ($key -eq "KV_NAMESPACE_NAME") { $CACHE_NAMESPACE = $value }
        if ($key -eq "WORKER_BRAIN_NAME") { $PROJECT_NAME = $value }
        if ($key -eq "DOMAIN_BRAIN") { $DOMAIN_BRAIN = $value }
        if ($key -eq "ZONE_NAME") { $ZONE_NAME = $value }
    }
}

# Colors for output (PowerShell)
$RED = "Red"
$GREEN = "Green"
$YELLOW = "Yellow"
$BLUE = "Blue"

function Write-Status {
    param([string]$Message)
    Write-Host "[$((Get-Date).ToString('HH:mm:ss'))] [INFO] $Message" -ForegroundColor $BLUE
}

function Write-Success {
    param([string]$Message)
    Write-Host "[$((Get-Date).ToString('HH:mm:ss'))] [SUCCESS] $Message" -ForegroundColor $GREEN
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[$((Get-Date).ToString('HH:mm:ss'))] [WARNING] $Message" -ForegroundColor $YELLOW
}

function Write-Error {
    param([string]$Message)
    Write-Host "[$((Get-Date).ToString('HH:mm:ss'))] [ERROR] $Message" -ForegroundColor $RED
}

# Check if wrangler is installed
Write-Status "Checking if Wrangler CLI is installed..."
if (!(Get-Command wrangler -ErrorAction SilentlyContinue)) {
    Write-Error "Wrangler CLI is not installed. Please install it first:"
    Write-Host "npm install -g wrangler"
    exit 1
}

# Check if user is logged in to Cloudflare
Write-Status "Checking Cloudflare authentication..."
try {
    $whoami = wrangler whoami 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Not authenticated"
    }
    Write-Success "Cloudflare authentication confirmed"
} catch {
    Write-Error "You are not logged in to Cloudflare. Please run:"
    Write-Host "wrangler auth login"
    exit 1
}

function Ask-Action {
    param([string]$ResourceType, [string]$Name)
    $choice = Read-Host "Resource $ResourceType '$Name' sudah ada. Pilih: (m)erge, (r)eplace, re(n)ame lama & create baru"
    switch ($choice.ToLower()) {
        'm' { return 'merge' }
        'r' { return 'replace' }
        'n' { return 'rename' }
        default { 
            Write-Host "Pilih m, r, atau n"
            Ask-Action $ResourceType $Name 
        }
    }
}

# Check if D1 database exists
$d1Exists = wrangler d1 list 2>$null | Select-String $MEMORY_DB_NAME
if ($d1Exists) {
    $action = Ask-Action "D1 Database" $MEMORY_DB_NAME
    if ($action -eq 'replace') {
        Write-Status "Menghapus D1 database lama..."
        wrangler d1 delete $MEMORY_DB_NAME --skip-confirmation
        Write-Status "Membuat D1 database baru..."
        wrangler d1 create $MEMORY_DB_NAME
    } elseif ($action -eq 'rename') {
        $newName = Read-Host "Masukkan nama baru untuk database lama (akan di-rename)"
        # D1 tidak support rename langsung, jadi beri tahu
        Write-Warning "D1 tidak support rename. Menggunakan database yang ada."
        $action = 'merge'
    } else {
        Write-Status "Menggunakan D1 database yang ada..."
    }
} else {
    Write-Status "Membuat D1 database baru..."
    wrangler d1 create $MEMORY_DB_NAME
}

# Execute database schema
Write-Status "Setting up database schema..."
wrangler d1 execute $MEMORY_DB_NAME --remote --file=$schemaPath
if ($LASTEXITCODE -eq 0) {
    Write-Success "Database schema executed successfully"
} else {
    Write-Warning "Database schema execution failed (might already be applied)"
}

# Check if Vectorize index exists
$vecExists = wrangler vectorize list 2>$null | Select-String $VECTOR_INDEX_NAME
if ($vecExists) {
    $action = Ask-Action "Vectorize Index" $VECTOR_INDEX_NAME
    if ($action -eq 'replace') {
        Write-Status "Menghapus Vectorize index lama..."
        wrangler vectorize delete $VECTOR_INDEX_NAME
        Write-Status "Membuat Vectorize index baru..."
        wrangler vectorize create $VECTOR_INDEX_NAME --dimensions=$MEMORY_INDEX_DIMENSION --metric=cosine
    } elseif ($action -eq 'rename') {
        $newName = Read-Host "Masukkan nama baru untuk index lama (akan di-rename)"
        # Vectorize tidak support rename, beri tahu
        Write-Warning "Vectorize tidak support rename. Menggunakan index yang ada."
        $action = 'merge'
    } else {
        Write-Status "Menggunakan Vectorize index yang ada..."
    }
} else {
    Write-Status "Membuat Vectorize index baru..."
    wrangler vectorize create $VECTOR_INDEX_NAME --dimensions=$MEMORY_INDEX_DIMENSION --metric=cosine
}

# Check if KV namespace exists
$kvExists = wrangler kv namespace list 2>$null | Select-String $CACHE_NAMESPACE
if ($kvExists) {
    $action = Ask-Action "KV Namespace" $CACHE_NAMESPACE
    if ($action -eq 'replace') {
        # Get ID first
        $kvList = wrangler kv namespace list | ConvertFrom-Json
        $kvNamespace = $kvList | Where-Object { $_.title -eq $CACHE_NAMESPACE }
        if ($kvNamespace) {
            Write-Status "Menghapus KV namespace lama..."
            wrangler kv namespace delete --namespace-id $kvNamespace.id
        }
        Write-Status "Membuat KV namespace baru..."
        wrangler kv namespace create $CACHE_NAMESPACE
    } elseif ($action -eq 'rename') {
        $newName = Read-Host "Masukkan nama baru untuk namespace lama (akan di-rename)"
        # KV tidak support rename, beri tahu
        Write-Warning "KV tidak support rename. Menggunakan namespace yang ada."
        $action = 'merge'
    } else {
        Write-Status "Menggunakan KV namespace yang ada..."
    }
} else {
    Write-Status "Membuat KV namespace baru..."
    wrangler kv namespace create $CACHE_NAMESPACE
}

# Get database ID
Write-Status "Retrieving database ID..."
try {
    $d1Output = wrangler d1 list
    # Parse the table: find line with database name and extract ID
    $lines = $d1Output -split "`n"
    $dbLine = $lines | Where-Object { $_ -match $MEMORY_DB_NAME }
    if ($dbLine) {
        # Split by | and clean
        $parts = $dbLine -split '\|' | ForEach-Object { $_.Trim() }
        $DATABASE_ID = $parts[1]
        Write-Success "Database ID retrieved: $DATABASE_ID"
    } else {
        Write-Error "Could not find database $MEMORY_DB_NAME"
        exit 1
    }
} catch {
    Write-Error "Failed to retrieve database ID: $($_.Exception.Message)"
    exit 1
}

# Get KV namespace ID
Write-Status "Retrieving KV namespace ID..."
try {
    $kvList = wrangler kv namespace list | ConvertFrom-Json
    $kvNamespace = $kvList | Where-Object { $_.title -eq $CACHE_NAMESPACE }
    if ($kvNamespace) {
        $KV_ID = $kvNamespace.id
        Write-Success "KV namespace ID retrieved: $KV_ID"
    } else {
        Write-Error "Could not find KV namespace $CACHE_NAMESPACE"
        exit 1
    }
} catch {
    Write-Error "Failed to retrieve KV namespace ID: $($_.Exception.Message)"
    exit 1
}

# Update wrangler.toml
Write-Status "Updating wrangler.toml configuration..."
$wranglerTomlPath = Join-Path $SCRIPT_DIR "wrangler.toml"
$wranglerContent = @"
name = "$PROJECT_NAME"
main = "src/index.ts"
compatibility_date = "2024-11-01"

[[d1_databases]]
binding = "DB"
database_name = "$MEMORY_DB_NAME"
database_id = "$DATABASE_ID"

[[kv_namespaces]]
binding = "CACHE"
id = "$KV_ID"

[[vectorize]]
binding = "VECTORIZE"
index_name = "$VECTOR_INDEX_NAME"

[ai]
binding = "AI"

[[routes]]
pattern = "$DOMAIN_BRAIN/*"
zone_name = "$ZONE_NAME"
"@

try {
    $wranglerContent | Out-File -FilePath $wranglerTomlPath -Encoding UTF8
    Write-Success "wrangler.toml updated successfully"
} catch {
    Write-Error "Failed to update wrangler.toml: $($_.Exception.Message)"
    exit 1
}

# Install dependencies
Write-Status "Installing dependencies..."
try {
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Dependencies installed successfully"
    } else {
        Write-Error "Failed to install dependencies"
        exit 1
    }
} catch {
    Write-Error "Failed to install dependencies: $($_.Exception.Message)"
    exit 1
}

# Test the build (if build script exists)
Write-Status "Checking for build script..."
$packageJsonPath = Join-Path $SCRIPT_DIR "package.json"
if (Test-Path $packageJsonPath) {
    $packageJson = Get-Content $packageJsonPath | ConvertFrom-Json
    if ($packageJson.scripts -and $packageJson.scripts.build) {
        Write-Status "Testing build..."
        try {
            npm run build
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Build successful"
            } else {
                Write-Error "Build failed"
                exit 1
            }
        } catch {
            Write-Error "Build failed: $($_.Exception.Message)"
            exit 1
        }
    } else {
        Write-Status "No build script found, skipping build test"
    }
}

# Create deployment checklist
Write-Status "Creating deployment checklist..."
$deployMdPath = Join-Path $SCRIPT_DIR "DEPLOY.md"
$deployContent = @"
# Deployment Checklist: Second Brain MCP Server

## Pre-deployment Checks

- [ ] All tests are passing: `npm test`
- [ ] Database schema is up to date: `wrangler d1 execute $MEMORY_DB_NAME --file=src/db/schema.sql`
- [ ] Vectorize index is configured correctly
- [ ] Environment variables are set in wrangler.toml

## Deployment Commands

1. **Deploy to Cloudflare Workers:**
   ```powershell
   wrangler deploy
   ```

2. **Test the deployment:**
   ```powershell
   # Test health endpoint
   curl https://$PROJECT_NAME.<your-account>.workers.dev/

   # Test MCP tools listing
   curl https://$PROJECT_NAME.<your-account>.workers.dev/mcp
   ```

## Post-deployment Verification

- [ ] Health endpoint returns success
- [ ] MCP tools listing returns all 4 tools
- [ ] Test storing a memory
- [ ] Test searching memories
- [ ] Test listing memories
- [ ] Test deleting a memory

## Environment Variables (if needed)

Add any additional environment variables to your `wrangler.toml`:

```toml
[vars]
# Add your environment variables here
```

## Troubleshooting

- **Database connection issues:** Check that the D1 database is properly bound
- **Vectorize issues:** Verify the vector index name and dimensions
- **AI binding issues:** Ensure the AI binding is available in your region
- **Build issues:** Check TypeScript compilation errors in the build output
"@

try {
    $deployContent | Out-File -FilePath $deployMdPath -Encoding UTF8
    Write-Success "DEPLOY.md created successfully"
} catch {
    Write-Error "Failed to create DEPLOY.md: $($_.Exception.Message)"
    exit 1
}

Write-Success "Setup completed successfully!"
Write-Host ""
Write-Status "Next steps:"
Write-Host "1. Review and update the generated wrangler.toml file if needed"
Write-Host "2. Deploy using: wrangler deploy"
Write-Host "3. Follow the DEPLOY.md checklist for deployment verification"
Write-Host ""
Write-Warning "Note: Make sure to update your wrangler.toml with your actual Worker name and any custom configuration"
Write-Host ""
Write-Success "🎉 Second Brain MCP Server setup is complete!"
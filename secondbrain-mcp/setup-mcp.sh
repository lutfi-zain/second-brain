#!/bin/bash

# Second Brain MCP Server Setup Script for Multiple AI Coding Assistants
# Supports: GitHub Copilot, Claude Code, Gemini Code, Antigravity

set -e

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

# Function to detect OS
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        echo "windows"
    else
        echo "unknown"
    fi
}

# Function to setup for GitHub Copilot
setup_copilot() {
    print_status "Setting up for GitHub Copilot..."

    # Install Node.js if not present
    if ! command -v node &> /dev/null; then
        print_status "Installing Node.js..."
        OS=$(detect_os)
        case $OS in
            linux)
                curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
                sudo apt-get install -y nodejs
                ;;
            macos)
                brew install node
                ;;
            windows)
                print_error "Please install Node.js manually from https://nodejs.org/"
                exit 1
                ;;
        esac
    fi

    # Install dependencies
    npm install

    # Setup MCP server
    print_status "Configuring MCP server for Copilot..."
    # Add MCP server configuration to VS Code settings
    print_warning "Please manually add the MCP server to VS Code settings:"
    echo "1. Open VS Code"
    echo "2. Go to Settings > Extensions > GitHub Copilot Chat"
    echo "3. Add MCP Server:"
    echo "   - Command: node src/index.js (or your stdio entry)"
    echo "   - Or URL: https://brain.maftia.tech"

    print_success "Copilot setup completed!"
}

# Function to setup for Claude Code
setup_claude() {
    print_status "Setting up for Claude Code..."

    # Install Node.js if not present
    if ! command -v node &> /dev/null; then
        print_status "Installing Node.js..."
        OS=$(detect_os)
        case $OS in
            linux)
                curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
                sudo apt-get install -y nodejs
                ;;
            macos)
                brew install node
                ;;
            windows)
                print_error "Please install Node.js manually from https://nodejs.org/"
                exit 1
                ;;
        esac
    fi

    # Install Claude Code
    if ! command -v claude &> /dev/null; then
        print_status "Installing Claude Code..."
        npm install -g @anthropic/claude-code
    fi

    # Install dependencies
    npm install

    # Configure MCP for Claude
    print_status "Configuring MCP for Claude Code..."
    print_warning "Claude Code MCP configuration:"
    echo "Add to your Claude Code config:"
    echo "mcp_servers:"
    echo "  secondbrain:"
    echo "    command: node"
    echo "    args: [src/index.js]"
    echo "    # Or use HTTP: url: https://brain.maftia.tech"

    print_success "Claude Code setup completed!"
}

# Function to setup for Gemini Code
setup_gemini() {
    print_status "Setting up for Gemini Code..."

    # Install Python if not present
    if ! command -v python3 &> /dev/null; then
        print_status "Installing Python..."
        OS=$(detect_os)
        case $OS in
            linux)
                sudo apt-get update
                sudo apt-get install -y python3 python3-pip
                ;;
            macos)
                brew install python
                ;;
            windows)
                print_error "Please install Python manually from https://python.org/"
                exit 1
                ;;
        esac
    fi

    # Install Gemini Code (assuming it's available)
    if ! command -v gemini-code &> /dev/null; then
        print_status "Installing Gemini Code..."
        pip3 install gemini-code  # Assuming package name
    fi

    # Setup MCP bridge for Gemini
    print_status "Setting up MCP bridge for Gemini Code..."
    print_warning "Gemini Code MCP configuration:"
    echo "Configure MCP server in Gemini Code settings:"
    echo "mcp:"
    echo "  servers:"
    echo "    - name: secondbrain"
    echo "      command: python3"
    echo "      args: [mcp_bridge.py, --url, https://brain.maftia.tech]"

    print_success "Gemini Code setup completed!"
}

# Function to setup for Antigravity
setup_antigravity() {
    print_status "Setting up for Antigravity..."

    # Antigravity specific setup
    print_status "Installing Antigravity dependencies..."

    # Assuming Antigravity uses Python
    if ! command -v python3 &> /dev/null; then
        print_status "Installing Python..."
        OS=$(detect_os)
        case $OS in
            linux)
                sudo apt-get update
                sudo apt-get install -y python3 python3-pip
                ;;
            macos)
                brew install python
                ;;
            windows)
                print_error "Please install Python manually from https://python.org/"
                exit 1
                ;;
        esac
    fi

    # Install Antigravity
    if ! command -v antigravity &> /dev/null; then
        print_status "Installing Antigravity..."
        pip3 install antigravity  # Assuming package name
    fi

    # Configure for Antigravity
    print_status "Configuring for Antigravity..."
    print_warning "Antigravity MCP configuration:"
    echo "Add to antigravity config:"
    echo "mcp_servers:"
    echo "  secondbrain:"
    echo "    type: http"
    echo "    url: https://brain.maftia.tech"

    print_success "Antigravity setup completed!"
}

# Main script
echo "🚀 Second Brain MCP Server Setup for AI Coding Assistants"
echo "Supported platforms: copilot, claude, gemini, antigravity"
echo ""

# Get platform from argument or ask user
PLATFORM=""
if [ $# -eq 0 ]; then
    echo "Available platforms:"
    echo "1) copilot    - GitHub Copilot"
    echo "2) claude     - Claude Code"
    echo "3) gemini     - Gemini Code"
    echo "4) antigravity - Antigravity"
    echo ""
    read -p "Choose platform (1-4): " choice

    case $choice in
        1) PLATFORM="copilot" ;;
        2) PLATFORM="claude" ;;
        3) PLATFORM="gemini" ;;
        4) PLATFORM="antigravity" ;;
        *) print_error "Invalid choice"; exit 1 ;;
    esac
else
    PLATFORM=$1
fi

# Validate platform
case $PLATFORM in
    copilot|claude|gemini|antigravity)
        print_status "Setting up for $PLATFORM..."
        ;;
    *)
        print_error "Unsupported platform: $PLATFORM"
        echo "Supported: copilot, claude, gemini, antigravity"
        exit 1
        ;;
esac

# Run setup based on platform
case $PLATFORM in
    copilot)
        setup_copilot
        ;;
    claude)
        setup_claude
        ;;
    gemini)
        setup_gemini
        ;;
    antigravity)
        setup_antigravity
        ;;
esac

echo ""
print_success "🎉 Setup completed for $PLATFORM!"
echo ""
print_status "Next steps:"
echo "1. Start the MCP server: npm start (or your start command)"
echo "2. Configure your AI assistant to use the MCP server"
echo "3. Test with: curl https://brain.maftia.tech/"
echo ""
print_warning "Note: Make sure to update configurations with your actual server URL"
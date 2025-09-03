#!/bin/bash

# Postiz Docker Restart Script
# This script restarts the Postiz application without rebuilding

set -e  # Exit on any error

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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."

    if ! command_exists docker; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    if ! command_exists docker-compose; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi

    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi

    # Check if Postiz image exists
    if ! docker images | grep -q "localhost/postiz"; then
        print_error "Postiz Docker image not found. Please run setup-postiz.sh first to build the image."
        exit 1
    fi

    print_success "All prerequisites are met!"
}

# Ensure infrastructure is running
ensure_infrastructure() {
    print_status "Checking infrastructure services..."

    if [ ! -f "docker-compose.dev.yaml" ]; then
        print_error "docker-compose.dev.yaml not found. Make sure you're in the Postiz project directory."
        exit 1
    fi

    # Check if infrastructure is running
    if ! docker ps | grep -q "postiz-postgres"; then
        print_status "Starting infrastructure services..."
        docker-compose -f docker-compose.dev.yaml up -d

        print_status "Waiting for services to be ready..."
        sleep 10
    fi

    # Verify services are running
    if docker ps | grep -q "postiz-postgres"; then
        print_success "PostgreSQL is running"
    else
        print_error "PostgreSQL is not running"
        exit 1
    fi

    if docker ps | grep -q "postiz-redis"; then
        print_success "Redis is running"
    else
        print_error "Redis is not running"
        exit 1
    fi

    print_success "Infrastructure services are ready!"
}

# Stop existing application
stop_application() {
    print_status "Stopping existing Postiz application..."

    # Kill any existing Postiz container
    docker ps -q --filter "ancestor=localhost/postiz" | xargs -r docker kill >/dev/null 2>&1 || true

    print_success "Existing application stopped!"
}

# Start the application
start_application() {
    print_status "Starting Postiz application..."

    print_status "Application is starting... This may take a minute..."
    print_status "You can monitor the logs in the terminal."
    print_status "Press Ctrl+C to stop the application when you're done."

    # Run the application container
    docker run --rm -p 3000:3000 -p 4200:4200 \
        --network postiz-app_postiz-network \
        -e DATABASE_URL="postgresql://postiz-local:postiz-local-pwd@postiz-postgres:5432/postiz-db-local" \
        -e REDIS_URL="redis://postiz-redis:6379" \
        -e JWT_SECRET="random-jwt-secret-for-development-only-$(date +%s)" \
        -e FRONTEND_URL="http://localhost:4200" \
        -e NEXT_PUBLIC_BACKEND_URL="http://localhost:3000" \
        -e BACKEND_INTERNAL_URL="http://localhost:3000" \
        -e STORAGE_PROVIDER="local" \
        -e IS_GENERAL="true" \
        localhost/postiz
}

# Cleanup function
cleanup() {
    print_status "Application stopped."
}

# Main execution
main() {
    echo "=================================================="
    echo "🔄 Postiz Docker Restart Script"
    echo "=================================================="
    echo ""

    # Set trap for cleanup on script exit
    trap cleanup EXIT

    check_prerequisites
    ensure_infrastructure
    stop_application

    echo ""
    echo "=================================================="
    print_success "Ready to start application!"
    echo "=================================================="
    echo ""
    echo "📋 Access URLs:"
    echo "   🌐 Postiz Frontend:  http://localhost:4200"
    echo "   🔧 Backend API:      http://localhost:3000"
    echo "   🗄️  pgAdmin:          http://localhost:8081"
    echo "   📊 RedisInsight:     http://localhost:5540"
    echo ""
    echo "⚡ Starting application..."
    echo ""

    start_application
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Postiz Docker Restart Script"
        echo ""
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --stop         Stop the application and infrastructure"
        echo ""
        echo "This script will:"
        echo "1. Check prerequisites and existing Docker image"
        echo "2. Ensure infrastructure services are running"
        echo "3. Stop existing application"
        echo "4. Start the Postiz application (without rebuilding)"
        echo ""
        echo "Note: Run setup-postiz.sh first if you haven't built the Docker image yet."
        exit 0
        ;;
    --stop)
        print_status "Stopping Postiz application and infrastructure..."
        docker ps -q --filter "ancestor=localhost/postiz" | xargs -r docker kill >/dev/null 2>&1 || true
        docker-compose -f docker-compose.dev.yaml down >/dev/null 2>&1 || true
        print_success "Application and infrastructure stopped!"
        exit 0
        ;;
    "")
        main
        ;;
    *)
        print_error "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac
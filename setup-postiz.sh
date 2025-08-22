#!/bin/bash

# Postiz Docker Setup Script
# This script automates the complete setup of Postiz application with Docker

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
    
    print_success "All prerequisites are met!"
}

# Setup environment file
setup_environment() {
    print_status "Setting up environment configuration..."
    
    if [ ! -f ".env.example" ]; then
        print_error ".env.example file not found. Make sure you're in the Postiz project directory."
        exit 1
    fi
    
    if [ -f ".env" ]; then
        print_warning ".env file already exists. Backing up to .env.backup"
        cp .env .env.backup
    fi
    
    # Copy and configure .env file
    cp .env.example .env
    
    # Update database and Redis URLs for Docker network
    sed -i 's|DATABASE_URL="postgresql://postiz-user:postiz-password@localhost:5432/postiz-db-local"|DATABASE_URL="postgresql://postiz-local:postiz-local-pwd@postiz-postgres:5432/postiz-db-local"|g' .env
    sed -i 's|REDIS_URL="redis://localhost:6379"|REDIS_URL="redis://postiz-redis:6379"|g' .env
    
    print_success "Environment file configured!"
}

# Start infrastructure services
start_infrastructure() {
    print_status "Starting infrastructure services (PostgreSQL, Redis, etc.)..."
    
    if [ ! -f "docker-compose.dev.yaml" ]; then
        print_error "docker-compose.dev.yaml not found. Make sure you're in the Postiz project directory."
        exit 1
    fi
    
    # Stop any existing containers
    docker-compose -f docker-compose.dev.yaml down >/dev/null 2>&1 || true
    
    # Start infrastructure services
    docker-compose -f docker-compose.dev.yaml up -d
    
    print_status "Waiting for services to be ready..."
    sleep 10
    
    # Check if services are running
    if docker ps | grep -q "postiz-postgres"; then
        print_success "PostgreSQL is running"
    else
        print_error "PostgreSQL failed to start"
        exit 1
    fi
    
    if docker ps | grep -q "postiz-redis"; then
        print_success "Redis is running"
    else
        print_error "Redis failed to start"
        exit 1
    fi
    
    print_success "Infrastructure services are running!"
}

# Build application Docker image
build_application() {
    print_status "Building Postiz application Docker image..."
    print_warning "This may take several minutes and requires ~5GB of disk space..."
    
    if [ ! -f "Dockerfile.dev" ]; then
        print_error "Dockerfile.dev not found. Make sure you're in the Postiz project directory."
        exit 1
    fi
    
    # Build the Docker image
    docker build -t localhost/postiz -f Dockerfile.dev .
    
    print_success "Docker image built successfully!"
}

# Start the application
start_application() {
    print_status "Starting Postiz application..."
    
    # Kill any existing Postiz container
    docker ps -q --filter "ancestor=localhost/postiz" | xargs -r docker kill >/dev/null 2>&1 || true
    
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
    print_status "Cleaning up..."
    docker-compose -f docker-compose.dev.yaml down >/dev/null 2>&1 || true
    print_success "Cleanup completed!"
}

# Main execution
main() {
    echo "=================================================="
    echo "🚀 Postiz Docker Setup Script"
    echo "=================================================="
    echo ""
    
    # Set trap for cleanup on script exit
    trap cleanup EXIT
    
    check_prerequisites
    setup_environment
    start_infrastructure
    build_application
    
    echo ""
    echo "=================================================="
    print_success "Setup completed successfully!"
    echo "=================================================="
    echo ""
    echo "📋 Access URLs:"
    echo "   🌐 Postiz Frontend:  http://localhost:4200"
    echo "   🔧 Backend API:      http://localhost:3000"
    echo "   🗄️  pgAdmin:          http://localhost:8081"
    echo "   📊 RedisInsight:     http://localhost:5540"
    echo ""
    echo "🔑 pgAdmin Login: admin@admin.com / admin"
    echo ""
    echo "⚡ Starting application..."
    echo ""
    
    start_application
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Postiz Docker Setup Script"
        echo ""
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --cleanup      Stop and remove all containers"
        echo ""
        echo "This script will:"
        echo "1. Check prerequisites (Docker, Docker Compose)"
        echo "2. Setup environment configuration"
        echo "3. Start infrastructure services"
        echo "4. Build the application Docker image"
        echo "5. Start the Postiz application"
        exit 0
        ;;
    --cleanup)
        print_status "Stopping and removing all Postiz containers..."
        docker-compose -f docker-compose.dev.yaml down
        docker ps -q --filter "ancestor=localhost/postiz" | xargs -r docker kill
        print_success "Cleanup completed!"
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

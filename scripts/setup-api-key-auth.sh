#!/bin/bash

# Setup script for API Key Authentication System
# This script helps set up the new API key authentication system

set -e

echo "🚀 Setting up API Key Authentication System"
echo "==========================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Check if Prisma is available
if ! command -v npx &> /dev/null; then
    echo "❌ Error: npx is not available. Please install Node.js and npm"
    exit 1
fi

echo "📋 Step 1: Checking prerequisites..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  Warning: DATABASE_URL environment variable is not set"
    echo "   Please set it in your .env file before running migrations"
fi

# Check if JWT_SECRET is set
if [ -z "$JWT_SECRET" ]; then
    echo "⚠️  Warning: JWT_SECRET environment variable is not set"
    echo "   Please set it in your .env file for proper API key hashing"
fi

echo "✅ Prerequisites checked"

echo "📋 Step 2: Generating Prisma migration..."

# Generate and apply the migration
echo "   Creating migration for UserApiKey model..."
npx prisma migrate dev --name add-user-api-keys --schema=libraries/nestjs-libraries/src/database/prisma/schema.prisma

if [ $? -eq 0 ]; then
    echo "✅ Database migration completed successfully"
else
    echo "❌ Error: Database migration failed"
    exit 1
fi

echo "📋 Step 3: Generating Prisma client..."

# Regenerate Prisma client
npx prisma generate --schema=libraries/nestjs-libraries/src/database/prisma/schema.prisma

if [ $? -eq 0 ]; then
    echo "✅ Prisma client generated successfully"
else
    echo "❌ Error: Prisma client generation failed"
    exit 1
fi

echo "📋 Step 4: Installing dependencies (if needed)..."

# Check if axios is installed (needed for test script)
if ! npm list axios &> /dev/null; then
    echo "   Installing axios for test script..."
    npm install axios
fi

echo "✅ Dependencies checked"

echo "📋 Step 5: Setting up environment variables..."

# Create or update .env file with necessary variables
ENV_FILE=".env"
if [ ! -f "$ENV_FILE" ]; then
    echo "   Creating .env file..."
    touch "$ENV_FILE"
fi

# Check and add JWT_SECRET if not present
if ! grep -q "JWT_SECRET" "$ENV_FILE"; then
    echo "   Adding JWT_SECRET to .env file..."
    echo "" >> "$ENV_FILE"
    echo "# JWT Secret for API key hashing and authentication" >> "$ENV_FILE"
    echo "JWT_SECRET=$(openssl rand -base64 32)" >> "$ENV_FILE"
fi

# Check and add NODE_ENV if not present
if ! grep -q "NODE_ENV" "$ENV_FILE"; then
    echo "   Adding NODE_ENV to .env file..."
    echo "" >> "$ENV_FILE"
    echo "# Environment (affects API key prefix)" >> "$ENV_FILE"
    echo "NODE_ENV=development" >> "$ENV_FILE"
fi

echo "✅ Environment variables configured"

echo "📋 Step 6: Building the application..."

# Build the application
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Application built successfully"
else
    echo "⚠️  Warning: Application build failed, but setup can continue"
fi

echo "🎉 Setup completed successfully!"
echo ""
echo "📚 Next Steps:"
echo "=============="
echo "1. Start the development server:"
echo "   npm run dev"
echo ""
echo "2. Test the API key authentication:"
echo "   node scripts/test-api-key-auth.js"
echo ""
echo "3. Check the documentation:"
echo "   cat docs/API_KEY_AUTHENTICATION.md"
echo ""
echo "🔗 New API Endpoints:"
echo "===================="
echo "• POST /auth/api-key/register - Register with API key"
echo "• POST /auth/api-key/login    - Login and get API key"
echo "• GET  /api-keys              - List user's API keys"
echo "• POST /api-keys              - Create new API key"
echo "• PUT  /api-keys/:id          - Update API key"
echo "• POST /api-keys/:id/regenerate - Regenerate API key"
echo "• DELETE /api-keys/:id        - Delete API key"
echo ""
echo "🛡️  Protected Endpoints (require API key):"
echo "==========================================="
echo "• GET  /api/v1/posts          - List posts"
echo "• POST /api/v1/posts          - Create posts"
echo "• GET  /api/v1/integrations   - List integrations"
echo "• POST /api/v1/upload         - Upload files"
echo ""
echo "💡 Usage Example:"
echo "================="
echo "curl -X POST http://localhost:3000/auth/api-key/register \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{"
echo "    \"email\": \"user@example.com\","
echo "    \"password\": \"password123\","
echo "    \"provider\": \"LOCAL\","
echo "    \"company\": \"My Company\","
echo "    \"keyName\": \"My API Key\""
echo "  }'"
echo ""
echo "✨ Happy coding!"

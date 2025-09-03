#!/bin/bash

# Test script for token-based API key registration
# Usage: ./scripts/test-token-auth.sh [registration-token]

set -e

# Configuration
BASE_URL="${API_BASE_URL:-http://localhost:3000}"
REGISTRATION_TOKEN="${1:-${API_KEY_REGISTRATION_TOKEN:-test-registration-token-123}}"
TEST_EMAIL="test-token-$(date +%s)@example.com"

echo "🚀 Testing Token-based API Key Registration"
echo "   Base URL: $BASE_URL"
echo "   Registration Token: ${REGISTRATION_TOKEN:0:10}..."
echo "   Test Email: $TEST_EMAIL"
echo ""

# Test 1: Register new user with correct token
echo "📝 Test 1: Register new user with correct token"
RESPONSE1=$(curl -s -X POST "$BASE_URL/auth/api-key/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$REGISTRATION_TOKEN\",
    \"provider\": \"LOCAL\",
    \"company\": \"Test Company\",
    \"keyName\": \"Test API Key\",
    \"expiresInDays\": 30
  }")

if echo "$RESPONSE1" | grep -q '"success":true'; then
  echo "✅ New user registration successful"
  API_KEY=$(echo "$RESPONSE1" | grep -o '"key":"[^"]*"' | cut -d'"' -f4)
  echo "   API Key: ${API_KEY:0:20}..."
else
  echo "❌ New user registration failed"
  echo "   Response: $RESPONSE1"
  exit 1
fi

echo ""

# Test 2: Register existing user with correct token (should behave like login)
echo "📝 Test 2: Register existing user with correct token"
RESPONSE2=$(curl -s -X POST "$BASE_URL/auth/api-key/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$REGISTRATION_TOKEN\",
    \"provider\": \"LOCAL\",
    \"company\": \"Different Company\",
    \"keyName\": \"Second API Key\",
    \"expiresInDays\": 7
  }")

if echo "$RESPONSE2" | grep -q '"success":true'; then
  echo "✅ Existing user registration successful (login behavior)"
  # Check if we got a new API key or existing one
  if echo "$RESPONSE2" | grep -q '"key":'; then
    NEW_API_KEY=$(echo "$RESPONSE2" | grep -o '"key":"[^"]*"' | cut -d'"' -f4)
    echo "   API Key: ${NEW_API_KEY:0:20}..."
    echo "   ✅ Key value provided in response"
  else
    echo "   ⚠️  No key value in response (returned existing key reference)"
    echo "   This might be acceptable depending on implementation"
  fi
else
  echo "❌ Existing user registration failed"
  echo "   Response: $RESPONSE2"
  exit 1
fi

echo ""

# Test 3: Register with wrong token (should fail)
echo "📝 Test 3: Register with wrong token"
RESPONSE3=$(curl -s -X POST "$BASE_URL/auth/api-key/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"wrong-token-123\",
    \"provider\": \"LOCAL\",
    \"company\": \"Another Company\",
    \"keyName\": \"Should Fail Key\",
    \"expiresInDays\": 7
  }")

if echo "$RESPONSE3" | grep -q '"statusCode":401'; then
  echo "✅ Wrong token correctly rejected"
elif echo "$RESPONSE3" | grep -q 'Invalid registration token'; then
  echo "✅ Wrong token correctly rejected"
else
  echo "❌ Wrong token should have been rejected"
  echo "   Response: $RESPONSE3"
  exit 1
fi

echo ""

# Test 4: Register with same key name (should return existing key)
echo "📝 Test 4: Register with same key name"
RESPONSE4=$(curl -s -X POST "$BASE_URL/auth/api-key/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$REGISTRATION_TOKEN\",
    \"provider\": \"LOCAL\",
    \"company\": \"Yet Another Company\",
    \"keyName\": \"Test API Key\",
    \"expiresInDays\": 15
  }")

if echo "$RESPONSE4" | grep -q '"success":true'; then
  echo "✅ Same key name handled correctly"
  # Check if we got a key value (which is now expected for registration endpoint)
  if echo "$RESPONSE4" | grep -q '"key":'; then
    SAME_NAME_KEY=$(echo "$RESPONSE4" | grep -o '"key":"[^"]*"' | cut -d'"' -f4)
    echo "   ✅ Key value provided: ${SAME_NAME_KEY:0:20}..."
    echo "   This is expected behavior for the registration endpoint"
  else
    echo "   ℹ️  No key value in response (returned existing key reference)"
    echo "   This might be acceptable depending on implementation"
  fi
else
  echo "❌ Same key name registration failed"
  echo "   Response: $RESPONSE4"
  exit 1
fi

echo ""
echo "🎉 All tests passed! Token-based authentication is working correctly."
echo ""
echo "📋 Summary:"
echo "   ✅ New user registration with correct token"
echo "   ✅ Existing user registration (login behavior)"
echo "   ✅ Wrong token rejection"
echo "   ✅ Same key name handling"
echo ""
echo "🔧 To use this in production:"
echo "   1. Set a secure API_KEY_REGISTRATION_TOKEN in your .env file"
echo "   2. Use that token in the 'password' field of registration requests"
echo "   3. Keep the token secret and rotate it periodically"

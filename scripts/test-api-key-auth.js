#!/usr/bin/env node

/**
 * Test script for API Key Authentication System
 * 
 * This script demonstrates the complete API key authentication flow:
 * 1. Register a new user with API key
 * 2. Use the API key to access protected endpoints
 * 3. Manage API keys (create, list, update, delete)
 * 
 * Usage: node scripts/test-api-key-auth.js
 */

const axios = require('axios');

// Configuration
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const TEST_EMAIL = `test-${Date.now()}@example.com`;
const TEST_PASSWORD = 'testpassword123';
const TEST_COMPANY = 'Test Company';

// Helper function to make API requests
async function apiRequest(method, endpoint, data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`Error ${method} ${endpoint}:`, error.response?.data || error.message);
    throw error;
  }
}

// Test functions
async function testRegistration() {
  console.log('\n🔐 Testing API Key Registration...');
  
  const registrationData = {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    provider: 'LOCAL',
    company: TEST_COMPANY,
    keyName: 'Test API Key',
    expiresInDays: 30,
  };

  const result = await apiRequest('POST', '/auth/api-key/register', registrationData);
  
  if (result.success && result.apiKey) {
    console.log('✅ Registration successful!');
    console.log(`   User: ${result.user.email}`);
    console.log(`   Organization: ${result.organization.name}`);
    console.log(`   API Key: ${result.apiKey.key.substring(0, 20)}...`);
    return result.apiKey.key;
  } else {
    throw new Error('Registration failed');
  }
}

async function testLogin() {
  console.log('\n🔑 Testing API Key Login...');
  
  const loginData = {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    provider: 'LOCAL',
    keyName: 'Login Test Key',
    expiresInDays: 7,
  };

  const result = await apiRequest('POST', '/auth/api-key/login', loginData);
  
  if (result.success && result.apiKey) {
    console.log('✅ Login successful!');
    console.log(`   New API Key: ${result.apiKey.key.substring(0, 20)}...`);
    return result.apiKey.key;
  } else {
    throw new Error('Login failed');
  }
}

async function testProtectedEndpoint(apiKey) {
  console.log('\n🛡️  Testing Protected Endpoint Access...');
  
  try {
    const result = await apiRequest('GET', '/api/v1/integrations', null, {
      'Authorization': apiKey,
    });
    
    console.log('✅ Protected endpoint access successful!');
    console.log(`   Found ${result.length} integrations`);
    return true;
  } catch (error) {
    console.log('❌ Protected endpoint access failed');
    return false;
  }
}

async function testApiKeyManagement(apiKey) {
  console.log('\n⚙️  Testing API Key Management...');
  
  try {
    // List existing keys
    const keys = await apiRequest('GET', '/api-keys', null, {
      'Authorization': apiKey,
    });
    console.log(`✅ Listed ${keys.length} existing API keys`);

    // Create a new key
    const newKeyData = {
      name: 'Management Test Key',
      expiresInDays: 14,
    };
    
    const newKey = await apiRequest('POST', '/api-keys', newKeyData, {
      'Authorization': apiKey,
    });
    console.log(`✅ Created new API key: ${newKey.name}`);

    // Update the key
    const updateData = {
      name: 'Updated Management Test Key',
    };
    
    const updatedKey = await apiRequest('PUT', `/api-keys/${newKey.id}`, updateData, {
      'Authorization': apiKey,
    });
    console.log(`✅ Updated API key name to: ${updatedKey.name}`);

    // Regenerate the key
    const regeneratedKey = await apiRequest('POST', `/api-keys/${newKey.id}/regenerate`, null, {
      'Authorization': apiKey,
    });
    console.log(`✅ Regenerated API key: ${regeneratedKey.key.substring(0, 20)}...`);

    // Delete the key
    await apiRequest('DELETE', `/api-keys/${newKey.id}`, null, {
      'Authorization': apiKey,
    });
    console.log('✅ Deleted API key successfully');

    return true;
  } catch (error) {
    console.log('❌ API key management test failed');
    return false;
  }
}

async function testInvalidApiKey() {
  console.log('\n🚫 Testing Invalid API Key...');
  
  try {
    await apiRequest('GET', '/api/v1/integrations', null, {
      'Authorization': 'invalid_key_12345',
    });
    console.log('❌ Invalid key test failed - should have been rejected');
    return false;
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('✅ Invalid API key correctly rejected');
      return true;
    } else {
      console.log('❌ Unexpected error for invalid key');
      return false;
    }
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting API Key Authentication Tests');
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Test Email: ${TEST_EMAIL}`);

  let apiKey;
  let testResults = {
    registration: false,
    login: false,
    protectedAccess: false,
    keyManagement: false,
    invalidKey: false,
  };

  try {
    // Test registration
    apiKey = await testRegistration();
    testResults.registration = true;

    // Test login (creates another key)
    const loginApiKey = await testLogin();
    testResults.login = true;

    // Test protected endpoint access
    testResults.protectedAccess = await testProtectedEndpoint(apiKey);

    // Test API key management
    testResults.keyManagement = await testApiKeyManagement(apiKey);

    // Test invalid API key
    testResults.invalidKey = await testInvalidApiKey();

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }

  // Print results summary
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  Object.entries(testResults).forEach(([test, passed]) => {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`   ${test.padEnd(20)}: ${status}`);
  });

  const passedTests = Object.values(testResults).filter(Boolean).length;
  const totalTests = Object.keys(testResults).length;
  
  console.log(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! API Key Authentication system is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Please check the implementation.');
  }
}

// Run the tests
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  runTests,
  testRegistration,
  testLogin,
  testProtectedEndpoint,
  testApiKeyManagement,
  testInvalidApiKey,
};

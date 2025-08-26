#!/usr/bin/env node

/**
 * Test script for Postiz Integration API
 * 
 * Usage:
 * node scripts/test-integration-api.js <api_key> <base_url>
 * 
 * Example:
 * node scripts/test-integration-api.js postiz_live_abc123 http://localhost:3000
 */

const fetch = require('node-fetch');

class PostizIntegrationTester {
  constructor(apiKey, baseUrl = 'http://localhost:3000') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}/api/v1/integrations${endpoint}`;
    console.log(`\n🔄 ${options.method || 'GET'} ${url}`);
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.headers,
          ...options.headers
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.log(`❌ Error ${response.status}:`, data);
        return null;
      }

      console.log(`✅ Success ${response.status}:`, JSON.stringify(data, null, 2));
      return data;
    } catch (error) {
      console.log(`❌ Request failed:`, error.message);
      return null;
    }
  }

  async testGetPlatforms() {
    console.log('\n📋 Testing: Get Available Platforms');
    const result = await this.request('/platforms');
    
    if (result && result.platforms) {
      console.log(`Found ${result.platforms.length} platforms`);
      const apiKeyPlatforms = result.platforms.filter(p => p.supportsApiKey);
      console.log(`API Key supported platforms: ${apiKeyPlatforms.map(p => p.identifier).join(', ')}`);
    }
    
    return result;
  }

  async testGetIntegrations() {
    console.log('\n📋 Testing: Get Integrations List');
    const result = await this.request('/list');
    
    if (result && result.integrations) {
      console.log(`Found ${result.integrations.length} existing integrations`);
      result.integrations.forEach(integration => {
        console.log(`  - ${integration.name} (${integration.provider}): ${integration.status}`);
      });
    }
    
    return result;
  }

  async testInitiateOAuth(provider = 'x') {
    console.log(`\n🔗 Testing: Initiate OAuth for ${provider}`);
    const result = await this.request('/initiate', {
      method: 'POST',
      body: JSON.stringify({
        provider,
        callbackUrl: 'https://example.com/callback'
      })
    });
    
    if (result && result.authUrl) {
      console.log(`OAuth URL generated successfully`);
      console.log(`State: ${result.state}`);
    }
    
    return result;
  }

  async testApiKeyIntegration(provider = 'medium', apiKey = 'test_key_123') {
    console.log(`\n🔑 Testing: API Key Integration for ${provider}`);
    const result = await this.request('/api-key', {
      method: 'POST',
      body: JSON.stringify({
        provider,
        apiKey,
        name: `Test ${provider} Account`,
        callbackUrl: 'https://example.com/callback'
      })
    });
    
    return result;
  }

  async testIntegrationStatus(integrationId) {
    console.log(`\n📊 Testing: Get Integration Status for ${integrationId}`);
    const result = await this.request(`/${integrationId}/status`);
    return result;
  }

  async testUpdateIntegration(integrationId) {
    console.log(`\n✏️ Testing: Update Integration ${integrationId}`);
    const result = await this.request(`/${integrationId}/update`, {
      method: 'POST',
      body: JSON.stringify({
        name: 'Updated Test Account',
        settings: {
          testSetting: 'testValue'
        }
      })
    });
    return result;
  }

  async testEnableDisableIntegration(integrationId) {
    console.log(`\n🔄 Testing: Enable/Disable Integration ${integrationId}`);
    
    // Test disable
    const disableResult = await this.request(`/${integrationId}/disable`, {
      method: 'POST'
    });
    
    if (disableResult) {
      // Test enable
      const enableResult = await this.request(`/${integrationId}/enable`, {
        method: 'POST'
      });
      return enableResult;
    }
    
    return disableResult;
  }

  async runAllTests() {
    console.log('🚀 Starting Postiz Integration API Tests');
    console.log(`Base URL: ${this.baseUrl}`);
    console.log(`API Key: ${this.apiKey.substring(0, 20)}...`);

    // Test 1: Get platforms
    const platforms = await this.testGetPlatforms();
    
    // Test 2: Get existing integrations
    const integrations = await this.testGetIntegrations();
    
    // Test 3: Initiate OAuth (should work for any OAuth provider)
    await this.testInitiateOAuth('x');
    
    // Test 4: API Key integration (will fail with test key, but should show proper error)
    await this.testApiKeyIntegration('medium', 'test_api_key_123');
    
    // Test 5: If we have existing integrations, test management endpoints
    if (integrations && integrations.integrations && integrations.integrations.length > 0) {
      const testIntegration = integrations.integrations[0];
      console.log(`\n🎯 Using existing integration for management tests: ${testIntegration.id}`);
      
      await this.testIntegrationStatus(testIntegration.id);
      await this.testUpdateIntegration(testIntegration.id);
      await this.testEnableDisableIntegration(testIntegration.id);
    } else {
      console.log('\n⚠️ No existing integrations found. Skipping management tests.');
    }

    console.log('\n✨ Test suite completed!');
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('Usage: node test-integration-api.js <api_key> [base_url]');
    console.log('Example: node test-integration-api.js postiz_live_abc123 http://localhost:3000');
    process.exit(1);
  }

  const apiKey = args[0];
  const baseUrl = args[1] || 'http://localhost:3000';

  const tester = new PostizIntegrationTester(apiKey, baseUrl);
  await tester.runAllTests();
}

if (require.main === module) {
  main().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}

module.exports = PostizIntegrationTester;

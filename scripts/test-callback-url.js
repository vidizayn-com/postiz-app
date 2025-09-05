#!/usr/bin/env node

/**
 * Script to test callback URL functionality
 * This helps debug callback URL issues by testing if your callback URL is reachable
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// Configuration
const TEST_CALLBACK_URL = process.argv[2] || 'https://your-app.com/integration-callback';

async function testCallbackUrl(callbackUrl) {
  console.log(`🔍 Testing callback URL: ${callbackUrl}\n`);

  try {
    // Parse the URL
    const url = new URL(callbackUrl);
    console.log(`📋 URL Details:`);
    console.log(`   Protocol: ${url.protocol}`);
    console.log(`   Host: ${url.hostname}`);
    console.log(`   Port: ${url.port || (url.protocol === 'https:' ? '443' : '80')}`);
    console.log(`   Path: ${url.pathname}`);
    console.log('');

    // Test if the URL is reachable
    await testReachability(callbackUrl);
    
    // Test POST request (what Postiz sends)
    await testPostRequest(callbackUrl);

  } catch (error) {
    console.error('❌ Error testing callback URL:', error.message);
  }
}

function testReachability(callbackUrl) {
  return new Promise((resolve, reject) => {
    console.log('🌐 Testing URL reachability...');
    
    const url = new URL(callbackUrl);
    const client = url.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'HEAD',
      timeout: 5000,
    };

    const req = client.request(options, (res) => {
      console.log(`✅ URL is reachable (Status: ${res.statusCode})`);
      console.log(`   Response headers:`, Object.keys(res.headers).join(', '));
      console.log('');
      resolve();
    });

    req.on('error', (error) => {
      console.log(`❌ URL is not reachable: ${error.message}`);
      if (error.code === 'ECONNREFUSED') {
        console.log('   💡 This means nothing is listening on that host/port');
        console.log('   💡 Make sure your application is running and accessible');
      } else if (error.code === 'ENOTFOUND') {
        console.log('   💡 DNS resolution failed - check the hostname');
      } else if (error.code === 'ETIMEDOUT') {
        console.log('   💡 Connection timed out - check firewall/network settings');
      }
      console.log('');
      resolve(); // Don't reject, continue with other tests
    });

    req.on('timeout', () => {
      console.log('❌ Request timed out');
      console.log('');
      req.destroy();
      resolve();
    });

    req.end();
  });
}

function testPostRequest(callbackUrl) {
  return new Promise((resolve, reject) => {
    console.log('📤 Testing POST request (simulating Postiz callback)...');
    
    const url = new URL(callbackUrl);
    const client = url.protocol === 'https:' ? https : http;
    
    const testData = JSON.stringify({
      integrationId: 'test-integration-id',
      name: 'Test Integration',
      provider: 'test',
      status: 'connected',
      timestamp: new Date().toISOString(),
      state: 'test-state',
      method: 'test'
    });

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(testData),
        'User-Agent': 'Postiz-Integration-Callback/1.0',
      },
    };

    const req = client.request(options, (res) => {
      console.log(`✅ POST request successful (Status: ${res.statusCode})`);
      
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (responseData) {
          console.log(`   Response: ${responseData.substring(0, 200)}${responseData.length > 200 ? '...' : ''}`);
        }
        console.log('');
        resolve();
      });
    });

    req.on('error', (error) => {
      console.log(`❌ POST request failed: ${error.message}`);
      console.log('   💡 Your callback endpoint should accept POST requests');
      console.log('   💡 Make sure CORS is configured if needed');
      console.log('');
      resolve();
    });

    req.on('timeout', () => {
      console.log('❌ POST request timed out');
      console.log('');
      req.destroy();
      resolve();
    });

    req.write(testData);
    req.end();
  });
}

function showUsage() {
  console.log(`
Usage: node scripts/test-callback-url.js <callback-url>

Examples:
  node scripts/test-callback-url.js https://your-app.com/integration-callback
  node scripts/test-callback-url.js http://localhost:3001/callback
  node scripts/test-callback-url.js https://webhook.site/your-unique-id

This script will:
1. Parse and validate the callback URL
2. Test if the URL is reachable
3. Send a test POST request (simulating Postiz callback)

Common Issues:
- ECONNREFUSED: Nothing listening on that host/port
- ENOTFOUND: DNS resolution failed
- ETIMEDOUT: Connection/firewall issues
- 404: Endpoint doesn't exist
- 405: Method not allowed (doesn't accept POST)
`);
}

async function main() {
  if (process.argv.length < 3) {
    showUsage();
    process.exit(1);
  }

  await testCallbackUrl(TEST_CALLBACK_URL);
  
  console.log('🔧 Troubleshooting Tips:');
  console.log('');
  console.log('1. For local development:');
  console.log('   - Use ngrok: ngrok http 3000');
  console.log('   - Use webhook.site for testing');
  console.log('');
  console.log('2. For production:');
  console.log('   - Ensure HTTPS is enabled');
  console.log('   - Check firewall settings');
  console.log('   - Verify DNS configuration');
  console.log('');
  console.log('3. For debugging:');
  console.log('   - Check server logs');
  console.log('   - Test with curl or Postman');
  console.log('   - Use webhook.site to see what Postiz sends');
}

main().catch(console.error);

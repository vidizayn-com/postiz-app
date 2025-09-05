#!/usr/bin/env node

/**
 * Script to debug callback URL storage in Redis
 * This helps identify issues with callback URL storage and retrieval
 */

const Redis = require('ioredis');

// Configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function debugCallbackStorage() {
  console.log('🔍 Debugging callback URL storage in Redis\n');

  const redis = new Redis(REDIS_URL);

  try {
    // Check Redis connection
    console.log('📡 Testing Redis connection...');
    await redis.ping();
    console.log('✅ Redis connection successful\n');

    // List all callback-related keys
    console.log('🔑 Checking for callback-related keys...');
    const callbackKeys = await redis.keys('callback:*');
    const orgKeys = await redis.keys('org:*');
    const loginKeys = await redis.keys('login:*');
    const externalKeys = await redis.keys('external:*');

    console.log(`Found ${callbackKeys.length} callback keys:`);
    for (const key of callbackKeys) {
      const value = await redis.get(key);
      const ttl = await redis.ttl(key);
      console.log(`  ${key}: ${value} (TTL: ${ttl}s)`);
    }

    console.log(`\nFound ${orgKeys.length} org keys:`);
    for (const key of orgKeys) {
      const value = await redis.get(key);
      const ttl = await redis.ttl(key);
      console.log(`  ${key}: ${value} (TTL: ${ttl}s)`);
    }

    console.log(`\nFound ${loginKeys.length} login keys:`);
    for (const key of loginKeys) {
      const value = await redis.get(key);
      const ttl = await redis.ttl(key);
      console.log(`  ${key}: ${value ? 'present' : 'missing'} (TTL: ${ttl}s)`);
    }

    console.log(`\nFound ${externalKeys.length} external keys:`);
    for (const key of externalKeys) {
      const value = await redis.get(key);
      const ttl = await redis.ttl(key);
      console.log(`  ${key}: ${value ? 'present' : 'missing'} (TTL: ${ttl}s)`);
    }

    // Test storing and retrieving a callback URL
    console.log('\n🧪 Testing callback URL storage...');
    const testState = 'test-state-' + Date.now();
    const testCallbackUrl = 'https://example.com/callback';
    
    await redis.set(`callback:${testState}`, testCallbackUrl, 'EX', 300);
    console.log(`✅ Stored test callback URL with state: ${testState}`);
    
    const retrievedUrl = await redis.get(`callback:${testState}`);
    console.log(`📥 Retrieved callback URL: ${retrievedUrl}`);
    
    if (retrievedUrl === testCallbackUrl) {
      console.log('✅ Storage and retrieval working correctly');
    } else {
      console.log('❌ Storage or retrieval failed');
    }
    
    // Clean up test data
    await redis.del(`callback:${testState}`);
    console.log('🧹 Cleaned up test data');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await redis.disconnect();
  }
}

async function testSpecificState(state) {
  console.log(`🔍 Testing specific state: ${state}\n`);

  const redis = new Redis(REDIS_URL);

  try {
    const callbackUrl = await redis.get(`callback:${state}`);
    const orgId = await redis.get(`org:${state}`);
    const loginToken = await redis.get(`login:${state}`);
    const external = await redis.get(`external:${state}`);

    console.log('Results:');
    console.log(`  Callback URL: ${callbackUrl || 'NOT FOUND'}`);
    console.log(`  Organization ID: ${orgId || 'NOT FOUND'}`);
    console.log(`  Login Token: ${loginToken ? 'PRESENT' : 'NOT FOUND'}`);
    console.log(`  External Data: ${external ? 'PRESENT' : 'NOT FOUND'}`);

    // Check TTL for each key
    const callbackTtl = await redis.ttl(`callback:${state}`);
    const orgTtl = await redis.ttl(`org:${state}`);
    const loginTtl = await redis.ttl(`login:${state}`);
    const externalTtl = await redis.ttl(`external:${state}`);

    console.log('\nTTL (Time To Live):');
    console.log(`  Callback URL: ${callbackTtl}s`);
    console.log(`  Organization ID: ${orgTtl}s`);
    console.log(`  Login Token: ${loginTtl}s`);
    console.log(`  External Data: ${externalTtl}s`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await redis.disconnect();
  }
}

function showUsage() {
  console.log(`
Usage: 
  node scripts/debug-callback-storage.js                    # Debug all callback storage
  node scripts/debug-callback-storage.js <state>           # Test specific state

Examples:
  node scripts/debug-callback-storage.js
  node scripts/debug-callback-storage.js coZliAAAAAAB3PWjAAABmRSCBY8

This script will:
1. Check Redis connection
2. List all callback-related keys
3. Test storage and retrieval functionality
4. If a state is provided, check that specific state

Common Issues:
- No callback keys found: Integration not initiated properly
- TTL expired: Keys expired (5 minutes default)
- Redis connection failed: Check REDIS_URL environment variable
`);
}

async function main() {
  const state = process.argv[2];

  if (state) {
    await testSpecificState(state);
  } else {
    await debugCallbackStorage();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { debugCallbackStorage, testSpecificState };

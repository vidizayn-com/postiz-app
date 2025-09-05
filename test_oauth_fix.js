#!/usr/bin/env node

const fetch = require('node-fetch');

async function testOAuthFix() {
    console.log('Testing OAuth callback fix...');
    
    // Test data
    const testCallbackUrl = 'http://laravel.test/settings/social-media/callback/x';
    const testState = 'test_state_' + Date.now();
    
    try {
        // 1. First, let's test storing a callback URL directly in Redis
        console.log('\n1. Testing Redis storage...');
        
        const storeResponse = await fetch('http://localhost:3000/api/v1/integrations/debug/redis/' + testState, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (storeResponse.ok) {
            const result = await storeResponse.json();
            console.log('Redis debug response:', result);
        } else {
            console.log('Redis debug failed:', storeResponse.status);
        }
        
        // 2. Test the initiate endpoint
        console.log('\n2. Testing initiate endpoint...');
        
        const initiateResponse = await fetch('http://localhost:3000/api/v1/integrations/initiate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer test-token' // You'll need a real token
            },
            body: JSON.stringify({
                provider: 'x',
                callbackUrl: testCallbackUrl
            })
        });
        
        if (initiateResponse.ok) {
            const result = await initiateResponse.json();
            console.log('Initiate response:', result);
            
            if (result.state) {
                console.log('\n3. Testing callback simulation...');
                
                // Simulate the OAuth callback
                const callbackResponse = await fetch(`http://localhost:3000/api/callback/oauth/x?oauth_token=${result.state}&oauth_verifier=test_verifier`, {
                    method: 'GET',
                    redirect: 'manual' // Don't follow redirects
                });
                
                console.log('Callback response status:', callbackResponse.status);
                console.log('Callback response headers:', Object.fromEntries(callbackResponse.headers.entries()));
                
                if (callbackResponse.status === 302) {
                    const location = callbackResponse.headers.get('location');
                    console.log('Redirect location:', location);
                    
                    if (location && location.includes(testCallbackUrl)) {
                        console.log('✅ SUCCESS: Callback URL redirect is working!');
                    } else {
                        console.log('❌ FAILED: Callback URL redirect is not working');
                    }
                } else {
                    const responseText = await callbackResponse.text();
                    console.log('Callback response body:', responseText);
                }
            }
        } else {
            console.log('Initiate failed:', initiateResponse.status, await initiateResponse.text());
        }
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

// Run the test
testOAuthFix();

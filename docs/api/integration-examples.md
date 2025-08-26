# Integration API Examples

This document provides practical examples of how to use the Postiz Integration API.

## Prerequisites

1. Get your API key from the Postiz dashboard
2. Set up a callback endpoint (optional but recommended)

## Example 1: OAuth Integration (Twitter/X)

### Step 1: Initiate OAuth Flow

```javascript
const response = await fetch('https://your-postiz.com/api/v1/integrations/initiate', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your_api_key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    provider: 'x',
    callbackUrl: 'https://your-app.com/postiz-callback'
  })
});

const { authUrl, state } = await response.json();

// Redirect user to authUrl
window.location.href = authUrl;
```

### Step 2: Handle Callback

Set up an endpoint at `https://your-app.com/postiz-callback` to receive the integration result:

```javascript
// Express.js example
app.post('/postiz-callback', (req, res) => {
  const { integrationId, status, provider, name } = req.body;
  
  if (status === 'connected') {
    console.log(`Successfully connected ${provider} account: ${name}`);
    console.log(`Integration ID: ${integrationId}`);
    
    // Store the integrationId in your database
    // You'll need this ID to create posts later
  } else {
    console.error('Integration failed:', req.body);
  }
  
  res.status(200).send('OK');
});
```

## Example 2: API Key Integration (Medium)

```javascript
const response = await fetch('https://your-postiz.com/api/v1/integrations/api-key', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your_api_key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    provider: 'medium',
    apiKey: 'your_medium_api_key',
    name: 'My Medium Blog',
    callbackUrl: 'https://your-app.com/postiz-callback'
  })
});

const integration = await response.json();
console.log('Integration created:', integration.integrationId);
```

## Example 3: Complete Integration Management

```javascript
class PostizIntegrationManager {
  constructor(apiKey, baseUrl = 'https://your-postiz.com/api/v1/integrations') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async request(endpoint, options = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API Error: ${error.message}`);
    }

    return response.json();
  }

  // Get all available platforms
  async getPlatforms() {
    return this.request('/platforms');
  }

  // Start OAuth flow
  async initiateOAuth(provider, callbackUrl) {
    return this.request('/initiate', {
      method: 'POST',
      body: JSON.stringify({ provider, callbackUrl })
    });
  }

  // Connect with API key
  async connectWithApiKey(provider, apiKey, name, additionalSettings = {}) {
    return this.request('/api-key', {
      method: 'POST',
      body: JSON.stringify({
        provider,
        apiKey,
        name,
        additionalSettings
      })
    });
  }

  // Get all integrations
  async getIntegrations() {
    return this.request('/list');
  }

  // Get integration status
  async getIntegrationStatus(integrationId) {
    return this.request(`/${integrationId}/status`);
  }

  // Update integration
  async updateIntegration(integrationId, updates) {
    return this.request(`/${integrationId}/update`, {
      method: 'POST',
      body: JSON.stringify(updates)
    });
  }

  // Enable/disable integration
  async enableIntegration(integrationId) {
    return this.request(`/${integrationId}/enable`, { method: 'POST' });
  }

  async disableIntegration(integrationId) {
    return this.request(`/${integrationId}/disable`, { method: 'POST' });
  }

  // Delete integration
  async deleteIntegration(integrationId) {
    return this.request(`/${integrationId}`, { method: 'DELETE' });
  }
}

// Usage
const manager = new PostizIntegrationManager('your_api_key');

// Get available platforms
const platforms = await manager.getPlatforms();
console.log('Available platforms:', platforms.platforms);

// Connect Medium account
const mediumIntegration = await manager.connectWithApiKey(
  'medium',
  'your_medium_api_key',
  'My Medium Blog'
);

// Get all integrations
const integrations = await manager.getIntegrations();
console.log('Connected integrations:', integrations.integrations);
```

## Example 4: React Integration Component

```jsx
import React, { useState, useEffect } from 'react';

const IntegrationManager = ({ apiKey }) => {
  const [platforms, setPlatforms] = useState([]);
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(false);

  const api = new PostizIntegrationManager(apiKey);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [platformsData, integrationsData] = await Promise.all([
        api.getPlatforms(),
        api.getIntegrations()
      ]);
      setPlatforms(platformsData.platforms);
      setIntegrations(integrationsData.integrations);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthConnect = async (provider) => {
    try {
      const { authUrl } = await api.initiateOAuth(
        provider,
        `${window.location.origin}/integration-callback`
      );
      window.open(authUrl, 'oauth', 'width=600,height=700');
    } catch (error) {
      console.error('Failed to initiate OAuth:', error);
    }
  };

  const handleApiKeyConnect = async (provider, apiKey, name) => {
    try {
      await api.connectWithApiKey(provider, apiKey, name);
      await loadData(); // Refresh the list
    } catch (error) {
      console.error('Failed to connect with API key:', error);
    }
  };

  const handleDisconnect = async (integrationId) => {
    try {
      await api.deleteIntegration(integrationId);
      await loadData(); // Refresh the list
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>Available Platforms</h2>
      {platforms.map(platform => (
        <div key={platform.identifier}>
          <h3>{platform.name}</h3>
          {platform.supportsApiKey ? (
            <ApiKeyForm 
              platform={platform} 
              onConnect={handleApiKeyConnect} 
            />
          ) : (
            <button onClick={() => handleOAuthConnect(platform.identifier)}>
              Connect with OAuth
            </button>
          )}
        </div>
      ))}

      <h2>Connected Integrations</h2>
      {integrations.map(integration => (
        <div key={integration.id}>
          <span>{integration.name} ({integration.provider})</span>
          <span>Status: {integration.status}</span>
          <button onClick={() => handleDisconnect(integration.id)}>
            Disconnect
          </button>
        </div>
      ))}
    </div>
  );
};

const ApiKeyForm = ({ platform, onConnect }) => {
  const [apiKey, setApiKey] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onConnect(platform.identifier, apiKey, name);
    setApiKey('');
    setName('');
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Account name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="API Key"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        required
      />
      <button type="submit">Connect</button>
    </form>
  );
};

export default IntegrationManager;
```

## Example 5: Python Integration

```python
import requests
import json

class PostizIntegrationAPI:
    def __init__(self, api_key, base_url="https://your-postiz.com/api/v1/integrations"):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

    def _request(self, method, endpoint, data=None):
        url = f"{self.base_url}{endpoint}"
        response = requests.request(method, url, headers=self.headers, json=data)
        response.raise_for_status()
        return response.json()

    def get_platforms(self):
        return self._request("GET", "/platforms")

    def initiate_oauth(self, provider, callback_url):
        return self._request("POST", "/initiate", {
            "provider": provider,
            "callbackUrl": callback_url
        })

    def connect_with_api_key(self, provider, api_key, name, additional_settings=None):
        data = {
            "provider": provider,
            "apiKey": api_key,
            "name": name
        }
        if additional_settings:
            data["additionalSettings"] = additional_settings
        return self._request("POST", "/api-key", data)

    def get_integrations(self):
        return self._request("GET", "/list")

    def delete_integration(self, integration_id):
        return self._request("DELETE", f"/{integration_id}")

# Usage
api = PostizIntegrationAPI("your_api_key")

# Connect Medium account
medium_integration = api.connect_with_api_key(
    "medium",
    "your_medium_api_key",
    "My Medium Blog"
)

print(f"Connected Medium account: {medium_integration['integrationId']}")

# List all integrations
integrations = api.get_integrations()
for integration in integrations['integrations']:
    print(f"{integration['name']} ({integration['provider']}): {integration['status']}")
```

## Webhook Callback Handler Examples

### Express.js
```javascript
app.post('/postiz-callback', express.json(), (req, res) => {
  const { integrationId, status, provider, error } = req.body;
  
  // Store in database
  if (status === 'connected') {
    // Save successful integration
    db.integrations.create({
      postizId: integrationId,
      provider: provider,
      status: status
    });
  } else {
    // Handle error
    console.error('Integration failed:', error);
  }
  
  res.status(200).json({ received: true });
});
```

### Flask (Python)
```python
from flask import Flask, request, jsonify

@app.route('/postiz-callback', methods=['POST'])
def handle_callback():
    data = request.get_json()
    
    if data['status'] == 'connected':
        # Save to database
        save_integration(data['integrationId'], data['provider'])
    else:
        # Handle error
        log_error(data.get('error', 'Unknown error'))
    
    return jsonify({'received': True})
```

## Error Handling

Always implement proper error handling:

```javascript
try {
  const integration = await api.connectWithApiKey('medium', apiKey, name);
  console.log('Success:', integration);
} catch (error) {
  if (error.message.includes('Invalid credentials')) {
    // Handle invalid API key
    showError('Please check your API key');
  } else if (error.message.includes('Integration not allowed')) {
    // Handle unsupported provider
    showError('This platform is not supported');
  } else {
    // Handle other errors
    showError('Something went wrong. Please try again.');
  }
}
```

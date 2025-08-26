# Postiz Integration API

The Postiz Integration API allows external applications to programmatically manage social media platform integrations. This enables you to build custom dashboards, automation tools, or integrate Postiz functionality into your existing applications.

## 🚀 Quick Start

1. **Get your API key** from the Postiz dashboard
2. **Choose your integration method**:
   - OAuth flow for platforms like Twitter/X, Facebook, LinkedIn
   - API key authentication for platforms like Medium, Dev.to, Hashnode
3. **Set up callback handling** (optional but recommended)
4. **Start integrating!**

## 📚 Documentation

- [**API Reference**](./integrations-api.md) - Complete API documentation
- [**Examples & Tutorials**](./integration-examples.md) - Practical implementation examples

## 🔧 Features

### ✅ Integration Management
- **List available platforms** - Get all supported social media platforms
- **OAuth flow initiation** - Start OAuth authentication for supported platforms
- **API key integration** - Direct integration using API keys
- **Custom callback URLs** - Receive integration results at your endpoints
- **Integration status monitoring** - Check connection health and status

### ✅ Platform Support
- **OAuth Platforms**: Twitter/X, Facebook, LinkedIn, Instagram, YouTube, TikTok, Pinterest, Reddit, Discord, Slack, and more
- **API Key Platforms**: Medium, Dev.to, Hashnode, Bluesky, Nostr, Lemmy, and more
- **Web3 Platforms**: Farcaster, Nostr with special handling

### ✅ Management Operations
- Enable/disable integrations
- Update integration settings
- Refresh access tokens
- Delete integrations
- Bulk operations support

## 🛠️ Implementation Examples

### JavaScript/Node.js
```javascript
const response = await fetch('https://your-postiz.com/api/v1/integrations/platforms', {
  headers: {
    'Authorization': 'Bearer your_api_key'
  }
});
const { platforms } = await response.json();
```

### Python
```python
import requests

response = requests.get(
    'https://your-postiz.com/api/v1/integrations/platforms',
    headers={'Authorization': 'Bearer your_api_key'}
)
platforms = response.json()['platforms']
```

### cURL
```bash
curl -H "Authorization: Bearer your_api_key" \
     https://your-postiz.com/api/v1/integrations/platforms
```

## 🔐 Authentication

All API endpoints require authentication using an API key:

```
Authorization: Bearer your_api_key_here
```

Get your API key from the Postiz dashboard under Settings > API Keys.

## 🔄 OAuth Flow

For OAuth-based platforms:

1. **Initiate** - Call `/initiate` endpoint with provider and callback URL
2. **Redirect** - Send user to the returned `authUrl`
3. **Callback** - Receive integration result at your callback URL
4. **Use** - Use the `integrationId` for posting content

## 🔑 API Key Flow

For API key-based platforms:

1. **Connect** - Call `/api-key` endpoint with provider credentials
2. **Receive** - Get immediate integration result
3. **Use** - Use the `integrationId` for posting content

## 📞 Callback Handling

Set up a webhook endpoint to receive integration results:

```javascript
app.post('/postiz-callback', (req, res) => {
  const { integrationId, status, provider } = req.body;
  
  if (status === 'connected') {
    // Store integrationId for future use
    console.log(`Connected ${provider}: ${integrationId}`);
  }
  
  res.status(200).send('OK');
});
```

## 🧪 Testing

Use the provided test script to verify your setup:

```bash
node scripts/test-integration-api.js your_api_key http://localhost:3000
```

## 📊 Response Format

All endpoints return JSON responses:

```json
{
  "integrationId": "integration_123",
  "name": "My Account",
  "provider": "x",
  "status": "connected",
  "picture": "https://avatar-url.com/image.jpg",
  "username": "myusername",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

## ⚠️ Error Handling

Errors include descriptive messages:

```json
{
  "error": "Integration not allowed",
  "message": "The specified provider is not supported"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (invalid API key)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error

## 🔒 Security

- API keys are encrypted and securely stored
- Rate limiting prevents abuse
- Callback URLs are validated
- OAuth state parameters prevent CSRF attacks

## 📈 Rate Limits

Rate limits are applied based on your subscription plan:
- Free tier: 100 requests/hour
- Pro tier: 1000 requests/hour
- Enterprise: Custom limits

## 🆘 Support

- Check the [examples](./integration-examples.md) for common use cases
- Review the [API reference](./integrations-api.md) for detailed documentation
- Contact support for enterprise integration assistance

## 🔄 Migration from Dashboard

If you're currently using the Postiz dashboard and want to migrate to API management:

1. Export your existing integrations using the API
2. Note down the integration IDs
3. Update your application to use the API endpoints
4. Test thoroughly before switching completely

## 🚦 Status Monitoring

Monitor your integrations programmatically:

```javascript
// Check all integrations
const integrations = await api.getIntegrations();

// Check specific integration
const status = await api.getIntegrationStatus(integrationId);

// Refresh if needed
if (status.refreshNeeded) {
  await api.refreshIntegration(integrationId);
}
```

## 🎯 Next Steps

After setting up integrations, you can:
- Use the Posts API to create and schedule content
- Set up webhooks for post status updates
- Build custom analytics dashboards
- Automate content distribution workflows

---

**Ready to get started?** Check out the [API Reference](./integrations-api.md) and [Examples](./integration-examples.md)!

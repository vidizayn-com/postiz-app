# Integration Callback Redirection Guide

This guide explains how to use callback URL redirection for API integrations, allowing users to be redirected back to your application after completing an integration.

## Overview

The Postiz API supports two types of callback handling for integrations:

1. **POST Notification** (Default): Sends a POST request to your callback URL with integration details
2. **Redirection** (New): Redirects the user to your callback URL with query parameters

## API Endpoints

### OAuth Flow with Redirection

For OAuth-based integrations (X/Twitter, Facebook, LinkedIn, etc.), use the `/initiate` endpoint:

```bash
POST /api/v1/integrations/initiate
```

**Request Body:**
```json
{
  "provider": "x",
  "callbackUrl": "https://your-app.com/integration-callback"
}
```

**Response:**
```json
{
  "authUrl": "https://oauth-provider.com/auth?...",
  "state": "unique-state-id",
  "provider": "x",
  "callbackUrl": "https://your-app.com/integration-callback",
  "message": "Redirect user to authUrl. Integration result will be sent to your callback URL."
}
```

**Flow:**
1. Redirect user to `authUrl`
2. User completes OAuth on the provider's site
3. User is redirected to your `callbackUrl` with query parameters

### API Key Integration with Redirection

For API key-based integrations, use the `/api-key` endpoint with the `redirect=true` query parameter:

```bash
POST /api/v1/integrations/api-key?redirect=true
```

**Request Body:**
```json
{
  "provider": "nostr",
  "apiKey": "your-api-key",
  "name": "My Integration",
  "callbackUrl": "https://your-app.com/integration-callback"
}
```

**Behavior:**
- **With `redirect=true`**: User is redirected to your callback URL
- **Without `redirect=true`**: JSON response is returned + POST notification sent

## Callback URL Parameters

When redirection occurs, your callback URL will receive these query parameters:

### Success Parameters

```
https://your-app.com/integration-callback?status=connected&provider=x&integrationId=123&name=John%20Doe&username=johndoe&method=oauth
```

**Parameters:**
- `status`: `connected` or `pending`
- `provider`: The integration provider identifier
- `integrationId`: The integration ID in Postiz
- `method`: `oauth` or `api-key`
- `name`: Account name (optional)
- `username`: Account username (optional)
- `picture`: Profile picture URL (optional)

### Error Parameters

```
https://your-app.com/integration-callback?status=error&error=OAuth%20authorization%20denied&method=oauth
```

**Parameters:**
- `status`: `error`
- `error`: Error message
- `method`: `oauth` or `api-key`

## Implementation Examples

### Frontend JavaScript

```javascript
// For OAuth integrations
async function initiateOAuthIntegration(provider) {
  const response = await fetch('/api/v1/integrations/initiate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'your-api-key'
    },
    body: JSON.stringify({
      provider: provider,
      callbackUrl: 'https://your-app.com/integration-callback'
    })
  });

  const data = await response.json();
  
  // Redirect user to OAuth provider
  window.location.href = data.authUrl;
}

// For API key integrations with redirection
async function connectWithApiKey(provider, apiKey) {
  const response = await fetch('/api/v1/integrations/api-key?redirect=true', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'your-api-key'
    },
    body: JSON.stringify({
      provider: provider,
      apiKey: apiKey,
      name: 'My Integration',
      callbackUrl: 'https://your-app.com/integration-callback'
    })
  });

  // This will redirect automatically if successful
}

// Handle callback on your callback page
function handleCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const status = urlParams.get('status');
  const provider = urlParams.get('provider');
  const integrationId = urlParams.get('integrationId');
  const error = urlParams.get('error');

  if (status === 'connected') {
    console.log(`Integration successful: ${provider} (ID: ${integrationId})`);
    // Handle success
  } else if (status === 'error') {
    console.error(`Integration failed: ${error}`);
    // Handle error
  }
}
```

### Backend Node.js (Express)

```javascript
// Callback handler
app.get('/integration-callback', (req, res) => {
  const { status, provider, integrationId, error, method } = req.query;

  if (status === 'connected') {
    // Integration successful
    res.render('integration-success', {
      provider,
      integrationId,
      method
    });
  } else if (status === 'error') {
    // Integration failed
    res.render('integration-error', {
      error,
      method
    });
  } else {
    res.status(400).send('Invalid callback');
  }
});
```

## Comparison: Redirection vs POST Notification

| Feature | Redirection | POST Notification |
|---------|-------------|-------------------|
| **User Experience** | User stays in your app flow | User sees JSON response |
| **Implementation** | Handle query parameters | Handle POST webhook |
| **Real-time** | Immediate | Immediate |
| **Reliability** | Depends on user's browser | More reliable |
| **Security** | Parameters visible in URL | Data in request body |
| **Use Case** | Interactive user flows | Background integrations |

## Best Practices

### Security Considerations

1. **Validate Parameters**: Always validate callback parameters on your server
2. **State Verification**: For OAuth flows, verify the state parameter if needed
3. **HTTPS Required**: Use HTTPS for all callback URLs
4. **Sensitive Data**: Don't include sensitive information in callback URLs

### Error Handling

```javascript
function handleCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const status = urlParams.get('status');

  try {
    switch (status) {
      case 'connected':
        handleSuccess(urlParams);
        break;
      case 'pending':
        handlePending(urlParams);
        break;
      case 'error':
        handleError(urlParams.get('error'));
        break;
      default:
        throw new Error('Unknown status');
    }
  } catch (error) {
    console.error('Callback handling error:', error);
    // Fallback error handling
  }
}
```

### Testing

1. **Local Development**: Use ngrok or similar tools to expose localhost
2. **Staging Environment**: Test with staging callback URLs
3. **Error Scenarios**: Test OAuth denial, invalid API keys, etc.

## Troubleshooting

### Common Issues

1. **No Redirection**: Ensure `redirect=true` parameter is included for API key integrations
2. **Missing Parameters**: Check that callback URL is properly formatted
3. **CORS Issues**: Ensure your callback URL accepts redirects from Postiz domain
4. **OAuth Errors**: Verify OAuth app configuration with providers
5. **ECONNREFUSED Error**: Your callback URL is not reachable (nothing listening on that host/port)
6. **POST Notification Fails**: The system will still redirect even if POST notification fails

### Debug Tips

1. **Test Callback URL**: Use the provided test script:
   ```bash
   node scripts/test-callback-url.js https://your-app.com/integration-callback
   ```

2. **Check Server Logs**: Look for these log messages:
   ```
   API Callback - Stored callback URL: found/not found
   API Callback - POST notification sent: true/false
   API Callback - Redirecting to: <url>
   Failed to send callback: <error>
   ```

3. **Use Webhook Testing Services**: For testing, use services like:
   - [webhook.site](https://webhook.site) - Get a temporary URL to see what Postiz sends
   - [ngrok](https://ngrok.com) - Expose localhost to the internet

4. **Check Network Tab**: Monitor requests in browser dev tools
5. **URL Encoding**: Ensure callback URLs are properly encoded
6. **Parameter Validation**: Log all received parameters for debugging

### Error Scenarios

#### ECONNREFUSED Error
```
Failed to send callback: TypeError: fetch failed
  [cause]: Error: connect ECONNREFUSED 127.0.0.1:80
```

**Solutions:**
- Ensure your application is running and accessible
- Check if the callback URL is correct
- For localhost, use ngrok or similar tunneling service
- Verify firewall settings

#### Callback URL Not Found
```
API Callback - Stored callback URL: not found
```

**Solutions:**
- Ensure you're providing `callbackUrl` in the initiate request
- Check that the OAuth state parameter matches
- Verify Redis is working (callback URLs are stored temporarily)

#### POST Notification Fails But Redirection Works
This is normal behavior. The system will:
1. Try to send POST notification to your callback URL
2. If it fails, log the error but continue
3. Redirect the user to your callback URL with query parameters

## Migration Guide

### From POST Notifications to Redirection

If you're currently using POST notifications and want to switch to redirection:

1. **Update API Calls**: Add `redirect=true` parameter to API key integrations
2. **Implement Callback Handler**: Create a page to handle callback parameters
3. **Update User Flow**: Modify your UI to handle redirections
4. **Test Thoroughly**: Ensure all integration types work correctly

### Hybrid Approach

You can use both methods depending on the integration type:

```javascript
// Use redirection for user-initiated integrations
if (userInitiated) {
  await initiateWithRedirection(provider);
} else {
  // Use POST notifications for background integrations
  await initiateWithNotification(provider);
}
```

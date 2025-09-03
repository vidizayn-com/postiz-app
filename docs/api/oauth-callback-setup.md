# OAuth Callback URL Setup for API Integration

## Problem

When using the Postiz API to integrate social media accounts, users want to redirect back to their own application after OAuth completion. However, OAuth platforms (X/Twitter, Facebook, LinkedIn, etc.) validate callback URLs against registered URLs in the OAuth app configuration.

## Solution

To properly handle custom callback URLs, you need to register the API callback endpoint with each OAuth provider and configure the system to redirect users to their desired callback URL after processing.

## Setup Instructions

### 1. Register API Callback URLs with OAuth Providers

For each social media platform you want to support, register the following callback URL in your OAuth app configuration:

```
https://your-postiz-domain.com/api/callback/oauth/{provider}
```

Replace `{provider}` with the actual provider identifier:

- **X/Twitter**: `https://your-postiz-domain.com/api/callback/oauth/x`
- **Facebook**: `https://your-postiz-domain.com/api/callback/oauth/facebook`
- **LinkedIn**: `https://your-postiz-domain.com/api/callback/oauth/linkedin`
- **Instagram**: `https://your-postiz-domain.com/api/callback/oauth/instagram`
- **TikTok**: `https://your-postiz-domain.com/api/callback/oauth/tiktok`
- **YouTube**: `https://your-postiz-domain.com/api/callback/oauth/youtube`

### 2. Update OAuth Provider Configurations

You need to modify each social media provider's `generateAuthUrl()` method to use the API callback URL instead of the frontend URL.

#### Example for X/Twitter Provider

Edit `libraries/nestjs-libraries/src/integrations/social/x.provider.ts`:

```typescript
// Change this line:
const callbackUrl = (process.env.X_URL || process.env.FRONTEND_URL) + `/integrations/social/x`;

// To this:
const callbackUrl = (process.env.BACKEND_URL || process.env.FRONTEND_URL) + `/api/callback/oauth/x`;
```

#### Example for Facebook Provider

Edit `libraries/nestjs-libraries/src/integrations/social/facebook.provider.ts`:

```typescript
// Change this:
`&redirect_uri=${encodeURIComponent(
  `${process.env.FRONTEND_URL}/integrations/social/facebook`
)}`

// To this:
`&redirect_uri=${encodeURIComponent(
  `${process.env.BACKEND_URL || process.env.FRONTEND_URL}/api/callback/oauth/facebook`
)}`
```

### 3. Environment Variables

Make sure you have the following environment variables set:

```bash
# Your backend URL (where the API callback endpoints are hosted)
BACKEND_URL="https://your-postiz-domain.com"

# Your frontend URL (for fallback)
FRONTEND_URL="https://your-postiz-domain.com"
```

### 4. API Usage

When initiating an OAuth integration, include your callback URL:

```javascript
const response = await fetch('/api/v1/integrations/initiate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_TOKEN'
  },
  body: JSON.stringify({
    provider: 'x',
    callbackUrl: 'https://your-app.com/integration-callback'
  })
});

const { authUrl } = await response.json();

// Redirect user to authUrl
window.location.href = authUrl;
```

### 5. Handle Callback

After successful OAuth, the user will be redirected to your callback URL with query parameters:

```
https://your-app.com/integration-callback?status=connected&provider=x&integrationId=123&name=John%20Doe&username=johndoe
```

Query parameters:
- `status`: `connected`, `pending`, or `error`
- `provider`: The social media provider identifier
- `integrationId`: The integration ID in Postiz
- `name`: The account name (optional)
- `username`: The account username (optional)
- `error`: Error message (only if status is `error`)

### 6. Error Handling

If there's an error during OAuth, the user will be redirected to your callback URL with an error parameter:

```
https://your-app.com/integration-callback?error=OAuth%20authorization%20denied
```

## Important Notes

1. **OAuth App Registration**: You must register the API callback URLs with each OAuth provider before this will work.

2. **HTTPS Required**: Most OAuth providers require HTTPS for callback URLs in production.

3. **Domain Matching**: The callback URL domain must match the domain registered with the OAuth provider.

4. **Fallback Behavior**: If no callback URL is provided, the system will use the default Postiz UI flow.

5. **Security**: The callback URLs are stored temporarily (5 minutes) and cleaned up after use.

## Testing

1. Register test callback URLs with OAuth providers
2. Use the API to initiate an integration with your callback URL
3. Complete the OAuth flow
4. Verify that you're redirected to your callback URL with the correct parameters

## Troubleshooting

- **"Invalid callback URL" errors**: Ensure the callback URL is registered with the OAuth provider
- **User not redirected**: Check that the callback URL is properly formatted and accessible
- **Missing parameters**: Verify that the OAuth flow completed successfully and the integration was created

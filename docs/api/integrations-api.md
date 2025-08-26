# Postiz Integration Management API

This document describes the API endpoints for managing social media platform integrations programmatically.

## Authentication

All API endpoints require authentication using an API key. Include your API key in the `Authorization` header:

```
Authorization: Bearer your_api_key_here
```

Or directly:

```
Authorization: your_api_key_here
```

## Base URL

```
https://your-postiz-instance.com/api/v1/integrations
```

## Endpoints

### 1. Get Available Platforms

Get a list of all available social media platforms that can be integrated.

**Endpoint:** `GET /platforms`

**Response:**
```json
{
  "platforms": [
    {
      "identifier": "x",
      "name": "X (Twitter)",
      "toolTip": "Connect your X account",
      "editor": "normal",
      "isExternal": false,
      "isWeb3": false,
      "customFields": [],
      "supportsApiKey": false
    },
    {
      "identifier": "medium",
      "name": "Medium",
      "toolTip": "Connect your Medium account",
      "editor": "markdown",
      "isExternal": false,
      "isWeb3": false,
      "customFields": [
        {
          "key": "apiKey",
          "label": "API key",
          "validation": "/^.{3,}$/",
          "type": "password"
        }
      ],
      "supportsApiKey": true
    }
  ]
}
```

### 2. Initiate OAuth Integration

Start the OAuth flow for platforms that require OAuth authentication.

**Endpoint:** `POST /initiate`

**Request Body:**
```json
{
  "provider": "x",
  "callbackUrl": "https://your-app.com/integration-callback",
  "externalUrl": "https://custom-instance.com" // Optional, for self-hosted platforms
}
```

**Response:**
```json
{
  "authUrl": "https://api.twitter.com/oauth/authorize?...",
  "state": "abc123",
  "provider": "x",
  "callbackUrl": "https://your-app.com/integration-callback",
  "message": "Redirect user to authUrl. Integration result will be sent to your callback URL."
}
```

**Usage:**
1. Call this endpoint to get the OAuth URL
2. Redirect your user to the `authUrl`
3. User completes OAuth on the platform
4. Platform redirects to Postiz callback handler
5. Postiz sends integration result to your `callbackUrl`

### 3. Connect with API Key

For platforms that support API key authentication (like Medium, Dev.to, Hashnode).

**Endpoint:** `POST /api-key`

**Request Body:**
```json
{
  "provider": "medium",
  "apiKey": "your_medium_api_key",
  "name": "My Medium Account",
  "callbackUrl": "https://your-app.com/integration-callback",
  "additionalSettings": {
    "identifier": "username",
    "service": "https://custom-instance.com"
  }
}
```

**Response:**
```json
{
  "integrationId": "integration_123",
  "name": "My Medium Account",
  "provider": "medium",
  "status": "connected",
  "picture": "https://avatar-url.com/image.jpg",
  "username": "username",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "callbackUrl": "https://your-app.com/integration-callback",
  "message": "Integration created successfully. Callback notification sent."
}
```

### 4. List Integrations

Get all integrations for your organization.

**Endpoint:** `GET /list`

**Response:**
```json
{
  "integrations": [
    {
      "id": "integration_123",
      "name": "My X Account",
      "provider": "x",
      "status": "connected",
      "picture": "https://avatar-url.com/image.jpg",
      "username": "myusername",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### 5. Get Integration Status

Get detailed status of a specific integration.

**Endpoint:** `GET /{integrationId}/status`

**Response:**
```json
{
  "id": "integration_123",
  "name": "My X Account",
  "provider": "x",
  "status": "connected",
  "picture": "https://avatar-url.com/image.jpg",
  "username": "myusername",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "refreshNeeded": false
}
```

### 6. Update Integration

Update integration settings like name or custom settings.

**Endpoint:** `POST /{integrationId}/update`

**Request Body:**
```json
{
  "name": "Updated Account Name",
  "settings": {
    "customSetting": "value"
  }
}
```

**Response:**
```json
{
  "id": "integration_123",
  "name": "Updated Account Name",
  "provider": "x",
  "status": "connected",
  "picture": "https://avatar-url.com/image.jpg",
  "username": "myusername",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "message": "Integration updated successfully"
}
```

### 7. Enable Integration

Enable a disabled integration.

**Endpoint:** `POST /{integrationId}/enable`

**Response:**
```json
{
  "id": "integration_123",
  "name": "My X Account",
  "provider": "x",
  "status": "connected",
  "message": "Integration enabled successfully"
}
```

### 8. Disable Integration

Disable an integration without deleting it.

**Endpoint:** `POST /{integrationId}/disable`

**Response:**
```json
{
  "id": "integration_123",
  "name": "My X Account",
  "provider": "x",
  "status": "disabled",
  "message": "Integration disabled successfully"
}
```

### 9. Refresh Integration

Refresh the access token for an integration.

**Endpoint:** `POST /{integrationId}/refresh`

**Response:**
```json
{
  "id": "integration_123",
  "name": "My X Account",
  "provider": "x",
  "status": "connected",
  "message": "Integration refreshed successfully"
}
```

### 10. Delete Integration

Permanently delete an integration and all associated posts.

**Endpoint:** `DELETE /{integrationId}`

**Response:**
```json
{
  "message": "Integration deleted successfully",
  "deletedPostsCount": 5
}
```

## Status Values

- `connected`: Integration is active and working
- `pending`: Integration is in setup process (for multi-step integrations)
- `disabled`: Integration is disabled but not deleted
- `error`: Integration has an error and needs attention

## Callback Notifications

When you provide a `callbackUrl`, Postiz will send a POST request to that URL with the integration result:

**Callback Payload:**
```json
{
  "integrationId": "integration_123",
  "name": "My Account",
  "provider": "x",
  "status": "connected",
  "picture": "https://avatar-url.com/image.jpg",
  "username": "myusername",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "state": "abc123",
  "method": "oauth" // or "api-key"
}
```

## Error Responses

All endpoints return standard HTTP status codes. Error responses include:

```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

Common error codes:
- `400`: Bad Request - Invalid parameters
- `401`: Unauthorized - Invalid API key
- `404`: Not Found - Resource not found
- `500`: Internal Server Error - Server error

## Rate Limits

API key authentication includes automatic rate limiting based on your subscription plan.

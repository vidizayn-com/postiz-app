# Non-Expiring API Keys Guide

This guide explains how to create and manage API keys that never expire, preventing the "The provided API key is invalid, expired, or inactive" error.

## Overview

By default, Postiz API keys are now created without expiration dates, meaning they will never expire unless manually deactivated. This prevents interruption of your integrations and automated workflows.

## Creating Non-Expiring API Keys

### Method 1: API Key Login (Recommended)

Create a non-expiring API key by logging in with your credentials:

```bash
curl -X POST http://localhost:3000/auth/api-key/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password",
    "provider": "LOCAL",
    "keyName": "My Non-Expiring API Key"
  }'
```

**Note:** Do not include the `expiresInDays` parameter to create a non-expiring key.

### Method 2: API Key Registration

For new users or when using the registration token:

```bash
curl -X POST http://localhost:3000/auth/api-key/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-registration-token",
    "provider": "LOCAL",
    "company": "Your Company",
    "keyName": "My Non-Expiring API Key"
  }'
```

### Method 3: Management API

If you're already authenticated, create additional non-expiring keys:

```bash
curl -X POST http://localhost:3000/api-keys \
  -H "Authorization: your-existing-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Another Non-Expiring Key"
  }'
```

## Fixing Existing Expired Keys

If you already have expired API keys, you can fix them using the provided utility script:

### List Expired Keys

```bash
node scripts/extend-api-keys.js list-expired
```

### Remove Expiration from All Keys

```bash
node scripts/extend-api-keys.js remove-expiration
```

### Remove Expiration for Specific User

```bash
node scripts/extend-api-keys.js remove-expiration user-id-here
```

### Reactivate Expired Keys

```bash
node scripts/extend-api-keys.js reactivate
```

## Verification

To verify that your API key doesn't have an expiration date, check the response when creating the key:

```json
{
  "success": true,
  "apiKey": {
    "id": "uuid",
    "name": "My Non-Expiring API Key",
    "key": "postiz_live_abcd1234...",
    "expiresAt": null,  // null means no expiration
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

## Best Practices

### Security Considerations

1. **Secure Storage**: Store API keys securely in environment variables or secure vaults
2. **Regular Rotation**: Even though keys don't expire, consider rotating them periodically for security
3. **Monitoring**: Monitor API key usage through the `lastUsedAt` and `lastUsedIp` fields
4. **Principle of Least Privilege**: Create separate keys for different applications/purposes

### Key Management

1. **Descriptive Names**: Use descriptive names for your API keys (e.g., "Production Bot", "Analytics Service")
2. **Documentation**: Document which keys are used by which services
3. **Cleanup**: Regularly review and delete unused keys
4. **Backup**: Keep a secure backup of critical API keys

### Monitoring

Monitor your API keys through the management endpoints:

```bash
# List all your API keys
curl -X GET http://localhost:3000/api-keys \
  -H "Authorization: your-api-key"
```

## Troubleshooting

### "Invalid API key" Error

If you're still getting the "invalid, expired, or inactive" error:

1. **Check Key Format**: Ensure your key starts with `postiz_live_` or `postiz_test_`
2. **Check Key Status**: Verify the key is active using the list endpoint
3. **Check User Status**: Ensure your user account is activated
4. **Check Organization**: Verify you have access to the organization

### Regenerating Keys

If you need to regenerate a key while keeping the same name:

```bash
curl -X POST http://localhost:3000/api-keys/key-id-here/regenerate \
  -H "Authorization: your-existing-api-key"
```

## Migration from Expiring Keys

If you're migrating from expiring keys to non-expiring keys:

1. **Create New Non-Expiring Keys**: Create new keys without expiration
2. **Update Your Applications**: Update your applications to use the new keys
3. **Test Thoroughly**: Ensure all integrations work with the new keys
4. **Remove Old Keys**: Delete the old expiring keys once migration is complete

## Environment Variables

Ensure these environment variables are properly set:

```bash
# Required for API key functionality
JWT_SECRET="your-jwt-secret"
API_KEY_REGISTRATION_TOKEN="your-registration-token"

# Database connection
DATABASE_URL="your-database-url"
```

## Support

If you encounter issues with non-expiring API keys:

1. Check the server logs for detailed error messages
2. Verify your environment configuration
3. Use the utility scripts to diagnose key status
4. Refer to the main API documentation for additional details

For additional support, refer to the main [API Key Authentication documentation](./API_KEY_AUTHENTICATION.md).

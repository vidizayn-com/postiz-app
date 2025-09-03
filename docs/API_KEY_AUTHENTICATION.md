# API Key Authentication System

This document describes the comprehensive API key authentication system implemented for Postiz, which allows users to generate and manage their own API keys for programmatic access to the platform.

## Overview

The API key authentication system provides:

1. **User-specific API Keys**: Each user can generate multiple API keys scoped to their organizations
2. **Secure Key Management**: API keys are hashed before storage and include security features like expiration dates
3. **Authentication Endpoints**: Login and registration endpoints that return API keys instead of JWT cookies
4. **Key Management**: Full CRUD operations for API key management
5. **Backward Compatibility**: Existing organization-level API keys continue to work

## Architecture

### Database Schema

The system introduces a new `UserApiKey` model:

```prisma
model UserApiKey {
  id             String       @id @default(uuid())
  user           User         @relation(fields: [userId], references: [id])
  userId         String
  organization   Organization @relation(fields: [organizationId], references: [id])
  organizationId String
  keyHash        String       @unique
  name           String
  lastUsedIp     String?
  lastUsedAt     DateTime?
  expiresAt      DateTime?
  isActive       Boolean      @default(true)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@unique([userId, organizationId, name])
  @@index([userId])
  @@index([organizationId])
  @@index([keyHash])
  @@index([isActive])
  @@index([expiresAt])
}
```

### API Key Format

API keys follow the format: `postiz_live_<32-char-random>` or `postiz_test_<32-char-random>`

- **Prefix**: Identifies the service and environment
- **Random Part**: 32-character random string for uniqueness and security
- **Storage**: Keys are hashed using bcrypt before database storage

## API Endpoints

### Authentication Endpoints

#### POST `/auth/api-key/login`
Login with email/password and receive an API key.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "provider": "LOCAL",
  "keyName": "My API Key",
  "expiresInDays": 30
}
```

**Response:**
```json
{
  "success": true,
  "apiKey": {
    "id": "uuid",
    "name": "My API Key",
    "key": "postiz_live_abcd1234...",
    "expiresAt": "2024-02-01T00:00:00Z",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "organization": {
    "id": "uuid",
    "name": "My Organization"
  }
}
```

#### POST `/auth/api-key/register`
Register a new user and receive an API key. If a user with the provided email already exists, this endpoint will behave like a login instead of throwing an error, validating the registration token and creating a new API key for the existing user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "your-registration-token-from-env",
  "provider": "LOCAL",
  "company": "My Company",
  "keyName": "My API Key",
  "expiresInDays": 30
}
```

**Important:** The `password` field should contain the registration token defined in the `API_KEY_REGISTRATION_TOKEN` environment variable, not an actual password.

**Note:** If the user already exists:
- The `company` field is ignored (existing organization is used)
- Registration token is validated against the `API_KEY_REGISTRATION_TOKEN` environment variable
- If an API key with the same name exists, that key is regenerated and returned with a new key value
- If the user has reached the maximum API key limit (10), the most recent key is regenerated and returned
- If no conflicts, creates a new API key for the existing user
- Always returns the actual API key value in the response (same as new user registration)
- Returns the same response format as a successful registration

### API Key Management Endpoints

All management endpoints require authentication via JWT (web session) or existing API key.

#### GET `/api-keys`
List all API keys for the authenticated user.

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "My API Key",
    "lastUsedAt": "2024-01-15T10:30:00Z",
    "lastUsedIp": "192.168.1.1",
    "expiresAt": "2024-02-01T00:00:00Z",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00Z"
  }
]
```

#### POST `/api-keys`
Create a new API key.

**Request Body:**
```json
{
  "name": "New API Key",
  "expiresInDays": 90
}
```

#### PUT `/api-keys/:id`
Update an API key.

**Request Body:**
```json
{
  "name": "Updated API Key Name",
  "isActive": false
}
```

#### POST `/api-keys/:id/regenerate`
Regenerate an API key (creates new key value).

#### DELETE `/api-keys/:id`
Delete an API key.

### Protected API Endpoints

#### Using User API Keys

All endpoints under `/api/v1/*` are protected by user API key authentication.

**Authentication Header:**
```
Authorization: postiz_live_abcd1234...
```
or
```
Authorization: Bearer postiz_live_abcd1234...
```

**Available Endpoints:**
- `GET /api/v1/posts` - List posts
- `POST /api/v1/posts` - Create posts
- `DELETE /api/v1/posts/:id` - Delete posts
- `GET /api/v1/integrations` - List integrations
- `POST /api/v1/upload` - Upload files

## Security Features

### Key Security
- **Hashing**: API keys are hashed using bcrypt before storage
- **Expiration**: Optional expiration dates for keys
- **Activity Tracking**: Last used IP and timestamp tracking
- **Active/Inactive Status**: Keys can be deactivated without deletion

### Rate Limiting
- Rate limiting is applied per organization
- Configurable limits via environment variables

### Validation
- Keys are validated on each request
- Expired keys are automatically deactivated
- User activation status is checked

## Migration and Compatibility

### Backward Compatibility
- Existing organization API keys (`/public/v1/*`) continue to work
- No breaking changes to existing authentication flows
- JWT-based web authentication remains unchanged

### Migration Path
1. Deploy new system alongside existing authentication
2. Users can generate API keys through new endpoints
3. Gradually migrate integrations to user-specific keys
4. Eventually deprecate organization-level keys (optional)

## Configuration

### Environment Variables
- `API_KEY_REGISTRATION_TOKEN`: **Required** - Static token for API key registration authentication
- `JWT_SECRET`: Used for key hashing and JWT signing
- `NODE_ENV`: Determines key prefix (live/test)
- `API_LIMIT`: Rate limiting configuration
- `STRIPE_SECRET_KEY`: If set, requires active subscription

#### API_KEY_REGISTRATION_TOKEN
This is a required environment variable that serves as a static authentication token for the API key registration endpoint.

**Setup:**
```bash
# Add to your .env file
API_KEY_REGISTRATION_TOKEN="your-secure-registration-token-here"
```

**Security Recommendations:**
- Use a long, random string (32+ characters)
- Keep it secret and don't expose it publicly
- Rotate it periodically for security
- Use different tokens for different environments

**Usage:**
The token should be passed in the `password` field of registration requests:
```json
{
  "email": "user@example.com",
  "password": "your-secure-registration-token-here",
  "provider": "LOCAL",
  "company": "My Company",
  "keyName": "My API Key"
}
```

### Database Migration
Run Prisma migration to add the new UserApiKey model:
```bash
npx prisma migrate dev --name add-user-api-keys
```

## Usage Examples

### cURL Examples

**Login and get API key:**
```bash
curl -X POST http://localhost:3000/auth/api-key/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "provider": "LOCAL",
    "keyName": "My API Key"
  }'
```

**Use API key to create a post:**
```bash
curl -X POST http://localhost:3000/api/v1/posts \
  -H "Authorization: postiz_live_abcd1234..." \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Hello World!",
    "integrations": ["integration-id"]
  }'
```

### JavaScript SDK Example

```javascript
import Postiz from '@postiz/node';

// Initialize with user API key
const postiz = new Postiz('postiz_live_abcd1234...');

// Create a post
const post = await postiz.post({
  content: 'Hello World!',
  integrations: ['integration-id']
});
```

## Error Handling

### Common Error Responses

**Invalid API Key:**
```json
{
  "error": "Invalid API key",
  "message": "The provided API key is invalid, expired, or inactive"
}
```

**No API Key:**
```json
{
  "error": "No API Key found",
  "message": "Please provide an API key in the Authorization header"
}
```

**User Not Activated:**
```json
{
  "error": "User not activated",
  "message": "User account is not activated"
}
```

## Monitoring and Maintenance

### Cleanup Tasks
- Expired keys are automatically deactivated
- Use `POST /api-keys/cleanup-expired` to manually clean up expired keys
- Monitor key usage through `lastUsedAt` and `lastUsedIp` fields

### Logging
- API key usage is logged with IP addresses
- Failed authentication attempts are logged
- Key generation and management operations are audited

## Testing

### Running Tests
```bash
# Run all tests
npm test

# Run API key specific tests
npm test -- --testNamePattern="ApiKey"
```

### Manual Testing
1. Start the development server: `npm run dev`
2. Register a new user with API key: `POST /auth/api-key/register`
3. Use the returned API key to access protected endpoints
4. Test key management operations through `/api-keys` endpoints

## Troubleshooting

### Common Issues

**"Maximum API keys allowed"**
- Users are limited to 10 API keys per organization
- Delete unused keys or increase the limit in `UserApiKeyService.MAX_KEYS_PER_USER`

**"API key name already exists"**
- Key names must be unique per user/organization
- Choose a different name or update the existing key

**"Invalid API key format"**
- Ensure the key starts with `postiz_live_` or `postiz_test_`
- Check for any whitespace or truncation in the key value

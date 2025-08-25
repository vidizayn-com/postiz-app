# Postiz API Key Authentication - Postman Collection

This directory contains Postman collection and environment files for testing the Postiz API Key Authentication endpoints.

## Files

- `Postiz_API_Key_Auth.postman_collection.json` - Main collection with API endpoints
- `Postiz_Development.postman_environment.json` - Environment variables for development

## Setup Instructions

### 1. Import Collection and Environment

1. Open Postman
2. Click "Import" button
3. Import both files:
   - `Postiz_API_Key_Auth.postman_collection.json`
   - `Postiz_Development.postman_environment.json`

### 2. Select Environment

1. In Postman, select "Postiz Development" from the environment dropdown (top right)
2. Verify the environment variables are loaded correctly

### 3. Configure Environment Variables

Before testing, update these environment variables as needed:

| Variable | Default Value | Description |
|----------|---------------|-------------|
| `base_url` | `http://localhost:3000` | API base URL |
| `test_email` | `test@example.com` | Email for testing |
| `test_password` | `password123` | Password for testing |
| `test_company` | `Test Company` | Company name for registration |
| `api_key_name` | `Test API Key` | Name for generated API keys |
| `expires_in_days` | `30` | API key expiration (1-365 days) |

## Usage Workflow

### Option 1: Register New User

1. **Register with API Key**
   - Run the "Register with API Key" request
   - This creates a new user, organization, and API key
   - The API key is automatically saved to the `api_key` environment variable

### Option 2: Login Existing User

1. **Login with API Key**
   - Update `test_email` and `test_password` with existing user credentials
   - Run the "Login with API Key" request
   - This generates a new API key for the existing user
   - The API key is automatically saved to the `api_key` environment variable

## ✅ Endpoints Status

**All API key authentication endpoints are now working correctly!** 🎉

### Authentication Endpoints
- ✅ `POST /auth/api-key/register` - Creates new user and returns API key
- ✅ `POST /auth/api-key/login` - Authenticates existing user and returns new API key

### Protected API Endpoints (Using API Key)
- ✅ `GET /api/v1/posts` - Fetch posts (requires startDate & endDate query params)
- ✅ `POST /api/v1/posts` - Create posts (requires integrations)
- ✅ `GET /api-keys` - List user's API keys
- ✅ `POST /api-keys` - Create new API key
- ✅ `PUT /api-keys/:id` - Update API key
- ✅ `DELETE /api-keys/:id` - Delete API key

### Testing Confirmed ✅
All endpoints have been successfully tested with working API key authentication!

### Testing Protected Endpoints

After obtaining an API key (via register or login), test the protected endpoints:

1. **Get Posts** - `GET /api/v1/posts`
2. **Get Integrations** - `GET /api/v1/integrations`
3. **Create Post** - `POST /api/v1/posts`

All protected endpoints automatically use the `{{api_key}}` variable in the Authorization header.

## API Key Format

Generated API keys follow this format:
- **Development**: `postiz_test_<32-char-random>`
- **Production**: `postiz_live_<32-char-random>`

## Authentication Methods

The API supports two authentication header formats:

```
Authorization: postiz_live_abcd1234...
```

or

```
Authorization: Bearer postiz_live_abcd1234...
```

## Request/Response Examples

### Register Request
```json
{
  "email": "user@example.com",
  "password": "password123",
  "provider": "LOCAL",
  "company": "My Company",
  "keyName": "My API Key",
  "expiresInDays": 30
}
```

### Successful Response
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

## Error Handling

Common error responses:

- **400 Bad Request**: Invalid request data
- **401 Unauthorized**: Invalid credentials or inactive user
- **403 Forbidden**: Registration disabled
- **409 Conflict**: Email already exists (registration)

## Environment Setup

Make sure your Postiz development server is running:

```bash
npm run dev
```

The server should be accessible at `http://localhost:3000` (or update the `base_url` environment variable accordingly).

## Security Notes

- API keys are sensitive credentials - treat them securely
- Keys can expire based on the `expiresInDays` setting
- Keys can be deactivated without deletion
- Each user can have multiple API keys with different names
- Only LOCAL provider is supported for API key authentication
- API keys use deterministic encryption for secure validation
- Keys are stored as encrypted hashes in the database

## Troubleshooting

1. **"Invalid credentials"**: Check email/password combination
2. **"User account is not activated"**: User needs to be activated first
3. **"Registration is disabled"**: Check server configuration
4. **"Email already exists"**: Use login instead of register, or different email
5. **Connection refused**: Ensure the development server is running on the correct port

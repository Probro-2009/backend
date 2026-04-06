# Auth Testing Playbook for T.P

## Test Credentials
- Demo User 1: username=`alice`, email=`alice@tp.com`, password=`password123`
- Demo User 2: username=`marcus`, email=`marcus@tp.com`, password=`password123`
- Demo User 3: username=`nova`, email=`nova@tp.com`, password=`password123`

## Auth Endpoints
- POST /api/auth/register - Register with username, email, password
- POST /api/auth/login - Login with identifier (username or email) + password
- GET /api/auth/me - Get current user (requires Bearer token)

## Testing Steps
1. Register a new user
2. Login with username
3. Login with email
4. Check /auth/me with token
5. Try invalid credentials
6. Try duplicate username registration

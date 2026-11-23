# Centralized Authentication Deployment Guide

This guide covers the deployment of the centralized authentication system with login.utkrixtech.com as the dedicated authentication subdomain.

## Table of Contents

1. [DNS Configuration](#dns-configuration)
2. [Backend Deployment](#backend-deployment)
3. [Authentication Frontend Deployment](#authentication-frontend-deployment)
4. [Environment Variables](#environment-variables)
5. [CORS Configuration](#cors-configuration)
6. [Cookie Configuration](#cookie-configuration)
7. [HTTPS Requirements](#https-requirements)
8. [Authentication Flow](#authentication-flow)
9. [Testing Production Authentication](#testing-production-authentication)
10. [Migration Steps](#migration-steps)

## DNS Configuration

### Required DNS Records

For the domain `utkrixtech.com`, configure the following DNS records:

```
# Main website
utkrixtech.com          A      <your-server-ip>
www.utkrixtech.com      CNAME  utkrixtech.com

# Authentication subdomain
login.utkrixtech.com    A      <your-auth-frontend-ip>

# Backend API
api.utkrixtech.com      A      <your-backend-api-ip>

# Employee portal
employees.utkrixtech.com A      <your-employee-portal-ip>

# Admin portal
admin.utkrixtech.com    A      <your-admin-portal-ip>
```

### Notes

- Replace `<your-server-ip>` with your actual server IP addresses
- If using Vercel for the frontend, Vercel will provide the appropriate DNS configuration
- For API backend, you may use a load balancer or direct server IP
- TTL (Time To Live) can be set to 300-600 seconds for faster updates during deployment

## Backend Deployment

### Prerequisites

- Node.js 18+ installed
- MySQL database running
- SSL/TLS certificate configured

### Deployment Steps

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd elearning-master-backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run database migration**:
   ```bash
   npx prisma migrate deploy
   ```

4. **Configure environment variables** (see [Environment Variables](#environment-variables))

5. **Start the server**:
   ```bash
   npm start
   ```

### Using PM2 for Process Management

```bash
# Install PM2 globally
npm install -g pm2

# Start the application
pm2 start server.js --name "utkrix-api"

# Enable auto-restart on system boot
pm2 startup
pm2 save
```

### Nginx Configuration Example

```nginx
server {
    listen 443 ssl http2;
    server_name api.utkrixtech.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Authentication Frontend Deployment

### Vercel Deployment

1. **Create a new Vercel project**:
   - Go to [vercel.com](https://vercel.com)
   - Import the `login-frontend` directory
   - Set project name to `login-abc-com`

2. **Configure environment variables** in Vercel:
   ```
   VITE_API_URL=https://api.utkrixtech.com
   VITE_MAIN_SITE_URL=https://utkrixtech.com
   VITE_EMPLOYEES_URL=https://employees.utkrixtech.com
   VITE_ADMIN_URL=https://admin.utkrixtech.com
   ```

3. **Configure custom domain**:
   - Add `login.utkrixtech.com` as a custom domain
   - Vercel will provide DNS records to add

4. **Deploy**:
   ```bash
   cd login-frontend
   npm install
   vercel --prod
   ```

### Alternative: Docker Deployment

```dockerfile
# login-frontend/Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## Environment Variables

### Backend Environment Variables

Create a `.env` file in the backend directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=production
LOG_LEVEL=info

# Database
MYSQL_URL=mysql://USER:PASSWORD@127.0.0.1:3306/utkrix

# JWT Secrets (minimum 32 bytes each - generate with: openssl rand -base64 32)
JWT_SECRET=your_production_jwt_secret_min_32_bytes
JWT_ACCESS_SECRET=your_access_secret_min_32_bytes
JWT_REFRESH_SECRET=your_refresh_secret_min_32_bytes

# CORS Origins (comma-separated, no spaces)
CORS_ORIGINS=https://utkrixtech.com,https://www.utkrixtech.com,https://login.utkrixtech.com,https://employees.utkrixtech.com,https://admin.utkrixtech.com

# Cookie Configuration
COOKIE_DOMAIN=.utkrixtech.com
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax

# Domain Configuration
AUTH_DOMAIN=https://login.utkrixtech.com
FRONTEND_URL=https://utkrixtech.com

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=UtkriX Technologies <your-email@gmail.com>
EMAIL_BRAND_NAME=UtkriX Technologies

# OAuth Configuration (if using OAuth)
OAUTH_CALLBACK_BASE_URL=https://api.utkrixtech.com/api/v1/auth/oauth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
FACEBOOK_GRAPH_VERSION=v24.0
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

### Frontend Environment Variables

Create a `.env.production` file in the login-frontend directory:

```env
VITE_API_URL=https://api.utkrixtech.com
VITE_MAIN_SITE_URL=https://utkrixtech.com
VITE_EMPLOYEES_URL=https://employees.utkrixtech.com
VITE_ADMIN_URL=https://admin.utkrixtech.com
```

### Security Notes

- Never commit `.env` files to version control
- Use different secrets for development and production
- Rotate secrets periodically
- Use environment-specific secret management (AWS Secrets Manager, HashiCorp Vault, etc.)

## CORS Configuration

### Current CORS Configuration

The backend is configured to:

1. **Allow explicit origins only** (no wildcard in production)
2. **Support credentials** (cookies)
3. **Allow required HTTP methods**: GET, POST, PUT, PATCH, DELETE, OPTIONS
4. **Allow required headers**: Content-Type, Authorization, X-CSRF-Token
5. **Handle preflight OPTIONS requests**

### Allowed Origins

Production origins must be explicitly listed:
- `https://utkrixtech.com`
- `https://www.utkrixtech.com`
- `https://login.utkrixtech.com`
- `https://employees.utkrixtech.com`
- `https://admin.utkrixtech.com`

### Testing CORS

```bash
# Test preflight request
curl -X OPTIONS https://api.utkrixtech.com/api/v1/auth/login \
  -H "Origin: https://login.utkrixtech.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v
```

## Cookie Configuration

### Cookie Settings

| Setting | Development | Production |
|---------|-------------|------------|
| Domain | (not set) | `.utkrixtech.com` |
| HttpOnly | `true` | `true` |
| Secure | `false` | `true` |
| SameSite | `lax` | `lax` |
| Path | `/` | `/` |
| Max-Age | 7 days | 7 days |

### Cookie Names

- `refreshToken` - HttpOnly refresh token for obtaining new access tokens
- `csrf_token` - CSRF token for protecting state-changing requests

### Cross-Subdomain Cookie Sharing

With `COOKIE_DOMAIN=.utkrixtech.com`, cookies set on `login.utkrixtech.com` will be accessible on:
- `utkrixtech.com`
- `www.utkrixtech.com`
- `employees.utkrixtech.com`
- `admin.utkrixtech.com`

## HTTPS Requirements

### SSL/TLS Certificates

HTTPS is **required** for production deployment because:

1. **Cookie security**: `COOKIE_SECURE=true` requires HTTPS
2. **Browser security**: Modern browsers block sensitive features on HTTP
3. **CSRF protection**: Requires secure context
4. **Data protection**: Passwords and tokens must be encrypted in transit

### Certificate Options

1. **Let's Encrypt** (Free):
   ```bash
   sudo certbot --nginx -d api.utkrixtech.com -d login.utkrixtech.com
   ```

2. **Cloudflare SSL** (Free tier available)

3. **Commercial certificates** (DigiCert, Comodo, etc.)

### HTTPS Redirect

Configure all HTTP traffic to redirect to HTTPS:

```nginx
server {
    listen 80;
    server_name utkrixtech.com www.utkrixtech.com login.utkrixtech.com api.utkrixtech.com;
    return 301 https://$host$request_uri;
}
```

## Authentication Flow

### 1. User Attempts to Access Protected Resource

```
User → employees.utkrixtech.com/dashboard
```

### 2. Redirect to Login

```
employees.utkrixtech.com → redirect to login.utkrixtech.com?redirect=https://employees.utkrixtech.com/dashboard
```

### 3. User Authenticates

```
User → login.utkrixtech.com/login
User enters credentials
POST https://api.utkrixtech.com/api/v1/auth/login
```

### 4. Backend Sets Cookies

```
Backend response includes:
- accessToken in response body (15 min expiry)
- refreshToken in HttpOnly cookie (7 days expiry)
- csrf_token in cookie (24 hours expiry)
```

### 5. Redirect Back

```
login.utkrixtech.com → redirect to https://employees.utkrixtech.com/dashboard
```

### 6. Access Protected Resource

```
employees.utkrixtech.com → GET https://api.utkrixtech.com/api/v1/dashboard
Headers: Authorization: Bearer <accessToken>
```

### 7. Token Refresh (if needed)

```
If accessToken expires:
Frontend → POST https://api.utkrixtech.com/api/v1/auth/refresh
Headers: X-CSRF-Token: <csrf_token>
Cookie: refreshToken=<refreshToken>

Backend response:
- New accessToken
- New refreshToken (rotation)
```

### 8. Logout

```
User clicks logout
Frontend → POST https://api.utkrixtech.com/api/v1/auth/logout
Headers: X-CSRF-Token: <csrf_token>
Cookie: refreshToken=<refreshToken>

Backend clears cookies and revokes tokens
```

## Testing Production Authentication

### 1. Test DNS Resolution

```bash
# Test each subdomain
nslookup login.utkrixtech.com
nslookup api.utkrixtech.com
nslookup employees.utkrixtech.com
nslookup admin.utkrixtech.com
```

### 2. Test HTTPS

```bash
# Test SSL certificate
curl -I https://login.utkrixtech.com
curl -I https://api.utkrixtech.com
```

### 3. Test Registration

```bash
curl -X POST https://api.utkrixtech.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -H "Origin: https://login.utkrixtech.com" \
  -d '{"name":"Test User","email":"test@example.com","password":"testpassword123456"}' \
  -v
```

### 4. Test Login

```bash
curl -X POST https://api.utkrixtech.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: https://login.utkrixtech.com" \
  -c cookies.txt \
  -d '{"email":"test@example.com","password":"testpassword123456"}' \
  -v
```

### 5. Test Token Refresh

```bash
curl -X POST https://api.utkrixtech.com/api/v1/auth/refresh \
  -H "Origin: https://login.utkrixtech.com" \
  -b cookies.txt \
  -c cookies.txt \
  -v
```

### 6. Test Logout

```bash
curl -X POST https://api.utkrixtech.com/api/v1/auth/logout \
  -H "Origin: https://login.utkrixtech.com" \
  -b cookies.txt \
  -c cookies.txt \
  -v
```

### 7. Test CORS with Different Origins

```bash
# Test from main site
curl -X POST https://api.utkrixtech.com/api/v1/auth/login \
  -H "Origin: https://utkrixtech.com" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpassword123456"}' \
  -v

# Test from unauthorized origin (should fail)
curl -X POST https://api.utkrixtech.com/api/v1/auth/login \
  -H "Origin: https://evil.com" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpassword123456"}' \
  -v
```

### 8. Test Cross-Subdomain Cookies

1. Login on `login.utkrixtech.com`
2. Navigate to `employees.utkrixtech.com`
3. Check that cookies are accessible
4. Verify API calls work without re-authentication

## Migration Steps

### Phase 1: Database Migration

1. **Backup existing database**:
   ```bash
   mysqldump -u user -p utkrix > backup.sql
   ```

2. **Run migration**:
   ```bash
   cd elearning-master-backend
   npx prisma migrate deploy
   ```

3. **Verify migration**:
   ```bash
   npx prisma studio
   # Check that refresh_tokens table exists
   ```

### Phase 2: Backend Deployment

1. **Deploy backend with new code**
2. **Update environment variables**
3. **Restart backend service**
4. **Test new endpoints**:
   - `/api/v1/auth/refresh`
   - `/api/v1/auth/logout`
   - `/api/v1/auth/me`

### Phase 3: Frontend Deployment

1. **Deploy login.utkrixtech.com frontend**
2. **Configure DNS**
3. **Test authentication flow**
4. **Verify cookie behavior**

### Phase 4: Update Existing Frontends

1. **Update main website** to redirect to login.utkrixtech.com
2. **Update employee portal** to use centralized auth
3. **Update admin portal** to use centralized auth
4. **Remove local auth logic from each frontend**

### Phase 5: User Migration

1. **Notify users** of authentication changes
2. **Set grace period** for old tokens to expire
3. **Monitor** for authentication issues
4. **Provide support** for users needing to re-authenticate

### Phase 6: Cleanup

1. **Remove old auth endpoints** (if any)
2. **Clean up old localStorage/sessionStorage code**
3. **Update documentation**
4. **Archive old authentication code**

## Troubleshooting

### Issue: Cookies not being set

**Symptoms**: Login succeeds but no cookies are visible

**Solutions**:
1. Verify HTTPS is working (`COOKIE_SECURE=true` requires HTTPS)
2. Check `COOKIE_DOMAIN` is set correctly
3. Verify browser is not blocking third-party cookies
4. Check SameSite policy compatibility

### Issue: CORS errors

**Symptoms**: Browser console shows CORS errors

**Solutions**:
1. Verify origin is in `CORS_ORIGINS` list
2. Check that `credentials: true` is set in CORS config
3. Verify preflight OPTIONS requests are handled
4. Check that no wildcard (`*`) is used with credentials

### Issue: CSRF token errors

**Symptoms**: POST requests fail with 403

**Solutions**:
1. Verify CSRF token is being sent in `X-CSRF-Token` header
2. Check that CSRF token cookie is being set
3. Verify CSRF token matches between cookie and header
4. Check that CSRF validation is only applied in production

### Issue: Token refresh not working

**Symptoms**: Access token expires but refresh fails

**Solutions**:
1. Verify refresh token cookie is present
2. Check that refresh token hasn't expired
3. Verify `JWT_REFRESH_SECRET` is set correctly
4. Check refresh token rotation logic

### Issue: Cross-subdomain cookies not sharing

**Symptoms**: Cookies set on login.utkrixtech.com not accessible on other subdomains

**Solutions**:
1. Verify `COOKIE_DOMAIN=.utkrixtech.com` (with leading dot)
2. Check that all subdomains use HTTPS
3. Verify SameSite policy allows cross-subdomain
4. Check browser privacy settings

## Security Checklist

- [ ] HTTPS enabled on all domains
- [ ] CORS origins explicitly listed (no wildcard)
- [ ] Cookies are HttpOnly
- [ ] Cookies are Secure (HTTPS only)
- [ ] CSRF protection enabled
- [ ] JWT secrets are at least 32 bytes
- [ ] Separate secrets for access and refresh tokens
- [ ] Rate limiting enabled on auth endpoints
- [ ] Password hashing uses bcrypt with cost 10
- [ ] Token versioning implemented
- [ ] Refresh token rotation implemented
- [ ] Session revocation on logout
- [ ] Environment variables not committed to git
- [ ] Database backups configured
- [ ] Logging and monitoring enabled
- [ ] Security headers configured (Helmet)
- [ ] Input validation enabled
- [ ] SQL injection protection (Prisma)
- [ ] XSS protection (input sanitization)

## Support

For deployment issues or questions:
1. Check the implementation plan: `AUTH_IMPLEMENTATION_PLAN.md`
2. Review the test files for examples
3. Check backend logs for error messages
4. Verify environment variables are correctly set
5. Test individual components in isolation

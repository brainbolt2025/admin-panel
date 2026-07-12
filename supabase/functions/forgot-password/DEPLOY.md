# Deploy Forgot Password Function

## Quick Deployment Steps

1. **Set Environment Variables in Supabase Dashboard:**
   - Go to Project Settings → Edge Functions → Secrets
   - Add/verify these secrets:
     - `MAILGUN_DOMAIN` (e.g., `mg.asine.app`)
     - `MAILGUN_API_KEY` (your private API key)
     - `MAILGUN_REGION` (optional, default: `us`)
     - `APP_DEEP_LINK_SCHEME` (optional, e.g., `asine://`)
     - `TENANT_APP_DEEP_LINK_SCHEME` (optional)
     - `APP_URL` (optional, e.g., `https://app.asine.app`)
     - `TENANT_APP_URL` (optional)

2. **Deploy the Function:**
   ```bash
   supabase functions deploy forgot-password
   ```

   Or use Supabase Dashboard:
   - Go to Edge Functions
   - Click "Create a new function"
   - Name: `forgot-password`
   - Paste the code from `index.ts`
   - Click "Deploy"

3. **Test the Function:**
   ```bash
   curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/forgot-password \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -d '{"email": "test@example.com"}'
   ```

4. **Update Frontend:**
   - Add "Forgot Password" link to login page
   - Call the function when user requests password reset
   - Handle the reset link redirect in your app

## Required Secrets

| Secret | Required | Description |
|--------|----------|-------------|
| `MAILGUN_DOMAIN` | Yes | Your Mailgun domain |
| `MAILGUN_API_KEY` | Yes | Your Mailgun private API key |
| `MAILGUN_REGION` | No | `us` or `eu` (default: `us`) |
| `APP_DEEP_LINK_SCHEME` | No | Custom URL scheme for mobile |
| `TENANT_APP_DEEP_LINK_SCHEME` | No | Tenant-specific deep link |
| `APP_URL` | No | Base URL for web app |
| `TENANT_APP_URL` | No | Tenant-specific app URL |

## Post-Deployment Checklist

- [ ] Function deployed successfully
- [ ] Mailgun secrets configured
- [ ] Test email sent successfully
- [ ] Deep link configuration verified (if using mobile app)
- [ ] Frontend "Forgot Password" button calls this function
- [ ] Reset link redirects correctly
- [ ] Password reset flow works end-to-end




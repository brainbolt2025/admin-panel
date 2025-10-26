# Deployment Guide for Supabase Edge Function

## Installing Supabase CLI

Since global npm installation is not supported, you need to use one of these methods:

### Option 1: Using Homebrew (macOS/Linux)
```bash
brew install supabase/tap/supabase
```

### Option 2: Using Scoop (Windows)
```bash
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### Option 3: Using npm with npx (No installation required)
```bash
# Just use npx for one-time commands
npx supabase functions deploy invite-pm
```

### Option 4: Download binary directly
Visit: https://github.com/supabase/cli/releases

## Deploying the Function

Once you have the CLI installed:

```bash
# Navigate to your project directory
cd "C:\Users\juego\OneDrive\Documentos\ideas\OMS app\admin panel\admin-panel"

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref qmhmgjzkpfzxfjdurigu

# Deploy the function
supabase functions deploy invite-pm
```

## Alternative: Deploy via Supabase Dashboard

If CLI installation doesn't work, you can also:

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to your project
3. Go to "Edge Functions" section
4. Click "New Function"
5. Copy and paste the contents of `supabase/functions/invite-pm/index.ts`
6. Click "Deploy"

## Testing the Function

After deployment, you can test it from the InvitePM form in your React app. The frontend is already configured to call the function endpoint.

## Verify Deployment

Check that your function is deployed by visiting:
```
https://qmhmgjzkpfzxfjdurigu.supabase.co/functions/v1/invite-pm
```

You should see a CORS preflight response or an error about missing auth (which means it's deployed successfully).

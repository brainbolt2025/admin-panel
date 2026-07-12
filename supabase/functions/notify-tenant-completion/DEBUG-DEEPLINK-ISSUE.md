# Debug: Work Order Completion Email Button Not Working

## Issue
The "View Completed Work Order" button in the completion email does nothing when clicked, even though the app handles `asine://work-order/{work_order_id}` deep links.

## Quick Checks

### 1. Check Supabase Edge Function Logs

Go to Supabase Dashboard → Edge Functions → `notify-tenant-completion` → Logs

Look for these log lines when an email is sent:
```
=== Work Order Completion Deep Link ===
TENANT_APP_DEEP_LINK_SCHEME (raw): ...
TENANT_APP_DEEP_LINK_SCHEME (normalized): ...
Generated work order link: ...
```

**Expected output if configured correctly:**
```
TENANT_APP_DEEP_LINK_SCHEME (raw): asine://
TENANT_APP_DEEP_LINK_SCHEME (normalized): asine://
Generated work order link: asine://work-order/{work_order_id}
```

**If you see:**
```
TENANT_APP_DEEP_LINK_SCHEME (raw): NOT SET
Generated work order link: https://app.asine.app/work-order/{work_order_id}
```
**→ The environment variable is NOT set!**

### 2. Verify Environment Variable is Set

In Supabase Dashboard:
1. Go to **Project Settings** → **Edge Functions** → **Secrets**
2. Check if `TENANT_APP_DEEP_LINK_SCHEME` exists
3. Verify its value is: `asine://`

**If it's missing or wrong:**
- Add/Update: `TENANT_APP_DEEP_LINK_SCHEME` = `asine://`
- Redeploy the function after setting it

### 3. Test the Email Link

**Option A: View Email Source**
1. Open the completion email
2. View email source/HTML
3. Find the `<a href="...">` tag for "View Completed Work Order"
4. Check what URL is actually in the `href` attribute

**Option B: Copy Link Text**
1. Right-click the button in the email
2. Copy link address/URL
3. Check if it's `asine://work-order/{id}` or a web URL

### 4. Common Issues and Fixes

#### Issue: Environment Variable Not Set
**Symptom:** Link is `https://app.asine.app/work-order/{id}` instead of `asine://work-order/{id}`

**Fix:**
```bash
# Set via Supabase Dashboard (Project Settings → Edge Functions → Secrets)
# OR via CLI:
supabase secrets set TENANT_APP_DEEP_LINK_SCHEME=asine://
```

Then **redeploy** the function:
```bash
supabase functions deploy notify-tenant-completion
```

#### Issue: Email Client Blocking Custom URL Scheme
**Symptom:** Link looks correct but nothing happens when clicked

**Possible causes:**
- Email client (Gmail, Outlook, etc.) blocks custom URL schemes for security
- Mobile email client requires additional permissions

**Fixes:**
1. **Test on different email clients** (native email app vs Gmail app)
2. **Try copying the link** from email and pasting it in a browser/notes app first
3. **Use Universal Links** instead of custom URL schemes (more complex but more reliable)

#### Issue: Deep Link Format Mismatch
**Symptom:** App handles `asine://work-order/{id}` but link format is slightly different

**Check:**
- Link should be exactly: `asine://work-order/{work_order_id}`
- No extra slashes: NOT `asine:///work-order/{id}`
- No missing parts: NOT `asine://workorder/{id}` (missing hyphen)

### 5. Test Deep Link Directly

**Android:**
```bash
adb shell am start -W -a android.intent.action.VIEW -d "asine://work-order/YOUR_WORK_ORDER_ID" com.yourapp.package
```

**iOS Simulator:**
```bash
xcrun simctl openurl booted "asine://work-order/YOUR_WORK_ORDER_ID"
```

**If this works but email doesn't:** The issue is with the email link, not the app.

### 6. Verify Function is Using Deep Link

After deploying, trigger a completion email and check logs:

1. Complete a work order via admin panel
2. Check Supabase Edge Function logs immediately
3. Look for: `Generated work order link: asine://work-order/...`

If you see a web URL instead, the environment variable isn't being read correctly.

### 7. Temporary Workaround: Always Use Deep Link

If the environment variable check is failing, you can hardcode it temporarily:

```typescript
// Temporary fix - force deep link
const workOrderLink = `asine://work-order/${work_order_id}`
```

**Note:** Only use this for testing. Proper fix is to set the environment variable.

## Most Likely Cause

**The `TENANT_APP_DEEP_LINK_SCHEME` environment variable is NOT set in Supabase**, so the function is falling back to the web URL `https://app.asine.app/work-order/{id}`, which won't open your mobile app.

## Solution

1. Set the environment variable:
   - Supabase Dashboard → Project Settings → Edge Functions → Secrets
   - Add: `TENANT_APP_DEEP_LINK_SCHEME` = `asine://`

2. Redeploy the function:
   ```bash
   supabase functions deploy notify-tenant-completion
   ```

3. Test with a new completion email (old emails will still have the wrong link)

4. Check logs to confirm the correct link is being generated

## Still Not Working?

If the environment variable is set correctly and logs show the right link, but it still doesn't work:

1. **Check email client**: Some email clients strip or modify custom URL schemes
2. **Check app deep link configuration**: Verify AndroidManifest.xml / Info.plist matches the format
3. **Check app logs**: See if the deep link is being received but not handled correctly
4. **Try Universal Links**: Consider using HTTPS deep links with proper domain verification


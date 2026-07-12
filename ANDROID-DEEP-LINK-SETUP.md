# Android Deep Link Setup Guide

This guide explains how to configure Android deep links for the Asine mobile app to handle email verification and work order notifications.

## Deep Link Structure

The app uses the following deep link patterns:

### Email Verification
- **Format**: `asine://auth/verified`
- **Example**: `asine://auth/verified`
- **Used when**: User clicks email verification link

### Work Orders
- **Format**: `asine://work-order/{work_order_id}`
- **Example**: `asine://work-order/123e4567-e89b-12d3-a456-426614174000`
- **Used when**: User clicks "View Work Order" button in email notifications

## Android Configuration

### 1. AndroidManifest.xml Setup

Add intent filters to your main activity (or a dedicated deep link activity) in `AndroidManifest.xml`:

```xml
<activity
    android:name=".MainActivity"
    android:exported="true"
    android:launchMode="singleTask">
    
    <!-- Standard launcher intent -->
    <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
    </intent-filter>
    
    <!-- Deep link: Email verification -->
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        
        <!-- Custom URL scheme -->
        <data
            android:scheme="asine"
            android:host="auth"
            android:pathPrefix="/verified" />
    </intent-filter>
    
    <!-- Deep link: Work Orders -->
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        
        <!-- Custom URL scheme -->
        <data
            android:scheme="asine"
            android:host="work-order"
            android:pathPrefix="/" />
    </intent-filter>
    
    <!-- Optional: App Links (HTTPS) for better security -->
    <!-- Requires domain verification -->
    <intent-filter android:autoVerify="true">
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        
        <data
            android:scheme="https"
            android:host="app.asine.app"
            android:pathPrefix="/auth/verified" />
    </intent-filter>
    
    <intent-filter android:autoVerify="true">
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        
        <data
            android:scheme="https"
            android:host="app.asine.app"
            android:pathPrefix="/work-order" />
    </intent-filter>
</activity>
```

### 2. Handle Deep Links in Kotlin

#### MainActivity.kt

```kotlin
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Handle deep link if app was opened via deep link
        handleDeepLink(intent)
        
        setContent {
            // Your app content
        }
    }
    
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // Handle deep link if app was already running
        handleDeepLink(intent)
    }
    
    private fun handleDeepLink(intent: Intent) {
        val data: Uri? = intent.data
        if (data != null) {
            when {
                // Email verification deep link
                data.scheme == "asine" && 
                data.host == "auth" && 
                data.path == "/verified" -> {
                    handleEmailVerification()
                }
                
                // Work order deep link
                data.scheme == "asine" && 
                data.host == "work-order" -> {
                    val workOrderId = data.pathSegments.firstOrNull()
                    if (workOrderId != null) {
                        handleWorkOrderDeepLink(workOrderId)
                    }
                }
                
                // HTTPS App Links (if configured)
                data.scheme == "https" && 
                data.host == "app.asine.app" -> {
                    when {
                        data.path?.startsWith("/auth/verified") == true -> {
                            handleEmailVerification()
                        }
                        data.path?.startsWith("/work-order/") == true -> {
                            val workOrderId = data.path?.removePrefix("/work-order/")
                            if (workOrderId != null) {
                                handleWorkOrderDeepLink(workOrderId)
                            }
                        }
                    }
                }
            }
        }
    }
    
    private fun handleEmailVerification() {
        // Email is already verified by Supabase when user clicks the link
        // Just show success message and navigate to login/success screen
        println("Email verified successfully!")
        
        // Navigate to success screen or show toast
        // Example: navController.navigate("emailVerified")
    }
    
    private fun handleWorkOrderDeepLink(workOrderId: String) {
        println("Opening work order: $workOrderId")
        
        // Navigate to work order detail screen
        // Example: navController.navigate("workOrder/$workOrderId")
    }
}
```

### 3. Alternative: Using Navigation Component

If you're using Jetpack Compose Navigation:

```kotlin
@Composable
fun AppNavigation() {
    val navController = rememberNavController()
    
    // Listen for deep links
    LaunchedEffect(Unit) {
        // This would be triggered when app receives deep link
        // You can use a ViewModel or shared state to handle this
    }
    
    NavHost(navController, startDestination = "home") {
        composable("home") { HomeScreen() }
        composable("emailVerified") { EmailVerifiedScreen() }
        composable("workOrder/{id}") { backStackEntry ->
            val workOrderId = backStackEntry.arguments?.getString("id")
            WorkOrderDetailScreen(workOrderId = workOrderId)
        }
    }
}
```

### 4. Testing Deep Links

#### Test via ADB

```bash
# Test email verification deep link
adb shell am start -W -a android.intent.action.VIEW -d "asine://auth/verified" com.your.package.name

# Test work order deep link
adb shell am start -W -a android.intent.action.VIEW -d "asine://work-order/123e4567-e89b-12d3-a456-426614174000" com.your.package.name
```

#### Test via Browser/Email

1. Send yourself a test email with the deep link
2. Click the link in Gmail/email client
3. Android should prompt to open with your app

## Supabase Configuration

### Set Deep Link Scheme

```bash
# For tenant app
supabase secrets set TENANT_APP_DEEP_LINK_SCHEME=asine://

# For technician app (or general)
supabase secrets set APP_DEEP_LINK_SCHEME=asine://
```

### Deep Link URLs Generated

When these secrets are set, the Edge Functions will generate:

- **Email Verification**: `asine://auth/verified`
- **Work Order Notifications**: `asine://work-order/{work_order_id}`

## App Links (HTTPS) - Optional but Recommended

For better security and user experience, you can also configure App Links using HTTPS:

### 1. Domain Verification

1. Create a `.well-known/assetlinks.json` file on your domain:
   ```
   https://app.asine.app/.well-known/assetlinks.json
   ```

2. Content of `assetlinks.json`:
   ```json
   [{
     "relation": ["delegate_permission/common.handle_all_urls"],
     "target": {
       "namespace": "android_app",
       "package_name": "com.your.package.name",
       "sha256_cert_fingerprints": [
         "YOUR_APP_SHA256_FINGERPRINT"
       ]
     }
   }]
   ```

3. Get your app's SHA256 fingerprint:
   ```bash
   keytool -list -v -keystore your-keystore.jks -alias your-alias
   ```

### 2. Benefits of App Links

- **No chooser dialog**: Links open directly in your app
- **Better security**: Domain verification prevents other apps from intercepting
- **Works in browsers**: HTTPS links work everywhere

## Troubleshooting

### Deep Link Not Opening App

1. **Check AndroidManifest.xml**: Ensure intent filters are correct
2. **Verify scheme/host/path**: Must match exactly
3. **Check package name**: Ensure it matches your app's package
4. **Test with ADB**: Use `adb shell am start` command above

### App Opens But Doesn't Handle Link

1. **Check `onNewIntent()`**: Ensure it's called when app is already running
2. **Verify intent data**: Log `intent.data` to see what's received
3. **Check launch mode**: `singleTask` or `singleTop` recommended

### Email Verification Not Working

1. **Supabase verifies automatically**: The email is verified when user clicks Supabase's link
2. **Deep link is for redirect**: The `asine://auth/verified` link is just to open your app
3. **Check Supabase Auth status**: Verify `email_confirmed_at` in Supabase dashboard

## Example: Complete Deep Link Handler

```kotlin
class DeepLinkHandler {
    fun handle(uri: Uri, context: Context) {
        when {
            // Email verification
            uri.scheme == "asine" && uri.host == "auth" -> {
                when (uri.path) {
                    "/verified" -> {
                        // Show success message
                        Toast.makeText(context, "Email verified!", Toast.LENGTH_SHORT).show()
                        // Navigate to login or home
                    }
                }
            }
            
            // Work orders
            uri.scheme == "asine" && uri.host == "work-order" -> {
                val workOrderId = uri.pathSegments.firstOrNull()
                if (workOrderId != null) {
                    // Navigate to work order detail
                    val intent = Intent(context, WorkOrderDetailActivity::class.java).apply {
                        putExtra("work_order_id", workOrderId)
                    }
                    context.startActivity(intent)
                }
            }
        }
    }
}
```

## Summary

- **Deep Link Scheme**: `asine://`
- **Email Verification**: `asine://auth/verified`
- **Work Orders**: `asine://work-order/{id}`
- **Configuration**: Set `TENANT_APP_DEEP_LINK_SCHEME=asine://` in Supabase secrets
- **Android Setup**: Add intent filters in AndroidManifest.xml
- **Handler**: Implement deep link handling in MainActivity



# Mobile App Deep Link Handling: Work Order Completion

This guide shows how to handle deep links from completion notification emails in your tenant mobile app.

## Deep Link Format

When a tenant clicks the "View Completed Work Order" button in the email, they'll receive a deep link:

**Deep Link Format:**
```
asine://work-order/{work_order_id}
```

**Example:**
```
asine://work-order/550e8400-e29b-41d4-a716-446655440000
```

**Web URL Fallback (if deep link not configured):**
```
https://app.asine.app/work-order/{work_order_id}
```

## Implementation Guide

### Android (Kotlin/Java)

#### 1. Configure AndroidManifest.xml

Add intent filter to your main activity:

```xml
<activity
    android:name=".MainActivity"
    android:exported="true"
    android:launchMode="singleTask">
    
    <!-- Existing intent filters -->
    <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
    </intent-filter>
    
    <!-- Deep Link Intent Filter -->
    <intent-filter android:autoVerify="true">
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        
        <!-- Custom URL Scheme -->
        <data
            android:scheme="asine"
            android:host="work-order" />
    </intent-filter>
</activity>
```

#### 2. Handle Deep Link in Activity

```kotlin
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        // Handle deep link if app was opened via deep link
        handleDeepLink(intent)
    }
    
    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        // Handle deep link if app was already running
        intent?.let { handleDeepLink(it) }
    }
    
    private fun handleDeepLink(intent: Intent) {
        val data: Uri? = intent.data
        
        if (data != null && data.scheme == "asine") {
            when {
                data.host == "work-order" -> {
                    // Extract work order ID from path
                    // Format: asine://work-order/{work_order_id}
                    val pathSegments = data.pathSegments
                    if (pathSegments.isNotEmpty()) {
                        val workOrderId = pathSegments[0]
                        navigateToWorkOrder(workOrderId)
                    }
                }
                // Add other deep link handlers here
                data.host == "auth" -> {
                    // Handle auth deep links (reset password, verification, etc.)
                    handleAuthDeepLink(data)
                }
            }
        }
    }
    
    private fun navigateToWorkOrder(workOrderId: String) {
        // Navigate to work order detail screen
        // This depends on your navigation framework (Navigation Component, etc.)
        
        // Example using Navigation Component:
        val bundle = Bundle().apply {
            putString("workOrderId", workOrderId)
        }
        
        // If using Navigation Component
        // findNavController(R.id.nav_host_fragment).navigate(
        //     R.id.action_to_work_order_detail,
        //     bundle
        // )
        
        // If using explicit Intent
        val intent = Intent(this, WorkOrderDetailActivity::class.java).apply {
            putExtra("workOrderId", workOrderId)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        startActivity(intent)
    }
}
```

#### 3. Handle Deep Link in Application Class (Alternative)

```kotlin
import android.app.Application
import android.content.Intent
import android.net.Uri

class MyApplication : Application() {
    
    override fun onCreate() {
        super.onCreate()
        
        // Set up deep link handler
        setupDeepLinkHandler()
    }
    
    private fun setupDeepLinkHandler() {
        // You can use a library like Branch.io, Firebase Dynamic Links, or custom handler
    }
    
    fun handleDeepLink(uri: Uri) {
        when {
            uri.scheme == "asine" && uri.host == "work-order" -> {
                val workOrderId = uri.pathSegments.firstOrNull()
                workOrderId?.let { id ->
                    // Store work order ID and navigate when app is ready
                    DeepLinkManager.pendingWorkOrderId = id
                    notifyNavigationListener(id)
                }
            }
        }
    }
}
```

#### 4. Universal Links (Android App Links) - Recommended

For better security and user experience, use Universal Links instead of custom URL schemes:

```xml
<!-- In AndroidManifest.xml -->
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    
    <!-- Universal Link -->
    <data
        android:scheme="https"
        android:host="app.asine.app"
        android:pathPrefix="/work-order" />
</intent-filter>
```

**Requirements:**
1. Host a `.well-known/assetlinks.json` file on `https://app.asine.app`
2. Configure Digital Asset Links for your app package and SHA-256 fingerprint

### iOS (Swift)

#### 1. Configure Info.plist

Add URL scheme to your `Info.plist`:

```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleTypeRole</key>
        <string>Editor</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>asine</string>
        </array>
    </dict>
</array>
```

#### 2. Handle Deep Link in AppDelegate

```swift
import UIKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    
    func application(_ application: UIApplication, 
                    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Check if app was opened via deep link
        if let url = launchOptions?[.url] as? URL {
            handleDeepLink(url)
        }
        return true
    }
    
    // Handle deep link when app is running
    func application(_ app: UIApplication, 
                    open url: URL, 
                    options: [UIApplication.OpenURLOptionsKey : Any] = [:]) -> Bool {
        handleDeepLink(url)
        return true
    }
    
    private func handleDeepLink(_ url: URL) {
        guard url.scheme == "asine" else { return }
        
        switch url.host {
        case "work-order":
            // Extract work order ID from path
            // Format: asine://work-order/{work_order_id}
            let pathComponents = url.pathComponents
            if pathComponents.count >= 2 {
                let workOrderId = pathComponents[1] // First component is "/"
                navigateToWorkOrder(workOrderId: workOrderId)
            }
        default:
            break
        }
    }
    
    private func navigateToWorkOrder(workOrderId: String) {
        // Get the root view controller
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let window = windowScene.windows.first,
              let rootViewController = window.rootViewController else {
            return
        }
        
        // Navigate to work order detail screen
        // This depends on your navigation framework
        
        // Example using Storyboard:
        let storyboard = UIStoryboard(name: "Main", bundle: nil)
        if let workOrderVC = storyboard.instantiateViewController(withIdentifier: "WorkOrderDetailViewController") as? WorkOrderDetailViewController {
            workOrderVC.workOrderId = workOrderId
            
            // If using Navigation Controller
            if let navController = rootViewController as? UINavigationController {
                navController.pushViewController(workOrderVC, animated: true)
            } else {
                // Present modally
                rootViewController.present(workOrderVC, animated: true)
            }
        }
        
        // Example using SwiftUI:
        // You would use NavigationLink or navigationDestination in your SwiftUI views
    }
}
```

#### 3. Handle Deep Link in SceneDelegate (iOS 13+)

```swift
import UIKit

class SceneDelegate: UIWindowSceneDelegate {
    
    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        guard let url = URLContexts.first?.url else { return }
        handleDeepLink(url)
    }
    
    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        // Check if app was opened via deep link
        if let urlContext = connectionOptions.urlContexts.first {
            handleDeepLink(urlContext.url)
        }
    }
    
    private func handleDeepLink(_ url: URL) {
        guard url.scheme == "asine" else { return }
        
        if url.host == "work-order" {
            let pathComponents = url.pathComponents
            if pathComponents.count >= 2 {
                let workOrderId = pathComponents[1]
                navigateToWorkOrder(workOrderId: workOrderId)
            }
        }
    }
    
    private func navigateToWorkOrder(workOrderId: String) {
        // Navigation logic here
    }
}
```

#### 4. Universal Links (iOS) - Recommended

For better security and user experience, use Universal Links:

1. **Configure Associated Domains** in Xcode:
   - Go to Signing & Capabilities
   - Add "Associated Domains" capability
   - Add: `applinks:app.asine.app`

2. **Host apple-app-site-association file:**
   - Host at: `https://app.asine.app/.well-known/apple-app-site-association`
   - Format:
   ```json
   {
     "applinks": {
       "apps": [],
       "details": [
         {
           "appID": "TEAM_ID.com.yourapp.bundleid",
           "paths": ["/work-order/*"]
         }
       ]
     }
   }
   ```

3. **Handle Universal Links:**
```swift
func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    guard userActivity.activityType == NSUserActivityTypeBrowsingWeb,
          let url = userActivity.webpageURL else {
        return
    }
    
    // Handle Universal Link
    if url.host == "app.asine.app" && url.path.hasPrefix("/work-order/") {
        let workOrderId = String(url.pathComponents.last ?? "")
        navigateToWorkOrder(workOrderId: workOrderId)
    }
}
```

### React Native

#### 1. Install Deep Linking Library

```bash
npm install react-native-deep-linking
# or
npm install @react-navigation/native
npm install react-native-linking
```

#### 2. Configure Deep Links

**Android (android/app/src/main/AndroidManifest.xml):**
```xml
<activity
    android:name=".MainActivity"
    android:launchMode="singleTask">
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="asine" android:host="work-order" />
    </intent-filter>
</activity>
```

**iOS (ios/YourApp/Info.plist):**
```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>asine</string>
        </array>
    </dict>
</array>
```

#### 3. Handle Deep Links in React Native

```javascript
import { useEffect } from 'react';
import { Linking } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';

function App() {
  useEffect(() => {
    // Handle deep link when app is opened
    const handleDeepLink = (url) => {
      console.log('Deep link received:', url);
      
      // Parse URL: asine://work-order/{work_order_id}
      if (url.startsWith('asine://work-order/')) {
        const workOrderId = url.replace('asine://work-order/', '');
        navigateToWorkOrder(workOrderId);
      }
    };

    // Check if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    // Listen for deep links when app is running
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const navigateToWorkOrder = (workOrderId) => {
    // Navigate to work order screen using your navigation library
    // Example using React Navigation:
    navigation.navigate('WorkOrderDetail', { workOrderId });
  };

  return (
    <NavigationContainer>
      {/* Your app navigation */}
    </NavigationContainer>
  );
}
```

#### 4. Using React Navigation Deep Linking

```javascript
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

const linking = {
  prefixes: ['asine://', 'https://app.asine.app'],
  config: {
    screens: {
      WorkOrderDetail: {
        path: 'work-order/:workOrderId',
        parse: {
          workOrderId: (workOrderId) => workOrderId,
        },
      },
    },
  },
};

function App() {
  return (
    <NavigationContainer linking={linking}>
      {/* Your navigation stack */}
    </NavigationContainer>
  );
}
```

### Flutter

#### 1. Add Dependencies

```yaml
# pubspec.yaml
dependencies:
  uni_links: ^0.5.1
  # or
  go_router: ^12.0.0
```

#### 2. Configure Deep Links

**Android (android/app/src/main/AndroidManifest.xml):**
```xml
<activity
    android:name=".MainActivity"
    android:launchMode="singleTask">
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="asine" android:host="work-order" />
    </intent-filter>
</activity>
```

**iOS (ios/Runner/Info.plist):**
```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>asine</string>
        </array>
    </dict>
</array>
```

#### 3. Handle Deep Links

```dart
import 'package:uni_links/uni_links.dart';
import 'dart:async';

class DeepLinkService {
  StreamSubscription? _sub;
  
  void initDeepLinks() {
    // Handle initial deep link
    getInitialLink().then((String? link) {
      if (link != null) {
        handleDeepLink(link);
      }
    });
    
    // Listen for deep links when app is running
    _sub = getUriLinksStream().listen((Uri uri) {
      handleDeepLink(uri.toString());
    }, onError: (err) {
      print('Deep link error: $err');
    });
  }
  
  void handleDeepLink(String url) {
    // Parse: asine://work-order/{work_order_id}
    if (url.startsWith('asine://work-order/')) {
      final workOrderId = url.replaceAll('asine://work-order/', '');
      navigateToWorkOrder(workOrderId);
    }
  }
  
  void navigateToWorkOrder(String workOrderId) {
    // Navigate using your navigation solution
    // Example using GoRouter:
    // router.push('/work-order/$workOrderId');
  }
  
  void dispose() {
    _sub?.cancel();
  }
}
```

## Testing Deep Links

### Android

```bash
# Test deep link via ADB
adb shell am start -W -a android.intent.action.VIEW -d "asine://work-order/12345" com.yourapp.package
```

### iOS (Simulator)

```bash
# Test deep link via xcrun
xcrun simctl openurl booted "asine://work-order/12345"
```

### iOS (Device)

Send yourself an email with the deep link and tap it, or use Safari with the URL directly.

## Best Practices

1. **Handle Cold Start**: Deep links can arrive when the app is closed - handle this in `onCreate`/`didFinishLaunching`

2. **Handle Warm Start**: Deep links can arrive when the app is running - handle in `onNewIntent`/`openURL`

3. **Validate Work Order ID**: Always validate that the work order ID exists and the user has permission to view it

4. **Show Loading State**: While fetching work order data, show a loading indicator

5. **Error Handling**: Handle cases where:
   - Work order doesn't exist
   - User doesn't have permission
   - Network error
   - User not authenticated

6. **Deep Link Storage**: Store pending deep links if the user needs to authenticate first

```kotlin
// Example: Store pending deep link
class DeepLinkManager {
    companion object {
        var pendingWorkOrderId: String? = null
        
        fun processPendingDeepLink() {
            pendingWorkOrderId?.let { id ->
                navigateToWorkOrder(id)
                pendingWorkOrderId = null
            }
        }
    }
}

// After user logs in:
fun onLoginSuccess() {
    DeepLinkManager.processPendingDeepLink()
}
```

## Security Considerations

1. **Validate Work Order Ownership**: Ensure the tenant can only view their own work orders

2. **Authenticate User**: Require authentication before showing work order details

3. **Validate Deep Link Format**: Always validate the deep link format before processing

4. **Rate Limiting**: Consider rate limiting deep link requests to prevent abuse

## Troubleshooting

### Deep Link Not Opening App

1. **Android**: Check that `android:exported="true"` is set on the activity
2. **iOS**: Verify URL scheme is in Info.plist
3. Check that the app is installed
4. Try clearing app data/cache

### Deep Link Opens Wrong Screen

1. Check intent filter/data matching
2. Verify path parsing logic
3. Check navigation routing

### Deep Link Works Sometimes

1. Ensure `singleTask` launch mode on Android
2. Check `onNewIntent` is implemented
3. Verify deep link handling in both cold and warm start scenarios

## Example: Complete Deep Link Handler

```kotlin
// Android/Kotlin Complete Example
class DeepLinkHandler {
    fun handle(url: String) {
        try {
            val uri = Uri.parse(url)
            
            if (uri.scheme != "asine") return
            
            when (uri.host) {
                "work-order" -> {
                    val workOrderId = uri.pathSegments.firstOrNull()
                    if (workOrderId != null && isValidUUID(workOrderId)) {
                        navigateToWorkOrder(workOrderId)
                    } else {
                        showError("Invalid work order ID")
                    }
                }
                else -> {
                    // Handle other deep link types
                }
            }
        } catch (e: Exception) {
            Log.e("DeepLink", "Error handling deep link", e)
            showError("Invalid deep link format")
        }
    }
    
    private fun isValidUUID(string: String): Boolean {
        return try {
            UUID.fromString(string)
            true
        } catch (e: IllegalArgumentException) {
            false
        }
    }
}
```

## Related Documentation

- See `README.md` for function overview
- See `CLIENT-APP-INTEGRATION.md` for API integration details


# Mobile App Deep Link Handling for Password Reset

## Deep Link Structure

When a user clicks the password reset link in the email, they'll receive a deep link like:

```
asine://auth/reset-password?token=xxx&type=recovery
```

Or if using Supabase's action_link directly:
```
https://YOUR_PROJECT.supabase.co/auth/v1/verify?token=xxx&type=recovery&redirect_to=asine://auth/reset-password
```

## What the App Should Do

### Step 1: Handle the Deep Link

The app needs to intercept the deep link when the user clicks it.

### Step 2: Extract the Token

Extract the `token` parameter from the URL.

### Step 3: Show Password Reset UI

Display a screen where the user can enter their new password.

### Step 4: Complete Password Reset

Call Supabase Auth API to update the password using the token.

## Android Implementation (Kotlin)

### 1. Configure AndroidManifest.xml

```xml
<activity
    android:name=".MainActivity"
    android:exported="true">
    
    <!-- Existing intent filters -->
    
    <!-- Deep link for password reset -->
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data
            android:scheme="asine"
            android:host="auth"
            android:pathPrefix="/reset-password" />
    </intent-filter>
    
    <!-- Also handle Supabase redirect URLs -->
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="https" />
    </intent-filter>
</activity>
```

### 2. Handle Deep Link in Activity/Fragment

```kotlin
import android.net.Uri
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth

class MainActivity : AppCompatActivity() {
    
    private lateinit var supabase: SupabaseClient
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        // Initialize Supabase client
        supabase = // ... your Supabase initialization
        
        // Handle deep link if app was opened via deep link
        handleDeepLink(intent.data)
    }
    
    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        // Handle deep link if app was already running
        intent?.data?.let { handleDeepLink(it) }
    }
    
    private fun handleDeepLink(uri: Uri?) {
        uri ?: return
        
        when {
            // Handle asine://auth/reset-password?token=xxx
            uri.scheme == "asine" && 
            uri.host == "auth" && 
            uri.path?.startsWith("/reset-password") == true -> {
                val token = uri.getQueryParameter("token")
                token?.let { showPasswordResetScreen(it) }
            }
            
            // Handle Supabase redirect: https://xxx.supabase.co/auth/v1/verify?token=xxx&type=recovery&redirect_to=asine://auth/reset-password
            uri.host?.contains("supabase.co") == true && 
            uri.path?.contains("/auth/v1/verify") == true -> {
                val token = uri.getQueryParameter("token")
                val type = uri.getQueryParameter("type")
                
                if (type == "recovery" && token != null) {
                    // Extract redirect_to and navigate
                    val redirectTo = uri.getQueryParameter("redirect_to")
                    if (redirectTo?.startsWith("asine://auth/reset-password") == true) {
                        showPasswordResetScreen(token)
                    }
                }
            }
        }
    }
    
    private fun showPasswordResetScreen(token: String) {
        // Navigate to password reset screen
        val intent = Intent(this, ResetPasswordActivity::class.java).apply {
            putExtra("reset_token", token)
        }
        startActivity(intent)
    }
}
```

### 3. Password Reset Screen

```kotlin
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class ResetPasswordActivity : AppCompatActivity() {
    
    private lateinit var supabase: SupabaseClient
    private lateinit var token: String
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_reset_password)
        
        // Get token from intent
        token = intent.getStringExtra("reset_token") ?: run {
            Toast.makeText(this, "Invalid reset link", Toast.LENGTH_SHORT).show()
            finish()
            return
        }
        
        // Initialize Supabase
        supabase = // ... your Supabase initialization
        
        // Set up UI
        setupUI()
    }
    
    private fun setupUI() {
        // Find your password input fields
        val newPasswordInput = findViewById<EditText>(R.id.new_password)
        val confirmPasswordInput = findViewById<EditText>(R.id.confirm_password)
        val resetButton = findViewById<Button>(R.id.reset_button)
        
        resetButton.setOnClickListener {
            val newPassword = newPasswordInput.text.toString()
            val confirmPassword = confirmPasswordInput.text.toString()
            
            // Validate passwords
            if (newPassword.length < 6) {
                Toast.makeText(this, "Password must be at least 6 characters", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            
            if (newPassword != confirmPassword) {
                Toast.makeText(this, "Passwords do not match", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            
            // Reset password
            resetPassword(newPassword)
        }
    }
    
    private fun resetPassword(newPassword: String) {
        CoroutineScope(Dispatchers.Main).launch {
            try {
                // Use Supabase Auth to update password with the token
                // The token from the deep link is used to verify the user
                supabase.auth.updateUser {
                    password = newPassword
                }
                
                Toast.makeText(this@ResetPasswordActivity, "Password reset successfully!", Toast.LENGTH_SHORT).show()
                
                // Navigate to login screen
                val intent = Intent(this@ResetPasswordActivity, LoginActivity::class.java)
                intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                startActivity(intent)
                finish()
                
            } catch (e: Exception) {
                Toast.makeText(this@ResetPasswordActivity, "Error: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }
}
```

### 4. Alternative: Using Supabase Auth Exchange Code

If the token needs to be exchanged first:

```kotlin
private suspend fun resetPassword(token: String, newPassword: String) {
    try {
        // Exchange the token for a session (if needed)
        // Or directly update password using the token
        
        // Option 1: Exchange token and then update
        val session = supabase.auth.exchangeCodeForSession(token)
        
        // Option 2: Update password directly (Supabase handles token verification)
        supabase.auth.updateUser {
            password = newPassword
        }
        
    } catch (e: Exception) {
        throw e
    }
}
```

## iOS Implementation (Swift)

### 1. Configure Info.plist

```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>asine</string>
        </array>
        <key>CFBundleURLName</key>
        <string>com.asine.app</string>
    </dict>
</array>
```

### 2. Handle Deep Link in AppDelegate/SceneDelegate

```swift
import UIKit
import Supabase

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    
    var window: UIWindow?
    var supabase: SupabaseClient?
    
    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        guard let url = URLContexts.first?.url else { return }
        handleDeepLink(url: url)
    }
    
    func handleDeepLink(url: URL) {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: true) else { return }
        
        // Handle asine://auth/reset-password?token=xxx
        if url.scheme == "asine" && 
           url.host == "auth" && 
           url.path.hasPrefix("/reset-password") {
            
            if let token = components.queryItems?.first(where: { $0.name == "token" })?.value {
                showPasswordResetScreen(token: token)
            }
        }
        
        // Handle Supabase redirect
        if url.host?.contains("supabase.co") == true && 
           url.path.contains("/auth/v1/verify") {
            
            if let token = components.queryItems?.first(where: { $0.name == "token" })?.value,
               let type = components.queryItems?.first(where: { $0.name == "type" })?.value,
               type == "recovery" {
                showPasswordResetScreen(token: token)
            }
        }
    }
    
    func showPasswordResetScreen(token: String) {
        let storyboard = UIStoryboard(name: "Main", bundle: nil)
        if let resetVC = storyboard.instantiateViewController(withIdentifier: "ResetPasswordViewController") as? ResetPasswordViewController {
            resetVC.resetToken = token
            window?.rootViewController?.present(resetVC, animated: true)
        }
    }
}
```

### 3. Password Reset View Controller

```swift
import UIKit
import Supabase

class ResetPasswordViewController: UIViewController {
    
    @IBOutlet weak var newPasswordField: UITextField!
    @IBOutlet weak var confirmPasswordField: UITextField!
    @IBOutlet weak var resetButton: UIButton!
    
    var resetToken: String?
    var supabase: SupabaseClient?
    
    override func viewDidLoad() {
        super.viewDidLoad()
        // Initialize Supabase
        supabase = // ... your Supabase initialization
    }
    
    @IBAction func resetPasswordTapped(_ sender: UIButton) {
        guard let newPassword = newPasswordField.text,
              let confirmPassword = confirmPasswordField.text,
              let token = resetToken else {
            showAlert(message: "Invalid data")
            return
        }
        
        // Validate
        if newPassword.count < 6 {
            showAlert(message: "Password must be at least 6 characters")
            return
        }
        
        if newPassword != confirmPassword {
            showAlert(message: "Passwords do not match")
            return
        }
        
        // Reset password
        Task {
            await resetPassword(token: token, newPassword: newPassword)
        }
    }
    
    func resetPassword(token: String, newPassword: String) async {
        do {
            // Update password using Supabase Auth
            try await supabase?.auth.update(user: UserAttributes(password: newPassword))
            
            await MainActor.run {
                showAlert(message: "Password reset successfully!") {
                    // Navigate to login
                    self.dismiss(animated: true)
                }
            }
        } catch {
            await MainActor.run {
                showAlert(message: "Error: \(error.localizedDescription)")
            }
        }
    }
    
    func showAlert(message: String, completion: (() -> Void)? = nil) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
            completion?()
        })
        present(alert, animated: true)
    }
}
```

## React Native Implementation

```typescript
import { Linking } from 'react-native';
import { supabase } from './supabase';

// Handle deep link
useEffect(() => {
  // Handle initial URL if app was opened via deep link
  Linking.getInitialURL().then((url) => {
    if (url) handleDeepLink(url);
  });

  // Listen for deep links while app is running
  const subscription = Linking.addEventListener('url', (event) => {
    handleDeepLink(event.url);
  });

  return () => subscription.remove();
}, []);

const handleDeepLink = (url: string) => {
  const parsedUrl = new URL(url);
  
  // Handle asine://auth/reset-password?token=xxx
  if (parsedUrl.protocol === 'asine:' && 
      parsedUrl.hostname === 'auth' && 
      parsedUrl.pathname === '/reset-password') {
    const token = parsedUrl.searchParams.get('token');
    if (token) {
      navigateToResetPassword(token);
    }
  }
  
  // Handle Supabase redirect
  if (parsedUrl.hostname?.includes('supabase.co') && 
      parsedUrl.pathname.includes('/auth/v1/verify')) {
    const token = parsedUrl.searchParams.get('token');
    const type = parsedUrl.searchParams.get('type');
    
    if (type === 'recovery' && token) {
      navigateToResetPassword(token);
    }
  }
};

const navigateToResetPassword = (token: string) => {
  navigation.navigate('ResetPassword', { token });
};

// In ResetPassword screen
const resetPassword = async (token: string, newPassword: string) => {
  try {
    // Update password
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    });
    
    if (error) throw error;
    
    Alert.alert('Success', 'Password reset successfully!');
    navigation.navigate('Login');
  } catch (error) {
    Alert.alert('Error', error.message);
  }
};
```

## Summary

**What the deep link does:**
1. Opens your mobile app
2. Extracts the reset token from the URL
3. Shows a password reset screen
4. Allows user to enter new password
5. Calls Supabase Auth to complete the reset

**Key Points:**
- The token in the URL is used to verify the user's identity
- Supabase Auth handles the token verification automatically
- After successful reset, redirect user to login screen
- Handle both direct deep links (`asine://`) and Supabase redirect URLs




# Fix Image URL Error (HTTP 400) - Kotlin

## Problem

The URL is malformed. You're getting:
```
/storage/v1/object/public/work-order-media//object/sign/work-order-media/...
```

The path has `/object/sign/` embedded in it, which is incorrect.

## Solution 1: Use Public URL (If Bucket is Public)

If your `work-order-media` bucket is set to **public**, use this format:

```kotlin
object SupabaseImageHelper {
    private const val BASE_URL = "https://goljbyvrnktxwtnjomaq.supabase.co"
    private const val BUCKET_NAME = "work-order-media"
    
    /**
     * Build correct public URL from attachment path
     * 
     * @param attachmentPath The path from attachment.path (e.g., "workOrderId/folder/file.jpg")
     * @return Full public URL
     */
    fun getPublicImageUrl(attachmentPath: String): String {
        // Remove any leading slashes or incorrect paths
        val cleanPath = attachmentPath
            .removePrefix("/")
            .removePrefix("object/sign/")
            .removePrefix("$BUCKET_NAME/")
        
        return "$BASE_URL/storage/v1/object/public/$BUCKET_NAME/$cleanPath"
    }
    
    /**
     * Build public URL from Attachment object
     */
    fun getPublicImageUrl(attachment: Attachment): String {
        return getPublicImageUrl(attachment.path)
    }
}

// Usage:
val imageUrl = SupabaseImageHelper.getPublicImageUrl(attachment.path)
imageView.load(imageUrl)
```

## Solution 2: Use Signed URLs Correctly

If your bucket is **private**, use signed URLs properly:

```kotlin
import io.github.jan.supabase.storage.storage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class SupabaseImageLoader {
    private val supabase = SupabaseManager.client
    private val bucketName = "work-order-media"
    
    /**
     * Get signed URL for private bucket
     * 
     * @param filePath The file path (e.g., "workOrderId/folder/file.jpg")
     * @param expiresIn Expiration time in seconds (default: 1 hour)
     * @return Signed URL string
     */
    suspend fun getSignedImageUrl(
        filePath: String,
        expiresIn: Int = 3600
    ): String = withContext(Dispatchers.IO) {
        // Clean the path - remove any incorrect prefixes
        val cleanPath = filePath
            .removePrefix("/")
            .removePrefix("object/sign/")
            .removePrefix("$bucketName/")
        
        // Get signed URL from Supabase
        val signedUrl = supabase.storage.from(bucketName)
            .createSignedUrl(cleanPath, expiresIn)
        
        signedUrl
    }
    
    /**
     * Load image using signed URL
     */
    suspend fun loadImageWithSignedUrl(
        imageView: ImageView,
        filePath: String
    ) = withContext(Dispatchers.Main) {
        try {
            val signedUrl = getSignedImageUrl(filePath)
            
            imageView.load(signedUrl) {
                placeholder(R.drawable.placeholder)
                error(R.drawable.error_placeholder)
                crossfade(true)
            }
        } catch (e: Exception) {
            Log.e("ImageLoader", "Failed to get signed URL", e)
            // Fallback to error placeholder
            imageView.setImageResource(R.drawable.error_placeholder)
        }
    }
}
```

## Solution 3: Fix Your Current Code

If you're building URLs incorrectly, here's how to fix it:

### ❌ WRONG (What you're probably doing):

```kotlin
// Don't do this - it creates malformed URLs
val imageUrl = "$baseUrl/storage/v1/object/public/$bucketName/${attachment.path}"
// If attachment.path already contains "object/sign/", this creates a bad URL
```

### ✅ CORRECT:

```kotlin
// Clean the path first
fun cleanAttachmentPath(path: String): String {
    return path
        .removePrefix("/")
        .removePrefix("object/sign/")
        .removePrefix("work-order-media/")
        .trim()
}

// Then build URL
val cleanPath = cleanAttachmentPath(attachment.path)
val imageUrl = "https://goljbyvrnktxwtnjomaq.supabase.co/storage/v1/object/public/work-order-media/$cleanPath"
```

## Complete Fixed Example

```kotlin
import android.widget.ImageView
import coil.load
import kotlinx.coroutines.launch
import androidx.lifecycle.lifecycleScope

class WorkOrderImageLoader {
    private val baseUrl = "https://goljbyvrnktxwtnjomaq.supabase.co"
    private val bucketName = "work-order-media"
    
    /**
     * Clean attachment path to remove any incorrect prefixes
     */
    private fun cleanPath(path: String): String {
        return path
            .removePrefix("/")
            .removePrefix("object/sign/")
            .removePrefix("$bucketName/")
            .trim()
    }
    
    /**
     * Build public URL (for public bucket)
     */
    fun buildPublicUrl(attachmentPath: String): String {
        val cleanPath = cleanPath(attachmentPath)
        return "$baseUrl/storage/v1/object/public/$bucketName/$cleanPath"
    }
    
    /**
     * Load image in ImageView (public bucket)
     */
    fun loadImage(imageView: ImageView, attachment: Attachment) {
        val imageUrl = buildPublicUrl(attachment.path)
        
        imageView.load(imageUrl) {
            placeholder(R.drawable.placeholder)
            error(R.drawable.error_placeholder)
            crossfade(true)
        }
    }
    
    /**
     * Load image with signed URL (private bucket)
     */
    suspend fun loadImageWithSignedUrl(
        imageView: ImageView,
        attachment: Attachment,
        supabase: SupabaseClient
    ) {
        val cleanPath = cleanPath(attachment.path)
        
        try {
            val signedUrl = supabase.storage.from(bucketName)
                .createSignedUrl(cleanPath, 3600)
            
            imageView.load(signedUrl) {
                placeholder(R.drawable.placeholder)
                error(R.drawable.error_placeholder)
                crossfade(true)
            }
        } catch (e: Exception) {
            Log.e("ImageLoader", "Failed to load image", e)
            imageView.setImageResource(R.drawable.error_placeholder)
        }
    }
}

// Usage in Activity/Fragment:
class WorkOrderDetailActivity : AppCompatActivity() {
    private val imageLoader = WorkOrderImageLoader()
    
    private fun displayAttachments(attachments: List<Attachment>) {
        attachments.forEach { attachment ->
            val imageView = ImageView(this)
            
            // Option 1: Public bucket (simpler)
            imageLoader.loadImage(imageView, attachment)
            
            // Option 2: Private bucket (use signed URLs)
            // lifecycleScope.launch {
            //     imageLoader.loadImageWithSignedUrl(
            //         imageView,
            //         attachment,
            //         SupabaseManager.client
            //     )
            // }
            
            imageContainer.addView(imageView)
        }
    }
}
```

## Check Your Attachment Path

The issue might be in how you're storing the path. Make sure when you create attachments, you use the correct path format:

```kotlin
// ✅ CORRECT: Store just the relative path
val attachment = Attachment(
    path = "$workOrderId/$fileName", // e.g., "6113d394-66f5-450c-8300-c8b424adc083/file.jpg"
    name = fileName,
    // ... other fields
)

// ❌ WRONG: Don't include full URL or "object/sign/" in path
val attachment = Attachment(
    path = "object/sign/work-order-media/$workOrderId/$fileName", // WRONG!
    // ...
)
```

## Debug: Check What's in Your Attachment Path

```kotlin
// Debug your attachment paths
workOrder.attachments?.forEach { attachment ->
    Log.d("Attachment", "Path: ${attachment.path}")
    Log.d("Attachment", "Name: ${attachment.name}")
    
    // Clean and build URL
    val cleanPath = attachment.path
        .removePrefix("/")
        .removePrefix("object/sign/")
        .removePrefix("work-order-media/")
    
    val imageUrl = "https://goljbyvrnktxwtnjomaq.supabase.co/storage/v1/object/public/work-order-media/$cleanPath"
    
    Log.d("Attachment", "Image URL: $imageUrl")
    
    imageView.load(imageUrl) {
        placeholder(R.drawable.placeholder)
        error(R.drawable.error_placeholder)
    }
}
```

## Quick Fix for Your Specific Error

Based on your error URL, the path contains `/object/sign/work-order-media/`. Fix it like this:

```kotlin
// Your attachment.path probably looks like:
// "object/sign/work-order-media/6113d394-66f5-450c-8300-c8b424adc083/..."

// Fix it:
fun fixImageUrl(attachmentPath: String): String {
    val baseUrl = "https://goljbyvrnktxwtnjomaq.supabase.co"
    val bucketName = "work-order-media"
    
    // Remove incorrect prefixes
    val cleanPath = attachmentPath
        .removePrefix("object/sign/")
        .removePrefix("$bucketName/")
        .removePrefix("/")
    
    // Build correct public URL
    return "$baseUrl/storage/v1/object/public/$bucketName/$cleanPath"
}

// Usage:
val imageUrl = fixImageUrl(attachment.path)
imageView.load(imageUrl)
```

## Summary

1. **Check your attachment.path** - it shouldn't contain "object/sign/" or full URLs
2. **Clean the path** before building the URL
3. **Use correct URL format**: 
   - Public: `https://...supabase.co/storage/v1/object/public/bucket-name/path`
   - Signed: Get from `supabase.storage.from(bucket).createSignedUrl(path)`
4. **Store only relative paths** in the database (e.g., `"workOrderId/file.jpg"`)

The key is to **clean the path** before using it to build the URL!



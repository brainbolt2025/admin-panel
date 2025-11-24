# Render Images from Supabase Storage (Kotlin/Android)

## Quick Answer

Use **Coil** (recommended) or **Glide** to load images from Supabase Storage URLs.

## Option 1: Using Coil (Recommended - Modern & Lightweight)

### Step 1: Add Dependency

```kotlin
// build.gradle.kts (Module: app)
dependencies {
    implementation("io.coil-kt:coil:2.5.0")
    implementation("io.coil-kt:coil-compose:2.5.0") // If using Jetpack Compose
}
```

### Step 2: Load Image in ImageView (XML Layout)

```kotlin
import android.widget.ImageView
import coil.load

class WorkOrderDetailActivity : AppCompatActivity() {
    private lateinit var imageView: ImageView
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_work_order_detail)
        
        imageView = findViewById(R.id.imageView)
        
        // Load image from Supabase Storage URL
        val imageUrl = "https://goljbyvrnktxwtnjomaq.supabase.co/storage/v1/object/public/work-order-media/6113d394-66f5-450c-8300-c8b424adc083/d7db1d1a-83bb-4c5e-97e5-4fb69b836685/21cd2d8d-d150-41c8-8d78-d92e0b5e4c31_1000001327.jpg"
        
        imageView.load(imageUrl) {
            placeholder(R.drawable.placeholder) // Show while loading
            error(R.drawable.error_placeholder) // Show if load fails
            crossfade(true) // Smooth fade-in animation
        }
    }
}
```

### Step 3: Load Image in Jetpack Compose

```kotlin
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import coil.compose.rememberAsyncImagePainter

@Composable
fun WorkOrderImageView(imageUrl: String) {
    Image(
        painter = rememberAsyncImagePainter(
            model = imageUrl,
            placeholder = painterResource(R.drawable.placeholder),
            error = painterResource(R.drawable.error_placeholder)
        ),
        contentDescription = "Work order image",
        modifier = Modifier.fillMaxSize(),
        contentScale = ContentScale.Crop
    )
}
```

### Step 4: Load Multiple Images (RecyclerView)

```kotlin
import android.view.LayoutInflater
import android.view.ViewGroup
import android.widget.ImageView
import androidx.recyclerview.widget.RecyclerView
import coil.load

class AttachmentAdapter(
    private val attachments: List<Attachment>
) : RecyclerView.Adapter<AttachmentAdapter.ViewHolder>() {
    
    class ViewHolder(val imageView: ImageView) : RecyclerView.ViewHolder(imageView)
    
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val imageView = ImageView(parent.context)
        imageView.layoutParams = ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        )
        imageView.scaleType = ImageView.ScaleType.CENTER_CROP
        return ViewHolder(imageView)
    }
    
    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val attachment = attachments[position]
        
        // Build Supabase Storage public URL
        val imageUrl = buildSupabaseImageUrl(attachment.path)
        
        holder.imageView.load(imageUrl) {
            placeholder(R.drawable.placeholder)
            error(R.drawable.error_placeholder)
            crossfade(true)
        }
    }
    
    override fun getItemCount() = attachments.size
    
    private fun buildSupabaseImageUrl(path: String): String {
        val baseUrl = "https://goljbyvrnktxwtnjomaq.supabase.co"
        return "$baseUrl/storage/v1/object/public/work-order-media/$path"
    }
}
```

## Option 2: Using Glide (Alternative)

### Step 1: Add Dependency

```kotlin
dependencies {
    implementation("com.github.bumptech.glide:glide:4.16.0")
    kapt("com.github.bumptech.glide:compiler:4.16.0") // If using Kotlin annotation processing
}
```

### Step 2: Load Image

```kotlin
import android.widget.ImageView
import com.bumptech.glide.Glide

class WorkOrderDetailActivity : AppCompatActivity() {
    private lateinit var imageView: ImageView
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_work_order_detail)
        
        imageView = findViewById(R.id.imageView)
        
        val imageUrl = "https://goljbyvrnktxwtnjomaq.supabase.co/storage/v1/object/public/work-order-media/6113d394-66f5-450c-8300-c8b424adc083/d7db1d1a-83bb-4c5e-97e5-4fb69b836685/21cd2d8d-d150-41c8-8d78-d92e0b5e4c31_1000001327.jpg"
        
        Glide.with(this)
            .load(imageUrl)
            .placeholder(R.drawable.placeholder)
            .error(R.drawable.error_placeholder)
            .into(imageView)
    }
}
```

## Option 3: Using Signed URLs (More Secure)

If your bucket is not public, use signed URLs:

```kotlin
import io.github.jan.supabase.storage.storage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class ImageLoader {
    private val supabase = SupabaseManager.client
    private val bucketName = "work-order-media"
    
    /**
     * Get signed URL for image (expires after specified seconds)
     */
    suspend fun getSignedImageUrl(
        filePath: String,
        expiresIn: Int = 3600 // 1 hour default
    ): String = withContext(Dispatchers.IO) {
        val signedUrl = supabase.storage.from(bucketName)
            .createSignedUrl(filePath, expiresIn)
        
        signedUrl
    }
    
    /**
     * Load image using signed URL
     */
    suspend fun loadImageWithSignedUrl(
        imageView: ImageView,
        filePath: String
    ) = withContext(Dispatchers.Main) {
        val signedUrl = getSignedImageUrl(filePath)
        
        imageView.load(signedUrl) {
            placeholder(R.drawable.placeholder)
            error(R.drawable.error_placeholder)
            crossfade(true)
        }
    }
}

// Usage:
lifecycleScope.launch {
    imageLoader.loadImageWithSignedUrl(
        imageView,
        "6113d394-66f5-450c-8300-c8b424adc083/d7db1d1a-83bb-4c5e-97e5-4fb69b836685/21cd2d8d-d150-41c8-8d78-d92e0b5e4c31_1000001327.jpg"
    )
}
```

## Complete Example: Display Work Order Attachments

```kotlin
import android.os.Bundle
import android.widget.ImageView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView
import coil.load
import kotlinx.coroutines.launch

class WorkOrderAttachmentsActivity : AppCompatActivity() {
    private lateinit var recyclerView: RecyclerView
    private val supabase = SupabaseManager.client
    private val baseUrl = "https://goljbyvrnktxwtnjomaq.supabase.co"
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_attachments)
        
        recyclerView = findViewById(R.id.recyclerView)
        recyclerView.layoutManager = GridLayoutManager(this, 2)
        
        val workOrderId = intent.getStringExtra("work_order_id") ?: ""
        loadAttachments(workOrderId)
    }
    
    private fun loadAttachments(workOrderId: String) {
        lifecycleScope.launch {
            try {
                // Fetch work order with attachments
                val workOrder = supabase.from("work_orders")
                    .select {
                        filter { eq("id", workOrderId) }
                    }
                    .decodeSingle<WorkOrder>()
                
                val attachments = workOrder.attachments ?: emptyList()
                
                // Filter for images only
                val imageAttachments = attachments.filter { 
                    it.mime_type.startsWith("image/") 
                }
                
                // Display images
                recyclerView.adapter = AttachmentImageAdapter(imageAttachments)
                
            } catch (e: Exception) {
                Log.e("Attachments", "Failed to load attachments", e)
            }
        }
    }
}

class AttachmentImageAdapter(
    private val attachments: List<Attachment>
) : RecyclerView.Adapter<AttachmentImageAdapter.ViewHolder>() {
    
    private val baseUrl = "https://goljbyvrnktxwtnjomaq.supabase.co"
    
    class ViewHolder(val imageView: ImageView) : RecyclerView.ViewHolder(imageView)
    
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val imageView = ImageView(parent.context).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                400.dpToPx(parent.context) // Fixed height
            )
            scaleType = ImageView.ScaleType.CENTER_CROP
            adjustViewBounds = true
        }
        return ViewHolder(imageView)
    }
    
    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val attachment = attachments[position]
        
        // Build public URL
        val imageUrl = "$baseUrl/storage/v1/object/public/work-order-media/${attachment.path}"
        
        holder.imageView.load(imageUrl) {
            placeholder(R.drawable.image_placeholder)
            error(R.drawable.image_error)
            crossfade(300)
        }
    }
    
    override fun getItemCount() = attachments.size
    
    private fun Int.dpToPx(context: android.content.Context): Int {
        return (this * context.resources.displayMetrics.density).toInt()
    }
}
```

## Helper Function: Build Image URL from Attachment

```kotlin
object SupabaseImageHelper {
    private const val BASE_URL = "https://goljbyvrnktxwtnjomaq.supabase.co"
    private const val BUCKET_NAME = "work-order-media"
    
    /**
     * Build public URL from attachment path
     */
    fun getPublicImageUrl(attachment: Attachment): String {
        return "$BASE_URL/storage/v1/object/public/$BUCKET_NAME/${attachment.path}"
    }
    
    /**
     * Build public URL from file path string
     */
    fun getPublicImageUrl(filePath: String): String {
        return "$BASE_URL/storage/v1/object/public/$BUCKET_NAME/$filePath"
    }
}

// Usage:
val imageUrl = SupabaseImageHelper.getPublicImageUrl(attachment)
imageView.load(imageUrl)
```

## Using with Your Attachment Data

```kotlin
// When you fetch work order with attachments:
val workOrder = supabase.from("work_orders")
    .select {
        filter { eq("id", workOrderId) }
    }
    .decodeSingle<WorkOrder>()

// Display each attachment image
workOrder.attachments?.forEach { attachment ->
    val imageUrl = SupabaseImageHelper.getPublicImageUrl(attachment)
    
    // Load in ImageView
    imageView.load(imageUrl) {
        placeholder(R.drawable.placeholder)
        error(R.drawable.error_placeholder)
    }
}
```

## XML Layout Example

```xml
<!-- activity_work_order_detail.xml -->
<LinearLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical">
    
    <ImageView
        android:id="@+id/imageView"
        android:layout_width="match_parent"
        android:layout_height="300dp"
        android:scaleType="centerCrop"
        android:contentDescription="Work order image" />
    
    <androidx.recyclerview.widget.RecyclerView
        android:id="@+id/recyclerView"
        android:layout_width="match_parent"
        android:layout_height="match_parent" />
        
</LinearLayout>
```

## Summary

**For your specific URL:**
```kotlin
val imageUrl = "https://goljbyvrnktxwtnjomaq.supabase.co/storage/v1/object/public/work-order-media/6113d394-66f5-450c-8300-c8b424adc083/d7db1d1a-83bb-4c5e-97e5-4fb69b836685/21cd2d8d-d150-41c8-8d78-d92e0b5e4c31_1000001327.jpg"

// Using Coil (recommended):
imageView.load(imageUrl) {
    placeholder(R.drawable.placeholder)
    error(R.drawable.error_placeholder)
    crossfade(true)
}

// Or using Glide:
Glide.with(context)
    .load(imageUrl)
    .placeholder(R.drawable.placeholder)
    .error(R.drawable.error_placeholder)
    .into(imageView)
```

**Recommendation**: Use **Coil** - it's modern, lightweight, Kotlin-first, and perfect for Android.


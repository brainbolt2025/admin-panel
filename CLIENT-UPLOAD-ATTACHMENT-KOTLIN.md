# Client App: Upload Attachments to Work Orders (Kotlin/Android)

## Complete Kotlin Implementation

### Step 1: Add Dependencies

In your `build.gradle.kts` (Module: app):

```kotlin
dependencies {
    // Supabase Kotlin client
    implementation(platform("io.github.jan-tennert.supabase:bom:2.0.0"))
    implementation("io.github.jan-tennert.supabase:postgrest-kt")
    implementation("io.github.jan-tennert.supabase:storage-kt")
    implementation("io.github.jan-tennert.supabase:gotrue-kt")
    
    // Image picker (optional)
    implementation("com.github.dhaval2404:imagepicker:2.1")
    
    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
}
```

### Step 2: Data Classes

```kotlin
import kotlinx.serialization.Serializable

@Serializable
data class Attachment(
    val path: String,
    val name: String,
    val size: Long,
    val mime_type: String,
    val uploaded_at: String,
    val uploaded_by: String?
)

@Serializable
data class WorkOrder(
    val id: String,
    val title: String? = null,
    val description: String? = null,
    val attachments: List<Attachment>? = null
)
```

### Step 3: Supabase Client Setup

```kotlin
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.storage.Storage
import io.github.jan.supabase.gotrue.Auth

class SupabaseManager {
    companion object {
        private const val SUPABASE_URL = "https://your-project.supabase.co"
        private const val SUPABASE_ANON_KEY = "your-anon-key"
        
        val client: SupabaseClient = createSupabaseClient(SUPABASE_URL) {
            install(Postgrest)
            install(Storage)
            install(Auth)
            
            defaultHeaders {
                set("apikey", SUPABASE_ANON_KEY)
            }
        }
    }
}
```

### Step 4: Upload Attachment Function

```kotlin
import android.net.Uri
import io.github.jan.supabase.storage.storage
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Column
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileInputStream

class WorkOrderAttachmentRepository {
    private val supabase = SupabaseManager.client
    private val bucketName = "work-order-media"
    
    /**
     * Upload a file and add it to work order attachments
     * 
     * @param workOrderId The ID of the work order
     * @param fileUri The URI of the file to upload (from file picker or camera)
     * @param userId The ID of the user uploading the file
     * @param context Android context for reading file
     * @return The created Attachment object
     */
    suspend fun uploadAttachmentToWorkOrder(
        workOrderId: String,
        fileUri: Uri,
        userId: String,
        context: android.content.Context
    ): Result<Attachment> = withContext(Dispatchers.IO) {
        try {
            // Step 1: Read file from URI
            val file = File(context.cacheDir, "temp_upload_${System.currentTimeMillis()}")
            context.contentResolver.openInputStream(fileUri)?.use { input ->
                file.outputStream().use { output ->
                    input.copyTo(output)
                }
            } ?: return@withContext Result.failure(
                Exception("Failed to read file from URI")
            )
            
            val fileName = getFileName(context, fileUri) ?: "file_${System.currentTimeMillis()}"
            val filePath = "$workOrderId/$fileName"
            val mimeType = context.contentResolver.getType(fileUri) 
                ?: "application/octet-stream"
            
            // Step 2: Upload file to storage
            val uploadResult = supabase.storage.from(bucketName)
                .upload(
                    path = filePath,
                    file = file,
                    upsert = false
                )
            
            // Clean up temp file
            file.delete()
            
            // Step 3: Get current work order attachments
            val currentWorkOrder = supabase.from("work_orders")
                .select {
                    filter {
                        eq("id", workOrderId)
                    }
                }
                .decodeSingle<WorkOrder>()
            
            val currentAttachments = currentWorkOrder.attachments ?: emptyList()
            
            // Step 4: Create new attachment metadata
            val newAttachment = Attachment(
                path = filePath,
                name = fileName,
                size = file.length(),
                mime_type = mimeType,
                uploaded_at = java.time.Instant.now().toString(),
                uploaded_by = userId
            )
            
            // Step 5: Update work order with new attachment
            val updatedAttachments = currentAttachments + newAttachment
            
            supabase.from("work_orders")
                .update(mapOf("attachments" to updatedAttachments)) {
                    filter {
                        eq("id", workOrderId)
                    }
                }
            
            Result.success(newAttachment)
            
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    /**
     * Helper function to get file name from URI
     */
    private fun getFileName(context: android.content.Context, uri: Uri): String? {
        var result: String? = null
        if (uri.scheme == "content") {
            val cursor = context.contentResolver.query(uri, null, null, null, null)
            cursor?.use {
                if (it.moveToFirst()) {
                    val nameIndex = it.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                    if (nameIndex >= 0) {
                        result = it.getString(nameIndex)
                    }
                }
            }
        }
        if (result == null) {
            result = uri.path
            val cut = result?.lastIndexOf('/')
            if (cut != -1) {
                result = result?.substring(cut + 1)
            }
        }
        return result
    }
}
```

### Step 5: ViewModel Example

```kotlin
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import android.net.Uri

class WorkOrderAttachmentViewModel : ViewModel() {
    private val repository = WorkOrderAttachmentRepository()
    
    private val _uploadState = MutableStateFlow<UploadState>(UploadState.Idle)
    val uploadState: StateFlow<UploadState> = _uploadState
    
    fun uploadAttachment(
        workOrderId: String,
        fileUri: Uri,
        userId: String,
        context: android.content.Context
    ) {
        viewModelScope.launch {
            _uploadState.value = UploadState.Uploading
            
            repository.uploadAttachmentToWorkOrder(
                workOrderId = workOrderId,
                fileUri = fileUri,
                userId = userId,
                context = context
            ).fold(
                onSuccess = { attachment ->
                    _uploadState.value = UploadState.Success(attachment)
                },
                onFailure = { error ->
                    _uploadState.value = UploadState.Error(error.message ?: "Upload failed")
                }
            )
        }
    }
    
    fun resetState() {
        _uploadState.value = UploadState.Idle
    }
}

sealed class UploadState {
    object Idle : UploadState()
    object Uploading : UploadState()
    data class Success(val attachment: Attachment) : UploadState()
    data class Error(val message: String) : UploadState()
}
```

### Step 6: Activity/Fragment Example

```kotlin
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import com.github.dhaval2404.imagepicker.ImagePicker
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach

class WorkOrderDetailActivity : AppCompatActivity() {
    private val viewModel: WorkOrderAttachmentViewModel by viewModels()
    private lateinit var workOrderId: String
    private lateinit var userId: String
    
    // Image picker launcher
    private val imagePickerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val uri: Uri? = result.data?.data
            uri?.let {
                uploadImage(it)
            }
        }
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_work_order_detail)
        
        workOrderId = intent.getStringExtra("work_order_id") ?: ""
        userId = getCurrentUserId() // Implement this based on your auth
        
        setupObservers()
        
        // Button click listener
        findViewById<Button>(R.id.btnUploadImage).setOnClickListener {
            pickImage()
        }
    }
    
    private fun pickImage() {
        ImagePicker.with(this)
            .crop()
            .compress(1024)
            .maxResultSize(1080, 1080)
            .createIntent { intent ->
                imagePickerLauncher.launch(intent)
            }
    }
    
    private fun uploadImage(uri: Uri) {
        viewModel.uploadAttachment(
            workOrderId = workOrderId,
            fileUri = uri,
            userId = userId,
            context = this
        )
    }
    
    private fun setupObservers() {
        viewModel.uploadState
            .onEach { state ->
                when (state) {
                    is UploadState.Idle -> {
                        // Hide loading
                    }
                    is UploadState.Uploading -> {
                        // Show loading indicator
                        showProgressDialog("Uploading image...")
                    }
                    is UploadState.Success -> {
                        hideProgressDialog()
                        showToast("Image uploaded successfully!")
                        // Refresh work order attachments list
                        loadAttachments()
                    }
                    is UploadState.Error -> {
                        hideProgressDialog()
                        showErrorDialog(state.message)
                    }
                }
            }
            .launchIn(lifecycleScope)
    }
    
    private fun getCurrentUserId(): String {
        // Get from your auth system (SharedPreferences, Session, etc.)
        // Example:
        val prefs = getSharedPreferences("auth", MODE_PRIVATE)
        return prefs.getString("user_id", "") ?: ""
    }
    
    private fun loadAttachments() {
        // Load and display attachments
        // Implementation depends on your UI
    }
}
```

### Step 7: Simplified Version (Direct Function)

If you prefer a simpler, direct approach without ViewModel:

```kotlin
import android.net.Uri
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class AttachmentUploader {
    private val supabase = SupabaseManager.client
    private val bucketName = "work-order-media"
    
    fun uploadAttachment(
        workOrderId: String,
        fileUri: Uri,
        userId: String,
        context: android.content.Context,
        onSuccess: (Attachment) -> Unit,
        onError: (String) -> Unit
    ) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                // Read file
                val file = File(context.cacheDir, "temp_${System.currentTimeMillis()}")
                context.contentResolver.openInputStream(fileUri)?.use { input ->
                    file.outputStream().use { output ->
                        input.copyTo(output)
                    }
                } ?: throw Exception("Failed to read file")
                
                val fileName = getFileName(context, fileUri) ?: "file_${System.currentTimeMillis()}"
                val filePath = "$workOrderId/$fileName"
                val mimeType = context.contentResolver.getType(fileUri) 
                    ?: "application/octet-stream"
                
                // Upload to storage
                supabase.storage.from(bucketName).upload(filePath, file, upsert = false)
                file.delete() // Clean up
                
                // Get current attachments
                val workOrder = supabase.from("work_orders")
                    .select {
                        filter { eq("id", workOrderId) }
                    }
                    .decodeSingle<WorkOrder>()
                
                // Create attachment
                val attachment = Attachment(
                    path = filePath,
                    name = fileName,
                    size = file.length(),
                    mime_type = mimeType,
                    uploaded_at = java.time.Instant.now().toString(),
                    uploaded_by = userId
                )
                
                // Update work order
                val updatedAttachments = (workOrder.attachments ?: emptyList()) + attachment
                
                supabase.from("work_orders")
                    .update(mapOf("attachments" to updatedAttachments)) {
                        filter { eq("id", workOrderId) }
                    }
                
                withContext(Dispatchers.Main) {
                    onSuccess(attachment)
                }
                
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    onError(e.message ?: "Upload failed")
                }
            }
        }
    }
    
    private fun getFileName(context: android.content.Context, uri: Uri): String? {
        var result: String? = null
        if (uri.scheme == "content") {
            val cursor = context.contentResolver.query(uri, null, null, null, null)
            cursor?.use {
                if (it.moveToFirst()) {
                    val nameIndex = it.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                    if (nameIndex >= 0) {
                        result = it.getString(nameIndex)
                    }
                }
            }
        }
        if (result == null) {
            result = uri.path
            val cut = result?.lastIndexOf('/')
            if (cut != -1) {
                result = result?.substring(cut + 1)
            }
        }
        return result
    }
}

// Usage:
val uploader = AttachmentUploader()
uploader.uploadAttachment(
    workOrderId = "work-order-id",
    fileUri = selectedImageUri,
    userId = currentUserId,
    context = this,
    onSuccess = { attachment ->
        Toast.makeText(this, "Uploaded: ${attachment.name}", Toast.LENGTH_SHORT).show()
        // Refresh UI
    },
    onError = { error ->
        Toast.makeText(this, "Error: $error", Toast.LENGTH_SHORT).show()
    }
)
```

### Step 8: Error Handling with Rollback

```kotlin
suspend fun uploadAttachmentWithRollback(
    workOrderId: String,
    fileUri: Uri,
    userId: String,
    context: android.content.Context
): Result<Attachment> = withContext(Dispatchers.IO) {
    var filePath: String? = null
    
    try {
        // ... upload file code ...
        filePath = "$workOrderId/$fileName"
        
        supabase.storage.from(bucketName).upload(filePath, file, upsert = false)
        
        // ... update database code ...
        
        Result.success(attachment)
        
    } catch (e: Exception) {
        // Rollback: delete uploaded file if database update failed
        filePath?.let { path ->
            try {
                supabase.storage.from(bucketName).remove(listOf(path))
            } catch (deleteError: Exception) {
                Log.e("AttachmentUpload", "Failed to cleanup file: $path", deleteError)
            }
        }
        Result.failure(e)
    }
}
```

## Key Points

1. **Upload to Storage First**: Always upload the file to storage before updating the database
2. **Update Attachments Column**: After successful upload, update the `work_orders.attachments` column
3. **Error Handling**: If database update fails, consider deleting the uploaded file (rollback)
4. **File Path Format**: Use `{workOrderId}/{fileName}` format for organization
5. **Metadata**: Include all required fields: path, name, size, mime_type, uploaded_at, uploaded_by

## Testing

After implementing, verify:
1. File appears in Supabase Storage bucket
2. Work order's `attachments` column contains the new attachment
3. Query work order to see attachments array

```kotlin
// Query to verify
val workOrder = supabase.from("work_orders")
    .select {
        filter { eq("id", workOrderId) }
    }
    .decodeSingle<WorkOrder>()

Log.d("Attachments", "Count: ${workOrder.attachments?.size}")
```


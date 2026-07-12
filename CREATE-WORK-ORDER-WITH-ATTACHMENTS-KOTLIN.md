# Create Work Order with Attachments (Kotlin)

## Problem

When creating a new work order, the `attachments` column starts as an empty array `[]`. You need to either:
1. **Create work order with attachments included** (if files are ready)
2. **Create work order first, then add attachments** (if files are uploaded after)

## Solution 1: Create Work Order with Attachments Included

If you have files ready when creating the work order:

```kotlin
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.storage.storage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import android.net.Uri

class WorkOrderRepository {
    private val supabase = SupabaseManager.client
    private val bucketName = "work-order-media"
    
    /**
     * Create work order with attachments
     */
    suspend fun createWorkOrderWithAttachments(
        title: String,
        description: String,
        tenantId: String,
        propertyId: String,
        fileUris: List<Uri>, // List of images/files to upload
        userId: String,
        context: android.content.Context
    ): Result<WorkOrder> = withContext(Dispatchers.IO) {
        try {
            // Step 1: Create work order first (with empty attachments)
            val newWorkOrder = supabase.from("work_orders")
                .insert(
                    mapOf(
                        "title" to title,
                        "description" to description,
                        "tenant_id" to tenantId,
                        "property_id" to propertyId,
                        "status" to "Pending",
                        "attachments" to emptyList<Attachment>() // Start with empty
                    )
                )
                .decodeSingle<WorkOrder>()
            
            // Step 2: Upload all files and build attachments
            val attachments = mutableListOf<Attachment>()
            
            for ((index, fileUri) in fileUris.withIndex()) {
                try {
                    // Read file
                    val file = File(context.cacheDir, "temp_${System.currentTimeMillis()}_$index")
                    context.contentResolver.openInputStream(fileUri)?.use { input ->
                        file.outputStream().use { output ->
                            input.copyTo(output)
                        }
                    } ?: continue
                    
                    val fileName = getFileName(context, fileUri) 
                        ?: "file_${System.currentTimeMillis()}_$index.jpg"
                    val filePath = "${newWorkOrder.id}/$fileName"
                    val mimeType = context.contentResolver.getType(fileUri) 
                        ?: "image/jpeg"
                    
                    // Upload to storage
                    supabase.storage.from(bucketName).upload(filePath, file, upsert = false)
                    
                    // Create attachment metadata
                    attachments.add(
                        Attachment(
                            path = filePath,
                            name = fileName,
                            size = file.length(),
                            mime_type = mimeType,
                            uploaded_at = java.time.Instant.now().toString(),
                            uploaded_by = userId
                        )
                    )
                    
                    // Clean up temp file
                    file.delete()
                    
                } catch (e: Exception) {
                    Log.e("WorkOrder", "Failed to upload file $index: ${e.message}")
                    // Continue with other files even if one fails
                }
            }
            
            // Step 3: Update work order with all attachments at once
            if (attachments.isNotEmpty()) {
                supabase.from("work_orders")
                    .update(mapOf("attachments" to attachments)) {
                        filter { eq("id", newWorkOrder.id) }
                    }
            }
            
            // Return updated work order
            val updatedWorkOrder = supabase.from("work_orders")
                .select {
                    filter { eq("id", newWorkOrder.id) }
                }
                .decodeSingle<WorkOrder>()
            
            Result.success(updatedWorkOrder)
            
        } catch (e: Exception) {
            Result.failure(e)
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
```

## Solution 2: Create Work Order, Then Add Attachments Separately

If files are uploaded after work order creation (more common):

```kotlin
/**
 * Create work order (attachments will be empty initially)
 */
suspend fun createWorkOrder(
    title: String,
    description: String,
    tenantId: String,
    propertyId: String,
    priority: String = "Medium"
): Result<WorkOrder> = withContext(Dispatchers.IO) {
    try {
        val workOrder = supabase.from("work_orders")
            .insert(
                mapOf(
                    "title" to title,
                    "description" to description,
                    "tenant_id" to tenantId,
                    "property_id" to propertyId,
                    "status" to "Pending",
                    "priority" to priority,
                    "attachments" to emptyList<Attachment>() // Empty by default
                )
            )
            .decodeSingle<WorkOrder>()
        
        Result.success(workOrder)
    } catch (e: Exception) {
        Result.failure(e)
    }
}

/**
 * Add attachment to existing work order
 */
suspend fun addAttachmentToWorkOrder(
    workOrderId: String,
    fileUri: Uri,
    userId: String,
    context: android.content.Context
): Result<Attachment> = withContext(Dispatchers.IO) {
    try {
        // Upload file to storage
        val file = File(context.cacheDir, "temp_${System.currentTimeMillis()}")
        context.contentResolver.openInputStream(fileUri)?.use { input ->
            file.outputStream().use { output ->
                input.copyTo(output)
            }
        } ?: return@withContext Result.failure(
            Exception("Failed to read file")
        )
        
        val fileName = getFileName(context, fileUri) ?: "file_${System.currentTimeMillis()}.jpg"
        val filePath = "$workOrderId/$fileName"
        val mimeType = context.contentResolver.getType(fileUri) ?: "image/jpeg"
        
        // Upload to storage
        supabase.storage.from(bucketName).upload(filePath, file, upsert = false)
        file.delete() // Clean up
        
        // Get current work order
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
        
        // Update work order - append to existing attachments
        val currentAttachments = workOrder.attachments ?: emptyList()
        val updatedAttachments = currentAttachments + attachment
        
        supabase.from("work_orders")
            .update(mapOf("attachments" to updatedAttachments)) {
                filter { eq("id", workOrderId) }
            }
        
        Result.success(attachment)
        
    } catch (e: Exception) {
        Result.failure(e)
    }
}
```

## Complete Example: Activity with Image Picker

```kotlin
class CreateWorkOrderActivity : AppCompatActivity() {
    private val repository = WorkOrderRepository()
    private val selectedImages = mutableListOf<Uri>()
    
    private val imagePickerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val uri: Uri? = result.data?.data
            uri?.let {
                selectedImages.add(it)
                updateImagePreview()
            }
        }
    }
    
    private fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_create_work_order)
        
        findViewById<Button>(R.id.btnAddImage).setOnClickListener {
            pickImage()
        }
        
        findViewById<Button>(R.id.btnCreateWorkOrder).setOnClickListener {
            createWorkOrder()
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
    
    private fun createWorkOrder() {
        val title = findViewById<EditText>(R.id.editTitle).text.toString()
        val description = findViewById<EditText>(R.id.editDescription).text.toString()
        val tenantId = getCurrentUserId() // Your auth logic
        
        lifecycleScope.launch {
            showProgress("Creating work order...")
            
            if (selectedImages.isEmpty()) {
                // Create without attachments
                repository.createWorkOrder(
                    title = title,
                    description = description,
                    tenantId = tenantId,
                    propertyId = getCurrentPropertyId()
                ).fold(
                    onSuccess = { workOrder ->
                        hideProgress()
                        Toast.makeText(this@CreateWorkOrderActivity, 
                            "Work order created!", Toast.LENGTH_SHORT).show()
                        finish()
                    },
                    onFailure = { error ->
                        hideProgress()
                        showError(error.message ?: "Failed to create work order")
                    }
                )
            } else {
                // Create with attachments
                repository.createWorkOrderWithAttachments(
                    title = title,
                    description = description,
                    tenantId = tenantId,
                    propertyId = getCurrentPropertyId(),
                    fileUris = selectedImages,
                    userId = tenantId,
                    context = this@CreateWorkOrderActivity
                ).fold(
                    onSuccess = { workOrder ->
                        hideProgress()
                        Toast.makeText(this@CreateWorkOrderActivity, 
                            "Work order created with ${workOrder.attachments?.size} images!", 
                            Toast.LENGTH_SHORT).show()
                        finish()
                    },
                    onFailure = { error ->
                        hideProgress()
                        showError(error.message ?: "Failed to create work order")
                    }
                )
            }
        }
    }
}
```

## Important Notes

1. **Empty Array is Normal**: New work orders start with `attachments = []` - this is expected behavior
2. **Update After Creation**: You need to explicitly update the `attachments` column after uploading files
3. **Always Include Attachments Field**: Even if empty, include `"attachments" to emptyList<Attachment>()` when creating
4. **Append to Existing**: When adding attachments, always fetch current attachments first, then append

## Quick Fix: Always Update Attachments After Upload

Make sure your upload function ALWAYS updates the work order:

```kotlin
// ✅ CORRECT: Updates work order after upload
suspend fun uploadImage(workOrderId: String, fileUri: Uri, userId: String) {
    // 1. Upload to storage
    val filePath = uploadToStorage(workOrderId, fileUri)
    
    // 2. MUST update work order attachments column
    updateWorkOrderAttachments(workOrderId, filePath, userId)
}

// ❌ WRONG: Only uploads to storage, doesn't update database
suspend fun uploadImage(workOrderId: String, fileUri: Uri) {
    uploadToStorage(workOrderId, fileUri)
    // Missing: update work_orders.attachments column!
}
```

## Summary

The `attachments` column will be empty (`[]`) for new work orders until you:
1. Upload files to storage
2. **Update the work order's `attachments` column** with the file metadata

Always remember: **Storage upload ≠ Database update**. You need to do both!



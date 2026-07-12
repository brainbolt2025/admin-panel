# Reopen Work Order Edge Function

This Supabase Edge Function allows tenants and property managers to reopen completed or canceled work orders by changing their status to "In Progress".

## Features

- Validates user authentication via JWT token
- Ensures tenants can only reopen their own work orders
- Ensures PMs can only reopen work orders in their property
- Validates that only Completed or Canceled work orders can be reopened
- Uses service role key to bypass RLS policies
- Returns the updated work order

## Setup

### 1. Environment Variables

This function uses automatically available environment variables:
- `SUPABASE_URL` - Your Supabase project URL (automatically set)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (automatically set)

### 2. Deploy the Function

```bash
supabase functions deploy reopen-work-order
```

## Usage

### Request

**Endpoint:**
```
POST https://YOUR_PROJECT.supabase.co/functions/v1/reopen-work-order
```

**Headers:**
```json
{
  "Authorization": "Bearer YOUR_ACCESS_TOKEN",
  "Content-Type": "application/json"
}
```

**Body:**
```json
{
  "work_order_id": "uuid-of-work-order"
}
```

### Response

**Success (200):**
```json
{
  "success": true,
  "message": "Work order reopened successfully",
  "work_order": {
    "id": "uuid",
    "title": "Work Order Title",
    "description": "Description",
    "status": "In Progress",
    "tenant_id": "uuid",
    "property_id": "uuid",
    ...
  }
}
```

**Error (400/401/403/404/500):**
```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional error details (if available)"
}
```

## Authorization

- **Tenants**: Can only reopen work orders where `tenant_id` matches their user ID
- **Property Managers**: Can only reopen work orders in their property (`property_id` matches)
- **Other roles**: Not allowed

## Validation Rules

1. User must be authenticated with a valid JWT token
2. User role must be `tenant` or `pm`
3. Work order must exist
4. User must have permission (tenant owns it, or PM manages the property)
5. Work order status must be `"Completed"` or `"Canceled"`
6. Status will be changed to `"In Progress"`

## Android Client Example

```kotlin
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

suspend fun reopenWorkOrder(
    workOrderId: String,
    accessToken: String,
    supabaseUrl: String
): Result<WorkOrder> {
    return withContext(Dispatchers.IO) {
        try {
            val url = "$supabaseUrl/functions/v1/reopen-work-order"
            
            val bodyJson = JSONObject().apply {
                put("work_order_id", workOrderId)
            }
            
            val requestBody = bodyJson.toString()
                .toRequestBody("application/json".toMediaType())
            
            val request = Request.Builder()
                .url(url)
                .post(requestBody)
                .addHeader("Authorization", "Bearer $accessToken")
                .addHeader("Content-Type", "application/json")
                .build()
            
            val client = OkHttpClient()
            val response = client.newCall(request).execute()
            
            if (response.isSuccessful) {
                val responseBody = response.body?.string()
                // Parse response
                val jsonResponse = JSONObject(responseBody)
                val workOrderJson = jsonResponse.getJSONObject("work_order")
                val workOrder = parseWorkOrder(workOrderJson)
                Result.success(workOrder)
            } else {
                val errorBody = response.body?.string()
                Result.failure(Exception("Failed to reopen: $errorBody"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
```

## Error Codes

- **400**: Bad Request (missing work_order_id, invalid status)
- **401**: Unauthorized (missing/invalid token)
- **403**: Forbidden (user doesn't have permission, wrong role)
- **404**: Not Found (work order or user not found)
- **500**: Internal Server Error

## Notes

- This function bypasses RLS by using the service role key
- Authentication is still required and validated
- Authorization is enforced at the application level
- The function logs all reopen operations for auditing


# Android Client - Reopen Work Order Request

## Recommended: Use Edge Function (Bypasses RLS)

**Method:** `POST`

**URL:**
```
https://YOUR_PROJECT_ID.supabase.co/functions/v1/reopen-work-order
```

Replace `YOUR_PROJECT_ID` with your Supabase project ID (e.g., `goljbyvrnktxwtnjomaq`)

## Request Headers

```kotlin
headers = mapOf(
    "Authorization" to "Bearer ${accessToken}",
    "Content-Type" to "application/json"
)
```

## Request Body

```json
{
  "work_order_id": "uuid-of-work-order"
}
```

---

## Alternative: Direct REST API (May be blocked by RLS)

If you prefer using the REST API directly (may require RLS policy changes):

## Complete Kotlin Example (Edge Function)

```kotlin
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

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
                .post(requestBody) // Use POST method
                .addHeader("Authorization", "Bearer $accessToken")
                .addHeader("Content-Type", "application/json")
                .build()
            
            val client = OkHttpClient()
            val response = client.newCall(request).execute()
            
            if (response.isSuccessful) {
                val responseBody = response.body?.string()
                val jsonResponse = JSONObject(responseBody)
                
                if (jsonResponse.getBoolean("success")) {
                    val workOrderJson = jsonResponse.getJSONObject("work_order")
                    val workOrder = parseWorkOrder(workOrderJson) // Your parsing function
                    Result.success(workOrder)
                } else {
                    val error = jsonResponse.getString("error")
                    Result.failure(Exception(error))
                }
            } else {
                val errorBody = response.body?.string()
                Result.failure(Exception("Failed to reopen work order: ${response.code} - $errorBody"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
```

## Alternative: Direct REST API Example (May be blocked by RLS)

```kotlin
suspend fun reopenWorkOrderDirect(
    workOrderId: String,
    accessToken: String,
    supabaseUrl: String,
    supabaseAnonKey: String
): Result<WorkOrder> {
    return withContext(Dispatchers.IO) {
        try {
            val url = "$supabaseUrl/rest/v1/work_orders?id=eq.$workOrderId"
            
            val bodyJson = JSONObject().apply {
                put("status", "In Progress")
            }
            
            val requestBody = bodyJson.toString()
                .toRequestBody("application/json".toMediaType())
            
            val request = Request.Builder()
                .url(url)
                .patch(requestBody) // Use PATCH method
                .addHeader("Authorization", "Bearer $accessToken")
                .addHeader("apikey", supabaseAnonKey)
                .addHeader("Content-Type", "application/json")
                .addHeader("Prefer", "return=representation")
                .build()
            
            val client = OkHttpClient()
            val response = client.newCall(request).execute()
            
            if (response.isSuccessful) {
                val responseBody = response.body?.string()
                // Parse response if needed
                Result.success(/* parsed WorkOrder */)
            } else {
                Result.failure(Exception("Failed to reopen work order: ${response.code}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
```

## Using Supabase Kotlin Client

```kotlin
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns

suspend fun reopenWorkOrder(
    supabase: SupabaseClient,
    workOrderId: String
): Result<WorkOrder> {
    return try {
        val updated = supabase
            .from("work_orders")
            .update(mapOf("status" to "In Progress")) {
                filter {
                    eq("id", workOrderId)
                }
            }
            .decodeSingle<WorkOrder>()
        
        Result.success(updated)
    } catch (e: Exception) {
        Result.failure(e)
    }
}
```

## Status Values

Valid status values (from the database constraint):
- `"Pending"`
- `"In Progress"` ← Use this to reopen
- `"Completed"`
- `"Canceled"`

## Notes

1. **Authentication**: Make sure you have a valid access token from Supabase Auth
2. **RLS Policies**: The user must have permission to update work orders (PMs can update work orders in their properties)
3. **Status Transition**: This changes the status from `"Completed"` or `"Canceled"` to `"In Progress"`
4. **Response**: With `Prefer: return=representation`, the API will return the updated work order object

## Example Request (Raw HTTP)

```http
PATCH https://goljbyvrnktxwtnjomaq.supabase.co/rest/v1/work_orders?id=eq.d3e7e1fd-aaf2-4ae3-a0f2-7b5e6830cd30
Authorization: Bearer YOUR_ACCESS_TOKEN
apikey: YOUR_SUPABASE_ANON_KEY
Content-Type: application/json
Prefer: return=representation

{
  "status": "In Progress"
}
```


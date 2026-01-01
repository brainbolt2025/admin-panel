# Create Work Order Edge Function

This Supabase Edge Function allows tenants to create work orders. It bypasses RLS by using the service role key and validates that only tenants can create work orders.

## Features

- ✅ JWT token verification
- ✅ Tenant role verification
- ✅ Automatically sets tenant_id from authenticated user
- ✅ Uses property_id from user profile if not provided
- ✅ Uses unit_number from user profile if not provided
- ✅ Validates priority values
- ✅ Bypasses RLS using service role key
- ✅ Returns created work order with all fields

## Deployment

```bash
# Deploy with JWT verification enabled (default)
supabase functions deploy create-work-order
```

## Usage from Client App

### Request

**Endpoint:** `https://YOUR_PROJECT.supabase.co/functions/v1/create-work-order`

**Method:** `POST`

**Headers:**
- `Content-Type: application/json`
- `Authorization: Bearer <tenant_jwt_token>`

**Body:**
```json
{
  "title": "Leaky faucet in kitchen",           // Optional
  "description": "The kitchen faucet has been leaking for the past week.",  // Required
  "priority": "Medium",                         // Optional: "Low", "Medium", or "High" (defaults to "Medium")
  "property_id": "uuid-of-property",           // Optional: uses tenant's property_id if not provided
  "unit_number": "A101"                        // Optional: uses tenant's unit_number if not provided
}
```

### Response

**Success (200):**
```json
{
  "success": true,
  "data": {
    "id": "work-order-uuid",
    "title": "Leaky faucet in kitchen",
    "description": "The kitchen faucet has been leaking for the past week.",
    "priority": "Medium",
    "status": "Pending",
    "tenant_id": "tenant-uuid",
    "property_id": "property-uuid",
    "unit_number": "A101",
    "technician_id": null,
    "attachments": [],
    "seen_by_pm": false,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

**Error Responses:**

**401 - Unauthorized:**
```json
{
  "error": "Missing authorization header"
}
```

**403 - Forbidden:**
```json
{
  "error": "Only tenants can create work orders"
}
```

**400 - Bad Request:**
```json
{
  "error": "Description is required"
}
```

or

```json
{
  "error": "Property ID is required. Either provide it in the request or ensure your user profile has a property_id."
}
```

**500 - Internal Server Error:**
```json
{
  "error": "Failed to create work order",
  "details": "detailed error message"
}
```

## Example: Kotlin/Android

```kotlin
suspend fun createWorkOrder(
    title: String?,
    description: String,
    priority: String = "Medium"
): Result<WorkOrder> = withContext(Dispatchers.IO) {
    try {
        val session = supabase.auth.currentSessionOrNull()
            ?: return@withContext Result.failure(Exception("Not authenticated"))
        
        val response = supabase.functions.invoke(
            function = "create-work-order",
            parameters = FunctionsInvokeOptions(
                body = mapOf(
                    "title" to (title ?: ""),
                    "description" to description,
                    "priority" to priority
                )
            )
        )
        
        val result = response.decodeAs<CreateWorkOrderResponse>()
        Result.success(result.data)
    } catch (e: Exception) {
        Result.failure(e)
    }
}

data class CreateWorkOrderResponse(
    val success: Boolean,
    val data: WorkOrder
)
```

## Example: JavaScript/TypeScript

```typescript
const createWorkOrder = async (
  title: string | null,
  description: string,
  priority: 'Low' | 'Medium' | 'High' = 'Medium'
) => {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(
    `${supabaseUrl}/functions/v1/create-work-order`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        title,
        description,
        priority,
      }),
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create work order')
  }

  const result = await response.json()
  return result.data
}
```

## How It Works

1. **Authentication**: Verifies JWT token from Authorization header
2. **Role Check**: Ensures the authenticated user has role = 'tenant'
3. **Data Extraction**: 
   - Always sets `tenant_id` to authenticated user's ID
   - Uses `property_id` from request or falls back to user's profile
   - Uses `unit_number` from request or falls back to user's profile
4. **Validation**: Validates required fields (description) and priority values
5. **Creation**: Creates work order using admin client (bypasses RLS)
6. **Response**: Returns created work order with all fields

## Default Values

- `status`: Always set to `'Pending'`
- `priority`: Defaults to `'Medium'` if not provided
- `attachments`: Always starts as empty array `[]`
- `seen_by_pm`: Always set to `false` for new work orders
- `technician_id`: Always `null` for new work orders

## Security Notes

- Only tenants can create work orders (role check enforced)
- `tenant_id` is always set to authenticated user (cannot be spoofed)
- Uses service role key to bypass RLS, ensuring creation succeeds
- All input is validated before database insertion









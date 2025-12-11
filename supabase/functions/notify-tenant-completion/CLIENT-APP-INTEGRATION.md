# Client App Integration Guide: Notify Tenant Completion

This guide provides details for integrating the `notify-tenant-completion` edge function into your client application.

## Overview

The `notify-tenant-completion` edge function sends a completion notification email to a tenant when a work order is marked as completed. This function should be called after a work order's status is updated to "Completed".

## API Endpoint

### URL
```
https://YOUR_PROJECT_ID.supabase.co/functions/v1/notify-tenant-completion
```

### Development vs Production
- **Development**: `https://goljbyvrnktxwtnjomaq.supabase.co/functions/v1/notify-tenant-completion`
- **Production**: `https://qmhmgjzkpfzxfjdurigu.supabase.co/functions/v1/notify-tenant-completion`

## Request Details

### Method
`POST`

### Headers

| Key | Value | Required | Description |
|-----|-------|----------|-------------|
| `Content-Type` | `application/json` | Yes | Content type header |
| `Authorization` | `Bearer YOUR_ACCESS_TOKEN` | Yes | User's authentication token from `localStorage.getItem('access_token')` |
| `apikey` | `YOUR_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key for API access |

### Request Body

```json
{
  "work_order_id": "uuid-string-here"
}
```

#### Request Body Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `work_order_id` | `string` (UUID) | Yes | The unique identifier of the completed work order |

## Response Formats

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Completion notification sent to tenant",
  "tenant_email": "tenant@example.com",
  "work_order_id": "uuid-string-here",
  "mailgun_id": "<20231201234567.abc123@mg.asine.app>"
}
```

### Error Responses

#### 400 Bad Request - Missing work_order_id
```json
{
  "success": false,
  "error": "Missing work_order_id"
}
```

#### 400 Bad Request - Work order not completed
```json
{
  "success": false,
  "error": "Work order is not completed"
}
```

#### 400 Bad Request - No tenant assigned
```json
{
  "success": false,
  "error": "Work order has no tenant"
}
```

#### 404 Not Found - Work order not found
```json
{
  "success": false,
  "error": "Work order not found"
}
```

#### 404 Not Found - Tenant not found
```json
{
  "success": false,
  "error": "Tenant not found"
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal server error"
}
```

#### 500 Internal Server Error - Mailgun configuration missing
```json
{
  "success": false,
  "error": "Mailgun configuration missing"
}
```

#### 500 Internal Server Error - Failed to send email
```json
{
  "success": false,
  "error": "Failed to send completion notification email",
  "details": "Error details from Mailgun"
}
```

## Integration Examples

### React/TypeScript Example

```typescript
import { config } from '../config' // Your config file with Supabase URL and keys

interface NotifyCompletionResponse {
  success: boolean
  message?: string
  tenant_email?: string
  work_order_id?: string
  mailgun_id?: string
  error?: string
  details?: string
}

async function notifyTenantCompletion(workOrderId: string): Promise<NotifyCompletionResponse> {
  try {
    // Get authentication token from localStorage
    const accessToken = localStorage.getItem('access_token')
    
    if (!accessToken) {
      throw new Error('User is not authenticated. Please log in again.')
    }

    // Get Supabase URL from config (handles dev/prod automatically)
    const supabaseUrl = config.supabase.url
    const anonKey = config.supabase.anonKey

    // Make the request
    const response = await fetch(
      `${supabaseUrl}/functions/v1/notify-tenant-completion`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'apikey': anonKey
        },
        body: JSON.stringify({
          work_order_id: workOrderId
        })
      }
    )

    const data: NotifyCompletionResponse = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to send completion notification')
    }

    return data
  } catch (error) {
    console.error('Error notifying tenant completion:', error)
    throw error
  }
}

// Usage example in a component
async function handleWorkOrderCompletion(workOrderId: string) {
  try {
    // First, update the work order status to "Completed"
    // ... your code to update work order status ...
    
    // Then, notify the tenant
    const result = await notifyTenantCompletion(workOrderId)
    console.log('Notification sent:', result)
    alert(`Completion notification sent to ${result.tenant_email}`)
  } catch (error) {
    console.error('Failed to notify tenant:', error)
    alert(error instanceof Error ? error.message : 'Failed to send notification')
  }
}
```

### React Component Integration Example

```typescript
import { useState } from 'react'
import { config } from '../config'

function WorkOrderDetails({ workOrderId }: { workOrderId: string }) {
  const [sendingNotification, setSendingNotification] = useState(false)
  const [notificationError, setNotificationError] = useState<string | null>(null)

  const handleCompleteAndNotify = async () => {
    setSendingNotification(true)
    setNotificationError(null)

    try {
      // Step 1: Update work order status (example using Supabase client)
      const supabase = getAuthenticatedSupabase()
      const { error: updateError } = await supabase
        .from('work_orders')
        .update({ status: 'Completed' })
        .eq('id', workOrderId)

      if (updateError) {
        throw new Error(`Failed to update work order: ${updateError.message}`)
      }

      // Step 2: Notify tenant
      const accessToken = localStorage.getItem('access_token')
      if (!accessToken) {
        throw new Error('User is not authenticated')
      }

      const response = await fetch(
        `${config.supabase.url}/functions/v1/notify-tenant-completion`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'apikey': config.supabase.anonKey
          },
          body: JSON.stringify({
            work_order_id: workOrderId
          })
        }
      )

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to send notification')
      }

      alert(`Completion notification sent to ${data.tenant_email}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setNotificationError(errorMessage)
      console.error('Error:', error)
    } finally {
      setSendingNotification(false)
    }
  }

  return (
    <div>
      <button 
        onClick={handleCompleteAndNotify}
        disabled={sendingNotification}
      >
        {sendingNotification ? 'Sending Notification...' : 'Complete & Notify Tenant'}
      </button>
      {notificationError && (
        <div className="error">{notificationError}</div>
      )}
    </div>
  )
}
```

### Kotlin/Android Example

```kotlin
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

class WorkOrderService(private val supabaseUrl: String, private val anonKey: String) {
    private val client = OkHttpClient()

    data class NotificationResponse(
        val success: Boolean,
        val message: String? = null,
        val tenantEmail: String? = null,
        val workOrderId: String? = null,
        val mailgunId: String? = null,
        val error: String? = null
    )

    suspend fun notifyTenantCompletion(
        workOrderId: String,
        accessToken: String
    ): Result<NotificationResponse> {
        return withContext(Dispatchers.IO) {
            try {
                val requestBody = JSONObject().apply {
                    put("work_order_id", workOrderId)
                }.toString()
                    .toRequestBody("application/json".toMediaType())

                val request = Request.Builder()
                    .url("$supabaseUrl/functions/v1/notify-tenant-completion")
                    .post(requestBody)
                    .addHeader("Content-Type", "application/json")
                    .addHeader("Authorization", "Bearer $accessToken")
                    .addHeader("apikey", anonKey)
                    .build()

                val response = client.newCall(request).execute()
                val responseBody = response.body?.string() ?: ""

                if (response.isSuccessful) {
                    val json = JSONObject(responseBody)
                    val notificationResponse = NotificationResponse(
                        success = json.getBoolean("success"),
                        message = json.optString("message"),
                        tenantEmail = json.optString("tenant_email"),
                        workOrderId = json.optString("work_order_id"),
                        mailgunId = json.optString("mailgun_id")
                    )
                    
                    if (notificationResponse.success) {
                        Result.success(notificationResponse)
                    } else {
                        Result.failure(
                            Exception(json.optString("error", "Unknown error"))
                        )
                    }
                } else {
                    val json = JSONObject(responseBody)
                    Result.failure(
                        Exception(json.optString("error", "Request failed"))
                    )
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }
}

// Usage in ViewModel or Activity
suspend fun completeWorkOrderAndNotify(workOrderId: String) {
    // First update work order status
    // ... your code to update status ...
    
    // Then notify tenant
    val result = workOrderService.notifyTenantCompletion(
        workOrderId = workOrderId,
        accessToken = getAccessToken() // Your method to get auth token
    )
    
    result.onSuccess { response ->
        Log.d("WorkOrder", "Notification sent to ${response.tenantEmail}")
        // Show success message to user
    }.onFailure { error ->
        Log.e("WorkOrder", "Failed to notify tenant", error)
        // Show error message to user
    }
}
```

### Swift/iOS Example

```swift
import Foundation

struct NotificationResponse: Codable {
    let success: Bool
    let message: String?
    let tenantEmail: String?
    let workOrderId: String?
    let mailgunId: String?
    let error: String?
    
    enum CodingKeys: String, CodingKey {
        case success
        case message
        case tenantEmail = "tenant_email"
        case workOrderId = "work_order_id"
        case mailgunId = "mailgun_id"
        case error
    }
}

class WorkOrderService {
    let supabaseUrl: String
    let anonKey: String
    
    init(supabaseUrl: String, anonKey: String) {
        self.supabaseUrl = supabaseUrl
        self.anonKey = anonKey
    }
    
    func notifyTenantCompletion(
        workOrderId: String,
        accessToken: String
    ) async throws -> NotificationResponse {
        guard let url = URL(string: "\(supabaseUrl)/functions/v1/notify-tenant-completion") else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        
        let requestBody: [String: Any] = [
            "work_order_id": workOrderId
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: requestBody)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        
        let notificationResponse = try JSONDecoder().decode(NotificationResponse.self, from: data)
        
        if !notificationResponse.success {
            throw NSError(
                domain: "WorkOrderService",
                code: httpResponse.statusCode,
                userInfo: [NSLocalizedDescriptionKey: notificationResponse.error ?? "Unknown error"]
            )
        }
        
        return notificationResponse
    }
}

// Usage
Task {
    do {
        // First update work order status
        // ... your code ...
        
        // Then notify tenant
        let response = try await workOrderService.notifyTenantCompletion(
            workOrderId: workOrderId,
            accessToken: accessToken
        )
        print("Notification sent to \(response.tenantEmail ?? "tenant")")
        // Show success message
    } catch {
        print("Failed to notify tenant: \(error)")
        // Show error message
    }
}
```

## Important Notes

### Prerequisites

1. **Work Order Status**: The work order **must** be in "Completed" status before calling this function. The function will return an error if the status is not "Completed".

2. **Work Order Assignment**: The work order must have a `tenant_id` assigned. If there's no tenant, the function will return an error.

3. **Authentication**: The user making the request must be authenticated. The `access_token` should be retrieved from `localStorage` (web) or your app's secure storage (mobile).

### Best Practice: Call After Status Update

It's recommended to call this function **immediately after** updating the work order status to "Completed":

```typescript
// ✅ Good: Update status first, then notify
await updateWorkOrderStatus(workOrderId, 'Completed')
await notifyTenantCompletion(workOrderId)

// ❌ Bad: Notify before status is updated (will fail)
await notifyTenantCompletion(workOrderId)
await updateWorkOrderStatus(workOrderId, 'Completed')
```

### Error Handling

Always handle errors gracefully:

```typescript
try {
  const result = await notifyTenantCompletion(workOrderId)
  // Success handling
} catch (error) {
  // Check specific error types
  if (error.message.includes('not completed')) {
    // Handle: Work order status not updated yet
  } else if (error.message.includes('no tenant')) {
    // Handle: No tenant assigned to work order
  } else if (error.message.includes('not authenticated')) {
    // Handle: User needs to log in again
  } else {
    // Handle: Generic error
  }
}
```

### Deep Link in Email

The email sent to the tenant includes a deep link to view the completed work order:

- **Deep Link Format**: `asine://work-order/{work_order_id}` (if `TENANT_APP_DEEP_LINK_SCHEME` is configured)
- **Web URL Format**: `{TENANT_APP_URL}/work-order/{work_order_id}` (fallback)

Make sure your tenant app can handle these deep links appropriately.

## Testing

### Test Case 1: Valid Completed Work Order
```json
{
  "work_order_id": "valid-completed-work-order-uuid"
}
```
**Expected**: Success response with `tenant_email` and `mailgun_id`

### Test Case 2: Missing work_order_id
```json
{}
```
**Expected**: Error response: "Missing work_order_id"

### Test Case 3: Work Order Not Completed
```json
{
  "work_order_id": "pending-work-order-uuid"
}
```
**Expected**: Error response: "Work order is not completed"

### Test Case 4: Work Order Without Tenant
```json
{
  "work_order_id": "work-order-without-tenant-uuid"
}
```
**Expected**: Error response: "Work order has no tenant"

### Test Case 5: Invalid Authentication
**Expected**: 401 Unauthorized or error about missing authentication

## Troubleshooting

### 401 Unauthorized
- **Cause**: Missing or invalid `access_token`
- **Solution**: 
  - Check that user is logged in
  - Retrieve token from `localStorage.getItem('access_token')`
  - Refresh token if expired

### 400 Bad Request - "Work order is not completed"
- **Cause**: Work order status is not "Completed"
- **Solution**: Update work order status to "Completed" before calling this function

### 400 Bad Request - "Work order has no tenant"
- **Cause**: Work order doesn't have a `tenant_id`
- **Solution**: Assign a tenant to the work order first

### 500 Internal Server Error
- **Cause**: Server-side configuration issue (Mailgun not configured, etc.)
- **Solution**: Check Supabase Edge Function logs and verify environment variables are set

### Email Not Received
- **Cause**: Email delivery issue
- **Solution**: 
  - Check Mailgun logs in Mailgun Dashboard
  - Verify tenant email address is correct
  - Check spam folder
  - Verify Mailgun domain is verified

## Environment Variables (Server-Side)

These are configured in Supabase Dashboard (not needed in client app):

- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for admin access
- `MAILGUN_DOMAIN`: Mailgun domain name
- `MAILGUN_API_KEY`: Mailgun private API key
- `MAILGUN_REGION`: Mailgun region (`us` or `eu`)
- `TENANT_APP_DEEP_LINK_SCHEME`: Deep link scheme (e.g., `asine://`)
- `TENANT_APP_URL`: Tenant app URL (fallback if no deep link)
- `STRIPE_SECRET_KEY`: Used to detect test/production mode

## Related Documentation

- See `README.md` for function overview
- See `DEPLOY.md` for deployment instructions


# Send Bulk Waitlist Email Edge Function

This Supabase Edge Function allows super admins to send bulk emails to all Property Managers in the waitlist.

## Features

- ✅ Super admin authentication required
- ✅ Bulk email to all waitlist entries
- ✅ Status filter support (pending, contacted, approved, declined, or all)
- ✅ Customizable subject and message
- ✅ Updates `notified_at` timestamp for successful sends
- ✅ Detailed success/failure reporting
- ✅ HTML and plain text email support

## Setup

### Prerequisites

- `pm_waitlist` table must exist
- Mailgun secrets configured:
  - `MAILGUN_DOMAIN`
  - `MAILGUN_API_KEY`
  - `MAILGUN_REGION` (optional, defaults to 'us')

### Deployment

```bash
# Deploy to staging
supabase functions deploy send-bulk-waitlist-email --project-ref goljbyvrnktxwtnjomaq

# Deploy to production
supabase functions deploy send-bulk-waitlist-email --project-ref qmhmgjzkpfzxfjdurigu
```

## API Usage

### Request

**Endpoint:**
```
POST https://{project-ref}.supabase.co/functions/v1/send-bulk-waitlist-email
```

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {jwt_token}
```

**Body:**
```json
{
  "subject": "Welcome to Asine!",
  "message": "Thank you for joining our waitlist...",
  "status_filter": "pending" // optional: "pending" | "contacted" | "approved" | "declined" | "all" (default: "all")
}
```

### Response

**Success (200):**
```json
{
  "success": true,
  "message": "Bulk email completed: 10 sent, 0 failed",
  "total": 10,
  "sent": 10,
  "failed": 0,
  "results": [
    {
      "email": "pm@example.com",
      "property_name": "ABC Properties",
      "success": true
    },
    {
      "email": "failed@example.com",
      "property_name": "XYZ Properties",
      "success": false,
      "error": "HTTP 400: Invalid email address"
    }
  ]
}
```

**Error Responses:**

- **401**: Missing or invalid authorization token
- **403**: User is not a super_admin
- **400**: Missing required fields (subject or message)
- **500**: Mailgun not configured or server error

## Frontend Integration

The function is integrated into the admin panel at the "PM Waitlist" page. Super admins can:

1. View all waitlist entries
2. Filter by status
3. Compose and send bulk emails
4. See detailed success/failure results

## Email Format

Emails are sent with:
- **From:** `Asine <noreply@{MAILGUN_DOMAIN}>`
- **Subject:** As specified in request
- **Body:** HTML format with line breaks preserved, plus plain text version
- **Footer:** "Best regards, The Asine Team"

## Notes

- The function updates the `notified_at` timestamp in the `pm_waitlist` table for each successfully sent email
- Failed emails are reported but don't prevent other emails from being sent
- The function processes emails sequentially (one at a time) to avoid overwhelming Mailgun
- Status filter applies to which waitlist entries receive the email











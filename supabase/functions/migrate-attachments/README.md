# Migrate Attachments Edge Function

This Edge Function migrates existing files from the `work-order-media` storage bucket into the `attachments` column of the `work_orders` table.

## What It Does

1. Lists all files in the `work-order-media` storage bucket
2. Extracts work order IDs from file paths/names (supports multiple naming patterns)
3. Groups files by work order ID
4. Builds attachment metadata objects
5. Updates the `attachments` column for each work order (merges with existing attachments)

## File Naming Patterns Supported

The function recognizes these file naming patterns:
- `workorder_{uuid}/filename.jpg`
- `workorder-{uuid}/filename.jpg`
- `{uuid}/filename.jpg`
- `{uuid}_filename.jpg`

## Prerequisites

1. The `attachments` column must exist in the `work_orders` table
   - Run `add-attachments-to-work-orders.sql` first if you haven't already

2. Service role key must be configured in Supabase secrets

## Deployment

```bash
supabase functions deploy migrate-attachments
```

## Usage

### Via cURL

```bash
curl -X POST \
  'https://your-project.supabase.co/functions/v1/migrate-attachments' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json'
```

### Via Supabase Dashboard

1. Go to **Edge Functions** → **migrate-attachments**
2. Click **Invoke**
3. View the response for migration results

## Response

```json
{
  "message": "Migration completed",
  "totalFiles": 150,
  "workOrdersProcessed": 45,
  "attachmentsMigrated": 142,
  "attachmentsSkipped": 8,
  "errors": ["Work order abc-123: Not found"]
}
```

## Notes

- The function merges new attachments with existing ones (won't duplicate)
- Files that can't be matched to a work order are skipped
- The function processes files in batches for efficiency
- `uploaded_by` is set to `null` for migrated files (unknown for existing files)

## Troubleshooting

### "No files found"
- Check that the `work-order-media` bucket exists
- Verify files are actually in the bucket

### "Work order not found"
- Some files may reference work orders that no longer exist
- These are skipped and reported in the response

### "Service role key not configured"
- Set `SUPABASE_SERVICE_ROLE_KEY` in Supabase secrets

## Running Multiple Times

The function is safe to run multiple times:
- It merges with existing attachments
- Duplicates are automatically avoided (by file path)
- You can re-run if you add more files later



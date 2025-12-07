# Deploy Migrate Attachments Function

## Quick Deploy

```bash
supabase functions deploy migrate-attachments
```

## Prerequisites

1. **Run the attachments migration SQL first:**
   ```sql
   -- Run add-attachments-to-work-orders.sql in Supabase SQL Editor
   ```

2. **Verify service role key is set:**
   ```bash
   supabase secrets list
   ```
   
   If `SUPABASE_SERVICE_ROLE_KEY` is missing:
   ```bash
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

## Usage

After deployment, invoke the function:

```bash
curl -X POST \
  'https://your-project.supabase.co/functions/v1/migrate-attachments' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json'
```

Or use the Supabase Dashboard:
1. Go to **Edge Functions**
2. Find `migrate-attachments`
3. Click **Invoke**

## What Happens

1. Function lists all files in `work-order-media` bucket
2. Extracts work order IDs from file paths
3. Updates `work_orders.attachments` column with file metadata
4. Returns summary of migration results

## Expected Output

```json
{
  "message": "Migration completed",
  "totalFiles": 150,
  "workOrdersProcessed": 45,
  "attachmentsMigrated": 142,
  "attachmentsSkipped": 8
}
```

## Notes

- Safe to run multiple times (merges with existing attachments)
- Files without matching work orders are skipped
- Existing attachments are preserved and merged



# Using the Attachments Column in Work Orders

## Overview

The `attachments` column in the `work_orders` table stores an array of attachment metadata. Files are still stored in the `work-order-media` storage bucket, but the metadata is stored in the database for efficient querying.

## Column Structure

The `attachments` column is a JSONB array. Each attachment object has the following structure:

```typescript
interface Attachment {
  path: string;        // Full path in storage bucket (e.g., "workorder_123/file.jpg")
  name: string;        // Original filename (e.g., "photo.jpg")
  size: number;        // File size in bytes
  mime_type: string;   // MIME type (e.g., "image/jpeg", "application/pdf")
  uploaded_at: string; // ISO 8601 timestamp
  uploaded_by: string; // UUID of user who uploaded the file
}
```

## Adding an Attachment

When a file is uploaded to storage, also update the work order's `attachments` column:

### Using Supabase Client (TypeScript/JavaScript)

```typescript
async function addAttachmentToWorkOrder(
  workOrderId: string,
  file: File,
  storagePath: string,
  userId: string
) {
  const supabaseClient = getAuthenticatedSupabase();

  // 1. Upload file to storage
  const { data: uploadData, error: uploadError } = await supabaseClient.storage
    .from('work-order-media')
    .upload(storagePath, file);

  if (uploadError) {
    throw uploadError;
  }

  // 2. Create attachment metadata object
  const attachment = {
    path: storagePath,
    name: file.name,
    size: file.size,
    mime_type: file.type || 'application/octet-stream',
    uploaded_at: new Date().toISOString(),
    uploaded_by: userId,
  };

  // 3. Append to attachments array in work_orders table
  const { error: updateError } = await supabaseClient
    .from('work_orders')
    .update({
      attachments: supabaseClient.rpc('jsonb_array_append', {
        jsonb_array: supabaseClient.rpc('coalesce', [
          supabaseClient.from('work_orders').select('attachments').eq('id', workOrderId).single(),
          '[]'::jsonb
        ]),
        new_element: attachment
      })
    })
    .eq('id', workOrderId);

  // OR use a simpler approach with PostgREST:
  const { data: currentOrder } = await supabaseClient
    .from('work_orders')
    .select('attachments')
    .eq('id', workOrderId)
    .single();

  const currentAttachments = currentOrder?.attachments || [];
  const updatedAttachments = [...currentAttachments, attachment];

  const { error: updateError } = await supabaseClient
    .from('work_orders')
    .update({ attachments: updatedAttachments })
    .eq('id', workOrderId);

  if (updateError) {
    throw updateError;
  }
}
```

### Using SQL Directly

```sql
-- Add an attachment to a work order
UPDATE work_orders 
SET attachments = attachments || jsonb_build_object(
  'path', 'workorder_123/file.jpg',
  'name', 'file.jpg',
  'size', 102400,
  'mime_type', 'image/jpeg',
  'uploaded_at', NOW()::text,
  'uploaded_by', 'user-uuid-here'
)::jsonb
WHERE id = 'work-order-uuid';
```

## Querying Attachments

### Get all work orders with attachments

```sql
SELECT id, title, attachments 
FROM work_orders 
WHERE jsonb_array_length(attachments) > 0;
```

### Get work orders with specific file types

```sql
SELECT id, title, attachments 
FROM work_orders 
WHERE attachments @> '[{"mime_type": "image/jpeg"}]'::jsonb;
```

### Count attachments per work order

```sql
SELECT 
  id, 
  title, 
  jsonb_array_length(COALESCE(attachments, '[]'::jsonb)) as attachment_count
FROM work_orders;
```

### Using Supabase Client

```typescript
// Fetch work order with attachments
const { data, error } = await supabaseClient
  .from('work_orders')
  .select('id, title, attachments')
  .eq('id', workOrderId)
  .single();

const attachments = data?.attachments || [];
```

## Removing an Attachment

### Using Supabase Client

```typescript
async function removeAttachmentFromWorkOrder(
  workOrderId: string,
  attachmentPath: string
) {
  const supabaseClient = getAuthenticatedSupabase();

  // 1. Get current attachments
  const { data: currentOrder } = await supabaseClient
    .from('work_orders')
    .select('attachments')
    .eq('id', workOrderId)
    .single();

  // 2. Filter out the attachment
  const updatedAttachments = (currentOrder?.attachments || []).filter(
    (att: Attachment) => att.path !== attachmentPath
  );

  // 3. Update work order
  const { error } = await supabaseClient
    .from('work_orders')
    .update({ attachments: updatedAttachments })
    .eq('id', workOrderId);

  if (error) throw error;

  // 4. Delete file from storage
  const { error: deleteError } = await supabaseClient.storage
    .from('work-order-media')
    .remove([attachmentPath]);

  if (deleteError) throw deleteError;
}
```

### Using SQL

```sql
-- Remove an attachment by path
UPDATE work_orders 
SET attachments = (
  SELECT jsonb_agg(elem)
  FROM jsonb_array_elements(attachments) elem
  WHERE elem->>'path' != 'workorder_123/file.jpg'
)
WHERE id = 'work-order-uuid';
```

## Migration from Current System

If you're currently using the storage bucket listing approach (like in `WorkOrders.tsx`), you can migrate existing files to the `attachments` column:

```typescript
async function migrateExistingFilesToAttachments(workOrderId: string) {
  const supabaseClient = getAuthenticatedSupabase();

  // 1. List all files for this work order from storage
  const { data: files, error: listError } = await supabaseClient.storage
    .from('work-order-media')
    .list('', {
      limit: 1000,
    });

  if (listError) throw listError;

  const relevantFiles = files.filter((file) =>
    file.name.includes(`workorder_${workOrderId}`)
  );

  // 2. Build attachments array
  const attachments = relevantFiles.map((file) => ({
    path: file.name,
    name: file.name.split('/').pop() || file.name,
    size: file.metadata?.size || 0,
    mime_type: file.metadata?.mimetype || 'application/octet-stream',
    uploaded_at: file.created_at || new Date().toISOString(),
    uploaded_by: null, // Unknown for existing files
  }));

  // 3. Update work order
  const { error } = await supabaseClient
    .from('work_orders')
    .update({ attachments })
    .eq('id', workOrderId);

  if (error) throw error;
}
```

## Benefits

1. **Faster Queries**: No need to list all files in storage and filter
2. **Metadata Storage**: Store additional info (uploader, upload time) with files
3. **Efficient Filtering**: Query by file type, size, uploader, etc. using JSONB operators
4. **Better Performance**: GIN index on JSONB column enables fast searches
5. **Data Integrity**: Database constraints ensure valid structure

## Client-Side Access (Mobile App)

For clients (tenants and technicians) to view attachments:

1. **Query the `attachments` column** from `work_orders` table
2. **Generate signed URLs** from Supabase Storage for each attachment
3. **Display images** using the signed URLs

See `CLIENT-ATTACHMENTS-GUIDE.md` for complete client-side implementation examples.

**Important**: Clients should NOT list all files in storage. They should:
- ✅ Query `work_orders.attachments` column
- ✅ Generate signed URLs for each attachment path
- ❌ NOT list all files and filter (inefficient)

## Notes

- Files are still stored in the `work-order-media` storage bucket
- The `attachments` column only stores metadata, not the actual files
- Always keep storage and database in sync when adding/removing files
- Consider using database triggers or Edge Functions to automatically update `attachments` when files are uploaded/deleted
- **Clients should use signed URLs** for secure, temporary access (see `CLIENT-ATTACHMENTS-GUIDE.md`)
- **Storage bucket policies** must be configured (see `setup-storage-policies.sql`)


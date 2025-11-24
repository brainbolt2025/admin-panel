# Client-Side Guide: Fetching Work Order Attachments

## Overview

Clients (mobile app - tenants and technicians) should:
1. **Query the `attachments` column** from the `work_orders` table to get attachment metadata
2. **Generate signed URLs** from Supabase Storage for secure, temporary access
3. **Display images** using the signed URLs

This approach is:
- ✅ **Secure**: Signed URLs expire after a set time
- ✅ **Efficient**: No need to list all files in storage
- ✅ **Fast**: Direct access to specific files
- ✅ **Scalable**: Works with thousands of attachments

## Recommended Flow

```
Client App
    ↓
1. Query work_orders table (with attachments column)
    ↓
2. Get attachment metadata (path, name, size, etc.)
    ↓
3. Generate signed URLs for each attachment
    ↓
4. Display images using signed URLs
```

## Implementation

### Step 1: Query Work Order with Attachments

```typescript
// Example: Fetch work order with attachments
async function fetchWorkOrderWithAttachments(workOrderId: string) {
  const supabaseClient = getAuthenticatedSupabase();

  const { data, error } = await supabaseClient
    .from('work_orders')
    .select('id, title, description, attachments')
    .eq('id', workOrderId)
    .single();

  if (error) throw error;
  return data;
}
```

### Step 2: Generate Signed URLs for Attachments

```typescript
// Example: Get signed URLs for all attachments
async function getAttachmentUrls(
  attachments: Attachment[],
  expiresIn: number = 3600 // 1 hour default
): Promise<AttachmentWithUrl[]> {
  const supabaseClient = getAuthenticatedSupabase();

  const attachmentsWithUrls = await Promise.all(
    attachments.map(async (attachment) => {
      // Generate signed URL for the file
      const { data: signedData, error } = await supabaseClient.storage
        .from('work-order-media')
        .createSignedUrl(attachment.path, expiresIn);

      if (error || !signedData?.signedUrl) {
        console.error(`Failed to generate URL for ${attachment.path}:`, error);
        return {
          ...attachment,
          signedUrl: null,
          error: error?.message || 'Failed to generate URL',
        };
      }

      return {
        ...attachment,
        signedUrl: signedData.signedUrl,
      };
    })
  );

  return attachmentsWithUrls;
}
```

### Step 3: Complete Example (React Native / Mobile)

```typescript
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

interface Attachment {
  path: string;
  name: string;
  size: number;
  mime_type: string;
  uploaded_at: string;
  uploaded_by: string;
}

interface AttachmentWithUrl extends Attachment {
  signedUrl: string | null;
  error?: string;
}

interface WorkOrder {
  id: string;
  title: string;
  description: string;
  attachments: Attachment[];
}

function useWorkOrderAttachments(workOrderId: string) {
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [attachments, setAttachments] = useState<AttachmentWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAttachments() {
      try {
        setLoading(true);
        setError(null);

        const supabaseClient = getAuthenticatedSupabase();

        // 1. Fetch work order with attachments
        const { data: workOrderData, error: fetchError } = await supabaseClient
          .from('work_orders')
          .select('id, title, description, attachments')
          .eq('id', workOrderId)
          .single();

        if (fetchError) throw fetchError;
        if (!workOrderData) throw new Error('Work order not found');

        setWorkOrder(workOrderData);

        // 2. If no attachments, return early
        const attachmentList = workOrderData.attachments || [];
        if (attachmentList.length === 0) {
          setAttachments([]);
          setLoading(false);
          return;
        }

        // 3. Generate signed URLs for all attachments
        const attachmentsWithUrls = await Promise.all(
          attachmentList.map(async (attachment: Attachment) => {
            const { data: signedData, error: urlError } = await supabaseClient.storage
              .from('work-order-media')
              .createSignedUrl(attachment.path, 3600); // 1 hour expiry

            if (urlError || !signedData?.signedUrl) {
              return {
                ...attachment,
                signedUrl: null,
                error: urlError?.message || 'Failed to generate URL',
              };
            }

            return {
              ...attachment,
              signedUrl: signedData.signedUrl,
            };
          })
        );

        setAttachments(attachmentsWithUrls);
      } catch (err: any) {
        console.error('Error fetching attachments:', err);
        setError(err.message || 'Failed to load attachments');
      } finally {
        setLoading(false);
      }
    }

    if (workOrderId) {
      fetchAttachments();
    }
  }, [workOrderId]);

  return { workOrder, attachments, loading, error };
}

// Usage in component
function WorkOrderDetailScreen({ workOrderId }: { workOrderId: string }) {
  const { workOrder, attachments, loading, error } = useWorkOrderAttachments(workOrderId);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <View>
      <Text>{workOrder?.title}</Text>
      
      {/* Display attachments */}
      {attachments.map((attachment, index) => {
        // Filter for images only
        if (!attachment.mime_type?.startsWith('image/')) return null;

        if (attachment.signedUrl) {
          return (
            <Image
              key={index}
              source={{ uri: attachment.signedUrl }}
              style={{ width: 200, height: 200 }}
            />
          );
        } else {
          return (
            <Text key={index} style={{ color: 'red' }}>
              Failed to load: {attachment.name}
            </Text>
          );
        }
      })}
    </View>
  );
}
```

## Storage Bucket Policies

Ensure your `work-order-media` bucket has proper policies. In Supabase Dashboard:

1. Go to **Storage** → **Policies** → **work-order-media**
2. Add policies for authenticated users:

### Policy 1: Allow tenants to view attachments for their work orders

```sql
-- Allow tenants to view files for their own work orders
CREATE POLICY "Tenants can view their work order attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'work-order-media'
  AND EXISTS (
    SELECT 1 
    FROM work_orders 
    WHERE work_orders.tenant_id = auth.uid()
    AND (storage.objects.name LIKE '%' || work_orders.id || '%')
  )
);
```

### Policy 2: Allow technicians to view attachments for assigned work orders

```sql
-- Allow technicians to view files for assigned work orders
CREATE POLICY "Technicians can view assigned work order attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'work-order-media'
  AND EXISTS (
    SELECT 1 
    FROM work_orders 
    WHERE work_orders.technician_id = auth.uid()
    AND (storage.objects.name LIKE '%' || work_orders.id || '%')
  )
);
```

### Policy 3: Allow PMs to view attachments for their property's work orders

```sql
-- Allow PMs to view files for work orders in their properties
CREATE POLICY "PMs can view their property work order attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'work-order-media'
  AND EXISTS (
    SELECT 1 
    FROM work_orders 
    JOIN users ON users.property_id = work_orders.property_id
    WHERE users.id = auth.uid()
    AND users.role = 'pm'
    AND (storage.objects.name LIKE '%' || work_orders.id || '%')
  )
);
```

## Optimizations

### 1. Batch Signed URL Generation

If you have many attachments, generate URLs in batches:

```typescript
async function getAttachmentUrlsBatch(
  attachments: Attachment[],
  batchSize: number = 10
): Promise<AttachmentWithUrl[]> {
  const results: AttachmentWithUrl[] = [];
  
  for (let i = 0; i < attachments.length; i += batchSize) {
    const batch = attachments.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(attachment => generateSignedUrl(attachment))
    );
    results.push(...batchResults);
  }
  
  return results;
}
```

### 2. Cache Signed URLs

Signed URLs are valid for a set time. Cache them to avoid regenerating:

```typescript
const urlCache = new Map<string, { url: string; expiresAt: number }>();

function getCachedUrl(path: string, expiresIn: number = 3600): string | null {
  const cached = urlCache.get(path);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }
  return null;
}

function setCachedUrl(path: string, url: string, expiresIn: number) {
  urlCache.set(path, {
    url,
    expiresAt: Date.now() + (expiresIn * 1000) - 60000, // 1 min buffer
  });
}
```

### 3. Lazy Loading Images

Only generate URLs when images are about to be displayed:

```typescript
function LazyImageAttachment({ attachment }: { attachment: Attachment }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadImage = async () => {
    setLoading(true);
    const url = await generateSignedUrl(attachment);
    setSignedUrl(url);
    setLoading(false);
  };

  return (
    <View onLayout={loadImage}>
      {loading ? (
        <LoadingSpinner />
      ) : signedUrl ? (
        <Image source={{ uri: signedUrl }} />
      ) : (
        <Text>Failed to load</Text>
      )}
    </View>
  );
}
```

## Error Handling

```typescript
async function getAttachmentUrlsSafe(
  attachments: Attachment[]
): Promise<AttachmentWithUrl[]> {
  const supabaseClient = getAuthenticatedSupabase();

  return Promise.allSettled(
    attachments.map(async (attachment) => {
      try {
        const { data, error } = await supabaseClient.storage
          .from('work-order-media')
          .createSignedUrl(attachment.path, 3600);

        if (error) throw error;
        if (!data?.signedUrl) throw new Error('No URL returned');

        return {
          ...attachment,
          signedUrl: data.signedUrl,
        };
      } catch (err: any) {
        console.error(`Failed to get URL for ${attachment.path}:`, err);
        return {
          ...attachment,
          signedUrl: null,
          error: err.message,
        };
      }
    })
  ).then(results =>
    results.map(result =>
      result.status === 'fulfilled' ? result.value : {
        ...attachments[results.indexOf(result)],
        signedUrl: null,
        error: 'Unknown error',
      }
    )
  );
}
```

## Summary

✅ **DO**: Query `attachments` column → Generate signed URLs → Display images  
❌ **DON'T**: List all files in storage → Filter by work order ID  
❌ **DON'T**: Use public URLs (security risk)  
❌ **DON'T**: Proxy through Edge Function (adds latency)

This approach is secure, efficient, and scalable for mobile clients.


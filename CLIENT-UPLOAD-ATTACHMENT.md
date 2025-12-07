# Client App: How to Upload Attachments to Work Orders

## Complete Flow

When a client uploads an image/file for a work order, they need to:

1. **Upload the file to Supabase Storage** ✅ (You're already doing this)
2. **Update the work order's `attachments` column** ⚠️ (This is what's missing)

## Step-by-Step Implementation

### Complete Upload Function

```typescript
import { createClient } from '@supabase/supabase-js';

interface Attachment {
  path: string;
  name: string;
  size: number;
  mime_type: string;
  uploaded_at: string;
  uploaded_by: string;
}

async function uploadAttachmentToWorkOrder(
  workOrderId: string,
  file: File | Blob,
  userId: string
): Promise<Attachment> {
  const supabaseClient = createClient(
    'YOUR_SUPABASE_URL',
    'YOUR_SUPABASE_ANON_KEY'
  );

  // Step 1: Generate a unique file path
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `${workOrderId}/${fileName}`;

  // Step 2: Upload file to storage
  const { data: uploadData, error: uploadError } = await supabaseClient.storage
    .from('work-order-media')
    .upload(filePath, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false, // Don't overwrite existing files
    });

  if (uploadError) {
    throw new Error(`Failed to upload file: ${uploadError.message}`);
  }

  console.log('File uploaded successfully:', uploadData.path);

  // Step 3: Create attachment metadata object
  const attachment: Attachment = {
    path: filePath, // Full path in storage
    name: file.name, // Original filename
    size: file.size,
    mime_type: file.type || 'application/octet-stream',
    uploaded_at: new Date().toISOString(),
    uploaded_by: userId,
  };

  // Step 4: Update work order's attachments column
  // First, get current attachments
  const { data: currentWorkOrder, error: fetchError } = await supabaseClient
    .from('work_orders')
    .select('attachments')
    .eq('id', workOrderId)
    .single();

  if (fetchError) {
    // If fetch fails, still try to update (might be a new work order)
    console.warn('Could not fetch current attachments:', fetchError);
  }

  // Get existing attachments or use empty array
  const currentAttachments: Attachment[] = 
    Array.isArray(currentWorkOrder?.attachments) 
      ? currentWorkOrder.attachments 
      : [];

  // Add new attachment to the array
  const updatedAttachments = [...currentAttachments, attachment];

  // Update the work order
  const { error: updateError } = await supabaseClient
    .from('work_orders')
    .update({ attachments: updatedAttachments })
    .eq('id', workOrderId);

  if (updateError) {
    // If update fails, you might want to delete the uploaded file
    console.error('Failed to update work order attachments:', updateError);
    
    // Optional: Clean up the uploaded file
    await supabaseClient.storage
      .from('work-order-media')
      .remove([filePath]);
    
    throw new Error(`Failed to update work order: ${updateError.message}`);
  }

  console.log('Attachment added to work order successfully');
  return attachment;
}
```

## React Native / Mobile App Example

### Complete Component Example

```typescript
import React, { useState } from 'react';
import { View, Button, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { createClient } from '@supabase/supabase-js';

function WorkOrderAttachmentUpload({ workOrderId, userId }: Props) {
  const [uploading, setUploading] = useState(false);

  const pickAndUploadImage = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please grant camera roll permissions');
        return;
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      const image = result.assets[0];

      setUploading(true);

      // Convert image to blob/file
      const response = await fetch(image.uri);
      const blob = await response.blob();

      // Create a File-like object
      const file = new File([blob], image.fileName || 'image.jpg', {
        type: 'image/jpeg',
      });

      // Upload and update work order
      const attachment = await uploadAttachmentToWorkOrder(
        workOrderId,
        file,
        userId
      );

      Alert.alert('Success', 'Image uploaded successfully!');
      console.log('Attachment:', attachment);
    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert('Error', error.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View>
      <Button
        title={uploading ? 'Uploading...' : 'Upload Image'}
        onPress={pickAndUploadImage}
        disabled={uploading}
      />
    </View>
  );
}
```

## When Creating a New Work Order

If you're creating a work order AND uploading images at the same time:

```typescript
async function createWorkOrderWithAttachments(
  workOrderData: {
    title: string;
    description: string;
    tenant_id: string;
    property_id: string;
    // ... other fields
  },
  files: File[],
  userId: string
) {
  const supabaseClient = createClient(
    'YOUR_SUPABASE_URL',
    'YOUR_SUPABASE_ANON_KEY'
  );

  // Step 1: Create the work order first
  const { data: workOrder, error: createError } = await supabaseClient
    .from('work_orders')
    .insert({
      ...workOrderData,
      attachments: [], // Initialize with empty array
    })
    .select()
    .single();

  if (createError || !workOrder) {
    throw new Error(`Failed to create work order: ${createError?.message}`);
  }

  // Step 2: Upload files and build attachments array
  const attachments: Attachment[] = [];

  for (const file of files) {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${workOrder.id}/${fileName}`;

      // Upload file
      const { error: uploadError } = await supabaseClient.storage
        .from('work-order-media')
        .upload(filePath, file);

      if (uploadError) {
        console.error(`Failed to upload ${file.name}:`, uploadError);
        continue; // Skip this file and continue with others
      }

      // Add to attachments array
      attachments.push({
        path: filePath,
        name: file.name,
        size: file.size,
        mime_type: file.type || 'application/octet-stream',
        uploaded_at: new Date().toISOString(),
        uploaded_by: userId,
      });
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error);
    }
  }

  // Step 3: Update work order with all attachments at once
  if (attachments.length > 0) {
    const { error: updateError } = await supabaseClient
      .from('work_orders')
      .update({ attachments })
      .eq('id', workOrder.id);

    if (updateError) {
      console.error('Failed to update attachments:', updateError);
      // Work order was created, but attachments weren't saved
      // You might want to retry or show a warning
    }
  }

  return workOrder;
}
```

## Simplified Helper Function

Here's a cleaner, reusable version:

```typescript
async function addAttachmentToWorkOrder(
  supabaseClient: SupabaseClient,
  workOrderId: string,
  file: File | Blob,
  userId: string,
  originalFileName?: string
): Promise<void> {
  const fileName = originalFileName || `file-${Date.now()}.${file instanceof File ? file.name.split('.').pop() : 'bin'}`;
  const filePath = `${workOrderId}/${fileName}`;

  // Upload file
  const { error: uploadError } = await supabaseClient.storage
    .from('work-order-media')
    .upload(filePath, file, {
      contentType: file instanceof File ? file.type : 'application/octet-stream',
    });

  if (uploadError) throw uploadError;

  // Get current attachments
  const { data: workOrder } = await supabaseClient
    .from('work_orders')
    .select('attachments')
    .eq('id', workOrderId)
    .single();

  const currentAttachments = Array.isArray(workOrder?.attachments) 
    ? workOrder.attachments 
    : [];

  // Add new attachment
  const newAttachment: Attachment = {
    path: filePath,
    name: originalFileName || fileName,
    size: file.size,
    mime_type: file instanceof File ? file.type : 'application/octet-stream',
    uploaded_at: new Date().toISOString(),
    uploaded_by: userId,
  };

  // Update work order
  const { error: updateError } = await supabaseClient
    .from('work_orders')
    .update({ attachments: [...currentAttachments, newAttachment] })
    .eq('id', workOrderId);

  if (updateError) {
    // Rollback: delete uploaded file
    await supabaseClient.storage.from('work-order-media').remove([filePath]);
    throw updateError;
  }
}
```

## Error Handling & Rollback

Always handle errors and consider rolling back if the database update fails:

```typescript
async function uploadWithRollback(
  workOrderId: string,
  file: File,
  userId: string
) {
  const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const filePath = `${workOrderId}/${file.name}`;

  try {
    // Upload file
    const { error: uploadError } = await supabaseClient.storage
      .from('work-order-media')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Update database
    // ... (update code from above) ...

  } catch (error) {
    // If database update fails, delete the uploaded file
    try {
      await supabaseClient.storage
        .from('work-order-media')
        .remove([filePath]);
    } catch (deleteError) {
      console.error('Failed to cleanup uploaded file:', deleteError);
    }
    throw error;
  }
}
```

## Summary

**The key step you're missing:**

After uploading to storage, immediately update the work order:

```typescript
// After successful storage upload:
const { error } = await supabaseClient
  .from('work_orders')
  .update({ 
    attachments: [...existingAttachments, newAttachmentMetadata] 
  })
  .eq('id', workOrderId);
```

This ensures:
- ✅ File is in storage
- ✅ Attachment metadata is in the database
- ✅ Clients can query attachments efficiently
- ✅ Files can be displayed immediately

## Testing

After implementing, verify:

1. Upload an image
2. Check Supabase Storage - file should be there
3. Query the work order:
   ```sql
   SELECT attachments FROM work_orders WHERE id = 'your-work-order-id';
   ```
4. The `attachments` array should contain the file metadata



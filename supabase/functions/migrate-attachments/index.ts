import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FileInfo {
  name: string
  id: string
  created_at: string
  updated_at: string
  last_accessed_at: string
  metadata: {
    size?: number
    mimetype?: string
    cacheControl?: string
    contentLength?: number
    eTag?: string
    contentType?: string
  }
}

interface Attachment {
  path: string
  name: string
  size: number
  mime_type: string
  uploaded_at: string
  uploaded_by: string | null
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Service role key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    const bucketName = 'work-order-media'

    console.log('Starting attachment migration...')

    // Step 1: List all files in the storage bucket
    console.log('Listing all files in bucket...')
    const allFiles: FileInfo[] = []
    let hasMore = true
    let offset = 0
    const limit = 1000

    while (hasMore) {
      const { data: files, error: listError } = await supabaseAdmin.storage
        .from(bucketName)
        .list('', {
          limit,
          offset,
          sortBy: { column: 'created_at', order: 'asc' },
        })

      if (listError) {
        console.error('Error listing files:', listError)
        throw listError
      }

      if (!files || files.length === 0) {
        hasMore = false
        break
      }

      allFiles.push(...(files as FileInfo[]))
      offset += files.length
      hasMore = files.length === limit

      console.log(`Fetched ${allFiles.length} files so far...`)
    }

    console.log(`Total files found: ${allFiles.length}`)

    if (allFiles.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No files found in storage bucket',
          migrated: 0,
          skipped: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 2: Extract work order IDs from file paths/names
    // Files are typically named like: "workorder_{workOrderId}/filename.jpg" or "{workOrderId}/filename.jpg"
    // Or just "{workOrderId}_filename.jpg"
    const workOrderFilesMap = new Map<string, FileInfo[]>()

    for (const file of allFiles) {
      let workOrderId: string | null = null

      // Try to extract work order ID from path
      // Pattern 1: "workorder_{uuid}/filename.jpg"
      const workorderMatch = file.name.match(/workorder[_-]?([a-f0-9-]{36})/i)
      if (workorderMatch) {
        workOrderId = workorderMatch[1]
      } else {
        // Pattern 2: "{uuid}/filename.jpg" or "{uuid}_filename.jpg"
        const uuidMatch = file.name.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i)
        if (uuidMatch) {
          workOrderId = uuidMatch[1]
        }
      }

      if (workOrderId) {
        if (!workOrderFilesMap.has(workOrderId)) {
          workOrderFilesMap.set(workOrderId, [])
        }
        workOrderFilesMap.get(workOrderId)!.push(file)
      } else {
        console.warn(`Could not extract work order ID from file: ${file.name}`)
      }
    }

    console.log(`Found files for ${workOrderFilesMap.size} work orders`)

    // Step 3: Verify work orders exist and build attachments
    let migrated = 0
    let skipped = 0
    const errors: string[] = []

    for (const [workOrderId, files] of workOrderFilesMap.entries()) {
      try {
        // Verify work order exists
        const { data: workOrder, error: woError } = await supabaseAdmin
          .from('work_orders')
          .select('id, attachments')
          .eq('id', workOrderId)
          .single()

        if (woError || !workOrder) {
          console.warn(`Work order ${workOrderId} not found, skipping ${files.length} files`)
          skipped += files.length
          continue
        }

        // Build attachment metadata objects
        const attachments: Attachment[] = files.map((file) => {
          const fileName = file.name.split('/').pop() || file.name
          const fileSize = file.metadata?.size || file.metadata?.contentLength || 0
          const mimeType = file.metadata?.mimetype || file.metadata?.contentType || 'application/octet-stream'

          return {
            path: file.name,
            name: fileName,
            size: fileSize,
            mime_type: mimeType,
            uploaded_at: file.created_at || new Date().toISOString(),
            uploaded_by: null, // Unknown for existing files
          }
        })

        // Get existing attachments (if any)
        const existingAttachments = Array.isArray(workOrder.attachments) 
          ? workOrder.attachments 
          : []

        // Merge with existing attachments, avoiding duplicates
        const existingPaths = new Set(existingAttachments.map((att: Attachment) => att.path))
        const newAttachments = attachments.filter(att => !existingPaths.has(att.path))
        const mergedAttachments = [...existingAttachments, ...newAttachments]

        // Update work order with merged attachments
        const { error: updateError } = await supabaseAdmin
          .from('work_orders')
          .update({ attachments: mergedAttachments })
          .eq('id', workOrderId)

        if (updateError) {
          console.error(`Error updating work order ${workOrderId}:`, updateError)
          errors.push(`Work order ${workOrderId}: ${updateError.message}`)
          skipped += files.length
        } else {
          console.log(`✓ Migrated ${newAttachments.length} attachments for work order ${workOrderId}`)
          migrated += newAttachments.length
        }
      } catch (error: any) {
        console.error(`Error processing work order ${workOrderId}:`, error)
        errors.push(`Work order ${workOrderId}: ${error.message}`)
        skipped += files.length
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Migration completed',
        totalFiles: allFiles.length,
        workOrdersProcessed: workOrderFilesMap.size,
        attachmentsMigrated: migrated,
        attachmentsSkipped: skipped,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Migration error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Migration failed',
        message: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})


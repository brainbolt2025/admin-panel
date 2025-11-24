-- Add attachments column to work_orders table
-- This column stores an array of attachment metadata (file paths, names, sizes, etc.)
-- Files are still stored in the 'work-order-media' storage bucket

-- Add attachments column as JSONB to store array of attachment objects
ALTER TABLE work_orders
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- Add comment to document the column
COMMENT ON COLUMN work_orders.attachments IS 
'Array of attachment metadata objects. Each object contains: { "path": "string", "name": "string", "size": number, "mime_type": "string", "uploaded_at": "ISO8601", "uploaded_by": "UUID" }';

-- Create a GIN index for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_work_orders_attachments_gin 
ON work_orders USING GIN (attachments);

-- Add a check constraint to ensure attachments is always an array
ALTER TABLE work_orders
DROP CONSTRAINT IF EXISTS work_orders_attachments_check;

ALTER TABLE work_orders
ADD CONSTRAINT work_orders_attachments_check 
CHECK (jsonb_typeof(attachments) = 'array');

-- Verify the column was added
SELECT 
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'work_orders'
AND column_name = 'attachments'
ORDER BY ordinal_position;

-- Example of how to query attachments:
-- SELECT id, title, attachments FROM work_orders WHERE jsonb_array_length(attachments) > 0;

-- Example of how to add an attachment (via UPDATE):
-- UPDATE work_orders 
-- SET attachments = attachments || jsonb_build_object(
--   'path', 'work-order-media/workorder_123/file.jpg',
--   'name', 'file.jpg',
--   'size', 102400,
--   'mime_type', 'image/jpeg',
--   'uploaded_at', NOW()::text,
--   'uploaded_by', auth.uid()::text
-- )::jsonb
-- WHERE id = 'work-order-uuid';


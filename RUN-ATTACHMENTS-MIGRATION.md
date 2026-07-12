# How to Add the Attachments Column to work_orders

## Quick Steps

1. **Open Supabase Dashboard**
   - Go to your project: https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click on **SQL Editor** in the left sidebar
   - Click **New Query**

3. **Run the Migration**
   - Open the file `add-attachments-to-work-orders.sql`
   - Copy the entire contents
   - Paste into the SQL Editor
   - Click **Run** (or press Ctrl+Enter / Cmd+Enter)

4. **Verify the Column Was Added**
   - After running, you should see a query result showing the column details
   - Or run this query to check:
   ```sql
   SELECT column_name, data_type, udt_name
   FROM information_schema.columns
   WHERE table_schema = 'public'
   AND table_name = 'work_orders'
   AND column_name = 'attachments';
   ```

## What the Migration Does

- ✅ Adds `attachments` JSONB column (defaults to empty array `[]`)
- ✅ Creates a GIN index for fast JSONB queries
- ✅ Adds a constraint to ensure it's always an array
- ✅ Adds documentation comment

## After Running

Once the column is added, you can:
- Query attachments: `SELECT id, title, attachments FROM work_orders`
- Add attachments when uploading files (see `ATTACHMENTS-USAGE.md`)
- Clients can fetch attachments (see `CLIENT-ATTACHMENTS-GUIDE.md`)

## Troubleshooting

If you get an error:
- Make sure you're running it in the correct database
- Check that the `work_orders` table exists
- If the column already exists, the `ADD COLUMN IF NOT EXISTS` will skip it safely



# Work Order Creation Request Body

## Overview

When creating a work order via POST request to Supabase, you must include the `unit_number` field in the request body.

## Required Fields

When creating a work order, the following fields should be included in the request body:

### Required Fields:
- `title` (string, optional) - Title of the work order
- `description` (string) - Description of the work order
- `tenant_id` (UUID) - ID of the tenant creating the work order
- `property_id` (UUID) - ID of the property

### Optional but Recommended Fields:
- `priority` (string) - Priority level: `'Low'`, `'Medium'`, or `'High'`
- `status` (string) - Status: `'Pending'`, `'In Progress'`, `'Completed'`, etc.
- **`unit_number` (string)** - **Unit/Apartment number for the tenant** ⚠️ **IMPORTANT**

## Request Body Example

### Using Supabase Client (TypeScript/JavaScript)

```typescript
const { data, error } = await supabase
  .from('work_orders')
  .insert({
    title: 'Leaky faucet in kitchen',
    description: 'The kitchen faucet has been leaking for the past week.',
    tenant_id: currentUserId,
    property_id: tenantPropertyId,
    unit_number: tenantUnitNumber, // ✅ INCLUDE THIS!
    priority: 'Medium',
    status: 'Pending'
  })
  .select()
  .single()
```

### Using HTTP POST Request

**Endpoint:** `https://YOUR_PROJECT.supabase.co/rest/v1/work_orders`

**Headers:**
```
Content-Type: application/json
apikey: YOUR_SUPABASE_ANON_KEY
Authorization: Bearer YOUR_SUPABASE_ANON_KEY
Prefer: return=representation
```

**Body:**
```json
{
  "title": "Leaky faucet in kitchen",
  "description": "The kitchen faucet has been leaking for the past week.",
  "tenant_id": "uuid-of-tenant",
  "property_id": "uuid-of-property",
  "unit_number": "A101",
  "priority": "Medium",
  "status": "Pending"
}
```

## Where to Get `unit_number`

The `unit_number` should come from the tenant's user profile:

```typescript
// Fetch tenant's unit_number from users table
const { data: tenantData } = await supabase
  .from('users')
  .select('unit_number')
  .eq('id', currentUserId)
  .single()

const unitNumber = tenantData?.unit_number || null

// Then use it when creating work order
const { data, error } = await supabase
  .from('work_orders')
  .insert({
    // ... other fields
    unit_number: unitNumber, // ✅ Include from tenant profile
  })
```

## Important Notes

1. **`unit_number` is stored in the `work_orders` table** - It's a column directly on the work order record
2. **Used in email notifications** - The `unit_number` is displayed in technician assignment emails
3. **Displayed in admin panel** - The admin panel shows the unit number for each work order
4. **Can be null** - If the tenant doesn't have a unit number, you can pass `null` or omit it

## Verification

After creating a work order, verify that `unit_number` was saved:

```typescript
const { data, error } = await supabase
  .from('work_orders')
  .select('id, title, unit_number')
  .eq('id', workOrderId)
  .single()

console.log('Unit number saved:', data?.unit_number)
```

## Current Implementation Status

✅ **`unit_number` field exists** in the `work_orders` table  
✅ **`unit_number` is queried** by the admin panel  
✅ **`unit_number` is displayed** in technician assignment emails  
⚠️ **Verify client app includes `unit_number`** when creating work orders

## Database Schema

The `work_orders` table includes the following relevant columns:

- `id` (UUID, primary key)
- `title` (TEXT, nullable)
- `description` (TEXT, nullable)
- `priority` (TEXT, nullable) - Check constraint: 'Low', 'Medium', 'High'
- `status` (TEXT, nullable)
- `tenant_id` (UUID, foreign key to users)
- `property_id` (UUID, foreign key to properties)
- **`unit_number` (TEXT, nullable)** - Unit/apartment number
- `technician_id` (UUID, nullable, foreign key to users)
- `created_at` (TIMESTAMPTZ)
- `attachments` (JSONB) - Array of attachment metadata




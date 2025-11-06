# Tenant Signup Recommendation

## Should You Use the Signup Endpoint?

**Short Answer: No, create a dedicated tenant signup function instead.**

## Why Not Use Generic Signup?

### Issues with Direct Supabase Auth Signup:

1. **Property Assignment**: Tenants need to be assigned to a property (`property_id`). The generic signup doesn't handle this.
2. **Role Assignment**: While the database trigger defaults to 'tenant', you can't control property assignment during signup.
3. **Approval Flow**: Your system has an `approved` field - tenants should start as `approved=false` (pending).
4. **Property Name Lookup**: If tenants sign up with property name, you need to resolve it to property_id.

## Recommended Approach

### Option 1: Create Tenant Signup Function (RECOMMENDED)

I've created `supabase/functions/create-tenant/index.ts` which:

✅ Creates auth user with tenant role  
✅ Assigns tenant to property (by ID or name)  
✅ Sets approved=false by default  
✅ Infers property_id from property_name  
✅ Handles all validation  
✅ Returns complete tenant information  

**Usage:**
```json
POST /functions/v1/create-tenant
{
  "email": "tenant@example.com",
  "password": "SecurePassword123!",
  "name": "John Tenant",
  "property_id": "uuid-of-property"  // Optional
  // OR
  "property_name": "setpoint apartment"  // Optional - will be resolved to property_id
}
```

### Option 2: Use Signup Endpoint (with limitations)

If you want to use the generic signup endpoint:

**Pros:**
- Simple
- Uses built-in Supabase Auth
- Database trigger creates user record

**Cons:**
- ❌ No property assignment during signup
- ❌ Property Manager needs to assign tenant to property afterward
- ❌ Less control over the process
- ❌ Can't set approved status

**If you use this approach:**
1. Tenant signs up via `/auth/v1/signup`
2. Database trigger creates user with role='tenant'
3. Property Manager manually assigns property_id afterward
4. Property Manager approves tenant

## Comparison

| Feature | Generic Signup | Create-Tenant Function |
|---------|---------------|----------------------|
| Auth User Creation | ✅ | ✅ |
| Property Assignment | ❌ | ✅ |
| Property Name Resolution | ❌ | ✅ |
| Approval Status | ❌ | ✅ (defaults to false) |
| Validation | Basic | Comprehensive |
| Error Handling | Basic | Detailed |
| Role Assignment | ✅ (via trigger) | ✅ (explicit) |

## Recommendation

**Use the `create-tenant` function** because:

1. **Complete Control**: You control the entire tenant creation process
2. **Property Assignment**: Tenants are immediately assigned to properties
3. **Better UX**: Single step signup vs. signup + manual assignment
4. **Consistency**: Matches your PM creation flow (`create-user` function)
5. **Future-Proof**: Easy to add features like email verification, welcome emails, etc.

## Implementation Steps

1. **Deploy the function:**
   ```bash
   supabase functions deploy create-tenant
   ```

2. **Use in client app:**
   ```typescript
   const response = await fetch(`${SUPABASE_URL}/functions/v1/create-tenant`, {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'Authorization': `Bearer ${ANON_KEY}`,
       'apikey': ANON_KEY
     },
     body: JSON.stringify({
       email: 'tenant@example.com',
       password: 'Password123!',
       name: 'John Tenant',
       property_name: 'setpoint apartment' // or property_id
     })
   })
   ```

3. **Handle response:**
   ```typescript
   const data = await response.json()
   if (data.success) {
     // Tenant created, can now sign in
     // Redirect to login or auto-login
   }
   ```

## Alternative: Hybrid Approach

If you want tenants to sign up themselves:

1. **Tenant provides email, password, name, property_name** (or property code)
2. **Client calls `create-tenant` function** with this info
3. **Function validates property exists** and assigns tenant
4. **Tenant is created and can immediately sign in**

This gives you the control of the function while still allowing self-service signup.

## Conclusion

**Don't use the generic signup endpoint directly.** Use the `create-tenant` function for better control, property assignment, and consistency with your existing architecture.


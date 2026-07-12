# How to Configure Carrd Form for Webhook (Request Body)

## The Right Way: Use Custom URL Form with AJAX + JSON

In Carrd, you don't configure a "request body" directly. Instead, Carrd automatically sends your form fields. You need to:

1. **Set up a Custom URL Form**
2. **Use AJAX method with JSON format**
3. **Name your form fields correctly**

### Step-by-Step Configuration:

1. **Select your Form element** in Carrd

2. **In the Form Settings sidebar, find "Type" section:**
   - Set Type to: **"Custom"**
   - Choose: **"Send to URL"**

3. **Enter Your Webhook URL:**
   - URL: `https://goljbyvrnktxwtnjomaq.supabase.co/functions/v1/add-to-waitlist`

4. **Set Method:**
   - Method: **"AJAX"** (NOT POST - AJAX allows JSON format)

5. **Set Format (IMPORTANT!):**
   - Format: **"JSON"** (this sends data as JSON body)

6. **Configure Form Fields:**
   - Go to the **Fields** tab
   - Make sure your fields have the correct **Submitted ID**:
     - Email field → Submitted ID: `email`
     - Property Name field → Submitted ID: `property_name`

**That's it!** Carrd will automatically send your form data as JSON:
```json
{
  "email": "user@example.com",
  "property_name": "ABC Properties"
}
```

## Important: Field Names Must Match

The function expects these exact field names in the JSON:
- `email` (not `Email` or `EMAIL`)
- `property_name` (not `propertyName` or `property_name_field`)

Make sure your form fields have these **Submitted ID** values.

## What You Should See

When configured correctly:
- **Type**: Custom → Send to URL
- **URL**: Your Supabase function URL
- **Method**: AJAX
- **Format**: JSON

When the form is submitted, Carrd will send:
```json
{
  "email": "user@example.com",
  "property_name": "ABC Properties"
}
```

This matches exactly what the function expects!

## Complete Configuration Checklist

- [ ] Form Type set to **Custom** → **Send to URL**
- [ ] URL: `https://goljbyvrnktxwtnjomaq.supabase.co/functions/v1/add-to-waitlist`
- [ ] Method: **AJAX** (not POST)
- [ ] Format: **JSON** (this is key!)
- [ ] Email field has Submitted ID: `email`
- [ ] Property Name field has Submitted ID: `property_name`

## Why AJAX + JSON?

- **POST method** sends form data as `application/x-www-form-urlencoded`
- **AJAX + JSON** sends data as `application/json` with the field names as JSON keys

The function is designed to handle both, but JSON is cleaner and matches exactly what we need.

## Testing

After configuring:
1. Submit a test form
2. Check Supabase Edge Function logs
3. You should see the JSON body with `email` and `property_name` fields
4. The function will automatically parse it correctly

No need to manually configure a request body - Carrd does it automatically based on your field names!


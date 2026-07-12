# Profile Pictures Setup Guide

This guide explains how to set up profile pictures for users (tenants and technicians) in the admin panel.

## Database Setup

### 1. Add Profile Picture Column

Run the SQL migration to add the `profile_picture_url` column to the users table:

```sql
-- Run this file:
add-profile-picture-to-users.sql
```

This adds a `profile_picture_url` column to store the path/URL to the profile picture in Supabase Storage.

### 2. Create Storage Bucket

1. Go to your Supabase Dashboard
2. Navigate to **Storage** section
3. Click **New bucket**
4. Name it: `profile-pictures`
5. Make it **Public** (or configure policies as needed)
6. Click **Create bucket**

### 3. Set Up Storage Policies

Run the SQL migration to set up storage policies:

```sql
-- Run this file:
setup-profile-pictures-storage.sql
```

This creates policies that allow:
- Users to view their own profile picture
- Users to view profile pictures of users in their property
- Users to upload/update/delete their own profile picture
- PMs to view all profile pictures in their property

## Features Implemented

### Users Component (Tenants)
- ✅ Displays profile pictures in the tenants table
- ✅ Shows default user icon if no profile picture is set
- ✅ Hover to upload: Click on the profile picture area to upload a new picture
- ✅ Image validation: Only accepts image files under 5MB
- ✅ Automatic refresh after upload

### Technicians Component
- ✅ Displays profile pictures in the technicians table
- ✅ Shows default wrench icon if no profile picture is set
- ✅ Hover to upload: Click on the profile picture area to upload a new picture
- ✅ Image validation: Only accepts image files under 5MB
- ✅ Automatic refresh after upload

## How It Works

1. **Storage**: Profile pictures are stored in the `profile-pictures` Supabase Storage bucket
2. **File Naming**: Files are named as `tenant_{userId}_{timestamp}.{ext}` or `technician_{userId}_{timestamp}.{ext}`
3. **Database**: The file path is stored in the `profile_picture_url` column in the users table
4. **Display**: Signed URLs are generated (valid for 24 hours) to display the images
5. **Upload**: Users can hover over the profile picture area and click to upload a new picture

## Usage

### For Property Managers (PMs)
1. Navigate to **Users** or **Technicians** page
2. Hover over a user's profile picture area (or icon)
3. Click the camera icon that appears
4. Select an image file (JPG, PNG, etc.)
5. The picture will upload and display automatically

### Image Requirements
- **Format**: Any image format (JPG, PNG, GIF, WebP, etc.)
- **Size**: Maximum 5MB
- **Recommended**: Square images (1:1 aspect ratio) work best for circular profile pictures

## Technical Details

### Components Updated
- `src/components/Users.tsx` - Added profile picture display and upload for tenants
- `src/components/Technicians.tsx` - Added profile picture display and upload for technicians

### Storage Bucket
- **Bucket Name**: `profile-pictures`
- **Public Access**: Configured via RLS policies
- **File Path Format**: `{role}_{userId}_{timestamp}.{extension}`

### Database Schema
```sql
ALTER TABLE users 
ADD COLUMN profile_picture_url TEXT;
```

## Troubleshooting

### Profile pictures not showing
1. Check that the storage bucket `profile-pictures` exists
2. Verify storage policies are set up correctly
3. Check browser console for errors
4. Ensure the user has a `profile_picture_url` value in the database

### Upload fails
1. Check file size (must be under 5MB)
2. Verify file is an image format
3. Check browser console for detailed error messages
4. Verify storage policies allow uploads for the current user

### Permission errors
1. Run the storage policies SQL migration
2. Verify the user's role and property_id are set correctly
3. Check that RLS policies are enabled on the storage.objects table

## Future Enhancements

Potential improvements:
- Image cropping/resizing before upload
- Profile picture deletion
- Default avatar generation based on user initials
- Batch upload for multiple users
- Profile picture preview before upload



# Supabase Email Confirmation Fix

## Problem
Email confirmation links are pointing to `auth.plate-app.com` instead of the correct domain `rbs-restaurant.vercel.app`.

## Root Cause
The Supabase project configuration has the wrong Site URL configured in the Authentication settings.

## Solution

### 1. Update Supabase Project Configuration

Go to your Supabase dashboard:
1. Navigate to https://supabase.com/dashboard/project/xsovqvbigdettnpeisjs
2. Go to **Authentication** → **URL Configuration**
3. Update the following URLs:

**Site URL**: `https://rbs-restaurant.vercel.app`

**Redirect URLs**: Add the following URLs to the allowed list:
- `https://rbs-restaurant.vercel.app/api/auth/callback`
- `https://rbs-restaurant.vercel.app/api/auth/*`
- `https://rbs-restaurant.vercel.app/email-confirmed`
- `https://rbs-restaurant.vercel.app/**` (catch-all for development)

### 2. Email Template Configuration (Optional)

If you want to customize the email templates:
1. Go to **Authentication** → **Email Templates**
2. Update the "Confirm signup" template if needed
3. Ensure the action URL points to your domain

### 3. Test the Flow

After updating the configuration:
1. Try signing up with a test email
2. Check that the confirmation email links point to `rbs-restaurant.vercel.app`
3. Verify the complete flow works: signup → email → confirmation → email-confirmed page

## Current Configuration Status

✅ **Code Changes Made**:
- Fixed `emailRedirectTo` URL in signup form
- Auth callback route is working correctly (`/api/auth/[...supabase]/route.ts`)
- Email confirmation pages are in place (`/email-confirmed/page.tsx`)

❌ **Supabase Dashboard Changes Needed**:
- Site URL needs to be updated from `plate-app.com` to `rbs-restaurant.vercel.app`
- Redirect URLs need to be updated to include the correct domain

## Files Modified
- `app/signup/page.tsx` - Fixed emailRedirectTo URL
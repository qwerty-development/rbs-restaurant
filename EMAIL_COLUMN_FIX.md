# Database Column Fix: Removing Non-Existent `email` References

## Issue Summary
The error `"column profiles_1.email does not exist"` was occurring because the codebase was trying to reference an `email` field in the `profiles` table, which doesn't exist in your database schema.

## Root Cause
In Supabase, user emails are stored in the `auth.users` table (managed by Supabase Auth), while additional profile information is stored in the `public.profiles` table. The `profiles` table does **not** have an `email` column.

## Database Schema Clarification

### ✅ Correct Structure:
```sql
-- auth.users (managed by Supabase Auth)
- id: uuid
- email: text
- created_at: timestamp
- ...

-- public.profiles (your custom table)
- id: uuid (references auth.users.id)
- full_name: text
- phone_number: text
- avatar_url: text
- allergies: array
- ... (no email field)
```

## 🛠️ Files Fixed

### 1. `lib/customer-utils.ts`
**Issue**: Query was trying to search `profiles.email`
```typescript
// ❌ BEFORE (broken)
query = query.or(`guest_email.eq.${email},profiles.email.eq.${email}`)

// ✅ AFTER (fixed)
query = query.eq('guest_email', email)
```

**Issue**: Contact info was referencing `customer.profile?.email`
```typescript
// ❌ BEFORE (broken)
email: customer.profile?.email || customer.guest_email,

// ✅ AFTER (fixed)  
email: customer.guest_email, // Only guest bookings have email stored locally
```

### 2. `lib/restaurant-auth.ts`
**Issue**: Trying to insert `email` into `profiles` table
```typescript
// ❌ BEFORE (broken)
const { data: existingUser } = await this.supabase
  .from('profiles')
  .select('id, email')
  .eq('email', staffData.email)

// ✅ AFTER (fixed)
const { data: authUsers } = await this.supabase.auth.admin.listUsers()
const existingUser = authUsers.users.find(user => user.email === staffData.email)
```

**Issue**: Inserting email field into profiles
```typescript
// ❌ BEFORE (broken)
.insert({
  id: userId,
  full_name: staffData.fullName,
  phone_number: staffData.phoneNumber,
  email: staffData.email // ← This field doesn't exist!
})

// ✅ AFTER (fixed)
.insert({
  id: userId,
  full_name: staffData.fullName,
  phone_number: staffData.phoneNumber
  // No email field
})
```

### 3. `components/waitlist/waitlist-entry-card.tsx`
**Issue**: Displaying `entry.user?.email` which doesn't exist
```typescript
// ❌ BEFORE (broken)
<Mail className="h-4 w-4" />
<span>{entry.user?.email || 'No email'}</span>

// ✅ AFTER (fixed)
// Removed email display entirely since it's not available in profiles
```

### 4. `types/index.ts`
**Issue**: Profile interface incorrectly included email field
```typescript
// ❌ BEFORE (broken)
export interface Profile {
  email: any;
  id: string;
  // ...
}

// ✅ AFTER (fixed)
export interface Profile {
  id: string;
  // No email field
  // ...
}
```

## ✅ Files That Were Already Correct

### 1. `app/(dashboard)/vip/` pages
These pages correctly fetch email from auth.users:
```typescript
// ✅ Correct approach
const { data: authUser } = await supabase.auth.admin.getUserById(userId)
return {
  ...data,
  user: {
    ...data.user,
    email: authUser?.user?.email // Gets email from auth.users
  }
}
```

### 2. `components/layout/header.tsx`
Correctly uses `user.email` from auth user object passed as props.

### 3. Booking pages
Correctly structure queries without referencing `profiles.email`.

## 🚀 New Utility Created

### `lib/user-utils.ts`
Created a comprehensive utility for handling user data across the application:

```typescript
import { userUtils } from '@/lib/user-utils'

// Get user's email from auth.users
const email = await userUtils.getUserEmail(userId)

// Enrich profile with email
const enrichedProfile = await userUtils.enrichProfileWithEmail(profile)

// Batch enrich multiple profiles
const enrichedProfiles = await userUtils.enrichProfilesWithEmails(profiles)

// Get contact info (handles both guest and user bookings)
const contact = userUtils.getContactInfo(bookingData)

// Get display name and initials
const name = userUtils.getDisplayName(user)
const initials = userUtils.getInitials(user)
```

## 🎯 Key Takeaways

### When to Use What:

1. **For User Authentication**: Use `auth.users` (email, password, etc.)
2. **For User Profiles**: Use `profiles` table (name, phone, preferences, etc.)
3. **For Guest Bookings**: Store email in `guest_email` field on bookings table
4. **For Staff Management**: Check auth.users for email, profiles for additional data

### Best Practices:

1. **Never reference `profiles.email`** - it doesn't exist
2. **For email lookup**: Use `supabase.auth.admin.getUserById()` or `listUsers()`
3. **For guest contacts**: Use `guest_email` field from bookings
4. **For display**: Enrich profile data with email when needed for UI

## 🔧 Quick Fix Verification

To verify the fixes work:

1. **Test booking creation** - should no longer throw email column errors
2. **Test staff addition** - should create profiles without email field
3. **Test waitlist display** - should show user info without email references
4. **Test VIP pages** - should correctly show emails from auth.users

## 🚨 Migration Note

If you have existing data with email fields in profiles, you may need to:

1. **Backup any email data** from profiles table
2. **Remove the email column** from profiles if it exists
3. **Ensure auth.users has all emails** for existing users

The current fixes assume the schema is correct (no email in profiles), which matches your provided schema.sql file.

## ✨ Result

After these fixes:
- ✅ No more "column profiles_1.email does not exist" errors
- ✅ Proper separation of auth data vs profile data
- ✅ Correct email handling for both users and guests
- ✅ Utility functions for future email needs
- ✅ Type safety with corrected interfaces

# Review Reply Feature

## Overview

The review reply feature allows restaurant staff to respond to customer reviews directly from the dashboard. This helps improve customer engagement and allows restaurants to address feedback professionally.

## Features

### ✅ Implemented Features

1. **Reply to Reviews**: Staff can reply to any customer review
2. **Edit Replies**: Staff can edit their existing replies
3. **Delete Replies**: Staff can delete their replies if needed
4. **One Reply Per Review**: Database constraint ensures only one reply per review
5. **Staff Authorization**: Only active restaurant staff can reply
6. **Visual Distinction**: Replies are clearly marked with restaurant branding
7. **Character Limit**: 1000 character limit for replies with live counter
8. **Responsive Design**: Works on all device sizes
9. **Real-time Updates**: Uses React Query for optimistic updates

### 🔧 Technical Implementation

#### Database Schema
- New `review_replies` table with proper foreign keys
- Row Level Security (RLS) policies for data protection
- Unique constraint ensuring one reply per review
- Audit trail with created_at and updated_at timestamps

#### Frontend Components
- `ReviewReply` component for handling reply UI/UX
- Integration with existing reviews page
- Toast notifications for user feedback
- Form validation and error handling

#### Security
- Staff authorization checks before allowing replies
- RLS policies prevent unauthorized access
- Input sanitization and validation

## Usage Guide

### For Restaurant Staff

1. **Viewing Reviews**: Navigate to Dashboard → Reviews
2. **Replying to a Review**: 
   - Click "Reply to review" button below any review
   - Type your response (max 1000 characters)
   - Click "Post Reply" to publish
3. **Editing a Reply**:
   - Click "Edit" button on existing reply
   - Modify the text and click "Update Reply"
4. **Deleting a Reply**:
   - Click "Delete" button on existing reply
   - Confirm the deletion

### Best Practices for Replies

1. **Be Professional**: Always maintain a professional tone
2. **Thank Customers**: Thank them for their feedback
3. **Address Concerns**: If there are issues mentioned, acknowledge them
4. **Invite Back**: Encourage customers to visit again
5. **Keep it Concise**: Replies should be helpful but not overly long

## Setup Instructions

### 1. Database Setup
Run the SQL script to create the `review_replies` table:
```bash
# The SQL script is located at /tmp/create_review_replies_table.sql
# Copy it to your Supabase SQL Editor or run it directly on your database
```

### 2. File Structure
The feature consists of these files:
```
components/reviews/review-reply.tsx    # Main reply component
app/(dashboard)/reviews/page.tsx       # Updated reviews page
types/index.ts                        # Updated with ReviewReply type
REVIEW_REPLIES_SETUP.md               # Database setup guide
```

### 3. Dependencies
No additional dependencies required. Uses existing:
- React Query for data fetching
- Supabase client for database operations
- shadcn/ui components for UI
- react-hot-toast for notifications

## Example Reply Flow

1. Customer leaves a review: ⭐⭐⭐⭐⭐ "Great food and service!"
2. Restaurant staff sees the review in the dashboard
3. Staff clicks "Reply to review"
4. Staff types: "Thank you so much for the wonderful review! We're thrilled you enjoyed your dining experience with us. We look forward to welcoming you back soon!"
5. Reply appears below the review with restaurant branding
6. Customer can see the reply when viewing the review

## Future Enhancements

Potential future improvements could include:
- Email notifications to customers when restaurants reply
- Reply templates for common responses
- Analytics on reply engagement
- Public display of replies on customer-facing pages
- Sentiment analysis of replies

## Troubleshooting

### Common Issues

1. **"Not authorized to reply" error**
   - Ensure user is an active staff member of the restaurant
   - Check `restaurant_staff` table for proper permissions

2. **Reply not appearing**
   - Check browser console for errors
   - Verify database table was created correctly
   - Ensure RLS policies are properly configured

3. **Cannot edit/delete reply**
   - Only the staff member who created the reply can edit/delete it
   - Ensure user has proper restaurant staff access

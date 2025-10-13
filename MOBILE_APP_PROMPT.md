# Mobile App Companion - Development Prompt

## Project Overview
Build a simplified mobile companion app (Android APK) for restaurant owners to manage their restaurant on-the-go. This is a **native mobile version** of the existing web dashboard, focused on the two most critical functions: managing bookings and updating restaurant information.

**Important**: Authentication is already complete. You only need to build the two main tabs described below.

---

## App Structure
The app should have **2 main tabs** accessible via bottom navigation:

1. **Bookings Tab** - Accept/decline booking requests and view booking history
2. **Manage Restaurant Tab** - Update restaurant information and settings

**Design Philosophy**: 
- Mobile-first, touch-friendly UI
- Clean, simple interface optimized for phone screens
- No table assignment features
- No tier differentiation (Basic/Pro) - single unified experience
- Focus on speed and ease of use for busy restaurant staff

---

## Tab 1: Bookings Tab

### Core Functionality
This tab should replicate the booking management experience from `/app/basic-dashboard/page.tsx` but optimized for mobile.

### Key Features:

#### 1. **Analytics Summary Cards** (Top of screen)
Display 5 metric cards in a 2-column grid (mobile-friendly layout):
- **Pending** (orange/highlighted) - with pulse animation if count > 0
- **Cancelled** (grey)
- **Accepted** (green)
- **Declined** (red)
- **Completed** (blue)

#### 2. **Search & Filter Controls**
- **Search bar**: Search by customer name, phone number, email, or confirmation code
- **Date Filter Buttons**:
  - Today (default)
  - Select Range (with date picker)
  - This Week
  - This Month
  - All Dates (from today onward)
- **Status Dropdown Filter**:
  - All Status (default)
  - Pending
  - Accepted (Confirmed)
  - Completed
  - Cancelled by Customer
  - Cancelled by Restaurant
  - Declined
  - No Show

#### 3. **Bookings List**
Display bookings as **cards** (not a table), each showing:

**Header Section:**
- Status badge (with icon) - PROMINENT
- Customer name (large, bold)
- Customer rating (if < 5.0, show star icon + rating)
- Confirmation code (top right)
- If pending: elapsed time since booking was created (updating in real-time with format like "5m 23s ago")

**Contact Information:**
- Phone number (with phone icon)
- Email (with mail icon)

**Booking Details (in bordered boxes):**
- **Date**: "MMM d, yyyy" format
- **Time**: "h:mm a" format
- **Guests**: Party size number
- **Section**: Preferred section or "No preference"

**Additional Details:**
- **Occasion**: If specified (birthday, anniversary, etc.)
- **Table Preferences**: If specified (booth, window, patio, etc.)
- **Special Requests**: Customer's special request text
- **Dietary Notes**: Display as small badges (vegetarian, vegan, gluten-free, etc.)
- **Special Offer**: If booking has an applied offer, show in blue badge/box with offer details

**Action Buttons** (at bottom of each card):

For **Pending** bookings:
- Large **DECLINE** button (left, red/destructive)
- Large **ACCEPT** button (right, green, primary)

For **Confirmed** bookings:
- **Complete** button
- **More** dropdown menu with:
  - Mark as No Show
  - Cancel Booking

Both decline and cancel actions should open a dialog asking for an optional note to send to the customer.

#### 4. **Real-time Updates**
- Subscribe to booking changes via Supabase real-time
- Show toast notifications for new bookings
- Auto-update the list when bookings change
- Show connection status indicator

#### 5. **Loading & Empty States**
- Loading: Show spinner with "Loading bookings..." text
- Empty state: Show calendar icon with message based on current filter/date selection

#### 6. **Data Fetching Logic** (CRITICAL)
**IMPORTANT**: Always fetch ALL pending bookings regardless of date filters, then fetch date-specific bookings for other statuses. Pending bookings should always appear at the top of the list.

Query structure:
1. Get all `status = 'pending'` bookings for the restaurant
2. Get date-filtered bookings for selected date range (excluding pending)
3. Combine and deduplicate
4. Sort: pending first, then by creation date (newest first)

Include in booking query:
```sql
bookings: {
  id, booking_time, party_size, status, 
  special_requests, preferred_section, occasion, 
  dietary_notes, guest_name, guest_email, 
  created_at, user_id, applied_offer_id, 
  confirmation_code, table_preferences
}
profiles (via user_id): {
  id, full_name, phone_number, email, user_rating
}
special_offers (via applied_offer_id): {
  id, title, description, discount_percentage
}
```

#### 7. **API Endpoint**
Use existing API: `POST /api/basic-booking-update`

Payload:
```json
{
  "bookingId": "uuid",
  "status": "confirmed" | "declined_by_restaurant" | "cancelled_by_restaurant" | "completed" | "no_show",
  "note": "optional message to customer"
}
```

---

## Tab 2: Manage Restaurant Tab

### Core Functionality
This tab should replicate the restaurant management experience from `/app/(dashboard)/settings/page.tsx` but in a mobile-friendly format.

### Layout Structure
Use **accordion sections** or **expandable cards** instead of tabs for better mobile UX.

### Sections to Include:

#### 1. **General Information**
Editable fields:
- **Restaurant Name** (text input, required, min 2 chars)
- **Description** (textarea, optional, 4 rows)
- **Address** (text input, required, min 5 chars)
- **Phone Number** (text input with phone icon, optional)
- **WhatsApp Number** (text input with phone icon, optional)
- **Website URL** (text input with globe icon, optional, must be valid URL)
- **Instagram Handle** (text input with Instagram icon, optional, without @)

**Save Button** at bottom of section

#### 2. **Operational Settings**
Editable fields:
- **Booking Window** (number input, 1-90 days, how far in advance customers can book)
- **Cancellation Window** (number input, 1-48 hours, how far in advance customers can cancel)
- **Table Turnover Time** (number input, 30-240 minutes, average dining duration)
- **Booking Policy** (dropdown: "Instant" or "Request" - if Basic tier, force to "Instant")
- **Minimum Age** (number input, 0-99, optional)

**Save Button** at bottom of section

#### 3. **Features & Amenities**
Editable fields:
- **Price Range** (1-4 dollar signs, slider or segmented control)
- **Cuisine Type** (dropdown with options):
  - Lebanese, Mediterranean, Italian, French, Japanese, Chinese, Indian, Mexican, American, Seafood, Steakhouse, Fusion, Vegetarian, Cafe
- **Dietary Options** (multi-select checkboxes):
  - Vegetarian, Vegan, Gluten-free, Halal, Kosher, Dairy-free, Nut-free
- **Amenities** (toggle switches):
  - Parking Available
  - Valet Parking
  - Outdoor Seating
  - Shisha Available

**Save Button** at bottom of section

#### 4. **Operating Hours** (Optional - Nice to Have)
If time permits, add quick link to manage:
- Regular weekly hours
- Holiday closures
- Special events

### Form Validation
Use Zod schemas (reference from settings page):
- Validate on submit
- Show inline error messages
- Disable save button while saving
- Show success toast on save
- Show error toast on failure

### Data Handling

**Fetch restaurant data:**
```typescript
const { data: restaurant } = await supabase
  .from("restaurants")
  .select("*")
  .eq("id", restaurantId)
  .single()
```

**Update restaurant data:**
```typescript
const { error } = await supabase
  .from("restaurants")
  .update({
    ...updatedFields,
    updated_at: new Date().toISOString()
  })
  .eq("id", restaurantId)
```

After successful update:
- Invalidate queries: `queryClient.invalidateQueries({ queryKey: ["restaurant"] })`
- Show success toast
- Keep form populated with updated values

---

## Technical Requirements

### Tech Stack
- **Framework**: React Native or similar for native Android
- **Database**: Supabase (already configured)
- **State Management**: React Query / TanStack Query (for caching and real-time updates)
- **Forms**: React Hook Form + Zod validation
- **UI Components**: Mobile-optimized components (cards, buttons, inputs)
- **Real-time**: Supabase Realtime subscriptions

### Authentication
- Authentication is **already implemented**
- Use existing Supabase auth session
- Get current user and restaurant context from `useRestaurantContext()`
- Show loading state while context is loading

### Connection Monitoring
- Show connection status indicator (top right, subtle)
- Handle offline/online states gracefully
- Implement retry logic for failed requests
- Use adaptive refetch intervals based on connection health

### Mobile Optimizations
- **Touch targets**: Minimum 48x48px for all interactive elements
- **Font sizes**: Larger than web (16px minimum for body text)
- **Spacing**: More generous padding and margins
- **Cards**: Prefer vertical stacking over horizontal layouts
- **Buttons**: Full-width or large, clearly visible
- **Forms**: One-column layouts, large input fields
- **Dropdowns**: Use native mobile pickers where appropriate
- **Loading states**: Show spinners and skeleton screens

### Performance
- Implement pull-to-refresh on bookings list
- Cache restaurant data (refetch only when needed)
- Optimize real-time subscriptions (unsubscribe on unmount)
- Debounce search input (300ms)
- Use pagination or virtual scrolling if booking list is very long

---

## File References

### Study these existing files for implementation details:

**Bookings functionality:**
- `/app/basic-dashboard/page.tsx` (lines 1-1962) - Complete bookings tab implementation
- `/components/bookings/booking-list.tsx` (lines 1-66) - Booking list component structure
- `/app/api/basic-booking-update/route.ts` - API endpoint for booking updates

**Restaurant management functionality:**
- `/app/(dashboard)/settings/page.tsx` (lines 1-972) - Complete settings implementation
- Look for form schemas, validation, and update mutations

**Real-time and connection handling:**
- `/hooks/use-realtime-health.ts` - Real-time connection monitoring
- `/hooks/use-connection-recovery.ts` - Connection recovery logic
- `/hooks/use-adaptive-refetch.ts` - Adaptive query configuration

---

## Design Guidelines

### Color Scheme
- **Pending/Warning**: Orange (#f97316)
- **Success/Confirmed**: Green (#16a34a)
- **Error/Declined**: Red (#dc2626)
- **Completed**: Blue (#2563eb)
- **Neutral**: Gray shades
- **Special Offers**: Blue/Cyan highlight (#3b82f6)

### Status Badge Design
Each status should have:
- Icon (CheckCircle, XCircle, AlertCircle, Clock)
- Color coding (as above)
- Clear text label
- Prominent placement

### Card Design
- Use shadow/elevation for depth
- Border for pending bookings (orange)
- Rounded corners (8-12px)
- Padding: 16-20px
- Margin between cards: 12-16px

---

## Error Handling

### User-facing errors:
- Network errors: "Unable to connect. Please check your internet connection."
- Update failures: "Failed to update [booking/restaurant]. Please try again."
- Validation errors: Show inline next to form fields

### Toast Notifications:
- Success: "Booking accepted successfully", "Settings updated successfully"
- Errors: "Failed to decline booking: [error message]"
- New booking: "New booking from [customer name] for [party size] guests"

---

## Testing Checklist

Before considering the app complete, test:

### Bookings Tab:
- [ ] Accept a pending booking
- [ ] Decline a pending booking with a note
- [ ] Complete a confirmed booking
- [ ] Mark a booking as no-show
- [ ] Cancel a confirmed booking with a note
- [ ] Search by customer name, phone, email, confirmation code
- [ ] Filter by each status type
- [ ] Filter by date (today, week, month, all, custom range)
- [ ] Real-time updates when new booking arrives
- [ ] Real-time updates when booking status changes
- [ ] Loading states display correctly
- [ ] Empty states display correctly with appropriate messages
- [ ] All pending bookings show regardless of date filter
- [ ] Elapsed time updates every second for pending bookings
- [ ] Special offers display correctly
- [ ] Customer ratings display correctly
- [ ] Pull to refresh works
- [ ] Connection status indicator shows online/offline state

### Manage Restaurant Tab:
- [ ] Load existing restaurant data correctly
- [ ] Edit and save general information
- [ ] Edit and save operational settings
- [ ] Edit and save features & amenities
- [ ] Form validation works (try invalid inputs)
- [ ] Success toast shows after save
- [ ] Error toast shows if save fails
- [ ] Multi-select for dietary options works
- [ ] Toggle switches work
- [ ] Dropdown selections work
- [ ] Form stays populated after successful save
- [ ] Loading state shows while saving

### General:
- [ ] App works offline (shows appropriate messages)
- [ ] App reconnects gracefully when coming back online
- [ ] All touch targets are easily tappable
- [ ] Text is readable on various screen sizes
- [ ] App doesn't crash or freeze during normal usage
- [ ] Authentication state is maintained correctly

---

## Success Criteria

The app is complete when:
1. A restaurant owner can accept/decline/manage all bookings from their phone
2. A restaurant owner can update all restaurant information from their phone
3. The app works reliably with real-time updates
4. The UI is clean, fast, and easy to use on mobile devices
5. All critical functions work offline with appropriate user feedback
6. The app can be installed as an APK on Android devices

---

## Out of Scope (DO NOT IMPLEMENT)

- Table assignment features
- Advanced analytics/reports
- Customer management
- Menu management
- Staff management
- Waitlist management (though component exists, skip it for mobile)
- Multi-restaurant switching
- Tier management
- Push notifications configuration
- PWA features
- Review management
- Chat/messaging features

Keep it simple and focused on the two core functions: **manage bookings** and **manage restaurant information**.



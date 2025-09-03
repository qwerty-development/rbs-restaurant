# Menu Image Upload Enhancement

## Overview
Enhanced the menu management system to provide dual options for menu item images:
1. **File Upload**: Upload images directly to Supabase `menu_images` bucket
2. **URL Input**: Provide external image URLs

## Implementation Details

### New Component: `MenuImageUpload`
**File**: `components/menu/menu-image-upload.tsx`

#### Features:
- **Dual Input Methods**: Tab-based interface for upload vs URL input
- **Drag & Drop Support**: Intuitive file dropping interface
- **Progress Tracking**: Real-time upload progress with visual feedback
- **Image Preview**: Live preview of current image with metadata
- **File Validation**: Type and size validation before upload
- **Error Handling**: Comprehensive error states and user feedback

#### Upload Specifications:
- **Bucket**: `menu_images` (Supabase Storage)
- **File Types**: All image formats (`image/*`)
- **Max Size**: 5MB (configurable)
- **File Naming**: `{restaurantId}/menu_{timestamp}_{random}.{extension}`
- **Cache Control**: 3600 seconds for optimal performance

#### Props Interface:
```typescript
interface MenuImageUploadProps {
  restaurantId: string        // Required for file path organization
  value?: string             // Current image URL
  onChange?: (url: string) => void  // Callback when image changes
  onClear?: () => void       // Callback when image is removed
  disabled?: boolean         // Form disabled state
  maxFileSize?: number       // Max file size in MB (default: 5)
}
```

### Updated Components

#### 1. `MenuItemForm` (`components/menu/menu-item-form.tsx`)
- **Added Import**: `MenuImageUpload` component
- **Updated Schema**: Simplified `image_url` validation (removed strict URL requirement)
- **Enhanced Props**: Added `restaurantId` parameter
- **Replaced Field**: Replaced basic URL input with full-featured image upload component

#### 2. Menu Page (`app/(dashboard)/menu/page.tsx`)
- **Updated Calls**: Pass `restaurantId` to `MenuItemForm` in both add and edit dialogs

## Usage Examples

### Basic Implementation
```tsx
<MenuImageUpload
  restaurantId="your-restaurant-id"
  value={currentImageUrl}
  onChange={(url) => setImageUrl(url)}
  disabled={isLoading}
/>
```

### Form Integration
```tsx
<FormField
  control={form.control}
  name="image_url"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Menu Item Image</FormLabel>
      <FormControl>
        <MenuImageUpload
          restaurantId={restaurantId}
          value={field.value}
          onChange={field.onChange}
          disabled={isLoading}
        />
      </FormControl>
      <FormDescription>
        Upload an image or provide an image URL for this menu item
      </FormDescription>
      <FormMessage />
    </FormItem>
  )}
/>
```

## User Experience

### Upload Flow:
1. **Select Method**: Choose between "Upload File" or "Image URL" tabs
2. **Upload File**:
   - Drag & drop image or click to browse
   - Real-time validation and progress tracking
   - Automatic upload to Supabase storage
   - Preview with metadata display
3. **URL Input**:
   - Enter external image URL
   - Instant validation and preview
   - Support for any accessible image URL

### Visual Feedback:
- **Upload Progress**: Progress bar with percentage
- **File Status**: Success, error, and loading states
- **Image Preview**: Thumbnail with source type badge
- **Validation**: Real-time error messages for invalid files/URLs

## Database Impact

### Storage Structure:
```
menu_images/
├── {restaurant-id-1}/
│   ├── menu_1234567890_abc123.jpg
│   ├── menu_1234567891_def456.png
│   └── ...
├── {restaurant-id-2}/
│   └── ...
```

### Schema Compatibility:
- **Backward Compatible**: Existing `image_url` field unchanged
- **Mixed Sources**: Supports both uploaded files and external URLs
- **URL Format**: Uploaded files use Supabase public URLs

## Security & Performance

### File Validation:
- **Type Check**: Only image files allowed
- **Size Limit**: Configurable max size (default 5MB)
- **Extension Validation**: Secure file extension handling

### Storage Optimization:
- **Unique Naming**: Prevents conflicts with timestamp + random string
- **Cache Headers**: 1-hour cache for optimal performance
- **Public Access**: Images publicly accessible for fast loading

### Access Control:
- **Restaurant Scoped**: Files organized by restaurant ID
- **User Permissions**: Requires valid restaurant staff access
- **Upload Restrictions**: Only authenticated users with restaurant access

## Benefits

### For Restaurant Owners:
- **Flexibility**: Choose between uploads and external URLs
- **Professional Look**: High-quality image management
- **Easy Management**: Intuitive drag-and-drop interface
- **Cost Control**: Images stored in dedicated bucket with clear organization

### For Developers:
- **Reusable Component**: Easy to integrate in other forms
- **Type Safe**: Full TypeScript support
- **Error Handling**: Comprehensive error states
- **Configurable**: Flexible props for different use cases

### For End Users:
- **Fast Loading**: Optimized image delivery via Supabase CDN
- **Consistent Quality**: Proper image validation and processing
- **Mobile Friendly**: Responsive design for all devices
- **Offline Support**: Images cached for PWA functionality

## Future Enhancements

### Potential Improvements:
1. **Image Resizing**: Automatic optimization on upload
2. **Multiple Images**: Support for image galleries per menu item
3. **Bulk Upload**: Mass image upload functionality
4. **Image Editor**: Basic cropping and editing capabilities
5. **AI Integration**: Automatic image optimization and alt-text generation

### Integration Options:
- **Menu Item Cards**: Enhanced image display in menu grids
- **Customer App**: High-quality images for customer-facing menus
- **Print Menus**: Export functionality with image optimization
- **Social Media**: Easy sharing with proper image formats

## Testing

### Manual Testing:
1. Navigate to Menu Management
2. Click "Add Item" or edit existing item
3. Test both upload and URL methods
4. Verify image preview and storage
5. Check form submission with both image types

### Browser Testing:
- ✅ Chrome/Edge: Full functionality
- ✅ Firefox: Full functionality  
- ✅ Safari: Full functionality
- ✅ Mobile browsers: Responsive design

### File Format Testing:
- ✅ JPEG/JPG: Standard format
- ✅ PNG: Transparency support
- ✅ WEBP: Modern format
- ✅ SVG: Vector graphics
- ✅ GIF: Animation support

This enhancement significantly improves the menu management experience while maintaining full backward compatibility and following best practices for image handling in web applications.

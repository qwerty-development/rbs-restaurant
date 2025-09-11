'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'react-hot-toast'
import { AlertTriangle, Plus, Building, Users, RefreshCw, Search, X, Loader2, CheckCircle2, MapPin, Camera, Save } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { LocationPicker } from '@/components/location/location-picker'
import type { Coordinates } from '@/lib/utils/location'
import { EnhancedRestaurantImageUpload } from '@/components/ui/enhanced-restaurant-image-upload'

interface Restaurant {
  name: string
  description: string
  address: string
  phone_number: string
  cuisine_type: string
  price_range: number
  booking_policy: 'instant' | 'request'
  owner_email: string
  tier: 'basic' | 'pro'
  coordinates?: Coordinates | null
  availability: {
    [key: string]: Array<{
      name: string
      is_open: boolean
      open_time: string
      close_time: string
    }>
  }
}

interface Staff {
  email: string
  role: 'owner' | 'manager' | 'staff' | 'viewer'
  restaurantId: string
}

// User search types
type SearchedUser = {
  id: string
  email: string
  full_name: string
  phone_number: string | null
  avatar_url: string | null
}

const defaultRestaurant: Restaurant = {
  name: "",
  description: "",
  address: "",
  phone_number: "",
  cuisine_type: "",
  price_range: 2,
  booking_policy: "instant",
  owner_email: "",
  tier: "pro",
  coordinates: null,
  availability: {
    monday: [{ name: "", is_open: true, open_time: "11:00", close_time: "22:00" }],
    tuesday: [{ name: "", is_open: true, open_time: "11:00", close_time: "22:00" }],
    wednesday: [{ name: "", is_open: true, open_time: "11:00", close_time: "22:00" }],
    thursday: [{ name: "", is_open: true, open_time: "11:00", close_time: "22:00" }],
    friday: [{ name: "", is_open: true, open_time: "11:00", close_time: "22:00" }],
    saturday: [{ name: "", is_open: true, open_time: "10:00", close_time: "24:00" }],
    sunday: [{ name: "", is_open: true, open_time: "10:00", close_time: "24:00" }]
  }
}


export default function AdminPage() {
  const [loading, setLoading] = useState(false)
  const [creationProgress, setCreationProgress] = useState('')
  const [restaurant, setRestaurant] = useState<Restaurant>(defaultRestaurant)
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [existingRestaurants, setExistingRestaurants] = useState<{id: string, name: string}[]>([])
  const [newStaff, setNewStaff] = useState<Staff>({
    email: '',
    role: 'manager',
    restaurantId: ''
  })
  
  // New state for pre-creation image upload
  const [showPreImageUpload, setShowPreImageUpload] = useState(false)
  const [mainImageUrl, setMainImageUrl] = useState<string>('')
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [tempRestaurantId, setTempRestaurantId] = useState<string>('')
  
  // Owner search state
  const [ownerSearch, setOwnerSearch] = useState("")
  const [searchedUsers, setSearchedUsers] = useState<SearchedUser[]>([])
  const [selectedOwner, setSelectedOwner] = useState<SearchedUser | null>(null)
  const [isSearchingUsers, setIsSearchingUsers] = useState(false)
  
  const supabase = createClient()

  useEffect(() => {
    const fetchExistingRestaurants = async () => {
      const { data: restaurants, error } = await supabase
        .from('restaurants')
        .select('id, name')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching restaurants:', error)
        return
      }

      setExistingRestaurants(restaurants || [])
    }
    
    fetchExistingRestaurants()
    
    // Generate a temporary ID for image upload
    setTempRestaurantId(`temp-${Date.now()}-${Math.random().toString(36).substring(7)}`)
  }, [supabase])

  // Search users when owner search changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (ownerSearch && ownerSearch.length >= 3 && !selectedOwner) {
        console.log('Searching for users with email:', ownerSearch)
        searchUsers(ownerSearch)
      } else if (ownerSearch.length < 3) {
        setSearchedUsers([])
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [ownerSearch, selectedOwner])

  // Set default booking policy based on tier
  useEffect(() => {
    if (restaurant.tier === 'basic') {
      setRestaurant(prev => ({ ...prev, booking_policy: 'request' }))
    } else if (restaurant.tier === 'pro' && restaurant.booking_policy === 'request') {
      // Only change to instant if currently on request (i.e., was basic before)
      setRestaurant(prev => ({ ...prev, booking_policy: 'instant' }))
    }
  }, [restaurant.tier])

  // Search for users by email
  const searchUsers = async (email: string) => {
    if (!email || email.length < 3) {
      setSearchedUsers([])
      return
    }

    try {
      setIsSearchingUsers(true)

      // Clean and normalize the search email
      const cleanEmail = email.trim().toLowerCase()
      console.log('Searching for users with cleaned email:', cleanEmail)

      // First try to search in profiles table by email
      const { data: profileUsers, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, phone_number, avatar_url, email')
        .or(`email.ilike.%${cleanEmail}%,email.eq.${cleanEmail}`)
        .limit(20)

      console.log('Profile search results:', profileUsers, 'Error:', profileError)

      let users: SearchedUser[] = []

      // If we found users in profiles, use them
      if (profileUsers && profileUsers.length > 0) {
        users = profileUsers.filter(u => u.email && u.full_name) as any
      }

      // If no users found by email, try searching by name (in case they typed a name instead of email)
      if (users.length === 0) {
        console.log('No email matches, trying name search...')
        const { data: nameSearch, error: nameError } = await supabase
          .from('profiles')
          .select('id, full_name, phone_number, avatar_url, email')
          .ilike('full_name', `%${cleanEmail}%`)
          .limit(10)

        console.log('Name search results:', nameSearch, 'Error:', nameError)

        if (nameSearch && nameSearch.length > 0) {
          users = nameSearch.filter(u => u.email && u.full_name) as any
        }
      }

      // If still no results, try a broader search
      if (users.length === 0) {
        console.log('No name matches, trying broader search...')
        const emailParts = cleanEmail.includes('@') ? cleanEmail.split('@') : [cleanEmail]
        const { data: broadSearch, error: broadError } = await supabase
          .from('profiles')
          .select('id, full_name, phone_number, avatar_url, email')
          .or(`full_name.ilike.%${emailParts[0]}%,email.ilike.%${emailParts[0]}%`)
          .limit(15)

        console.log('Broad search results:', broadSearch, 'Error:', broadError)

        if (broadSearch && broadSearch.length > 0) {
          users = broadSearch.filter(u => u.email && u.full_name) as any
        }
      }

      // Filter out users with null/empty emails and ensure they have the required fields
      const validUsers = users.filter(u => 
        u.email && 
        u.full_name && 
        u.id
      )

      console.log('Final valid users:', validUsers)
      setSearchedUsers(validUsers)

    } catch (error: any) {
      console.error('Error searching users:', error)
      toast.error(error.message || 'Failed to search users')
      setSearchedUsers([])
    } finally {
      setIsSearchingUsers(false)
    }
  }

  // Handle user selection
  const handleOwnerSelect = (user: SearchedUser) => {
    setSelectedOwner(user)
    setOwnerSearch(user.email)
    setRestaurant(prev => ({ ...prev, owner_email: user.email }))
    setSearchedUsers([])
  }

  // Clear user selection
  const clearOwnerSelection = () => {
    setSelectedOwner(null)
    setOwnerSearch('')
    setRestaurant(prev => ({ ...prev, owner_email: '' }))
    setSearchedUsers([])
  }

  // Handle opening/closing pre-upload image section
  const handleOpenImageUpload = () => {
    setShowPreImageUpload(true)
  }

  const handleCloseImageUpload = () => {
    setShowPreImageUpload(false)
  }

  // Handle address and coordinates changes from AddressSearch
  const handleAddressChange = (address: string, coordinates?: Coordinates) => {
    setRestaurant(prev => ({ 
      ...prev, 
      address: address,
      coordinates: coordinates || null
    }))
  }

  // Handle location changes from LocationPicker  
  const handleLocationPickerChange = (coordinates: Coordinates, address?: string) => {
    setRestaurant(prev => ({ 
      ...prev, 
      coordinates: coordinates,
      address: address || prev.address // Keep existing address if none provided
    }))
  }

  

  const refreshRestaurants = async () => {
    setLoading(true)
    try {
      const { data: restaurants, error } = await supabase
        .from('restaurants')
        .select('id, name')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching restaurants:', error)
        toast.error('Failed to refresh restaurants')
        return
      }

      setExistingRestaurants(restaurants || [])
      toast.success('Restaurants refreshed!')
    } catch (error) {
      console.error('Error refreshing restaurants:', error)
      toast.error('Failed to refresh restaurants')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateRestaurant = async () => {
    if (!restaurant.name || !restaurant.address || !restaurant.phone_number || !restaurant.cuisine_type || !selectedOwner) {
      toast.error('Please fill in all required fields and select an owner')
      return
    }

    if (!restaurant.coordinates) {
      toast.error('Please select a valid address with location coordinates')
      return
    }

    setLoading(true)
    try {
      setCreationProgress(`Creating ${restaurant.name}...`)

      // Use selected owner's data
      const ownerProfile = selectedOwner
      
      // Create location string from coordinates if available
      const locationValue = restaurant.coordinates 
        ? `POINT(${restaurant.coordinates.lng} ${restaurant.coordinates.lat})`
        : `POINT(-74.006 40.7128)` // Default NYC location
      
      const { data, error } = await supabase
        .from('restaurants')
        .insert({
          name: restaurant.name,
          description: restaurant.description,
          address: restaurant.address,
          phone_number: restaurant.phone_number,
          cuisine_type: restaurant.cuisine_type,
          tier: restaurant.tier,
          price_range: restaurant.price_range,
          booking_policy: restaurant.booking_policy,
          location: locationValue,
          main_image_url: mainImageUrl || null,
          image_urls: imageUrls.length > 0 ? imageUrls : null,
          average_rating: 0,
          total_reviews: 0,
          featured: false,
          status: 'active'
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating restaurant:', error)
        toast.error(`Failed to create ${restaurant.name}`)
        setLoading(false)
        setCreationProgress('')
        return
      }

      // Add the owner to restaurant_staff
      setCreationProgress(`Adding owner to ${restaurant.name}...`)
      const { error: staffError } = await supabase
        .from('restaurant_staff')
        .insert({
          restaurant_id: data.id,
          user_id: ownerProfile.id,
          role: 'owner',
          permissions: ['all'],
          is_active: true,
          created_by: ownerProfile.id
        })

      if (staffError) {
        console.error('Error adding owner:', staffError)
        toast.error('Restaurant created but failed to add owner. Please add manually.')
      }

      // Create restaurant hours based on availability settings
      setCreationProgress(`Setting up operating hours for ${restaurant.name}...`)
      const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      
      const allShifts: any[] = []
      DAYS_OF_WEEK.forEach(day => {
        const dayShifts = restaurant.availability[day] || []
        dayShifts.forEach(shift => {
          allShifts.push({
            restaurant_id: data.id,
            day_of_week: day,
            name: shift.name || null,
            is_open: shift.is_open,
            open_time: shift.is_open ? shift.open_time : null,
            close_time: shift.is_open ? shift.close_time : null,
          })
        })
      })

      if (allShifts.length > 0) {
        const { error: hoursError } = await supabase
          .from('restaurant_hours')
          .insert(allShifts)

        if (hoursError) {
          console.error('Error creating restaurant hours:', hoursError)
          toast.error('Restaurant created but failed to set operating hours. Please set them in settings.')
        }
      }
      
      // Update the existing restaurants list
      setExistingRestaurants(prev => [...prev, { id: data.id, name: data.name }])
      
      const imageMessage = mainImageUrl || imageUrls.length > 0 
        ? ` with ${imageUrls.length + (mainImageUrl ? 1 : 0)} image(s)`
        : ''
      
      toast.success(`Successfully created ${restaurant.name}${imageMessage} and assigned ${selectedOwner.full_name} (${selectedOwner.email}) as owner!`)
      
      // Reset form and images after successful creation
      setRestaurant(defaultRestaurant)
      clearOwnerSelection()
      setMainImageUrl('')
      setImageUrls([])
      setShowPreImageUpload(false)
      // Generate new temp ID for next restaurant
      setTempRestaurantId(`temp-${Date.now()}-${Math.random().toString(36).substring(7)}`)
    } catch (error) {
      console.error('Error creating restaurant:', error)
      toast.error('Failed to create restaurant')
    } finally {
      setLoading(false)
      setCreationProgress('')
    }
  }

  const handleAddStaff = async () => {
    if (!newStaff.email || !newStaff.restaurantId) {
      toast.error('Please fill in all fields')
      return
    }

    setLoading(true)
    try {
      // First, check if user exists in profiles
      const { data: userProfile, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', newStaff.email)
        .single()

      if (userError || !userProfile) {
        toast.error('User not found. User must be registered first.')
        setLoading(false)
        return
      }

      // Add to restaurant_staff
      const { error: staffError } = await supabase
        .from('restaurant_staff')
        .insert({
          restaurant_id: newStaff.restaurantId,
          user_id: userProfile.id,
          role: newStaff.role,
          permissions: getPermissionsByRole(newStaff.role),
          is_active: true
        })

      if (staffError) {
        console.error('Error adding staff:', staffError)
        toast.error('Failed to add staff member')
        return
      }

      toast.success('Staff member added successfully!')
      setNewStaff({ email: '', role: 'manager', restaurantId: '' })
    } catch (error) {
      console.error('Error adding staff:', error)
      toast.error('Failed to add staff member')
    } finally {
      setLoading(false)
    }
  }

  const getPermissionsByRole = (role: string): string[] => {
    switch (role) {
      case 'owner':
        return ['all']
      case 'manager':
        return ['bookings', 'customers', 'staff', 'analytics', 'tables', 'menu']
      case 'staff':
        return ['bookings', 'customers', 'tables']
      case 'viewer':
        return ['bookings', 'customers']
      default:
        return []
    }
  }

  const updateRestaurant = (field: keyof Restaurant, value: any) => {
    setRestaurant(prev => ({ ...prev, [field]: value }))
  }

  const updateAvailability = (day: string, shiftIndex: number, field: string, value: any) => {
    setRestaurant(prev => ({
      ...prev,
      availability: {
        ...prev.availability,
        [day]: prev.availability[day].map((shift, index) => 
          index === shiftIndex ? { ...shift, [field]: value } : shift
        )
      }
    }))
  }

  return (
    <>
      {/* Admin Dashboard Header */}
      <div className="mb-8">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
              <p className="text-blue-100">
                Welcome to the RBS Restaurant Management System Admin Panel
              </p>
              <p className="text-blue-200 text-sm mt-1">
                Manage restaurants, users, and system-wide settings
              </p>
            </div>
            <div className="hidden md:block">
              <div className="bg-white/10 rounded-lg p-4">
                <Building className="w-12 h-12 text-blue-100" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Restaurants</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{existingRestaurants.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Setup Form</CardTitle>
            <Plus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Single Restaurant</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <AlertTriangle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Active</div>
          </CardContent>
        </Card>
      </div>

      <div className="container mx-auto p-6 max-w-6xl">
        <div className="mb-6">
          <h2 className="text-3xl font-bold flex items-center gap-2">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
            Setup Tools
          </h2>
          <p className="text-muted-foreground mt-2">
            Quick setup tool for creating restaurants and adding staff. This page should be removed in production.
          </p>
        </div>

      <Tabs defaultValue="restaurants" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="restaurants" className="flex items-center gap-2">
            <Building className="w-4 h-4" />
            Restaurants
          </TabsTrigger>
          <TabsTrigger value="staff" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Staff Management
          </TabsTrigger>
        </TabsList>

        <TabsContent value="restaurants" className="space-y-6">
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-blue-800">What Gets Created</CardTitle>
              <CardDescription>
                Each restaurant is created with basic information and owner assignment only
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <h4 className="font-semibold text-blue-800">👤 Owner & Access</h4>
                  <ul className="space-y-1 text-blue-700">
                    <li>• Owner automatically added to staff</li>
                    <li>• Full permissions granted to owner</li>
                    <li>• Immediate access to dashboard</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-blue-800">� Restaurant Profile</h4>
                  <ul className="space-y-1 text-blue-700">
                    <li>• Basic restaurant information</li>
                    <li>• Contact details and address</li>
                    <li>• Cuisine type and tier settings</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-blue-800">📸 Image Management</h4>
                  <ul className="space-y-1 text-blue-700">
                    <li>• Upload main restaurant image (logo)</li>
                    <li>• Add gallery images (up to 10)</li>
                    <li>• Drag & drop reordering support</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-blue-800">⚙️ Setup Process</h4>
                  <ul className="space-y-1 text-blue-700">
                    <li>• Step 1: Create restaurant profile</li>
                    <li>• Step 2: Upload images (optional)</li>
                    <li>• Additional setup via dashboard</li>
                  </ul>
                </div>
              </div>
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-amber-800 text-sm">
                  <strong>Note:</strong> After creating the restaurant, you'll have the option to upload images. Restaurants will still need to set up their own sections, tables, schedules, and menu through the dashboard.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Create New Restaurant</CardTitle>
              <CardDescription>
                Create a new restaurant with basic information and assign an owner.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label>Restaurant Name *</Label>
                    <Input
                      value={restaurant.name}
                      onChange={(e) => updateRestaurant('name', e.target.value)}
                      placeholder="Enter restaurant name"
                    />
                  </div>
                  <div>
                    <Label>Cuisine Type *</Label>
                    <Input
                      value={restaurant.cuisine_type}
                      onChange={(e) => updateRestaurant('cuisine_type', e.target.value)}
                      placeholder="e.g., Italian, Japanese, American"
                    />
                  </div>
                  <div>
                    <Label>Phone Number *</Label>
                    <Input
                      value={restaurant.phone_number}
                      onChange={(e) => updateRestaurant('phone_number', e.target.value)}
                      placeholder="+1234567890"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Restaurant Address *</Label>
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <Input
                          value={restaurant.address}
                          onChange={(e) => handleAddressChange(e.target.value)}
                          placeholder="Enter restaurant address..."
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowLocationPicker(!showLocationPicker)}
                          className="px-4"
                        >
                          {showLocationPicker ? 'Hide Map' : 'Open Map'}
                        </Button>
                      </div>
                      
                      {restaurant.coordinates && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 text-green-600" />
                          <span>Location: {restaurant.coordinates.lat.toFixed(4)}, {restaurant.coordinates.lng.toFixed(4)}</span>
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                            Coordinates Set
                          </Badge>
                        </div>
                      )}

                      {showLocationPicker && (
                        <div className="border rounded-lg overflow-hidden">
                          <LocationPicker
                            value={restaurant.coordinates}
                            onChange={handleLocationPickerChange}
                            initialAddress={restaurant.address}
                            height={350}
                            showAddressSearch={false} // We have it above
                            showCurrentLocation={false} // We have it in AddressSearch
                            showCoordinateInput={true}
                            zoom={15}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label>Owner Search *</Label>
                    <div className="relative">
                      <Input
                        type="email"
                        placeholder="Enter email or name to search for owner..."
                        value={ownerSearch}
                        onChange={(e) => setOwnerSearch(e.target.value)}
                        className="pr-20"
                      />
                      <div className="absolute right-2 top-2 flex items-center gap-1">
                        {isSearchingUsers && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        {ownerSearch && ownerSearch.length >= 3 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => searchUsers(ownerSearch)}
                            disabled={isSearchingUsers}
                          >
                            <Search className="h-3 w-3" />
                          </Button>
                        )}
                        {selectedOwner && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={clearOwnerSelection}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {/* Search Results - Show directly under search box */}
                    {searchedUsers.length > 0 && !selectedOwner && (
                      <div className="mt-2 space-y-2 max-h-64 overflow-y-auto border rounded-lg bg-white shadow-lg">
                        {searchedUsers.map((user) => (
                          <div
                            key={user.id}
                            className="p-3 cursor-pointer hover:bg-muted/50 border-b last:border-b-0 transition-colors"
                            onClick={() => handleOwnerSelect(user)}
                          >
                            <div className="flex items-center space-x-3">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-xs font-semibold">
                                  {user.full_name.split(' ').map(n => n[0]).join('')}
                                </span>
                              </div>
                              <div className="flex-1">
                                <div className="font-medium">{user.full_name}</div>
                                <div className="text-sm text-muted-foreground">{user.email}</div>
                                {user.phone_number && (
                                  <div className="text-sm text-muted-foreground">{user.phone_number}</div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Helper messages */}
                    {ownerSearch && ownerSearch.length >= 3 && !isSearchingUsers && searchedUsers.length === 0 && !selectedOwner && (
                      <div className="text-sm text-muted-foreground mt-1 space-y-1">
                        <p>No users found. Try:</p>
                        <ul className="text-xs list-disc list-inside ml-2 space-y-1">
                          <li>Checking the email spelling</li>
                          <li>Searching by name instead</li>
                          <li>Using just the username part (before @)</li>
                          <li>Making sure the user has registered</li>
                        </ul>
                      </div>
                    )}
                    {ownerSearch && ownerSearch.length < 3 && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Enter at least 3 characters to search
                      </p>
                    )}
                  </div>

                  {/* Selected Owner Display */}
                  {selectedOwner && (
                    <div className="p-4 border rounded-lg bg-muted/50">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-semibold">
                            {selectedOwner.full_name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium">{selectedOwner.full_name}</h4>
                          <p className="text-sm text-muted-foreground">{selectedOwner.email}</p>
                          {selectedOwner.phone_number && (
                            <p className="text-sm text-muted-foreground">{selectedOwner.phone_number}</p>
                          )}
                        </div>
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      </div>
                    </div>
                  )}

                  <div>
                    <Label>Price Range (1-4)</Label>
                    <Select
                      value={restaurant.price_range.toString()}
                      onValueChange={(value) => updateRestaurant('price_range', parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">$ - Budget</SelectItem>
                        <SelectItem value="2">$$ - Moderate</SelectItem>
                        <SelectItem value="3">$$$ - Expensive</SelectItem>
                        <SelectItem value="4">$$$$ - Very Expensive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Restaurant Tier</Label>
                    <Select
                      value={restaurant.tier}
                      onValueChange={(value: 'basic' | 'pro') => updateRestaurant('tier', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="basic">Basic Tier</SelectItem>
                        <SelectItem value="pro">Pro Tier</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {restaurant.tier === 'pro' && (
                    <div>
                      <Label>Booking Policy</Label>
                      <Select
                        value={restaurant.booking_policy}
                        onValueChange={(value: 'instant' | 'request') => updateRestaurant('booking_policy', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="instant">Instant Booking</SelectItem>
                          <SelectItem value="request">Request Based</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="md:col-span-3">
                    <Label>Operating Hours</Label>
                    <div className="space-y-4 mt-2">
                      {Object.entries(restaurant.availability).map(([day, shifts]) => (
                        <div key={day} className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-2">
                            <Label className="text-sm capitalize">{day}</Label>
                          </div>
                          <div className="col-span-2">
                            <Checkbox
                              checked={shifts[0]?.is_open || false}
                              onCheckedChange={(checked) => updateAvailability(day, 0, 'is_open', checked)}
                            />
                            <span className="ml-2 text-sm">Open</span>
                          </div>
                          {shifts[0]?.is_open && (
                            <>
                              <div className="col-span-3">
                                <Input
                                  type="time"
                                  value={shifts[0]?.open_time || '11:00'}
                                  onChange={(e) => updateAvailability(day, 0, 'open_time', e.target.value)}
                                  className="w-full"
                                />
                              </div>
                              <div className="col-span-1 text-center">
                                <span className="text-sm">to</span>
                              </div>
                              <div className="col-span-3">
                                <Input
                                  type="time"
                                  value={shifts[0]?.close_time || '22:00'}
                                  onChange={(e) => updateAvailability(day, 0, 'close_time', e.target.value)}
                                  className="w-full"
                                />
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="md:col-span-3">
                    <Label>Description</Label>
                    <Textarea
                      value={restaurant.description}
                      onChange={(e) => updateRestaurant('description', e.target.value)}
                      rows={3}
                      placeholder="Describe the restaurant atmosphere, cuisine, and special features"
                    />
                  </div>
                </div>

                {/* Image Upload Section - Before Restaurant Creation */}
                <div className="mt-6 p-4 border rounded-lg bg-blue-50 border-blue-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-semibold text-blue-800 flex items-center gap-2">
                        <Camera className="w-5 h-5" />
                        Restaurant Images (Optional)
                      </h4>
                      <p className="text-sm text-blue-600 mt-1">
                        Add images before creating the restaurant. You can upload a main image and gallery images.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={showPreImageUpload ? handleCloseImageUpload : handleOpenImageUpload}
                      className="border-blue-300 text-blue-700 hover:bg-blue-100"
                    >
                      {showPreImageUpload ? (
                        <>
                          <X className="w-4 h-4 mr-2" />
                          Close Images
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          Add Images
                        </>
                      )}
                    </Button>
                  </div>

                  {showPreImageUpload && (
                    <div className="space-y-4">
                      <EnhancedRestaurantImageUpload
                        restaurantId={tempRestaurantId}
                        mainImageUrl={mainImageUrl}
                        images={imageUrls}
                        onMainImageChange={setMainImageUrl}
                        onImagesChange={setImageUrls}
                        maxImages={10}
                        maxFileSize={5}
                      />
                    </div>
                  )}

                  {(mainImageUrl || imageUrls.length > 0) && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2 text-green-800">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="font-medium">
                          Images Ready: {imageUrls.length + (mainImageUrl ? 1 : 0)} image(s) selected
                        </span>
                      </div>
                      <p className="text-green-600 text-sm mt-1">
                        These images will be included when you create the restaurant.
                      </p>
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleCreateRestaurant}
                  disabled={loading || !restaurant.name || !restaurant.address || !restaurant.phone_number || !restaurant.cuisine_type || !selectedOwner || !restaurant.coordinates}
                  className="w-full"
                  size="lg"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      {creationProgress || 'Creating restaurant...'}
                    </div>
                  ) : (
                    <>
                      <Building className="w-4 h-4 mr-2" />
                      Create Restaurant
                      {(mainImageUrl || imageUrls.length > 0) && (
                        <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                          +{imageUrls.length + (mainImageUrl ? 1 : 0)} images
                        </span>
                      )}
                    </>
                  )}
                </Button>
              </div>

              {existingRestaurants.length > 0 && (
                <Card className="mt-6 border-green-200 bg-green-50">
                  <CardHeader>
                    <CardTitle className="text-green-800">Existing Restaurants</CardTitle>
                    <CardDescription>All restaurants in the database</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {existingRestaurants.map((restaurant) => (
                        <div key={restaurant.id} className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="font-medium">{restaurant.name}</span>
                          <span className="text-sm text-muted-foreground">ID: {restaurant.id}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="staff" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Add Staff to Restaurants</CardTitle>
                  <CardDescription>
                    Add existing users as staff members to restaurants. Users must be registered first. 
                    You can also assign owners here in addition to the restaurant creation form.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshRestaurants}
                  disabled={loading}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div>
                  <Label>User Email</Label>
                  <Input
                    type="email"
                    placeholder="user@example.com"
                    value={newStaff.email}
                    onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Role</Label>
                  <Select
                    value={newStaff.role}
                    onValueChange={(value: any) => setNewStaff({ ...newStaff, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">Owner</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Restaurant</Label>
                  <Select
                    value={newStaff.restaurantId}
                    onValueChange={(value) => setNewStaff({ ...newStaff, restaurantId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a restaurant" />
                    </SelectTrigger>
                    <SelectContent>
                      {existingRestaurants.map((restaurant) => (
                        <SelectItem key={restaurant.id} value={restaurant.id}>
                          {restaurant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleAddStaff}
                  disabled={loading || !newStaff.email || !newStaff.restaurantId}
                >
                  {loading ? 'Adding Staff...' : 'Add Staff Member'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {existingRestaurants.length === 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-amber-800">
                  <AlertTriangle className="w-5 h-5" />
                  <span>Create restaurants first to add staff members</span>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
      </div>
    </>
  )
}

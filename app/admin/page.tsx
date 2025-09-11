'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'react-hot-toast'
import { AlertTriangle, Plus, Building, Users, RefreshCw } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'

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

const getAmbanceByPriceRange = (priceRange: number): string[] => {
  switch (priceRange) {
    case 1:
      return ['casual', 'family-friendly', 'quick-service']
    case 2:
      return ['casual', 'neighborhood', 'comfortable']
    case 3:
      return ['upscale', 'romantic', 'elegant']
    case 4:
      return ['fine-dining', 'luxury', 'sophisticated', 'intimate']
    default:
      return ['casual']
  }
}

export default function AdminPage() {
  const [loading, setLoading] = useState(false)
  const [creationProgress, setCreationProgress] = useState('')
  const [restaurant, setRestaurant] = useState<Restaurant>(defaultRestaurant)
  const [existingRestaurants, setExistingRestaurants] = useState<{id: string, name: string}[]>([])
  const [newStaff, setNewStaff] = useState<Staff>({
    email: '',
    role: 'manager',
    restaurantId: ''
  })
  const router = useRouter()
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
  }, [supabase])

  // Set default booking policy based on tier
  useEffect(() => {
    if (restaurant.tier === 'basic') {
      setRestaurant(prev => ({ ...prev, booking_policy: 'request' }))
    } else if (restaurant.tier === 'pro' && restaurant.booking_policy === 'request') {
      // Only change to instant if currently on request (i.e., was basic before)
      setRestaurant(prev => ({ ...prev, booking_policy: 'instant' }))
    }
  }, [restaurant.tier])

  

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
    if (!restaurant.name || !restaurant.address || !restaurant.phone_number || !restaurant.cuisine_type || !restaurant.owner_email) {
      toast.error('Please fill in all required fields including owner email')
      return
    }

    setLoading(true)
    try {
      setCreationProgress(`Creating ${restaurant.name}...`)

      // First, check if owner exists in profiles
      const { data: ownerProfile, error: ownerError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', restaurant.owner_email)
        .single()

      if (ownerError || !ownerProfile) {
        toast.error('Owner not found. The owner must be registered first.')
        setLoading(false)
        setCreationProgress('')
        return
      }
      
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
          location: `POINT(-74.006 40.7128)`, // Default NYC location
          average_rating: 4.5,
          total_reviews: Math.floor(Math.random() * 100) + 10,
          featured: false,
          status: 'active',
          // Enhanced default settings
          booking_window_days: 30,
          cancellation_window_hours: 24,
          table_turnover_minutes: restaurant.price_range <= 2 ? 90 : 120,
          dietary_options: ['vegetarian', 'vegan', 'gluten-free'],
          parking_available: true,
          outdoor_seating: true,
          ambiance_tags: getAmbanceByPriceRange(restaurant.price_range),
          tags: [restaurant.cuisine_type.toLowerCase(), 'reservations', 'full-service']
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
      setCreationProgress(`Setting up ${restaurant.name} - Adding owner...`)
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
      
      setCreationProgress(`Setting up ${restaurant.name} - Creating sections...`)
      
      // Create restaurant sections first
      const sections = [
        { name: 'Main Dining', description: 'Primary dining area', capacity: 40, is_active: true },
        { name: 'Bar Area', description: 'Bar seating and high tables', capacity: 15, is_active: true },
        { name: 'Patio', description: 'Outdoor seating area', capacity: 20, is_active: true },
        { name: 'Private Dining', description: 'Private dining room', capacity: 12, is_active: true }
      ]

      const sectionIds: { [key: string]: string } = {}
      
      for (const section of sections) {
        const { data: sectionData, error: sectionError } = await supabase
          .from('restaurant_sections')
          .insert({
            restaurant_id: data.id,
            ...section
          })
          .select()
          .single()

        if (!sectionError && sectionData) {
          sectionIds[section.name] = sectionData.id
        }
      }

      setCreationProgress(`Setting up ${restaurant.name} - Creating tables...`)

      // Create comprehensive table layout
      const tables = [
        // Main Dining Area Tables
        { table_number: 'M1', table_type: 'standard', capacity: 2, x_position: 100, y_position: 100, section_id: sectionIds['Main Dining'] },
        { table_number: 'M2', table_type: 'standard', capacity: 2, x_position: 200, y_position: 100, section_id: sectionIds['Main Dining'] },
        { table_number: 'M3', table_type: 'standard', capacity: 4, x_position: 300, y_position: 100, section_id: sectionIds['Main Dining'] },
        { table_number: 'M4', table_type: 'standard', capacity: 4, x_position: 400, y_position: 100, section_id: sectionIds['Main Dining'] },
        { table_number: 'M5', table_type: 'booth', capacity: 6, x_position: 100, y_position: 200, section_id: sectionIds['Main Dining'] },
        { table_number: 'M6', table_type: 'booth', capacity: 6, x_position: 300, y_position: 200, section_id: sectionIds['Main Dining'] },
        { table_number: 'M7', table_type: 'window', capacity: 4, x_position: 100, y_position: 300, section_id: sectionIds['Main Dining'] },
        { table_number: 'M8', table_type: 'window', capacity: 4, x_position: 200, y_position: 300, section_id: sectionIds['Main Dining'] },
        
        // Bar Area Tables
        { table_number: 'B1', table_type: 'bar', capacity: 2, x_position: 100, y_position: 100, section_id: sectionIds['Bar Area'] },
        { table_number: 'B2', table_type: 'bar', capacity: 2, x_position: 150, y_position: 100, section_id: sectionIds['Bar Area'] },
        { table_number: 'B3', table_type: 'bar', capacity: 3, x_position: 200, y_position: 100, section_id: sectionIds['Bar Area'] },
        { table_number: 'B4', table_type: 'standard', capacity: 4, x_position: 100, y_position: 200, section_id: sectionIds['Bar Area'] },
        
        // Patio Tables
        { table_number: 'P1', table_type: 'patio', capacity: 4, x_position: 100, y_position: 100, section_id: sectionIds['Patio'] },
        { table_number: 'P2', table_type: 'patio', capacity: 6, x_position: 200, y_position: 100, section_id: sectionIds['Patio'] },
        { table_number: 'P3', table_type: 'patio', capacity: 8, x_position: 300, y_position: 100, section_id: sectionIds['Patio'] },
        { table_number: 'P4', table_type: 'patio', capacity: 4, x_position: 100, y_position: 200, section_id: sectionIds['Patio'] },
        
        // Private Dining
        { table_number: 'PD1', table_type: 'private', capacity: 12, x_position: 100, y_position: 100, section_id: sectionIds['Private Dining'] }
      ]

      for (const table of tables) {
        await supabase
          .from('restaurant_tables')
          .insert({
            restaurant_id: data.id,
            ...table
          })
      }

      setCreationProgress(`Setting up ${restaurant.name} - Creating weekly schedule...`)

      // Create weekly availability schedule using restaurant.availability
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
      const weeklySchedule = []

      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const dayName = dayNames[dayIndex]
        const dayShifts = restaurant.availability[dayName] || []
        
        // For each shift in the day
        for (const shift of dayShifts) {
          if (shift.is_open && shift.open_time && shift.close_time) {
            weeklySchedule.push({
              restaurant_id: data.id,
              day_of_week: dayName,
              name: shift.name || null,
              is_open: shift.is_open,
              open_time: shift.open_time,
              close_time: shift.close_time
            })
          }
        }
      }

      // Insert weekly schedule into restaurant_hours table
      if (weeklySchedule.length > 0) {
        await supabase
          .from('restaurant_hours')
          .insert(weeklySchedule)
      }

      setCreationProgress(`Setting up ${restaurant.name} - Creating service periods...`)

      // Create default service periods
      const servicePeriods = [
        { name: 'Breakfast', start_time: '08:00', end_time: '11:00', is_active: restaurant.cuisine_type !== 'Japanese' },
        { name: 'Lunch', start_time: '12:00', end_time: '15:00', is_active: true },
        { name: 'Dinner', start_time: '17:00', end_time: '22:00', is_active: true },
        { name: 'Late Night', start_time: '22:00', end_time: '24:00', is_active: restaurant.price_range >= 3 }
      ]

      for (const period of servicePeriods) {
        if (period.is_active) {
          await supabase
            .from('restaurant_service_periods')
            .insert({
              restaurant_id: data.id,
              name: period.name,
              start_time: period.start_time,
              end_time: period.end_time,
              is_active: true
            })
        }
      }

      setCreationProgress(`Setting up ${restaurant.name} - Creating 30-day availability...`)

      // Create default table availability for the next 30 days
      const today = new Date()
      const availabilityPromises = []

      for (let i = 0; i < 30; i++) {
        const date = new Date(today)
        date.setDate(today.getDate() + i)
        
        // Get day name for this date
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
        const dayName = dayNames[date.getDay()]
        const dayShifts = restaurant.availability[dayName] || []
        
        // Find the first open shift for this day
        const firstOpenShift = dayShifts.find(shift => shift.is_open && shift.open_time && shift.close_time)
        
        if (firstOpenShift) {
          availabilityPromises.push(
            supabase
              .from('restaurant_daily_availability')
              .insert({
                restaurant_id: data.id,
                date: date.toISOString().split('T')[0],
                is_open: true,
                open_time: firstOpenShift.open_time,
                close_time: firstOpenShift.close_time,
                max_capacity: 87, // Sum of all table capacities
                special_notes: i === 0 ? 'Opening day - full service available' : null
              })
          )
        }
      }

      await Promise.all(availabilityPromises)
      
      // Update the existing restaurants list
      setExistingRestaurants(prev => [...prev, { id: data.id, name: data.name }])
      
      toast.success(`Successfully created ${restaurant.name} with complete setup and assigned ${restaurant.owner_email} as owner!`)
      
      // Reset form after successful creation
      setRestaurant(defaultRestaurant)
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
              <CardTitle className="text-blue-800">What Gets Created by Default</CardTitle>
              <CardDescription>
                Each restaurant comes with a complete setup ready for immediate use, including automatic owner assignment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div className="space-y-2">
                  <h4 className="font-semibold text-blue-800">👤 Owner & Access</h4>
                  <ul className="space-y-1 text-blue-700">
                    <li>• Owner automatically added</li>
                    <li>• Full permissions granted</li>
                    <li>• Immediate access to dashboard</li>
                    <li>• Staff invitation capability</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-blue-800">🏢 Restaurant Sections</h4>
                  <ul className="space-y-1 text-blue-700">
                    <li>• Main Dining (40 seats)</li>
                    <li>• Bar Area (15 seats)</li>
                    <li>• Patio (20 seats)</li>
                    <li>• Private Dining (12 seats)</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-blue-800">🪑 Tables & Layout</h4>
                  <ul className="space-y-1 text-blue-700">
                    <li>• 17 total tables</li>
                    <li>• Multiple table types</li>
                    <li>• Proper positioning</li>
                    <li>• 87 total capacity</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-blue-800">📅 Schedule & Hours</h4>
                  <ul className="space-y-1 text-blue-700">
                    <li>• Full weekly schedule</li>
                    <li>• Extended weekend hours</li>
                    <li>• Service periods</li>
                    <li>• 30-day availability</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Create New Restaurant</CardTitle>
              <CardDescription>
                Create a single restaurant with all necessary setup including tables, sections, schedules, and assign an owner.
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
                    <Label>Address *</Label>
                    <Input
                      value={restaurant.address}
                      onChange={(e) => updateRestaurant('address', e.target.value)}
                      placeholder="Full restaurant address"
                    />
                  </div>
                  <div>
                    <Label>Owner Email *</Label>
                    <Input
                      type="email"
                      value={restaurant.owner_email}
                      onChange={(e) => updateRestaurant('owner_email', e.target.value)}
                      placeholder="owner@example.com"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Owner must be registered in the system first
                    </p>
                  </div>
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

                <Button
                  onClick={handleCreateRestaurant}
                  disabled={loading || !restaurant.name || !restaurant.address || !restaurant.phone_number || !restaurant.cuisine_type || !restaurant.owner_email}
                  className="w-full"
                  size="lg"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      {creationProgress || 'Creating restaurant...'}
                    </div>
                  ) : (
                    'Create Restaurant'
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

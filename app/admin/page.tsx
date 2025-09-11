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
import { AlertTriangle, Plus, User, Building, Users, Copy, RefreshCw } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'

interface Restaurant {
  name: string
  description: string
  address: string
  phone_number: string
  cuisine_type: string
  opening_time: string
  closing_time: string
  price_range: number
  booking_policy: 'instant' | 'request'
}

interface Staff {
  email: string
  role: 'owner' | 'manager' | 'staff' | 'viewer'
  restaurantId: string
}

const defaultRestaurants: Restaurant[] = [
  {
    name: "The Golden Fork",
    description: "Fine dining with contemporary cuisine and exceptional service",
    address: "123 Main Street, Downtown",
    phone_number: "+1234567890",
    cuisine_type: "Contemporary",
    opening_time: "17:00",
    closing_time: "23:00",
    price_range: 3,
    booking_policy: "request"
  },
  {
    name: "Pasta Palace",
    description: "Authentic Italian cuisine in a warm, family-friendly atmosphere",
    address: "456 Oak Avenue, Little Italy",
    phone_number: "+1234567891",
    cuisine_type: "Italian",
    opening_time: "11:30",
    closing_time: "22:00",
    price_range: 2,
    booking_policy: "instant"
  },
  {
    name: "Sushi Zen",
    description: "Traditional Japanese sushi and modern fusion in an elegant setting",
    address: "789 Bamboo Lane, Uptown",
    phone_number: "+1234567892",
    cuisine_type: "Japanese",
    opening_time: "17:30",
    closing_time: "23:30",
    price_range: 4,
    booking_policy: "request"
  },
  {
    name: "The Burger Joint",
    description: "Gourmet burgers, craft beers, and casual dining experience",
    address: "321 Food Street, Midtown",
    phone_number: "+1234567893",
    cuisine_type: "American",
    opening_time: "11:00",
    closing_time: "21:00",
    price_range: 2,
    booking_policy: "instant"
  }
]

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
  const [restaurants, setRestaurants] = useState<Restaurant[]>(defaultRestaurants)
  const [selectedRestaurants, setSelectedRestaurants] = useState<boolean[]>(new Array(defaultRestaurants.length).fill(false))
  const [existingRestaurants, setExistingRestaurants] = useState<{id: string, name: string}[]>([])
  const [newStaff, setNewStaff] = useState<Staff>({
    email: '',
    role: 'manager',
    restaurantId: ''
  })
  const [currentUser, setCurrentUser] = useState<any>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        
        setCurrentUser({ ...user, profile })
      }
    }

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

    getCurrentUser()
    fetchExistingRestaurants()
  }, [supabase, router])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
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

  const handleCreateAllRestaurants = async () => {
    const selectedIndices = selectedRestaurants
      .map((selected, index) => selected ? index : -1)
      .filter(index => index !== -1)

    if (selectedIndices.length === 0) {
      toast.error('Please select at least one restaurant to create')
      return
    }

    setLoading(true)
    try {
      const created: {id: string, name: string}[] = []
      
      for (const index of selectedIndices) {
        const restaurant = restaurants[index]
        setCreationProgress(`Creating ${restaurant.name}...`)
        
        const { data, error } = await supabase
          .from('restaurants')
          .insert({
            name: restaurant.name,
            description: restaurant.description,
            address: restaurant.address,
            phone_number: restaurant.phone_number,
            cuisine_type: restaurant.cuisine_type,
            opening_time: restaurant.opening_time,
            closing_time: restaurant.closing_time,
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
          continue
        }

        created.push({ id: data.id, name: data.name })
        
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

        // Create weekly availability schedule
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        const weeklySchedule = []

        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
          const isWeekend = dayIndex === 0 || dayIndex === 6 // Sunday or Saturday
          const openTime = isWeekend ? '10:00' : restaurant.opening_time
          const closeTime = isWeekend ? '24:00' : restaurant.closing_time
          
          weeklySchedule.push({
            restaurant_id: data.id,
            day_of_week: dayIndex,
            is_open: true,
            open_time: openTime,
            close_time: closeTime,
            special_hours: isWeekend ? 'Extended weekend hours' : null
          })
        }

        // Insert weekly schedule
        await supabase
          .from('restaurant_availability')
          .insert(weeklySchedule)

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
          
          // Skip if restaurant is closed on this day
          const dayOfWeek = date.getDay()
          const schedule = weeklySchedule.find(s => s.day_of_week === dayOfWeek)
          
          if (schedule?.is_open) {
            availabilityPromises.push(
              supabase
                .from('restaurant_daily_availability')
                .insert({
                  restaurant_id: data.id,
                  date: date.toISOString().split('T')[0],
                  is_open: true,
                  open_time: schedule.open_time,
                  close_time: schedule.close_time,
                  max_capacity: 87, // Sum of all table capacities
                  special_notes: i === 0 ? 'Opening day - full service available' : null
                })
            )
          }
        }

        await Promise.all(availabilityPromises)
        
        toast.success(`Created ${restaurant.name} with 4 sections, 17 tables, weekly schedule, and 30-day availability`)
      }

      // Update both the created list and existing restaurants list
      setExistingRestaurants(prev => [...prev, ...created])
      
      const restaurantWord = created.length === 1 ? 'restaurant' : 'restaurants'
      const setupDetails = created.length === 1 
        ? '4 sections, 17 tables, weekly schedule, service periods, and 30-day availability'
        : `complete setup with sections, tables, schedules, and availability`
      
      toast.success(`Successfully created ${created.length} ${restaurantWord} with ${setupDetails}!`)
      
      // Reset selections after successful creation
      setSelectedRestaurants(new Array(restaurants.length).fill(false))
    } catch (error) {
      console.error('Error creating restaurants:', error)
      toast.error('Failed to create restaurants')
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

  const updateRestaurant = (index: number, field: keyof Restaurant, value: any) => {
    const updated = [...restaurants]
    updated[index] = { ...updated[index], [field]: value }
    setRestaurants(updated)
  }

  const toggleRestaurantSelection = (index: number) => {
    const updated = [...selectedRestaurants]
    updated[index] = !updated[index]
    setSelectedRestaurants(updated)
  }

  const toggleSelectAll = () => {
    const allSelected = selectedRestaurants.every(selected => selected)
    setSelectedRestaurants(new Array(restaurants.length).fill(!allSelected))
  }

  const selectedCount = selectedRestaurants.filter(Boolean).length

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
            <CardTitle className="text-sm font-medium">Available Templates</CardTitle>
            <Plus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{restaurants.length}</div>
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="user" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Current User
          </TabsTrigger>
          <TabsTrigger value="restaurants" className="flex items-center gap-2">
            <Building className="w-4 h-4" />
            Restaurants
          </TabsTrigger>
          <TabsTrigger value="staff" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Staff Management
          </TabsTrigger>
        </TabsList>

        <TabsContent value="user" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Current User Information</CardTitle>
              <CardDescription>
                Your current user details for testing and staff assignment
              </CardDescription>
            </CardHeader>
            <CardContent>
              {currentUser ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>User ID</Label>
                      <div className="flex items-center gap-2">
                        <Input value={currentUser.id} readOnly />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(currentUser.id)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label>Email</Label>
                      <div className="flex items-center gap-2">
                        <Input value={currentUser.email} readOnly />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(currentUser.email)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    {currentUser.profile && (
                      <>
                        <div>
                          <Label>Full Name</Label>
                          <Input value={currentUser.profile.full_name || 'Not set'} readOnly />
                        </div>
                        <div>
                          <Label>Profile Created</Label>
                          <Input value={new Date(currentUser.profile.created_at).toLocaleDateString()} readOnly />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div>Loading user information...</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="restaurants" className="space-y-6">
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-blue-800">What Gets Created by Default</CardTitle>
              <CardDescription>
                Each restaurant comes with a complete setup ready for immediate use
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
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
                <div className="space-y-2">
                  <h4 className="font-semibold text-blue-800">⚙️ Settings & Features</h4>
                  <ul className="space-y-1 text-blue-700">
                    <li>• Dietary options</li>
                    <li>• Parking available</li>
                    <li>• Ambiance tags</li>
                    <li>• Booking policies</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Create Sample Restaurants</CardTitle>
              <CardDescription>
                Select which restaurants to create. You can modify the details below before creating them.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="select-all"
                      checked={selectedRestaurants.every(Boolean)}
                      onCheckedChange={toggleSelectAll}
                    />
                    <Label htmlFor="select-all" className="font-medium">
                      Select All ({selectedCount} of {restaurants.length} selected)
                    </Label>
                  </div>
                  <Button
                    onClick={handleCreateAllRestaurants}
                    disabled={loading || selectedCount === 0}
                    className="ml-auto"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        {creationProgress || 'Creating...'}
                      </div>
                    ) : (
                      `Create Selected (${selectedCount})`
                    )}
                  </Button>
                </div>

                <div className="grid gap-6">
                  {restaurants.map((restaurant, index) => (
                    <Card key={index} className={`p-4 transition-all ${selectedRestaurants[index] ? 'ring-2 ring-primary bg-primary/5' : ''}`}>
                      <div className="flex items-start gap-4">
                        <Checkbox
                          id={`restaurant-${index}`}
                          checked={selectedRestaurants[index]}
                          onCheckedChange={() => toggleRestaurantSelection(index)}
                          className="mt-6"
                        />
                        <div className="flex-1">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                              <Label>Restaurant Name</Label>
                              <Input
                                value={restaurant.name}
                                onChange={(e) => updateRestaurant(index, 'name', e.target.value)}
                              />
                            </div>
                            <div>
                              <Label>Cuisine Type</Label>
                              <Input
                                value={restaurant.cuisine_type}
                                onChange={(e) => updateRestaurant(index, 'cuisine_type', e.target.value)}
                              />
                            </div>
                            <div>
                              <Label>Phone Number</Label>
                              <Input
                                value={restaurant.phone_number}
                                onChange={(e) => updateRestaurant(index, 'phone_number', e.target.value)}
                              />
                            </div>
                            <div className="md:col-span-2">
                              <Label>Address</Label>
                              <Input
                                value={restaurant.address}
                                onChange={(e) => updateRestaurant(index, 'address', e.target.value)}
                              />
                            </div>
                            <div>
                              <Label>Price Range (1-4)</Label>
                              <Select
                                value={restaurant.price_range.toString()}
                                onValueChange={(value) => updateRestaurant(index, 'price_range', parseInt(value))}
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
                              <Label>Opening Time</Label>
                              <Input
                                type="time"
                                value={restaurant.opening_time}
                                onChange={(e) => updateRestaurant(index, 'opening_time', e.target.value)}
                              />
                            </div>
                            <div>
                              <Label>Closing Time</Label>
                              <Input
                                type="time"
                                value={restaurant.closing_time}
                                onChange={(e) => updateRestaurant(index, 'closing_time', e.target.value)}
                              />
                            </div>
                            <div className="md:col-span-3">
                              <Label>Description</Label>
                              <Textarea
                                value={restaurant.description}
                                onChange={(e) => updateRestaurant(index, 'description', e.target.value)}
                                rows={2}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                <Button
                  onClick={handleCreateAllRestaurants}
                  disabled={loading || selectedCount === 0}
                  className="w-full"
                  size="lg"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      {creationProgress || 'Creating restaurants...'}
                    </div>
                  ) : (
                    `Create Selected Restaurants (${selectedCount})`
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

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { toast } from 'react-hot-toast'
import { 
  Search, 
  Filter, 
  Plus, 
  Edit2, 
  Trash2, 
  Eye, 
  MapPin, 
  Phone, 
  Clock, 
  Star, 
  DollarSign,
  Users,
  Calendar,
  ChefHat,
  Settings,
  BarChart3,
  RefreshCw,
  Download,
  Upload,
  MoreHorizontal,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Pause
} from 'lucide-react'
import { titleCase } from '@/lib/utils'

interface Restaurant {
  id: string
  name: string
  description: string
  address: string
  phone_number: string
  cuisine_type: string
  opening_time: string
  closing_time: string
  price_range: number
  booking_policy: 'instant' | 'request'
  average_rating: number
  total_reviews: number
  status: 'active' | 'inactive' | 'suspended'
  featured: boolean
  created_at: string
  updated_at: string
  // Additional fields for admin management
  total_bookings?: number
  total_revenue?: number
  staff_count?: number
  table_count?: number
}

interface RestaurantStats {
  total_restaurants: number
  active_restaurants: number
  total_bookings: number
  total_revenue: number
  average_rating: number
}

export default function RestaurantManagement() {
  const router = useRouter()
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [stats, setStats] = useState<RestaurantStats>({
    total_restaurants: 0,
    active_restaurants: 0,
    total_bookings: 0,
    total_revenue: 0,
    average_rating: 0
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [cuisineFilter, setCuisineFilter] = useState('all')
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    address: '',
    phone_number: '',
    cuisine_type: '',
    opening_time: '09:00',
    closing_time: '22:00',
    price_range: 2,
    booking_policy: 'request',
    featured: false
  })

  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        fetchRestaurants(),
        fetchStats()
      ])
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const fetchRestaurants = async () => {
    const { data: restaurants, error } = await supabase
      .from('restaurants')
      .select(`
        *,
        bookings:bookings(count),
        staff:restaurant_staff(count),
        tables:restaurant_tables(count)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching restaurants:', error)
      throw error
    }

    const processedRestaurants = restaurants?.map(restaurant => ({
      ...restaurant,
      total_bookings: restaurant.bookings?.[0]?.count || 0,
      staff_count: restaurant.staff?.[0]?.count || 0,
      table_count: restaurant.tables?.[0]?.count || 0,
    })) || []

    setRestaurants(processedRestaurants)
  }

  const fetchStats = async () => {
    try {
      // Get restaurant stats
      const { data: restaurantStats, error: statsError } = await supabase
        .from('restaurants')
        .select('id, status, average_rating')

      if (statsError) throw statsError

      // Get booking stats
      const { data: bookingStats, error: bookingError } = await supabase
        .rpc('get_admin_booking_stats')

      // Calculate stats
      const totalRestaurants = restaurantStats?.length || 0
      const activeRestaurants = restaurantStats?.filter(r => r.status === 'active').length || 0
      const avgRating = restaurantStats?.reduce((sum, r) => sum + (r.average_rating || 0), 0) / totalRestaurants || 0

      setStats({
        total_restaurants: totalRestaurants,
        active_restaurants: activeRestaurants,
        total_bookings: bookingStats?.[0]?.total_bookings || 0,
        total_revenue: bookingStats?.[0]?.total_revenue || 0,
        average_rating: avgRating
      })
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const handleStatusChange = async (restaurantId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('restaurants')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', restaurantId)

      if (error) throw error

      await fetchRestaurants()
      toast.success('Restaurant status updated successfully')
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('Failed to update restaurant status')
    }
  }

  const handleFeaturedChange = async (restaurantId: string, featured: boolean) => {
    try {
      const { error } = await supabase
        .from('restaurants')
        .update({ featured, updated_at: new Date().toISOString() })
        .eq('id', restaurantId)

      if (error) throw error

      await fetchRestaurants()
      toast.success(`Restaurant ${featured ? 'featured' : 'unfeatured'} successfully`)
    } catch (error) {
      console.error('Error updating featured status:', error)
      toast.error('Failed to update featured status')
    }
  }

  const handleDeleteRestaurant = async (restaurantId: string) => {
    if (!confirm('Are you sure you want to delete this restaurant? This action cannot be undone.')) {
      return
    }

    try {
      // Fetch image URLs to clean up storage assets before deletion
      const { data: restaurant, error: fetchError } = await supabase
        .from('restaurants')
        .select('main_image_url, image_urls')
        .eq('id', restaurantId)
        .single()

      if (fetchError) {
        console.error('Error fetching restaurant before delete:', fetchError)
      } else if (restaurant) {
        const urls: string[] = []
        if (restaurant.main_image_url) urls.push(restaurant.main_image_url)
        if (Array.isArray(restaurant.image_urls)) urls.push(...restaurant.image_urls.filter(Boolean))

        const extractBucketAndPath = (publicUrl: string): { bucket: string; path: string } | null => {
          try {
            const marker = '/storage/v1/object/public/'
            const idx = publicUrl.indexOf(marker)
            if (idx === -1) return null
            const rest = publicUrl.substring(idx + marker.length)
            const firstSlash = rest.indexOf('/')
            if (firstSlash === -1) return null
            const bucket = rest.substring(0, firstSlash)
            const path = rest.substring(firstSlash + 1)
            return { bucket, path }
          } catch (_) {
            return null
          }
        }

        const removalsByBucket: Record<string, string[]> = {}
        urls.forEach((u) => {
          const parsed = extractBucketAndPath(u)
          if (parsed) {
            removalsByBucket[parsed.bucket] = removalsByBucket[parsed.bucket]
              ? [...removalsByBucket[parsed.bucket], parsed.path]
              : [parsed.path]
          }
        })

        // Execute deletions per bucket
        await Promise.all(Object.entries(removalsByBucket).map(async ([bucket, paths]) => {
          try {
            if (paths.length > 0) {
              await supabase.storage.from(bucket).remove(paths)
            }
          } catch (e) {
            console.warn('Failed to remove some images from bucket', bucket, e)
          }
        }))
      }

      const { error } = await supabase
        .from('restaurants')
        .delete()
        .eq('id', restaurantId)

      if (error) throw error

      await fetchRestaurants()
      toast.success('Restaurant deleted successfully')
    } catch (error) {
      console.error('Error deleting restaurant:', error)
      toast.error('Failed to delete restaurant')
    }
  }

  const handleCreateRestaurant = async () => {
    setSaving(true)
    try {
      if (!formData.name.trim() || !formData.address.trim() || !formData.phone_number.trim()) {
        toast.error('Please fill in all required fields')
        return
      }

      const { error } = await supabase
        .from('restaurants')
        .insert([{
          name: formData.name.trim(),
          description: formData.description.trim(),
          address: formData.address.trim(),
          phone_number: formData.phone_number.trim(),
          cuisine_type: formData.cuisine_type.trim(),
          opening_time: formData.opening_time,
          closing_time: formData.closing_time,
          price_range: formData.price_range,
          booking_policy: formData.booking_policy,
          featured: formData.featured,
          status: 'active',
          average_rating: 0,
          total_reviews: 0
        }])

      if (error) throw error

      await fetchRestaurants()
      setShowAddDialog(false)
      resetFormData()
      toast.success('Restaurant created successfully')
    } catch (error) {
      console.error('Error creating restaurant:', error)
      toast.error('Failed to create restaurant')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateRestaurant = async () => {
    if (!selectedRestaurant) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('restaurants')
        .update({
          name: formData.name.trim(),
          description: formData.description.trim(),
          address: formData.address.trim(),
          phone_number: formData.phone_number.trim(),
          cuisine_type: formData.cuisine_type.trim(),
          opening_time: formData.opening_time,
          closing_time: formData.closing_time,
          price_range: formData.price_range,
          booking_policy: formData.booking_policy,
          featured: formData.featured,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedRestaurant.id)

      if (error) throw error

      await fetchRestaurants()
      setShowEditDialog(false)
      setSelectedRestaurant(null)
      toast.success('Restaurant updated successfully')
    } catch (error) {
      console.error('Error updating restaurant:', error)
      toast.error('Failed to update restaurant')
    } finally {
      setSaving(false)
    }
  }

  const handleExportRestaurants = async () => {
    setExporting(true)
    try {
      const csv = [
        'Name,Description,Address,Phone,Cuisine,Opening Time,Closing Time,Price Range,Status,Average Rating,Total Reviews,Featured',
        ...filteredRestaurants.map(restaurant => [
          `"${restaurant.name}"`,
          `"${restaurant.description}"`,
          `"${restaurant.address}"`,
          restaurant.phone_number,
          restaurant.cuisine_type,
          restaurant.opening_time,
          restaurant.closing_time,
          restaurant.price_range,
          restaurant.status,
          restaurant.average_rating,
          restaurant.total_reviews,
          restaurant.featured
        ].join(','))
      ].join('\n')

      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `restaurants_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      toast.success('Restaurant data exported successfully')
    } catch (error) {
      console.error('Error exporting data:', error)
      toast.error('Failed to export restaurant data')
    } finally {
      setExporting(false)
    }
  }

  const resetFormData = () => {
    setFormData({
      name: '',
      description: '',
      address: '',
      phone_number: '',
      cuisine_type: '',
      opening_time: '09:00',
      closing_time: '22:00',
      price_range: 2,
      booking_policy: 'request',
      featured: false
    })
  }

  const populateFormData = (restaurant: Restaurant) => {
    setFormData({
      name: restaurant.name,
      description: restaurant.description,
      address: restaurant.address,
      phone_number: restaurant.phone_number,
      cuisine_type: restaurant.cuisine_type,
      opening_time: restaurant.opening_time,
      closing_time: restaurant.closing_time,
      price_range: restaurant.price_range,
      booking_policy: restaurant.booking_policy,
      featured: restaurant.featured
    })
  }

  const filteredRestaurants = restaurants.filter(restaurant => {
    const matchesSearch = restaurant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         restaurant.cuisine_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         restaurant.address.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || restaurant.status === statusFilter
    const matchesCuisine = cuisineFilter === 'all' || restaurant.cuisine_type === cuisineFilter

    return matchesSearch && matchesStatus && matchesCuisine
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'inactive': return 'bg-gray-100 text-gray-800'
      case 'suspended': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4" />
      case 'inactive': return <Pause className="w-4 h-4" />
      case 'suspended': return <XCircle className="w-4 h-4" />
      default: return <AlertTriangle className="w-4 h-4" />
    }
  }

  const getPriceRangeText = (priceRange: number) => {
    const ranges = ['', '$', '$$', '$$$', '$$$$']
    return ranges[priceRange] || '$'
  }

  const uniqueCuisines = [...new Set(restaurants.map(r => r.cuisine_type))].sort()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading restaurant data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Restaurant Management</h1>
          <p className="mt-2 text-gray-600">
            Manage all restaurants, settings, and performance across the platform
          </p>
        </div>
        <div className="mt-4 lg:mt-0 flex items-center gap-3">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExportRestaurants} disabled={exporting}>
            <Download className={`w-4 h-4 mr-2 ${exporting ? 'animate-spin' : ''}`} />
            {exporting ? 'Exporting...' : 'Export'}
          </Button>
          <Button onClick={() => {
            resetFormData()
            setShowAddDialog(true)
          }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Restaurant
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Restaurants</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total_restaurants}</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <ChefHat className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-3xl font-bold text-green-600">{stats.active_restaurants}</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Bookings</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total_bookings.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Rating</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.average_rating.toFixed(1)}</p>
              </div>
              <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Star className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">System Health</p>
                <p className="text-2xl font-bold text-green-600">Excellent</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search restaurants by name, cuisine, or location..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  style={{ minHeight: '44px' }}
                />
              </div>
            </div>
            <div className="flex gap-3 w-full lg:w-auto">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full lg:w-[140px]" style={{ minHeight: '44px' }}>
                  <SelectValue placeholder="Status"  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>

              <Select value={cuisineFilter} onValueChange={setCuisineFilter}>
                <SelectTrigger className="w-full lg:w-[140px]" style={{ minHeight: '44px' }}>
                  <SelectValue placeholder="Cuisine" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cuisines</SelectItem>
                  {uniqueCuisines.map(cuisine => (
                    <SelectItem key={cuisine} value={cuisine}>{cuisine}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Restaurant List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredRestaurants.map((restaurant) => (
          <Card key={restaurant.id} className="hover:shadow-lg transition-all">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{restaurant.name}</CardTitle>
                  <CardDescription className="mt-1">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {restaurant.cuisine_type}
                    </span>
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor(restaurant.status)}>
                    {getStatusIcon(restaurant.status)}
                    <span className="ml-1">{titleCase(restaurant.status)}</span>
                  </Badge>
                  {restaurant.featured && (
                    <Badge variant="secondary">Featured</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-4">
                {/* Key Info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-500" />
                    <span>{restaurant.average_rating?.toFixed(1) || 'N/A'} ({restaurant.total_reviews || 0})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-500" />
                    <span>{getPriceRangeText(restaurant.price_range)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span>{restaurant.opening_time} - {restaurant.closing_time}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-purple-500" />
                    <span>{restaurant.total_bookings || 0} bookings</span>
                  </div>
                </div>

                {/* Address */}
                <div className="text-sm text-gray-600 truncate">
                  <MapPin className="w-3 h-3 inline mr-1" />
                  {restaurant.address}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setSelectedRestaurant(restaurant)
                        setShowDetailsDialog(true)
                      }}
                      style={{ minHeight: '36px' }}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => router.push(`/admin/restaurants/${restaurant.id}`)}
                      style={{ minHeight: '36px' }}
                    >
                      <Edit2 className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFeaturedChange(restaurant.id, !restaurant.featured)}
                      className="text-yellow-600 hover:text-yellow-700"
                    >
                      <Star className={`w-4 h-4 ${restaurant.featured ? 'fill-current' : ''}`} />
                    </Button>
                    
                    <Select 
                      value={restaurant.status} 
                      onValueChange={(value) => handleStatusChange(restaurant.id, value)}
                    >
                      <SelectTrigger className="w-10 h-9 p-0 hover:bg-gray-100">
                        <Settings className="w-4 h-4" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Activate</SelectItem>
                        <SelectItem value="inactive">Deactivate</SelectItem>
                        <SelectItem value="suspended">Suspend</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteRestaurant(restaurant.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredRestaurants.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <ChefHat className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No restaurants found</h3>
            <p className="text-gray-500">
              {searchTerm || statusFilter !== 'all' || cuisineFilter !== 'all'
                ? 'Try adjusting your search criteria'
                : 'Get started by adding your first restaurant'
              }
            </p>
          </CardContent>
        </Card>
      )}

      {/* Restaurant Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {selectedRestaurant?.name}
            </DialogTitle>
          </DialogHeader>
          
          {selectedRestaurant && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Description</Label>
                    <p className="text-gray-900 mt-1">{selectedRestaurant.description}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Address</Label>
                    <p className="text-gray-900 mt-1">{selectedRestaurant.address}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Phone</Label>
                    <p className="text-gray-900 mt-1">{selectedRestaurant.phone_number}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Cuisine Type</Label>
                    <p className="text-gray-900 mt-1">{selectedRestaurant.cuisine_type}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Operating Hours</Label>
                    <p className="text-gray-900 mt-1">
                      {selectedRestaurant.opening_time} - {selectedRestaurant.closing_time}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Price Range</Label>
                    <p className="text-gray-900 mt-1">
                      {getPriceRangeText(selectedRestaurant.price_range)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Performance Metrics</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-gray-900">{selectedRestaurant.total_bookings || 0}</p>
                    <p className="text-sm text-gray-600">Total Bookings</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-gray-900">{selectedRestaurant.staff_count || 0}</p>
                    <p className="text-sm text-gray-600">Staff Members</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-gray-900">{selectedRestaurant.table_count || 0}</p>
                    <p className="text-sm text-gray-600">Tables</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-gray-900">{selectedRestaurant.average_rating?.toFixed(1) || 'N/A'}</p>
                    <p className="text-sm text-gray-600">Avg Rating</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Restaurant Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Restaurant</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Restaurant Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Enter restaurant name"
                />
              </div>
              <div>
                <Label htmlFor="cuisine_type">Cuisine Type *</Label>
                <Input
                  id="cuisine_type"
                  value={formData.cuisine_type}
                  onChange={(e) => setFormData({...formData, cuisine_type: e.target.value})}
                  placeholder="e.g., Italian, Asian, American"
                />
              </div>
              <div>
                <Label htmlFor="phone_number">Phone Number *</Label>
                <Input
                  id="phone_number"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                  placeholder="Restaurant phone number"
                />
              </div>
              <div>
                <Label htmlFor="price_range">Price Range</Label>
                <Select value={formData.price_range.toString()} onValueChange={(value) => setFormData({...formData, price_range: parseInt(value)})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">$ - Budget Friendly</SelectItem>
                    <SelectItem value="2">$$ - Moderate</SelectItem>
                    <SelectItem value="3">$$$ - Upscale</SelectItem>
                    <SelectItem value="4">$$$$ - Fine Dining</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="opening_time">Opening Time</Label>
                <Input
                  id="opening_time"
                  type="time"
                  value={formData.opening_time}
                  onChange={(e) => setFormData({...formData, opening_time: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="closing_time">Closing Time</Label>
                <Input
                  id="closing_time"
                  type="time"
                  value={formData.closing_time}
                  onChange={(e) => setFormData({...formData, closing_time: e.target.value})}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="address">Address *</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                placeholder="Full restaurant address"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Brief description of the restaurant"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="booking_policy">Booking Policy</Label>
                <Select value={formData.booking_policy} onValueChange={(value) => setFormData({...formData, booking_policy: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instant">Instant Confirmation</SelectItem>
                    <SelectItem value="request">Request Based</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2 pt-6">
                <Switch
                  id="featured"
                  checked={formData.featured}
                  onCheckedChange={(checked) => setFormData({...formData, featured: checked})}
                />
                <Label htmlFor="featured">Featured Restaurant</Label>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateRestaurant} disabled={saving}>
                {saving ? 'Creating...' : 'Create Restaurant'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Restaurant moved to dedicated page at /admin/restaurants/[id] */}
    </div>
  )
}
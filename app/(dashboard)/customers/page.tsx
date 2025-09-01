// app/(dashboard)/customers/page.tsx

'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { 
  Search, 
  Plus, 
  Filter, 
  Download, 
  Users, 
  Star,
  AlertCircle,
  UserPlus,
  MoreVertical,
  Phone,
  Mail,
  Calendar,
  TrendingUp,
  X,
  Edit
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { CustomerDetailsDialog } from '@/components/customers/customer-details-dialog'
import { TagManagementDialog } from '@/components/customers/tag-management-dialog'
import { AddCustomerDialog } from '@/components/customers/add-customer-dialog'
import CustomerMergeSelectionDialog from '@/components/customers/customer-merge-selection-dialog'
import { CustomerBulkActions } from '@/components/customers/customer-bulk-actions'
import { CustomerInsights } from '@/components/customers/customer-insights'
import { EditCustomerDialog } from '@/components/customers/edit-customer-dialog'
import { MigrationButton } from '@/components/migration/migration-button'
import { restaurantAuth } from '@/lib/restaurant-auth'
import type { RestaurantCustomer, CustomerTag, CustomerFilters } from '@/types/customer'

export default function CustomersPage() {
  const router = useRouter()
  const supabase = createClient()
  
  // State
  const [customers, setCustomers] = useState<RestaurantCustomer[]>([])
  const [tags, setTags] = useState<CustomerTag[]>([])
  const [loading, setLoading] = useState(true)
  const [restaurantId, setRestaurantId] = useState<string>('')
  const [currentStaff, setCurrentStaff] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('customers')
  
  // Bulk selection
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set())
  const [isSelectMode, setIsSelectMode] = useState(false)
  
  // Filters
  const [filters, setFilters] = useState<CustomerFilters>({
    search: '',
    sort_by: 'last_visit',
    sort_order: 'desc'
  })
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  
  // Dialogs
  const [selectedCustomer, setSelectedCustomer] = useState<RestaurantCustomer | null>(null)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [showTagDialog, setShowTagDialog] = useState(false)
  const [showAddCustomerDialog, setShowAddCustomerDialog] = useState(false)
  const [showMergeDialog, setShowMergeDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [customerToMerge, setCustomerToMerge] = useState<RestaurantCustomer | null>(null)
  const [customerToEdit, setCustomerToEdit] = useState<RestaurantCustomer | null>(null)

  const loadCustomers = useCallback(async (restaurantId: string) => {
    try {
      // First, get all customers
      const { data: customersData, error: customersError } = await supabase
        .from('restaurant_customers')
        .select(`
          *,
          profile:profiles!restaurant_customers_user_id_fkey(
            id,
            full_name,
            email,
            phone_number,
            avatar_url,
            allergies,
            dietary_restrictions,
            favorite_cuisines,
            preferred_party_size,
            notification_preferences,
            loyalty_points,
            membership_tier,
            privacy_settings,
            user_rating,
            total_bookings,
            completed_bookings,
            cancelled_bookings,
            no_show_bookings,
            rating_last_updated,
            created_at,
            updated_at
          )
        `)
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })

      if (customersError) throw customersError

      // Get all profiles for customers who don't have profile data
      const customerUserIds = customersData?.map(c => c.user_id).filter(id => id !== null) || []
      const { data: profilesData, error: profilesError } = customerUserIds.length > 0 
        ? await supabase
            .from('profiles')
            .select('*')
            .in('id', customerUserIds)
        : { data: [], error: null }

      if (profilesError) throw profilesError

      // Transform data to merge customer and profile information
      const transformedData = customersData?.map(customer => {
        // If profile is already included from the join, use it
        if (customer.profile) {
          return {
            ...customer,
            profile: customer.profile
          }
        }
        
        // Otherwise, find the profile in the separate query
        const profile = profilesData?.find(p => p.id === customer.user_id)
        return {
          ...customer,
          profile: profile || null
        }
      }) || []

      setCustomers(transformedData)
    } catch (error) {
      console.error('Error loading customers:', error)
      toast.error('Failed to load customers')
    }
  }, [supabase])

  const loadTags = useCallback(async (restaurantId: string) => {
    try {
      const { data, error } = await supabase
        .from('customer_tags')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('name')

      if (error) throw error
      setTags(data || [])
    } catch (error) {
      console.error('Error loading tags:', error)
      toast.error('Failed to load tags')
    }
  }, [supabase])

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Get current staff data
      const { data: staffData, error: staffError } = await supabase
        .from('restaurant_staff')
        .select(`
          id,
          role,
          permissions,
          restaurant_id,
          user_id
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single()

      if (staffError || !staffData) {
        toast.error("You don't have access to view customers")
        router.push('/dashboard')
        return
      }

      setCurrentStaff(staffData)
      setRestaurantId(staffData.restaurant_id)

      // Check permissions
      if (!restaurantAuth.hasPermission(staffData.permissions, 'customers.view', staffData.role)) {
        toast.error("You don't have permission to view customers")
        router.push('/dashboard')
        return
      }

      // Load customers and tags
      await Promise.all([
        loadCustomers(staffData.restaurant_id),
        loadTags(staffData.restaurant_id)
      ])

    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load customers')
    } finally {
      setLoading(false)
    }
  }, [router, loadCustomers, loadTags, supabase])

  // Load initial data
  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  // Filter customers
  const filteredCustomers = useMemo(() => {
    let filtered = [...customers]

    // Search filter
    if (filters.search) {
      const search = filters.search.toLowerCase()
      filtered = filtered.filter(customer => {
        const name = (customer.profile?.full_name || customer.guest_name || '').toLowerCase()
        const email = (customer.profile?.email || customer.guest_email || '').toLowerCase()
        const phone = (customer.profile?.phone_number || customer.guest_phone || '').toLowerCase()
        return name.includes(search) || email.includes(search) || phone.includes(search)
      })
    }

    // Tag filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter(customer => 
        selectedTags.some(tagId => 
          customer.tags?.some(tag => tag.id === tagId)
        )
      )
    }

    // VIP filter
    if (filters.vip_only) {
      filtered = filtered.filter(customer => customer.vip_status)
    }

    // Blacklist filter
    if (filters.blacklisted) {
      filtered = filtered.filter(customer => customer.blacklisted)
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0
      switch (filters.sort_by) {
        case 'name':
          const nameA = (a.profile?.full_name || a.guest_name || '').toLowerCase()
          const nameB = (b.profile?.full_name || b.guest_name || '').toLowerCase()
          comparison = nameA.localeCompare(nameB)
          break
        case 'last_visit':
          comparison = (b.last_visit || '').localeCompare(a.last_visit || '')
          break
        case 'total_bookings':
          comparison = b.total_bookings - a.total_bookings
          break
        case 'total_spent':
          comparison = b.total_spent - a.total_spent
          break
      }
      return filters.sort_order === 'desc' ? -comparison : comparison
    })

    return filtered
  }, [customers, filters, selectedTags])

  // Stats
  const stats = useMemo(() => {
    const total = customers.length
    const vip = customers.filter(c => c.vip_status).length
    const blacklisted = customers.filter(c => c.blacklisted).length
    const withTags = customers.filter(c => c.tags && c.tags.length > 0).length

    return { total, vip, blacklisted, withTags }
  }, [customers])

  // Handlers
  const handleCustomerClick = (customer: RestaurantCustomer) => {
    if (isSelectMode) {
      toggleCustomerSelection(customer.id)
    } else {
      setSelectedCustomer(customer)
      setShowDetailsDialog(true)
    }
  }

  const toggleCustomerSelection = (customerId: string) => {
    const newSelection = new Set(selectedCustomerIds)
    if (newSelection.has(customerId)) {
      newSelection.delete(customerId)
    } else {
      newSelection.add(customerId)
    }
    setSelectedCustomerIds(newSelection)
  }

  const toggleSelectAll = () => {
    if (selectedCustomerIds.size === filteredCustomers.length) {
      setSelectedCustomerIds(new Set())
    } else {
      setSelectedCustomerIds(new Set(filteredCustomers.map(c => c.id)))
    }
  }

  const clearSelection = () => {
    setSelectedCustomerIds(new Set())
    setIsSelectMode(false)
  }

  const selectedCustomers = useMemo(() => 
    customers.filter(c => selectedCustomerIds.has(c.id)),
    [customers, selectedCustomerIds]
  )

  const handleToggleVIP = async (customer: RestaurantCustomer) => {
    try {
      if (customer.vip_status) {
        // Remove VIP status - set valid_until to current date for any active VIP records
        const { error } = await supabase
          .from('restaurant_vip_users')
          .update({ 
            valid_until: new Date().toISOString()
          })
          .eq('restaurant_id', restaurantId)
          .eq('user_id', customer.user_id)
          .gte('valid_until', new Date().toISOString())

        if (error) throw error

        // Also update the restaurant_customers table
        await supabase
          .from('restaurant_customers')
          .update({ 
            vip_status: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', customer.id)

      } else {
        // Add VIP status
        if (!customer.user_id) {
          toast.error('Cannot make guest customers VIP. Customer must have an account.')
          return
        }

        const { error } = await supabase
          .from('restaurant_vip_users')
          .insert({
            restaurant_id: restaurantId,
            user_id: customer.user_id,
            extended_booking_days: 60,
            priority_booking: true,
            valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year from now
          })

        if (error) throw error

        // Also update the restaurant_customers table
        await supabase
          .from('restaurant_customers')
          .update({ 
            vip_status: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', customer.id)
      }

      toast.success(`Customer ${customer.vip_status ? 'removed from' : 'added to'} VIP list`)
      await loadCustomers(restaurantId)
    } catch (error) {
      console.error('Error updating VIP status:', error)
      toast.error('Failed to update VIP status')
    }
  }

  const handleToggleBlacklist = async (customer: RestaurantCustomer, reason?: string) => {
    try {
      const { error } = await supabase
        .from('restaurant_customers')
        .update({ 
          blacklisted: !customer.blacklisted,
          blacklist_reason: !customer.blacklisted ? reason : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', customer.id)

      if (error) throw error

      toast.success(`Customer ${customer.blacklisted ? 'removed from' : 'added to'} blacklist`)
      await loadCustomers(restaurantId)
    } catch (error) {
      console.error('Error updating blacklist status:', error)
      toast.error('Failed to update blacklist status')
    }
  }

  const handleExportCustomers = () => {
    // Convert customers to CSV
    const headers = [
      'Name', 'Email', 'Email Verified', 'Phone', 'Total Bookings', 'Completed Bookings', 
      'Cancelled Bookings', 'No Shows', 'Last Visit', 'First Visit', 'VIP', 'Membership Tier',
      'Loyalty Points', 'Dietary Restrictions', 'Allergies', 'Favorite Cuisines', 'Tags'
    ]
    const rows = filteredCustomers.map(customer => [
      customer.profile?.full_name || customer.guest_name || '',
      customer.profile?.email || customer.guest_email || '',
      customer.profile?.email ? 'Yes' : 'No',
      customer.profile?.phone_number || customer.guest_phone || '',
      customer.total_bookings,
      customer.profile?.completed_bookings || 0,
      customer.profile?.cancelled_bookings || 0,
      customer.profile?.no_show_bookings || 0,
      customer.last_visit ? format(new Date(customer.last_visit), 'yyyy-MM-dd') : '',
      customer.first_visit ? format(new Date(customer.first_visit), 'yyyy-MM-dd') : '',
      customer.vip_status ? 'Yes' : 'No',
      customer.profile?.membership_tier || 'Bronze',
      customer.profile?.loyalty_points || 0,
      customer.profile?.dietary_restrictions?.join('; ') || '',
      customer.profile?.allergies?.join('; ') || '',
      customer.profile?.favorite_cuisines?.join('; ') || '',
      customer.tags?.map(t => t.name).join(', ') || ''
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `customers-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading customers...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">
            Manage your restaurant's customer relationships
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowTagDialog(true)}>
            <Filter className="mr-2 h-4 w-4" />
            Manage Tags
          </Button>
          <Button variant="outline" onClick={handleExportCustomers}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          {restaurantAuth.hasPermission(currentStaff?.permissions || [], 'customers.manage', currentStaff?.role) && (
            <>
              <MigrationButton restaurantId={restaurantId} variant="outline" />
              <Button onClick={() => setShowAddCustomerDialog(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Add Customer
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              All time customers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">VIP Customers</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.vip}</div>
            <p className="text-xs text-muted-foreground">
              {((stats.vip / stats.total) * 100).toFixed(1)}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tagged Customers</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.withTags}</div>
            <p className="text-xs text-muted-foreground">
              Have at least one tag
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blacklisted</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.blacklisted}</div>
            <p className="text-xs text-muted-foreground">
              Restricted customers
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="customers" className="space-y-4">
          {/* Bulk Actions */}
          {isSelectMode && (
            <CustomerBulkActions
              selectedCustomers={selectedCustomers}
              tags={tags}
              onUpdate={() => loadCustomers(restaurantId)}
              onClearSelection={clearSelection}
              currentUserId={currentStaff?.user_id || ''}
            />
          )}

          {/* Filters */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Filters</CardTitle>
                {!isSelectMode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsSelectMode(true)}
                  >
                    Select Multiple
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search by name, email, or phone..."
                      value={filters.search}
                      onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <Select
                  value={filters.sort_by}
                  onValueChange={(value: any) => setFilters({ ...filters, sort_by: value })}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="last_visit">Last Visit</SelectItem>
                    <SelectItem value="total_bookings">Total Bookings</SelectItem>
                    <SelectItem value="total_spent">Total Spent</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex gap-2">
                  {tags.map(tag => (
                    <Badge
                      key={tag.id}
                      variant={selectedTags.includes(tag.id) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => {
                        setSelectedTags(prev =>
                          prev.includes(tag.id)
                            ? prev.filter(id => id !== tag.id)
                            : [...prev, tag.id]
                        )
                      }}
                      style={{
                        backgroundColor: selectedTags.includes(tag.id) ? tag.color : undefined,
                        borderColor: tag.color
                      }}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customers List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Customer List</CardTitle>
                  <CardDescription>
                    {filteredCustomers.length} customers found
                  </CardDescription>
                </div>
                {isSelectMode && filteredCustomers.length > 0 && (
                  <Checkbox
                    checked={selectedCustomerIds.size === filteredCustomers.length}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all customers"
                  />
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {filteredCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    className={`flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer transition-colors ${
                      selectedCustomerIds.has(customer.id) ? 'bg-muted border-l-4 border-primary' : ''
                    }`}
                    onClick={() => handleCustomerClick(customer)}
                  >
                    <div className="flex items-center gap-4">
                      {isSelectMode && (
                        <Checkbox
                          checked={selectedCustomerIds.has(customer.id)}
                          onClick={(e) => e.stopPropagation()}
                          onCheckedChange={() => toggleCustomerSelection(customer.id)}
                        />
                      )}
                      
                      <Avatar>
                        <AvatarImage src={customer.profile?.avatar_url} />
                        <AvatarFallback>
                          {(customer.profile?.full_name || customer.guest_name || 'G')
                            .split(' ')
                            .map(n => n[0])
                            .join('')
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {customer.profile?.full_name || customer.guest_name || 'Guest'}
                          </p>
                          {customer.vip_status && (
                            <Badge variant="secondary" className="text-xs">
                              <Star className="h-3 w-3 mr-1" />
                              VIP
                            </Badge>
                          )}
                          {customer.blacklisted && (
                            <Badge variant="destructive" className="text-xs">
                              <X className="h-3 w-3 mr-1" />
                              Blacklisted
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          {(customer.profile?.email || customer.guest_email) && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              <span className="truncate max-w-[200px]">{customer.profile?.email || customer.guest_email}</span>
                            </span>
                          )}
                          {(customer.profile?.phone_number || customer.guest_phone) && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {customer.profile?.phone_number || customer.guest_phone}
                            </span>
                          )}
                        </div>
                        
                        {/* Additional customer info */}
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                          {customer.profile?.membership_tier && (
                            <Badge variant="outline" className="text-xs">
                              {customer.profile.membership_tier.charAt(0).toUpperCase() + customer.profile.membership_tier.slice(1)} Member
                            </Badge>
                          )}
                          {(customer.profile?.loyalty_points || 0) > 0 && (
                            <span>{customer.profile?.loyalty_points} pts</span>
                          )}
                          {(customer.profile?.dietary_restrictions?.length || 0) > 0 && (
                            <Badge variant="outline" className="text-xs text-orange-600">
                              Dietary: {customer.profile?.dietary_restrictions?.length} items
                            </Badge>
                          )}
                          {(customer.profile?.allergies?.length || 0) > 0 && (
                            <Badge variant="outline" className="text-xs text-red-600">
                              Allergies: {customer.profile?.allergies?.length} items
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 mt-1">
                          {customer.tags?.map(tag => (
                            <Badge
                              key={tag.id}
                              variant="outline"
                              className="text-xs"
                              style={{ borderColor: tag.color, color: tag.color }}
                            >
                              {tag.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right space-y-1">
                        <p className="text-sm font-medium">{customer.total_bookings} total bookings</p>
                        
                        {/* Booking breakdown */}
                        <div className="flex items-center gap-2 text-xs">
                          {(customer.profile?.completed_bookings || 0) > 0 && (
                            <span className="text-green-600">{customer.profile?.completed_bookings} completed</span>
                          )}
                          {(customer.profile?.cancelled_bookings || 0) > 0 && (
                            <span className="text-orange-600">{customer.profile?.cancelled_bookings} cancelled</span>
                          )}
                          {(customer.profile?.no_show_bookings || 0) > 0 && (
                            <span className="text-red-600">{customer.profile?.no_show_bookings} no-shows</span>
                          )}
                        </div>
                        
                        {/* Customer rating */}
                        {customer.profile?.user_rating && customer.profile.user_rating !== 5.0 && (
                          <div className="flex items-center gap-1 text-xs">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            <span>Rating: {customer.profile.user_rating.toFixed(1)}</span>
                          </div>
                        )}
                        
                        {/* Last visit */}
                        {customer.last_visit && (
                          <p className="text-xs text-gray-600">
                            <Calendar className="inline h-3 w-3 mr-1" />
                            Last: {format(new Date(customer.last_visit), 'MMM d, yyyy')}
                          </p>
                        )}
                        
                        {/* Total spent estimate */}
                        {customer.total_spent > 0 && (
                          <p className="text-xs text-gray-600">
                            Est. spent: ${customer.total_spent.toFixed(0)}
                          </p>
                        )}
                      </div>
                      
                      {!isSelectMode && (
                        <div className="flex items-center gap-1">
                          {restaurantAuth.hasPermission(currentStaff?.permissions || [], 'customers.manage', currentStaff?.role) && (
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation()
                                setCustomerToEdit(customer)
                                setShowEditDialog(true)
                              }}
                              className="h-8 w-8"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {restaurantAuth.hasPermission(currentStaff?.permissions || [], 'customers.manage', currentStaff?.role) && (
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation()
                                setCustomerToEdit(customer)
                                setShowEditDialog(true)
                              }}>
                                Edit Customer
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation()
                              handleToggleVIP(customer)
                            }}>
                              {customer.vip_status ? 'Remove VIP Status' : 'Mark as VIP'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation()
                              const reason = customer.blacklisted ? null : prompt('Reason for blacklisting:')
                              if (reason !== null || customer.blacklisted) {
                                handleToggleBlacklist(customer, reason || undefined)
                              }
                            }}>
                              {customer.blacklisted ? 'Remove from Blacklist' : 'Add to Blacklist'}
                            </DropdownMenuItem>
                            {/* Show merge option only for guest customers or when restaurant can manage customers */}
                            {(!customer.user_id || filteredCustomers.some(c => !c.user_id)) && 
                             restaurantAuth.hasPermission(currentStaff?.permissions || [], 'customers.manage', currentStaff?.role) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation()
                                  setCustomerToMerge(customer)
                                  setShowMergeDialog(true)
                                }}>
                                  Merge Customer
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {filteredCustomers.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    No customers found matching your filters
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights">
          <CustomerInsights restaurantId={restaurantId} />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {selectedCustomer && (
        <CustomerDetailsDialog
          customer={selectedCustomer}
          open={showDetailsDialog}
          onOpenChange={setShowDetailsDialog}
          onUpdate={() => loadCustomers(restaurantId)}
          restaurantId={restaurantId}
          currentUserId={currentStaff?.user_id || ''}
          canManage={restaurantAuth.hasPermission(currentStaff?.permissions || [], 'customers.manage', currentStaff?.role)}
        />
      )}

      <TagManagementDialog
        open={showTagDialog}
        onOpenChange={setShowTagDialog}
        restaurantId={restaurantId}
        tags={tags}
        onUpdate={() => loadTags(restaurantId)}
      />

      <AddCustomerDialog
        open={showAddCustomerDialog}
        onOpenChange={setShowAddCustomerDialog}
        restaurantId={restaurantId}
        onSuccess={() => loadCustomers(restaurantId)}
      />

      <CustomerMergeSelectionDialog
        open={showMergeDialog}
        onOpenChange={setShowMergeDialog}
        primaryCustomer={customerToMerge}
        restaurantId={restaurantId}
        onSuccess={() => loadCustomers(restaurantId)}
      />

      {customerToEdit && (
        <EditCustomerDialog
          customer={customerToEdit}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          onSuccess={() => loadCustomers(restaurantId)}
          restaurantId={restaurantId}
        />
      )}
    </div>
  )
}
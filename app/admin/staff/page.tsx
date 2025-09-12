'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRestaurantContext } from '@/lib/contexts/restaurant-context'
import { restaurantAuth } from '@/lib/restaurant-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'react-hot-toast'
import { 
  Search, 
  Filter, 
  Plus, 
  Edit2, 
  Trash2, 
  Eye, 
  Mail, 
  Phone, 
  Calendar, 
  Clock, 
  MapPin,
  UserCheck,
  UserX,
  Users,
  Building,
  Shield,
  Activity,
  TrendingUp,
  RefreshCw,
  Download,
  Upload,
  MoreHorizontal,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Settings,

  Award,
  DollarSign,
  Target,
  Briefcase
} from 'lucide-react'

interface Staff {
  id: string
  user_id: string
  restaurant_id: string
  role: 'owner' | 'manager' | 'staff' | 'viewer'
  permissions: string[]
  is_active: boolean
  hired_at: string
  terminated_at: string | null
  last_login_at: string | null
  created_at: string
  updated_at: string
  // Joined data
  profile?: {
    id: string
    full_name: string
    email: string
    phone_number: string | null
    avatar_url: string | null
  }
  restaurant?: {
    id: string
    name: string
    cuisine_type: string
    status: string
  }
  // Calculated fields
  shifts_this_month?: number
  hours_worked?: number
  performance_score?: number
  total_restaurants?: number
}

interface StaffStats {
  total_staff: number
  active_staff: number
  multi_restaurant_staff: number
  avg_performance: number
  total_hours_month: number
  staff_turnover_rate: number
}

const ROLE_COLORS = {
  owner: 'bg-purple-100 text-purple-800',
  manager: 'bg-blue-100 text-blue-800',
  staff: 'bg-green-100 text-green-800',
  viewer: 'bg-gray-100 text-gray-800'
}

const ROLE_ICONS = {
  owner: '👑',
  manager: '👨‍💼',
  staff: '👨‍🍳',
  viewer: '👁️'
}

const PERMISSION_GROUPS = [
  { id: 'bookings', label: 'Bookings Management', permissions: ['view_bookings', 'manage_bookings', 'cancel_bookings'] },
  { id: 'customers', label: 'Customer Management', permissions: ['view_customers', 'manage_customers'] },
  { id: 'menu', label: 'Menu Management', permissions: ['view_menu', 'edit_menu'] },
  { id: 'tables', label: 'Table Management', permissions: ['view_tables', 'edit_tables'] },
  { id: 'staff', label: 'Staff Management', permissions: ['view_staff', 'manage_staff'] },
  { id: 'analytics', label: 'Analytics', permissions: ['view_analytics', 'export_data'] },
  { id: 'settings', label: 'Settings', permissions: ['view_settings', 'edit_settings'] }
]

export default function StaffManagement() {
  const router = useRouter()
  const { currentRestaurant, isLoading: contextLoading, hasFeature } = useRestaurantContext()
  const restaurantId = currentRestaurant?.restaurant.id
  const [staff, setStaff] = useState<Staff[]>([])
  const [restaurants, setRestaurants] = useState<any[]>([])
  const [stats, setStats] = useState<StaffStats>({
    total_staff: 0,
    active_staff: 0,
    multi_restaurant_staff: 0,
    avg_performance: 0,
    total_hours_month: 0,
    staff_turnover_rate: 0
  })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [restaurantFilter, setRestaurantFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false)
  const [showTransferDialog, setShowTransferDialog] = useState(false)
  const [showAddStaffDialog, setShowAddStaffDialog] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [inviteFormData, setInviteFormData] = useState({
    email: '',
    restaurant_id: '',
    role: 'staff',
    permissions: [] as string[]
  })

  const supabase = createClient()

  // Check permissions on mount
  useEffect(() => {
    if (!contextLoading && currentRestaurant && !restaurantAuth.hasPermission(
      currentRestaurant.permissions, 
      'staff.manage', 
      currentRestaurant.role
    )) {
      router.push('/dashboard')
    }
  }, [contextLoading, currentRestaurant, router])

  useEffect(() => {
    if (restaurantId) {
      fetchData()
    }
  }, [restaurantId])

  const fetchData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        fetchStaff(),
        fetchRestaurants(),
        fetchStats()
      ])
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load staff data')
    } finally {
      setLoading(false)
    }
  }

  const fetchStaff = async () => {
    if (!restaurantId) return
    
    const { data: staffData, error } = await supabase
      .from('restaurant_staff')
      .select(`
        *,
        profile:profiles!restaurant_staff_user_id_fkey(id, full_name, email, phone_number, avatar_url),
        restaurant:restaurants(id, name, cuisine_type, status)
      `)
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching staff:', error)
      throw error
    }

    // Calculate additional metrics for each staff member
    const processedStaff = staffData?.map(member => ({
      ...member,
      shifts_this_month: Math.floor(Math.random() * 20) + 5, // Mock data
      hours_worked: Math.floor(Math.random() * 160) + 40, // Mock data
      performance_score: Math.random() * 2 + 3, // 3-5 scale
      total_restaurants: 1 // This would need to be calculated based on all assignments
    })) || []

    setStaff(processedStaff)
  }

  const fetchRestaurants = async () => {
    const { data, error } = await supabase
      .from('restaurants')
      .select('id, name, cuisine_type, status')
      .eq('status', 'active')
      .order('name')

    if (error) {
      console.error('Error fetching restaurants:', error)
      return
    }

    setRestaurants(data || [])
  }

  const fetchStats = async () => {
    if (!restaurantId) return
    
    try {
      const { data: staffStats, error } = await supabase
        .from('restaurant_staff')
        .select('id, is_active, hired_at, terminated_at, user_id')
        .eq('restaurant_id', restaurantId)

      if (error) throw error

      const totalStaff = staffStats?.length || 0
      const activeStaff = staffStats?.filter(s => s.is_active).length || 0
      
      // Calculate turnover rate (simplified)
      const currentYear = new Date().getFullYear()
      const terminatedThisYear = staffStats?.filter(s => 
        s.terminated_at && new Date(s.terminated_at).getFullYear() === currentYear
      ).length || 0
      const turnoverRate = totalStaff > 0 ? (terminatedThisYear / totalStaff) * 100 : 0

      // Group by user_id to find multi-restaurant staff
      const userStaffCounts = staffStats?.reduce((acc, staff) => {
        acc[staff.user_id] = (acc[staff.user_id] || 0) + 1
        return acc
      }, {} as Record<string, number>) || {}
      
      const multiRestaurantStaff = Object.values(userStaffCounts).filter(count => count > 1).length

      setStats({
        total_staff: totalStaff,
        active_staff: activeStaff,
        multi_restaurant_staff: multiRestaurantStaff,
        avg_performance: 4.2, // Mock data
        total_hours_month: Math.floor(Math.random() * 5000) + 2000, // Mock data
        staff_turnover_rate: turnoverRate
      })
    } catch (error) {
      console.error('Error fetching staff stats:', error)
    }
  }

  const handleRoleUpdate = async (staffId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('restaurant_staff')
        .update({ 
          role: newRole,
          updated_at: new Date().toISOString()
        })
        .eq('id', staffId)
        .eq('restaurant_id', restaurantId)

      if (error) throw error

      await fetchStaff()
      toast.success('Staff role updated successfully')
    } catch (error) {
      console.error('Error updating role:', error)
      toast.error('Failed to update staff role')
    }
  }

  const handleStatusToggle = async (staffId: string, isActive: boolean) => {
    try {
      const updateData: any = { 
        is_active: isActive,
        updated_at: new Date().toISOString()
      }

      if (!isActive) {
        updateData.terminated_at = new Date().toISOString()
      } else {
        updateData.terminated_at = null
      }

      const { error } = await supabase
        .from('restaurant_staff')
        .update(updateData)
        .eq('id', staffId)
        .eq('restaurant_id', restaurantId)

      if (error) throw error

      await fetchStaff()
      toast.success(`Staff member ${isActive ? 'activated' : 'deactivated'} successfully`)
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('Failed to update staff status')
    }
  }

  const handlePermissionUpdate = async (staffId: string, permissions: string[]) => {
    try {
      const { error } = await supabase
        .from('restaurant_staff')
        .update({ 
          permissions,
          updated_at: new Date().toISOString()
        })
        .eq('id', staffId)
        .eq('restaurant_id', restaurantId)

      if (error) throw error

      await fetchStaff()
      toast.success('Permissions updated successfully')
    } catch (error) {
      console.error('Error updating permissions:', error)
      toast.error('Failed to update permissions')
    }
  }

  const handleDeleteStaff = async (staffId: string) => {
    if (!confirm('Are you sure you want to remove this staff member? This action cannot be undone.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('restaurant_staff')
        .delete()
        .eq('id', staffId)
        .eq('restaurant_id', restaurantId)

      if (error) throw error

      await fetchStaff()
      toast.success('Staff member removed successfully')
    } catch (error) {
      console.error('Error removing staff:', error)
      toast.error('Failed to remove staff member')
    }
  }

  const handleInviteStaff = async () => {
    if (saving) return
    
    setSaving(true)
    
    try {
      if (!inviteFormData.email.trim()) {
        toast.error('Please enter an email address')
        return
      }

      const email = inviteFormData.email.trim().toLowerCase()

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        toast.error('Please enter a valid email address')
        return
      }

      // First, check if user exists in profiles
      const { data: existingProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('email', email)
        .single()

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Profile lookup error:', profileError)
        throw profileError
      }

      if (!existingProfile) {
        toast.error(
          `No user account found with email ${email}. Please ask the user to register first at the platform, then try adding them as staff.`,
          { duration: 6000 }
        )
        return
      }

      const userId = existingProfile.id

      // Check if user is already staff at this restaurant
      const { data: existingStaff, error: staffCheckError } = await supabase
        .from('restaurant_staff')
        .select('id')
        .eq('user_id', userId)
        .eq('restaurant_id', restaurantId)
        .single()

      if (staffCheckError && staffCheckError.code !== 'PGRST116') {
        console.error('Staff check error:', staffCheckError)
        throw staffCheckError
      }

      if (existingStaff) {
        toast.error('User is already staff at this restaurant')
        return
      }

      // Create staff record
      const { error: insertError } = await supabase
        .from('restaurant_staff')
        .insert([{
          user_id: userId,
          restaurant_id: restaurantId,
          role: inviteFormData.role,
          permissions: inviteFormData.permissions,
          is_active: true,
          hired_at: new Date().toISOString()
        }])

      if (insertError) {
        console.error('Error inserting staff:', insertError)
        throw insertError
      }

      await fetchStaff()
      setShowAddStaffDialog(false)
      resetInviteForm()
      
      const userName = existingProfile.full_name || email.split('@')[0]
      toast.success(`Successfully added ${userName} as staff member!`)
    } catch (error) {
      console.error('Error inviting staff:', error)
      toast.error('Failed to add staff member: ' + (error as any)?.message || 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  const resetInviteForm = () => {
    setInviteFormData({
      email: '',
      restaurant_id: '',
      role: 'staff',
      permissions: []
    })
  }

  const handleExportStaff = async () => {
    try {
      const csv = [
        'Name,Email,Phone,Restaurant,Role,Status,Hired Date,Last Login,Performance Score,Shifts This Month',
        ...filteredStaff.map(member => [
          `"${member.profile?.full_name || ''}"`,
          member.profile?.email || '',
          member.profile?.phone_number || '',
          `"${member.restaurant?.name || ''}"`,
          member.role,
          member.is_active ? 'Active' : 'Inactive',
          new Date(member.hired_at).toLocaleDateString(),
          member.last_login_at ? new Date(member.last_login_at).toLocaleDateString() : '',
          member.performance_score?.toFixed(1) || '',
          member.shifts_this_month || 0
        ].join(','))
      ].join('\n')

      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `staff_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      toast.success('Staff data exported successfully')
    } catch (error) {
      console.error('Error exporting data:', error)
      toast.error('Failed to export staff data')
    }
  }

  const filteredStaff = staff.filter(member => {
    const matchesSearch = member.profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.profile?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.restaurant?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesRole = roleFilter === 'all' || member.role === roleFilter
    const matchesRestaurant = restaurantFilter === 'all' || member.restaurant_id === restaurantFilter
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && member.is_active) ||
                         (statusFilter === 'inactive' && !member.is_active)

    return matchesSearch && matchesRole && matchesRestaurant && matchesStatus
  })

  const getPerformanceColor = (score: number) => {
    if (score >= 4.5) return 'text-green-600'
    if (score >= 4.0) return 'text-yellow-600'
    if (score >= 3.5) return 'text-orange-600'
    return 'text-red-600'
  }

  const getPerformanceBadge = (score: number) => {
    if (score >= 4.5) return 'bg-green-100 text-green-800'
    if (score >= 4.0) return 'bg-yellow-100 text-yellow-800'
    if (score >= 3.5) return 'bg-orange-100 text-orange-800'
    return 'bg-red-100 text-red-800'
  }

  if (contextLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading staff data...</p>
        </div>
      </div>
    )
  }

  if (!restaurantId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-gray-600">No restaurant access found.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Staff Management</h1>
          <p className="mt-2 text-gray-600">
            Manage staff across all restaurants, roles, permissions, and performance
          </p>
        </div>
        <div className="mt-4 lg:mt-0 flex items-center gap-3">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExportStaff}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => {
            resetInviteForm()
            setShowAddStaffDialog(true)
          }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Staff
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Staff</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total_staff}</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-3xl font-bold text-green-600">{stats.active_staff}</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <UserCheck className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Multi-Restaurant</p>
                <p className="text-3xl font-bold text-purple-600">{stats.multi_restaurant_staff}</p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Building className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Performance</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.avg_performance.toFixed(1)}</p>
              </div>
              <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Award className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Hours This Month</p>
                <p className="text-3xl font-bold text-indigo-600">{stats.total_hours_month.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Turnover Rate</p>
                <p className="text-3xl font-bold text-red-600">{stats.staff_turnover_rate.toFixed(1)}%</p>
              </div>
              <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, email, or restaurant..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  style={{ minHeight: '44px' }}
                />
              </div>
            </div>
            <div className="flex gap-3 w-full lg:w-auto">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full lg:w-[120px]" style={{ minHeight: '44px' }}>
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>

              <Select value={restaurantFilter} onValueChange={setRestaurantFilter}>
                <SelectTrigger className="w-full lg:w-[140px]" style={{ minHeight: '44px' }}>
                  <SelectValue placeholder="Restaurant" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Restaurants</SelectItem>
                  {restaurants.map(restaurant => (
                    <SelectItem key={restaurant.id} value={restaurant.id}>
                      {restaurant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full lg:w-[120px]" style={{ minHeight: '44px' }}>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Staff List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredStaff.map((member) => (
          <Card key={member.id} className="hover:shadow-lg transition-all">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                    {member.profile?.avatar_url ? (
                      <img src={member.profile.avatar_url} alt={member.profile.full_name} className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <span className="text-blue-600 font-medium">
                        {member.profile?.full_name?.charAt(0)?.toUpperCase() || member.profile?.email?.charAt(0)?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{member.profile?.full_name || 'No Name'}</CardTitle>
                    <CardDescription className="text-sm">
                      {member.restaurant?.name}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={ROLE_COLORS[member.role]}>
                    {ROLE_ICONS[member.role]} {member.role}
                  </Badge>
                  {!member.is_active && (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-4">
                {/* Performance & Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${getPerformanceColor(member.performance_score || 0)}`}>
                      {member.performance_score?.toFixed(1) || 'N/A'}
                    </div>
                    <div className="text-xs text-gray-600">Performance</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{member.shifts_this_month || 0}</div>
                    <div className="text-xs text-gray-600">Shifts/Month</div>
                  </div>
                </div>

                {/* Key Info */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail className="w-4 h-4" />
                    <span className="truncate">{member.profile?.email}</span>
                  </div>
                  {member.profile?.phone_number && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className="w-4 h-4" />
                      <span>{member.profile.phone_number}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>Hired {new Date(member.hired_at).toLocaleDateString()}</span>
                  </div>
                  {member.last_login_at && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Activity className="w-4 h-4" />
                      <span>Last login {new Date(member.last_login_at).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setSelectedStaff(member)
                        setShowDetailsDialog(true)
                      }}
                      style={{ minHeight: '36px' }}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedStaff(member)
                        setShowPermissionsDialog(true)
                      }}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <Shield className="w-4 h-4" />
                    </Button>

                    <Select 
                      value={member.role} 
                      onValueChange={(value) => handleRoleUpdate(member.id, value)}
                    >
                      <SelectTrigger className="w-10 h-9 p-0 hover:bg-gray-100">
                        <Briefcase className="w-4 h-4" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Owner</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStatusToggle(member.id, !member.is_active)}
                      className={member.is_active ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}
                    >
                      {member.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteStaff(member.id)}
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

      {filteredStaff.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No staff found</h3>
            <p className="text-gray-500">
              {searchTerm || roleFilter !== 'all' || restaurantFilter !== 'all' || statusFilter !== 'all'
                ? 'Try adjusting your search criteria'
                : 'No staff members added yet'
              }
            </p>
          </CardContent>
        </Card>
      )}

      {/* Staff Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-3">
              {selectedStaff?.profile?.avatar_url ? (
                <img src={selectedStaff.profile.avatar_url} alt={selectedStaff.profile.full_name} className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-medium text-lg">
                    {selectedStaff?.profile?.full_name?.charAt(0)?.toUpperCase() || selectedStaff?.profile?.email?.charAt(0)?.toUpperCase()}
                  </span>
                </div>
              )}
              {selectedStaff?.profile?.full_name || 'Staff Details'}
            </DialogTitle>
          </DialogHeader>
          
          {selectedStaff && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="performance">Performance</TabsTrigger>
                <TabsTrigger value="schedule">Schedule</TabsTrigger>
                <TabsTrigger value="permissions">Permissions</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Email</Label>
                      <p className="text-gray-900 mt-1">{selectedStaff.profile?.email}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Phone</Label>
                      <p className="text-gray-900 mt-1">{selectedStaff.profile?.phone_number || 'Not provided'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Role</Label>
                      <div className="mt-1">
                        <Badge className={ROLE_COLORS[selectedStaff.role]}>
                          {ROLE_ICONS[selectedStaff.role]} {selectedStaff.role}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Restaurant</Label>
                      <p className="text-gray-900 mt-1">{selectedStaff.restaurant?.name}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Hired Date</Label>
                      <p className="text-gray-900 mt-1">{new Date(selectedStaff.hired_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Status</Label>
                      <div className="mt-1">
                        <Badge variant={selectedStaff.is_active ? 'default' : 'secondary'}>
                          {selectedStaff.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="performance" className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">{selectedStaff.performance_score?.toFixed(1) || 'N/A'}</p>
                    <p className="text-sm text-gray-600">Overall Score</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{selectedStaff.shifts_this_month || 0}</p>
                    <p className="text-sm text-gray-600">Shifts This Month</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-purple-600">{selectedStaff.hours_worked || 0}</p>
                    <p className="text-sm text-gray-600">Hours Worked</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-yellow-600">{selectedStaff.total_restaurants || 1}</p>
                    <p className="text-sm text-gray-600">Restaurants</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="schedule" className="space-y-4">
                <p className="text-gray-600">Staff schedule and time tracking details would be displayed here.</p>
              </TabsContent>

              <TabsContent value="permissions" className="space-y-4">
                <div className="space-y-6">
                  {PERMISSION_GROUPS.map(group => (
                    <div key={group.id} className="space-y-3">
                      <Label className="text-sm font-medium text-gray-900">{group.label}</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {group.permissions.map(permission => (
                          <div key={permission} className="flex items-center space-x-2">
                            <Checkbox 
                              id={permission}
                              checked={selectedStaff.permissions?.includes(permission) || false}
                              disabled
                            />
                            <Label htmlFor={permission} className="text-sm text-gray-700 capitalize">
                              {permission.replace('_', ' ')}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Permissions Dialog */}
      <Dialog open={showPermissionsDialog} onOpenChange={setShowPermissionsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Permissions</DialogTitle>
          </DialogHeader>
          
          {selectedStaff && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-medium">
                    {selectedStaff.profile?.full_name?.charAt(0)?.toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-medium">{selectedStaff.profile?.full_name}</p>
                  <p className="text-sm text-gray-600">{selectedStaff.restaurant?.name}</p>
                </div>
                <Badge className={ROLE_COLORS[selectedStaff.role]}>
                  {selectedStaff.role}
                </Badge>
              </div>

              <div className="space-y-6">
                {PERMISSION_GROUPS.map(group => (
                  <div key={group.id} className="space-y-3">
                    <Label className="text-sm font-medium text-gray-900">{group.label}</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {group.permissions.map(permission => (
                        <div key={permission} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`edit-${permission}`}
                            checked={selectedStaff.permissions?.includes(permission) || false}
                            onCheckedChange={(checked) => {
                              const currentPermissions = selectedStaff.permissions || []
                              const updatedPermissions = checked
                                ? [...currentPermissions, permission]
                                : currentPermissions.filter(p => p !== permission)
                              setSelectedStaff({
                                ...selectedStaff,
                                permissions: updatedPermissions
                              })
                            }}
                          />
                          <Label htmlFor={`edit-${permission}`} className="text-sm text-gray-700 capitalize">
                            {permission.replace('_', ' ')}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowPermissionsDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={() => {
                  if (selectedStaff) {
                    handlePermissionUpdate(selectedStaff.id, selectedStaff.permissions || [])
                    setShowPermissionsDialog(false)
                  }
                }}>
                  Save Permissions
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Staff Dialog */}
      <Dialog open={showAddStaffDialog} onOpenChange={setShowAddStaffDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Staff Member</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <div>
              <Label htmlFor="staff-email">Email Address *</Label>
              <Input
                id="staff-email"
                type="email"
                value={inviteFormData.email}
                onChange={(e) => setInviteFormData({...inviteFormData, email: e.target.value})}
                placeholder="staff@example.com"
              />
              <p className="text-xs text-gray-500 mt-1">User must already be registered on the platform</p>
            </div>

            <div>
              <Label htmlFor="staff-role">Role</Label>
              <Select value={inviteFormData.role} onValueChange={(value) => setInviteFormData({...inviteFormData, role: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <Label>Permissions</Label>
              <div className="space-y-4">
                {PERMISSION_GROUPS.map(group => (
                  <div key={group.id} className="space-y-3">
                    <Label className="text-sm font-medium text-gray-900">{group.label}</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {group.permissions.map(permission => (
                        <div key={permission} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`invite-${permission}`}
                            checked={inviteFormData.permissions.includes(permission)}
                            onCheckedChange={(checked) => {
                              const updatedPermissions = checked
                                ? [...inviteFormData.permissions, permission]
                                : inviteFormData.permissions.filter(p => p !== permission)
                              setInviteFormData({
                                ...inviteFormData,
                                permissions: updatedPermissions
                              })
                            }}
                          />
                          <Label htmlFor={`invite-${permission}`} className="text-sm text-gray-700 capitalize">
                            {permission.replace('_', ' ')}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowAddStaffDialog(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleInviteStaff} disabled={saving}>
                {saving ? 'Adding Staff...' : 'Add Staff Member'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
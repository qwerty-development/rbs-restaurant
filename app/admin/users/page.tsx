'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
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
  Star, 
  Trophy,
  Users,
  UserCheck,
  UserX,
  Shield,
  Activity,
  TrendingUp,
  RefreshCw,
  Download,
  MoreHorizontal,
  AlertTriangle,
  CheckCircle,
  Clock,
  MapPin,
  Heart,
  CreditCard,
  Settings
} from 'lucide-react'

interface User {
  id: string
  email: string
  full_name: string
  phone_number: string | null
  avatar_url: string | null
  allergies: string[] | null
  favorite_cuisines: string[] | null
  dietary_restrictions: string[] | null
  preferred_party_size: number
  loyalty_points: number
  membership_tier: 'bronze' | 'silver' | 'gold' | 'platinum'
  user_rating: number
  total_bookings: number
  completed_bookings: number
  cancelled_bookings: number
  no_show_bookings: number
  created_at: string
  updated_at: string
  // Calculated fields
  booking_completion_rate?: number
  avg_spend?: number
  last_booking?: string
  favorite_restaurants?: number
  reviews_count?: number
}

interface UserStats {
  total_users: number
  active_users: number
  new_users_this_month: number
  avg_user_rating: number
  total_loyalty_points: number
  high_value_users: number
}

const TIER_COLORS = {
  bronze: 'bg-amber-100 text-amber-800',
  silver: 'bg-gray-100 text-gray-800',
  gold: 'bg-yellow-100 text-yellow-800',
  platinum: 'bg-purple-100 text-purple-800'
}

const TIER_ICONS = {
  bronze: '🥉',
  silver: '🥈', 
  gold: '🥇',
  platinum: '💎'
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [stats, setStats] = useState<UserStats>({
    total_users: 0,
    active_users: 0,
    new_users_this_month: 0,
    avg_user_rating: 0,
    total_loyalty_points: 0,
    high_value_users: 0
  })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [tierFilter, setTierFilter] = useState('all')
  const [ratingFilter, setRatingFilter] = useState('all')
  const [activityFilter, setActivityFilter] = useState('all')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [createdFrom, setCreatedFrom] = useState('')
  const [createdTo, setCreatedTo] = useState('')
  const [pointsMin, setPointsMin] = useState('')
  const [pointsMax, setPointsMax] = useState('')

  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  // Refetch when pagination or filters change
  useEffect(() => {
    fetchUsers()
  }, [page, pageSize])

  const onApplyFilters = () => {
    setPage(1)
    fetchUsers()
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        fetchUsers(),
        fetchStats()
      ])
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load user data')
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('profiles')
      .select(`
        *,
        bookings:bookings!bookings_user_id_fkey(count),
        completed_bookings:bookings!bookings_user_id_fkey(id, status),
        reviews:reviews(count),
        favorites:favorites(count)
      `, { count: 'exact' })

    // Search (server-side across name, email, phone)
    if (searchTerm.trim()) {
      const sq = searchTerm.trim()
      query = query.or(`full_name.ilike.%${sq}%,email.ilike.%${sq}%,phone_number.ilike.%${sq}%`)
    }

    // Tier filter
    if (tierFilter !== 'all') {
      query = query.eq('membership_tier', tierFilter)
    }

    // Rating filter buckets
    if (ratingFilter !== 'all') {
      if (ratingFilter === 'high') query = query.gte('user_rating', 4.0)
      if (ratingFilter === 'medium') query = query.gte('user_rating', 3.0).lt('user_rating', 4.0)
      if (ratingFilter === 'low') query = query.lt('user_rating', 3.0)
    }

    // Created date range
    if (createdFrom) query = query.gte('created_at', new Date(createdFrom).toISOString())
    if (createdTo) {
      const end = new Date(createdTo)
      end.setHours(23,59,59,999)
      query = query.lte('created_at', end.toISOString())
    }

    // Loyalty points range
    const minPts = pointsMin ? parseInt(pointsMin,10) : undefined
    const maxPts = pointsMax ? parseInt(pointsMax,10) : undefined
    if (!Number.isNaN(minPts) && typeof minPts === 'number') query = query.gte('loyalty_points', minPts as number)
    if (!Number.isNaN(maxPts) && typeof maxPts === 'number') query = query.lte('loyalty_points', maxPts as number)

    // Activity filter (based on bookings count) via join-in approach
    if (activityFilter !== 'all') {
      if (activityFilter === 'active' || activityFilter === 'frequent') {
        // Get user_ids with bookings, optionally count>=10
        const { data: bookingAgg } = await supabase
          .from('bookings')
          .select('user_id, count:count(*)')
          .not('user_id', 'is', null)
          .group('user_id')
        const ids = (bookingAgg || [])
          .filter((r: any) => activityFilter === 'frequent' ? (r.count >= 10) : (r.count > 0))
          .map((r: any) => r.user_id)
        if (ids.length === 0) {
          setUsers([])
          setTotal(0)
          return
        }
        query = query.in('id', ids as any)
      } else if (activityFilter === 'inactive') {
        const { data: bookingAgg } = await supabase
          .from('bookings')
          .select('user_id')
          .not('user_id', 'is', null)
          .group('user_id')
        const ids = (bookingAgg || []).map((r: any) => r.user_id)
        if (ids.length > 0) {
          query = query.not('id', 'in', `(${ids.join(',')})`)
        }
      }
    }

    // Sort & paginate
    query = query.order('created_at', { ascending: false }).range(from, to)

    const { data: profiles, error, count } = await query

    if (error) {
      console.error('Error fetching users:', error)
      throw error
    }

    setTotal(count || 0)

    const processedUsers = (profiles || []).map(user => {
      const completedBookings = user.completed_bookings?.filter((b: { status: string }) => b.status === 'completed').length || 0
      const totalBookings = user.bookings?.[0]?.count || 0
      
      return {
        ...user,
        total_bookings: totalBookings,
        completed_bookings: completedBookings,
        booking_completion_rate: totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0,
        reviews_count: user.reviews?.[0]?.count || 0,
        favorite_restaurants: user.favorites?.[0]?.count || 0
      }
    })

    setUsers(processedUsers)
  }

  const fetchStats = async () => {
    try {
      const PAGE_SIZE = 1000

      // Page through profiles for stats
      let profilesFrom = 0
      let allUserStats: { id: string; created_at: string; loyalty_points: number; user_rating: number }[] = []
      while (true) {
        const { data: page, error } = await supabase
          .from('profiles')
          .select('id, created_at, loyalty_points, user_rating')
          .range(profilesFrom, profilesFrom + PAGE_SIZE - 1)

        if (error) throw error

        const current = page || []
        allUserStats = allUserStats.concat(current as any)
        if (current.length < PAGE_SIZE) break
        profilesFrom += PAGE_SIZE
      }

      // Page through bookings just to accumulate user_id counts
      let bookingsFrom = 0
      let bookingUserIds: string[] = []
      while (true) {
        const { data: page, error: bookingError } = await supabase
          .from('bookings')
          .select('user_id')
          .range(bookingsFrom, bookingsFrom + PAGE_SIZE - 1)

        if (bookingError) {
          console.error('Error fetching booking stats:', bookingError)
          break
        }

        const current = (page || []).map(b => b.user_id).filter(Boolean)
        bookingUserIds = bookingUserIds.concat(current as any)
        if ((page || []).length < PAGE_SIZE) break
        bookingsFrom += PAGE_SIZE
      }

      const now = new Date()
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      
      const totalUsers = allUserStats.length
      const newUsersThisMonth = allUserStats.filter(u => new Date(u.created_at) >= thisMonth).length
      
      // Calculate active users based on booking data
      const usersWithBookings = new Set(bookingUserIds)
      const activeUsers = usersWithBookings.size
      
      const avgRating = totalUsers > 0 ? (allUserStats.reduce((sum, u) => sum + (u.user_rating || 0), 0) / totalUsers) : 0
      const totalLoyaltyPoints = allUserStats.reduce((sum, u) => sum + (u.loyalty_points || 0), 0)
      
      // Count users with 10+ bookings
      const bookingCountsByUser = bookingUserIds.reduce((acc, userId) => {
        acc[userId] = (acc[userId] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      
      const highValueUsers = Object.values(bookingCountsByUser).filter(count => count >= 10).length

      setStats({
        total_users: totalUsers,
        active_users: activeUsers,
        new_users_this_month: newUsersThisMonth,
        avg_user_rating: avgRating,
        total_loyalty_points: totalLoyaltyPoints,
        high_value_users: highValueUsers
      })
    } catch (error) {
      console.error('Error fetching user stats:', error)
    }
  }

  const handleUpdateUserTier = async (userId: string, newTier: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          membership_tier: newTier,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (error) throw error

      await fetchUsers()
      toast.success('User tier updated successfully')
    } catch (error) {
      console.error('Error updating user tier:', error)
      toast.error('Failed to update user tier')
    }
  }

  const handleResetUserRating = async (userId: string) => {
    if (!confirm('Are you sure you want to reset this user\'s rating to 5.0?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          user_rating: 5.0,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (error) throw error

      await fetchUsers()
      toast.success('User rating reset successfully')
    } catch (error) {
      console.error('Error resetting user rating:', error)
      toast.error('Failed to reset user rating')
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return
    }

    try {
      // In a real app, you'd want to handle this more carefully
      // as it might require cascading deletes or anonymization
      const { error } = await supabase.auth.admin.deleteUser(userId)

      if (error) throw error

      await fetchUsers()
      toast.success('User deleted successfully')
    } catch (error) {
      console.error('Error deleting user:', error)
      toast.error('Failed to delete user')
    }
  }

  const handleExportUsers = async () => {
    try {
      const csv = [
        'Name,Email,Phone,Membership Tier,User Rating,Total Bookings,Completed Bookings,Loyalty Points,Favorite Cuisines,Dietary Restrictions,Allergies,Created At',
        ...filteredUsers.map(user => [
          `"${user.full_name || ''}"`,
          user.email,
          user.phone_number || '',
          user.membership_tier,
          user.user_rating || 0,
          user.total_bookings,
          user.completed_bookings,
          user.loyalty_points,
          `"${user.favorite_cuisines?.join('; ') || ''}"`,
          `"${user.dietary_restrictions?.join('; ') || ''}"`,
          `"${user.allergies?.join('; ') || ''}"`,
          new Date(user.created_at).toLocaleDateString()
        ].join(','))
      ].join('\n')

      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `users_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      toast.success('User data exported successfully')
    } catch (error) {
      console.error('Error exporting data:', error)
      toast.error('Failed to export user data')
    }
  }

  // Results are already server-filtered; keep reference for UI consistency
  const filteredUsers = users

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return 'text-green-600'
    if (rating >= 4.0) return 'text-yellow-600'
    if (rating >= 3.0) return 'text-orange-600'
    return 'text-red-600'
  }

  const getRatingBadge = (rating: number) => {
    if (rating >= 4.5) return 'bg-green-100 text-green-800'
    if (rating >= 4.0) return 'bg-yellow-100 text-yellow-800'
    if (rating >= 3.0) return 'bg-orange-100 text-orange-800'
    return 'bg-red-100 text-red-800'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading user data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="mt-2 text-gray-600">
            Manage user accounts, analytics, and engagement across the platform
          </p>
        </div>
        <div className="mt-4 lg:mt-0 flex items-center gap-3">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleExportUsers}>
            <Download className="w-4 h-4 mr-2" />
            Export Users
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total_users.toLocaleString()}</p>
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
                <p className="text-sm font-medium text-gray-600">Active Users</p>
                <p className="text-3xl font-bold text-green-600">{stats.active_users.toLocaleString()}</p>
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
                <p className="text-sm font-medium text-gray-600">New This Month</p>
                <p className="text-3xl font-bold text-purple-600">{stats.new_users_this_month}</p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Rating</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.avg_user_rating.toFixed(1)}</p>
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
                <p className="text-sm font-medium text-gray-600">Loyalty Points</p>
                <p className="text-3xl font-bold text-indigo-600">{stats.total_loyalty_points.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Trophy className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">High Value</p>
                <p className="text-3xl font-bold text-emerald-600">{stats.high_value_users}</p>
              </div>
              <div className="h-12 w-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-emerald-600" />
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
                  placeholder="Search by name, email, or phone..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setPage(1) }}
                  className="pl-10"
                  style={{ minHeight: '44px' }}
                />
              </div>
            </div>
            <div className="flex gap-3 w-full lg:w-auto">
              <Select value={tierFilter} onValueChange={(v) => { setTierFilter(v); setPage(1) }}>
                <SelectTrigger className="w-full lg:w-[120px]" style={{ minHeight: '44px' }}>
                  <SelectValue placeholder="Tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  <SelectItem value="bronze">Bronze</SelectItem>
                  <SelectItem value="silver">Silver</SelectItem>
                  <SelectItem value="gold">Gold</SelectItem>
                  <SelectItem value="platinum">Platinum</SelectItem>
                </SelectContent>
              </Select>

              <Select value={ratingFilter} onValueChange={(v) => { setRatingFilter(v); setPage(1) }}>
                <SelectTrigger className="w-full lg:w-[120px]" style={{ minHeight: '44px' }}>
                  <SelectValue placeholder="Rating" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Ratings</SelectItem>
                  <SelectItem value="high">High (4.0+)</SelectItem>
                  <SelectItem value="medium">Medium (3.0-4.0)</SelectItem>
                  <SelectItem value="low">Low (&lt;3.0)</SelectItem>
                </SelectContent>
              </Select>

              <Select value={activityFilter} onValueChange={(v) => { setActivityFilter(v); setPage(1) }}>
                <SelectTrigger className="w-full lg:w-[120px]" style={{ minHeight: '44px' }}>
                  <SelectValue placeholder="Activity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="frequent">Frequent (10+)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Additional filters */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-sm">Created From</Label>
              <Input type="date" value={createdFrom} onChange={(e) => { setCreatedFrom(e.target.value); setPage(1) }} />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">Created To</Label>
              <Input type="date" value={createdTo} onChange={(e) => { setCreatedTo(e.target.value); setPage(1) }} />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">Min Points</Label>
              <Input type="number" inputMode="numeric" placeholder="0" value={pointsMin} onChange={(e) => { setPointsMin(e.target.value); setPage(1) }} />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">Max Points</Label>
              <Input type="number" inputMode="numeric" placeholder="10000" value={pointsMax} onChange={(e) => { setPointsMax(e.target.value); setPage(1) }} />
            </div>
          </div>

          {/* Apply button */}
          <div className="mt-4 flex items-center justify-end">
            <Button onClick={onApplyFilters} disabled={loading}>
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* User List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredUsers.map((user) => (
          <Card key={user.id} className="hover:shadow-lg transition-all">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.full_name} className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <span className="text-blue-600 font-medium">
                        {user.full_name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{user.full_name || 'No Name'}</CardTitle>
                    <CardDescription className="text-sm truncate max-w-[200px]">
                      {user.email}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={TIER_COLORS[user.membership_tier]}>
                    {TIER_ICONS[user.membership_tier]} {user.membership_tier}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-4">
                {/* User Rating & Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${getRatingColor(user.user_rating)}`}>
                      {user.user_rating?.toFixed(1) || 'N/A'}
                    </div>
                    <div className="text-xs text-gray-600">User Rating</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{user.total_bookings}</div>
                    <div className="text-xs text-gray-600">Total Bookings</div>
                  </div>
                </div>

                {/* Progress Bars */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Completion Rate</span>
                    <span>{user.booking_completion_rate?.toFixed(0)}%</span>
                  </div>
                  <Progress value={user.booking_completion_rate} className="h-2" />
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-3 gap-2 text-xs text-center">
                  <div>
                    <div className="font-medium text-gray-900">{user.loyalty_points}</div>
                    <div className="text-gray-600">Points</div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{user.reviews_count || 0}</div>
                    <div className="text-gray-600">Reviews</div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{user.favorite_restaurants || 0}</div>
                    <div className="text-gray-600">Favorites</div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setSelectedUser(user)
                        setShowDetailsDialog(true)
                      }}
                      style={{ minHeight: '36px' }}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                  </div>

                  <div className="flex items-center gap-1">
                    <Select 
                      value={user.membership_tier} 
                      onValueChange={(value) => handleUpdateUserTier(user.id, value)}
                    >
                      <SelectTrigger className="w-10 h-9 p-0 hover:bg-gray-100">
                        <Trophy className="w-4 h-4" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bronze">Bronze</SelectItem>
                        <SelectItem value="silver">Silver</SelectItem>
                        <SelectItem value="gold">Gold</SelectItem>
                        <SelectItem value="platinum">Platinum</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleResetUserRating(user.id)}
                      className="text-yellow-600 hover:text-yellow-700"
                    >
                      <Star className="w-4 h-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteUser(user.id)}
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

      {/* Pagination Controls */}
      <div className="flex items-center justify-between mt-6">
        <div className="text-sm text-gray-600">
          Page {page} of {totalPages}
        </div>
        <div className="flex items-center gap-3">
          <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(parseInt(v)); setPage(1) }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 / page</SelectItem>
              <SelectItem value="20">20 / page</SelectItem>
              <SelectItem value="50">50 / page</SelectItem>
              <SelectItem value="100">100 / page</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
            <Button variant="outline" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next</Button>
          </div>
        </div>
      </div>

      {filteredUsers.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
            <p className="text-gray-500">
              {searchTerm || tierFilter !== 'all' || ratingFilter !== 'all' || activityFilter !== 'all'
                ? 'Try adjusting your search criteria'
                : 'No users registered yet'
              }
            </p>
          </CardContent>
        </Card>
      )}

      {/* User Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-3">
              {selectedUser?.avatar_url ? (
                <img src={selectedUser.avatar_url} alt={selectedUser.full_name} className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-medium text-lg">
                    {selectedUser?.full_name?.charAt(0)?.toUpperCase() || selectedUser?.email?.charAt(0)?.toUpperCase()}
                  </span>
                </div>
              )}
              {selectedUser?.full_name || 'User Details'}
            </DialogTitle>
          </DialogHeader>
          
          {selectedUser && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
                <TabsTrigger value="preferences">Preferences</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Email</Label>
                      <p className="text-gray-900 mt-1">{selectedUser.email}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Phone</Label>
                      <p className="text-gray-900 mt-1">{selectedUser.phone_number || 'Not provided'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Member Since</Label>
                      <p className="text-gray-900 mt-1">{new Date(selectedUser.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Membership Tier</Label>
                      <div className="mt-1">
                        <Badge className={TIER_COLORS[selectedUser.membership_tier]}>
                          {TIER_ICONS[selectedUser.membership_tier]} {selectedUser.membership_tier}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">User Rating</Label>
                      <div className={`text-2xl font-bold mt-1 ${getRatingColor(selectedUser.user_rating)}`}>
                        {selectedUser.user_rating?.toFixed(1) || 'N/A'}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Preferred Party Size</Label>
                      <p className="text-gray-900 mt-1">{selectedUser.preferred_party_size}</p>
                    </div>
                  </div>
                </div>

                {/* Statistics */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">User Statistics</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">{selectedUser.total_bookings}</p>
                      <p className="text-sm text-gray-600">Total Bookings</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">{selectedUser.completed_bookings}</p>
                      <p className="text-sm text-gray-600">Completed</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-yellow-600">{selectedUser.cancelled_bookings}</p>
                      <p className="text-sm text-gray-600">Cancelled</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-red-600">{selectedUser.no_show_bookings}</p>
                      <p className="text-sm text-gray-600">No Shows</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-purple-600">{selectedUser.loyalty_points}</p>
                      <p className="text-sm text-gray-600">Loyalty Points</p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="activity" className="space-y-4">
                <p className="text-gray-600">User activity history and analytics would be displayed here.</p>
              </TabsContent>

              <TabsContent value="preferences" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Favorite Cuisines</Label>
                    <div className="mt-2 space-x-2">
                      {selectedUser.favorite_cuisines?.map(cuisine => (
                        <Badge key={cuisine} variant="secondary">{cuisine}</Badge>
                      )) || <span className="text-gray-500">None specified</span>}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Dietary Restrictions</Label>
                    <div className="mt-2 space-x-2">
                      {selectedUser.dietary_restrictions?.map(restriction => (
                        <Badge key={restriction} variant="outline">{restriction}</Badge>
                      )) || <span className="text-gray-500">None specified</span>}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-sm font-medium text-gray-700">Allergies</Label>
                    <div className="mt-2 space-x-2">
                      {selectedUser.allergies?.map(allergy => (
                        <Badge key={allergy} variant="destructive">{allergy}</Badge>
                      )) || <span className="text-gray-500">None specified</span>}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="settings" className="space-y-4">
                <p className="text-gray-600">User account settings and privacy controls would be displayed here.</p>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
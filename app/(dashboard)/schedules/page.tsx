"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { format, startOfWeek, endOfWeek } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Calendar,
  Clock,
  Users,
  Plus,
  Search,
  Filter,
  BarChart3,
  UserCheck,
  Timer,
  DollarSign,
  Settings,
  Download
} from "lucide-react"
import { restaurantAuth } from "@/lib/restaurant-auth"
import { createClient } from "@/lib/supabase/client"
import { useRestaurantContext } from "@/lib/contexts/restaurant-context"
import { staffSchedulingService } from "@/lib/services/staff-scheduling"
import { ScheduleCalendar } from "@/components/staff/schedule-calendar"
import { ShiftForm } from "@/components/staff/shift-form"
import { TimeClock } from "@/components/staff/time-clock"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import type { StaffShift, RestaurantStaff, TimeClockEntry, StaffPosition } from "@/types"
import { toast } from "react-hot-toast"

export default function SchedulesPage() {
  const router = useRouter()
  const supabase = createClient()
  const { currentRestaurant, isLoading: contextLoading } = useRestaurantContext()
  const restaurantId = currentRestaurant?.restaurant.id
  
  // State
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [currentStaff, setCurrentStaff] = useState<any>(null)
  const [staffMembers, setStaffMembers] = useState<RestaurantStaff[]>([])
  const [shifts, setShifts] = useState<StaffShift[]>([])
  const [timeClockEntries, setTimeClockEntries] = useState<TimeClockEntry[]>([])
  const [positions, setPositions] = useState<StaffPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState("calendar")
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStaffId, setSelectedStaffId] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  
  // Modal states
  const [isShiftFormOpen, setIsShiftFormOpen] = useState(false)
  const [editingShift, setEditingShift] = useState<StaffShift | null>(null)
  const [shiftFormInitialDate, setShiftFormInitialDate] = useState<string>("")
  const [shiftFormInitialStaffId, setShiftFormInitialStaffId] = useState<string>("")
  const [shiftToDelete, setShiftToDelete] = useState<StaffShift | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const loadStaffMembers = useCallback(async (restaurantId: string) => {
    try {
      const data = await staffSchedulingService.getRestaurantStaff(restaurantId)
      setStaffMembers(data)
    } catch (error) {
      console.error('Error loading staff members:', error)
      toast.error('Failed to load staff members')
    }
  }, [])

  const loadShifts = useCallback(async (restaurantId: string) => {
    try {
      const weekStart = startOfWeek(new Date())
      const weekEnd = endOfWeek(new Date())
      
      const data = await staffSchedulingService.getStaffShifts(restaurantId, {
        startDate: format(weekStart, 'yyyy-MM-dd'),
        endDate: format(weekEnd, 'yyyy-MM-dd')
      })
      setShifts(data)
    } catch (error) {
      console.error('Error loading shifts:', error)
      toast.error('Failed to load shifts')
    }
  }, [])

  const loadTimeClockEntries = useCallback(async (restaurantId: string) => {
    try {
      // Load today's entries for general display
      const today = format(new Date(), 'yyyy-MM-dd')
      const todayData = await staffSchedulingService.getTimeClockEntries(restaurantId, {
        startDate: today,
        endDate: today
      })
      
      // Also load all active entries (regardless of date) for accurate stats
      const activeData = await staffSchedulingService.getTimeClockEntries(restaurantId, {
        status: 'active'
      })
      
      // Combine both datasets, removing duplicates
      const allEntries = [...todayData]
      activeData.forEach(activeEntry => {
        if (!allEntries.find(entry => entry.id === activeEntry.id)) {
          allEntries.push(activeEntry)
        }
      })
      
      setTimeClockEntries(allEntries)
    } catch (error) {
      console.error('Error loading time clock entries:', error)
      toast.error('Failed to load time clock entries')
    }
  }, [])

  const loadPositions = useCallback(async (restaurantId: string) => {
    try {
      const data = await staffSchedulingService.getStaffPositions(restaurantId)
      setPositions(data)
    } catch (error) {
      console.error('Error loading positions:', error)
    }
  }, [])

  // Check permissions on mount
  useEffect(() => {
    if (!contextLoading && currentRestaurant) {
      const hasPermission = restaurantAuth.hasPermission(
        currentRestaurant.permissions,
        'schedules.view',
        currentRestaurant.role
      )
      
      if (!hasPermission) {
        toast.error("You don't have permission to view schedules")
        router.push('/dashboard')
      }
    } else if (!contextLoading && !currentRestaurant) {
      router.push('/dashboard/overview')
    }
  }, [contextLoading, currentRestaurant, router])

  const loadInitialData = useCallback(async () => {
    if (!restaurantId) return
    
    try {
      setLoading(true)

      // Get current user
      const { data: { user } }:any = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setCurrentUser(user)

      // Get current staff data for this restaurant
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
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .single()

      if (staffError || !staffData) {
        toast.error("You don't have access to schedules")
        router.push('/dashboard')
        return
      }

      setCurrentStaff(staffData)

      // Load data in parallel
      await Promise.all([
        loadStaffMembers(restaurantId),
        loadShifts(restaurantId),
        loadTimeClockEntries(restaurantId),
        loadPositions(restaurantId)
      ])

    } catch (error) {
      console.error('Error loading initial data:', error)
      toast.error('Failed to load schedule data')
    } finally {
      setLoading(false)
    }
  }, [restaurantId, supabase, router, loadStaffMembers, loadShifts, loadTimeClockEntries, loadPositions])

  useEffect(() => {
    if (restaurantId) {
      loadInitialData()
    }
  }, [loadInitialData])

  const handleCreateShift = (date?: string, staffId?: string) => {
    setShiftFormInitialDate(date || "")
    setShiftFormInitialStaffId(staffId || "")
    setEditingShift(null)
    setIsShiftFormOpen(true)
  }

  const handleEditShift = (shift: StaffShift) => {
    setEditingShift(shift)
    setShiftFormInitialDate("")
    setShiftFormInitialStaffId("")
    setIsShiftFormOpen(true)
  }

  const handleShiftFormSuccess = () => {
    // Trigger refresh of the calendar
    setRefreshTrigger(prev => prev + 1)
    
    // Also reload the parent data
    if (restaurantId) {
      loadShifts(restaurantId)
      loadTimeClockEntries(restaurantId)
    }
  }

  const handleDeleteShift = async (shift: StaffShift) => {
    if (!canManageSchedules) {
      toast.error("You don't have permission to delete shifts")
      return
    }

    // Check if the shift has any time clock entries
    try {
      const { data: entries, error } = await supabase
        .from('time_clock_entries')
        .select('id, status')
        .eq('shift_id', shift.id)

      if (error) {
        console.error('Error checking time clock entries:', error)
        toast.error('Failed to check shift dependencies')
        return
      }

      // If there are active time clock entries, prevent deletion
      if (entries && entries.length > 0) {
        const activeEntries = entries.filter(entry => entry.status === 'active')
        if (activeEntries.length > 0) {
          toast.error('Cannot delete shift: Staff member is currently clocked in for this shift')
          return
        }
        
        // If there are completed time clock entries, show a warning
        if (entries.length > 0) {
          const confirmed = window.confirm(
            `This shift has ${entries.length} time clock entries. Deleting the shift will also remove these time tracking records. Are you sure you want to continue?`
          )
          if (!confirmed) return
        }
      }
    } catch (error) {
      console.error('Error checking shift dependencies:', error)
      toast.error('Failed to verify shift can be deleted')
      return
    }

    setShiftToDelete(shift)
  }

  const confirmDeleteShift = async () => {
    if (!shiftToDelete || !restaurantId) return

    try {
      setIsDeleting(true)
      await staffSchedulingService.deleteStaffShift(shiftToDelete.id)
      toast.success('Shift deleted successfully')
      
      // Trigger refresh of the calendar
      setRefreshTrigger(prev => prev + 1)
      
      // Also reload the parent data
      loadShifts(restaurantId)
      loadTimeClockEntries(restaurantId)
      setShiftToDelete(null)
    } catch (error: any) {
      console.error('Error deleting shift:', error)
      toast.error(error.message || 'Failed to delete shift')
    } finally {
      setIsDeleting(false)
    }
  }

  // Filtered staff members
  const filteredStaffMembers = useMemo(() => {
    return staffMembers.filter(staff => {
      const matchesSearch = !searchQuery || 
        staff.user?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        staff.user?.email?.toLowerCase().includes(searchQuery.toLowerCase())
      
      return matchesSearch
    })
  }, [staffMembers, searchQuery])

  // Current staff member for time clock
  const currentStaffMember = staffMembers.find(staff => staff.user_id === currentUser?.id)

  // Permission checks
  const canManageSchedules = !!(currentRestaurant && restaurantAuth.hasPermission(
    currentRestaurant.permissions,
    'schedules.manage',
    currentRestaurant.role
  ))

  // Statistics
  const stats = useMemo(() => {
    const totalShifts = shifts.length
    const activeClockIns = timeClockEntries.filter(entry => entry.status === 'active').length
    const scheduledToday = shifts.filter(shift => 
      shift.shift_date === format(new Date(), 'yyyy-MM-dd')
    ).length
    const totalHours = timeClockEntries.reduce((sum, entry) => 
      sum + (entry.total_hours || 0), 0
    )

    return {
      totalShifts,
      activeClockIns,
      scheduledToday,
      totalHours: Number(totalHours.toFixed(1))
    }
  }, [shifts, timeClockEntries])

  if (contextLoading || loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-96 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!currentRestaurant || !restaurantId) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-gray-600">No restaurant selected.</p>
        </div>
      </div>
    )
  }

  const StatsCard = ({ title, value, subtitle, icon: Icon, color = "text-primary" }: {
    title: string
    value: string | number
    subtitle?: string
    icon: any
    color?: string
  }) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className={`p-3 bg-primary/10 rounded-lg ${color}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff Schedules</h1>
          <p className="text-muted-foreground">
            Manage staff schedules, shifts, and time tracking
          </p>
        </div>
        
        {canManageSchedules && (
          <Button onClick={() => handleCreateShift()}>
            <Plus className="mr-2 h-4 w-4" />
            Create Shift
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard
          title="This Week's Shifts"
          value={stats.totalShifts}
          icon={Calendar}
        />
        <StatsCard
          title="Currently Clocked In"
          value={stats.activeClockIns}
          subtitle="Active staff"
          icon={UserCheck}
          color="text-green-600"
        />
        <StatsCard
          title="Scheduled Today"
          value={stats.scheduledToday}
          subtitle="Shifts"
          icon={Timer}
          color="text-blue-600"
        />
        <StatsCard
          title="Hours Today"
          value={stats.totalHours}
          subtitle="Total worked"
          icon={Clock}
          color="text-purple-600"
        />
      </div>

      {/* Main Content */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="calendar" className="flex items-center space-x-2">
            <Calendar className="h-4 w-4" />
            <span>Schedule Calendar</span>
          </TabsTrigger>
          <TabsTrigger value="timeclock" className="flex items-center space-x-2">
            <Clock className="h-4 w-4" />
            <span>Time Clock</span>
          </TabsTrigger>
          {canManageSchedules && (
            <TabsTrigger value="management" className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span>Management</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* Schedule Calendar Tab */}
        <TabsContent value="calendar" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search staff members..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 w-full md:w-64"
                  />
                </div>
                
                <div className="flex space-x-2">
                  <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All Staff" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Staff</SelectItem>
                      {filteredStaffMembers.map((staff) => (
                        <SelectItem key={staff.id} value={staff.id}>
                          {staff.user?.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Schedule Calendar */}
          <ScheduleCalendar
            restaurantId={restaurantId}
            staffMembers={filteredStaffMembers}
            selectedStaffId={selectedStaffId === "all" ? undefined : selectedStaffId}
            onCreateShift={canManageSchedules ? handleCreateShift : undefined}
            onEditShift={canManageSchedules ? handleEditShift : undefined}
            onDeleteShift={canManageSchedules ? handleDeleteShift : undefined}
            refreshTrigger={refreshTrigger}
          />
        </TabsContent>

        {/* Time Clock Tab */}
        <TabsContent value="timeclock">
          {currentStaffMember && restaurantId ? (
            <TimeClock
              restaurantId={restaurantId}
              currentStaff={currentStaffMember}
              onTimeClockChange={() => {
                // Refresh time clock entries when clock in/out happens
                if (restaurantId) loadTimeClockEntries(restaurantId)
              }}
            />
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Time Clock Unavailable</h3>
                <p className="text-muted-foreground">
                  You need to be registered as a staff member to use the time clock.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Management Tab */}
        {canManageSchedules && (
          <TabsContent value="management" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    onClick={() => handleCreateShift()}
                    className="w-full justify-start"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create New Shift
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => restaurantId && loadShifts(restaurantId)}
                    className="w-full justify-start"
                  >
                    <BarChart3 className="mr-2 h-4 w-4" />
                    View Reports
                  </Button>
                  <Button 
                    variant="outline"
                    className="w-full justify-start"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export Schedule
                  </Button>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {timeClockEntries.slice(0, 5).map(entry => (
                      <div key={entry.id} className="flex items-center justify-between text-sm">
                        <div>
                          <span className="font-medium">{entry.staff?.user?.full_name}</span>
                          <span className="text-muted-foreground ml-2">
                            clocked {entry.clock_out_time ? 'out' : 'in'}
                          </span>
                        </div>
                        <Badge variant="outline">
                          {format(new Date(entry.clock_in_time), 'HH:mm')}
                        </Badge>
                      </div>
                    ))}
                    {timeClockEntries.length === 0 && (
                      <p className="text-muted-foreground text-center py-4">
                        No recent activity
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Shift Form Modal */}
      <ShiftForm
        open={isShiftFormOpen}
        onOpenChange={setIsShiftFormOpen}
        restaurantId={restaurantId}
        staffMembers={staffMembers}
        positions={positions}
        shift={editingShift}
        initialDate={shiftFormInitialDate}
        initialStaffId={shiftFormInitialStaffId}
        onSuccess={handleShiftFormSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!shiftToDelete}
        onOpenChange={(open) => !open && setShiftToDelete(null)}
        title="Delete Shift"
        description={
          shiftToDelete 
            ? `Are you sure you want to delete the shift for ${shiftToDelete.staff?.user?.full_name || 'Unknown'} on ${format(new Date(shiftToDelete.shift_date), 'MMM d, yyyy')} from ${shiftToDelete.start_time} to ${shiftToDelete.end_time}? This action cannot be undone.`
            : "Are you sure you want to delete this shift?"
        }
        confirmText="Delete Shift"
        onConfirm={confirmDeleteShift}
        isLoading={isDeleting}
      />
    </div>
  )
}
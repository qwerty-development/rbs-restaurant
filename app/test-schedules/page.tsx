"use client"

import { useState, useEffect, useMemo } from "react"
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
import { staffSchedulingService } from "@/lib/services/staff-scheduling"
import { ScheduleCalendar } from "@/components/staff/schedule-calendar"
import { TimeClock } from "@/components/staff/time-clock"
import type { StaffShift, RestaurantStaff, TimeClockEntry, StaffPosition } from "@/types"
import { toast } from "react-hot-toast"

export default function TestSchedulesPage() {
  // Hard-coded test data
  const restaurantId = "660e8400-e29b-41d4-a716-446655440005"
  const canManageSchedules = true
  
  // State
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

  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    try {
      console.log('🎯 Starting loadInitialData...')
      setLoading(true)

      // Load data in parallel
      console.log('🔄 Loading data in parallel...')
      await Promise.all([
        loadStaffMembers(),
        loadShifts(),
        loadTimeClockEntries(),
        loadPositions()
      ])
      
      console.log('✅ All data loaded successfully')

    } catch (error) {
      console.error('❌ Error loading initial data:', error)
      toast.error('Failed to load schedule data')
    } finally {
      console.log('🏁 Loading completed, setting loading to false')
      setLoading(false)
    }
  }

  const loadStaffMembers = async () => {
    try {
      console.log('🚀 Starting to load staff members...')
      const data = await staffSchedulingService.getRestaurantStaff(restaurantId)
      console.log('✅ Staff members loaded in component:', data)
      setStaffMembers(data)
    } catch (error) {
      console.error('❌ Error loading staff members in component:', error)
      toast.error('Failed to load staff members')
    }
  }

  const loadShifts = async () => {
    try {
      const weekStart = startOfWeek(new Date())
      const weekEnd = endOfWeek(new Date())
      
      const data = await staffSchedulingService.getStaffShifts(restaurantId, {
        startDate: format(weekStart, 'yyyy-MM-dd'),
        endDate: format(weekEnd, 'yyyy-MM-dd')
      })
      console.log('Shifts loaded:', data)
      setShifts(data)
    } catch (error) {
      console.error('Error loading shifts:', error)
      toast.error('Failed to load shifts')
    }
  }

  const loadTimeClockEntries = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd')
      const data = await staffSchedulingService.getTimeClockEntries(restaurantId, {
        startDate: today,
        endDate: today
      })
      console.log('Time clock entries loaded:', data)
      setTimeClockEntries(data)
    } catch (error) {
      console.error('Error loading time clock entries:', error)
      toast.error('Failed to load time clock entries')
    }
  }

  const loadPositions = async () => {
    try {
      const data = await staffSchedulingService.getStaffPositions(restaurantId)
      console.log('Positions loaded:', data)
      setPositions(data)
    } catch (error) {
      console.error('Error loading positions:', error)
      toast.error('Failed to load positions')
    }
  }

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
    loadShifts()
    loadTimeClockEntries()
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

  // Current staff member for time clock (use first staff member)
  const currentStaffMember = staffMembers[0]

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

    console.log('Stats calculated:', { totalShifts, activeClockIns, scheduledToday, totalHours })

    return {
      totalShifts,
      activeClockIns,
      scheduledToday,
      totalHours: Number(totalHours.toFixed(1))
    }
  }, [shifts, timeClockEntries])

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
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
          <h1 className="text-3xl font-bold tracking-tight">Staff Schedules (Test)</h1>
          <p className="text-muted-foreground">
            Testing staff schedules, shifts, and time tracking
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

      {/* Debug Info */}
      <Card>
        <CardHeader>
          <CardTitle>Debug Info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Restaurant ID:</strong> {restaurantId}
            </div>
            <div>
              <strong>Staff Members:</strong> {staffMembers.length}
            </div>
            <div>
              <strong>Shifts:</strong> {shifts.length}
            </div>
            <div>
              <strong>Time Clock Entries:</strong> {timeClockEntries.length}
            </div>
          </div>
        </CardContent>
      </Card>

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
          <TabsTrigger value="management" className="flex items-center space-x-2">
            <Settings className="h-4 w-4" />
            <span>Management</span>
          </TabsTrigger>
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
          />
        </TabsContent>

        {/* Time Clock Tab */}
        <TabsContent value="timeclock">
          {currentStaffMember ? (
            <TimeClock
              restaurantId={restaurantId}
              currentStaff={currentStaffMember}
            />
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Time Clock Unavailable</h3>
                <p className="text-muted-foreground">
                  Loading staff member data...
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Management Tab */}
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
                  onClick={() => loadShifts()}
                  className="w-full justify-start"
                >
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Refresh Data
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
      </Tabs>
    </div>
  )
}

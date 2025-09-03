"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isSameDay, parseISO } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ChevronLeft, ChevronRight, Plus, Clock, Users, User, Trash2 } from "lucide-react"
import { staffSchedulingService } from "@/lib/services/staff-scheduling"
import type { StaffShift, RestaurantStaff } from "@/types"
import { cn } from "@/lib/utils"

interface ScheduleCalendarProps {
  restaurantId: string
  staffMembers: RestaurantStaff[]
  onCreateShift?: (date: string, staffId?: string) => void
  onEditShift?: (shift: StaffShift) => void
  onDeleteShift?: (shift: StaffShift) => void
  selectedStaffId?: string
  refreshTrigger?: number // Add this to force refresh
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const STATUS_COLORS = {
  scheduled: 'bg-blue-100 text-blue-800 border-blue-200',
  confirmed: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
  completed: 'bg-gray-100 text-gray-800 border-gray-200',
  no_show: 'bg-orange-100 text-orange-800 border-orange-200'
}

export function ScheduleCalendar({ 
  restaurantId, 
  staffMembers, 
  onCreateShift, 
  onEditShift,
  onDeleteShift,
  selectedStaffId,
  refreshTrigger 
}: ScheduleCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [shifts, setShifts] = useState<StaffShift[]>([])
  const [loading, setLoading] = useState(true)
  const loadingRef = useRef(false)
  const lastLoadedWeekRef = useRef<string>('')

  // Memoize week calculations to prevent unnecessary re-renders
  const weekStart = useMemo(() => startOfWeek(currentDate), [currentDate])
  const weekEnd = useMemo(() => endOfWeek(currentDate), [currentDate])
  const weekDays = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd])
  const weekStartFormatted = useMemo(() => format(weekStart, 'yyyy-MM-dd'), [weekStart])
  const weekEndFormatted = useMemo(() => format(weekEnd, 'yyyy-MM-dd'), [weekEnd])

  // Create a unique key for the current week to prevent duplicate loads
  const weekKey = useMemo(() => `${weekStartFormatted}-${weekEndFormatted}-${selectedStaffId || 'all'}`, [weekStartFormatted, weekEndFormatted, selectedStaffId])

  // Filtered staff members
  const displayStaff = useMemo(() => {
    if (selectedStaffId) {
      return staffMembers.filter(staff => staff.id === selectedStaffId)
    }
    return staffMembers
  }, [staffMembers, selectedStaffId])

  // Load shifts effect - only trigger when essential dependencies change
  useEffect(() => {
    // Reset cache when refresh is triggered
    if (refreshTrigger && refreshTrigger > 0) {
      lastLoadedWeekRef.current = ''
    }

    // Prevent duplicate loading (but allow refresh trigger to override)
    if (!restaurantId || (loadingRef.current && !refreshTrigger) || (!refreshTrigger && lastLoadedWeekRef.current === weekKey)) {
      return
    }

    const loadShifts = async () => {
      try {
        loadingRef.current = true
        setLoading(true)
        console.log('📅 Loading shifts for week:', weekStartFormatted, 'to', weekEndFormatted, refreshTrigger ? '(forced refresh)' : '')
        
        const data = await staffSchedulingService.getStaffShifts(restaurantId, {
          startDate: weekStartFormatted,
          endDate: weekEndFormatted,
          staffId: selectedStaffId
        })
        
        console.log('📅 Loaded shifts:', data.length)
        setShifts(data)
        lastLoadedWeekRef.current = weekKey
      } catch (error) {
        console.error('Error loading shifts:', error)
      } finally {
        setLoading(false)
        loadingRef.current = false
      }
    }

    loadShifts()
  }, [restaurantId, weekKey, weekStartFormatted, weekEndFormatted, selectedStaffId, refreshTrigger])

  const getShiftsForDay = (date: Date, staffId: string) => {
    return shifts.filter(shift => 
      isSameDay(parseISO(shift.shift_date), date) && 
      shift.staff_id === staffId
    )
  }

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => direction === 'prev' ? subWeeks(prev, 1) : addWeeks(prev, 1))
  }

  const ShiftCard = ({ shift }: { shift: StaffShift }) => {
    // Check if shift has active time clock entries
    const hasActiveTimeEntry = shift.time_clock_entries?.some(entry => entry.status === 'active')
    
    return (
      <div
        key={shift.id}
        className={cn(
          "p-2 rounded border text-xs hover:shadow-sm transition-shadow group relative cursor-pointer",
          STATUS_COLORS[shift.status]
        )}
        onClick={() => onEditShift?.(shift)}
      >
        <div className="font-medium truncate">
          {shift.start_time} - {shift.end_time}
          {hasActiveTimeEntry && (
            <span className="ml-1 inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Currently clocked in" />
          )}
        </div>
        {shift.role && (
          <div className="text-xs opacity-75 truncate">
            {shift.role}
          </div>
        )}
        {shift.station && (
          <div className="text-xs opacity-75 truncate">
            📍 {shift.station}
          </div>
        )}
        
        {/* Delete button - show on hover */}
        {onDeleteShift && (
          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDeleteShift(shift)
              }}
              className={cn(
                "p-1 rounded",
                hasActiveTimeEntry 
                  ? "opacity-50 cursor-not-allowed" 
                  : "hover:bg-red-100 text-red-600"
              )}
              title={hasActiveTimeEntry ? "Cannot delete - staff is clocked in" : "Delete shift"}
              disabled={hasActiveTimeEntry}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32" />
            <div className="flex space-x-2">
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-8 gap-2">
            {Array.from({ length: 56 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Schedule Calendar</span>
            <Badge variant="outline" className="ml-2">
              {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
            </Badge>
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateWeek('prev')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(new Date())}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateWeek('next')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="border-b bg-muted/30">
          <div className="grid grid-cols-8 gap-0">
            {/* Staff column header */}
            <div className="p-3 border-r font-medium text-sm">
              <div className="flex items-center space-x-1">
                <Users className="h-4 w-4" />
                <span>Staff</span>
              </div>
            </div>
            {/* Day headers */}
            {weekDays.map(day => (
              <div key={day.toISOString()} className="p-3 border-r font-medium text-sm text-center">
                <div>{DAYS_OF_WEEK[day.getDay()]}</div>
                <div className="text-lg">{format(day, 'd')}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {displayStaff.map(staff => (
            <div key={staff.id} className="grid grid-cols-8 gap-0 border-b hover:bg-muted/20">
              {/* Staff member info */}
              <div className="p-3 border-r bg-muted/10">
                <div className="flex items-center space-x-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">
                      {staff.user?.full_name}
                    </div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {staff.role}
                    </div>
                  </div>
                </div>
              </div>

              {/* Daily shift columns */}
              {weekDays.map(day => {
                const dayShifts = getShiftsForDay(day, staff.id)
                const isToday = isSameDay(day, new Date())
                
                return (
                  <div 
                    key={`${staff.id}-${day.toISOString()}`}
                    className={cn(
                      "p-2 border-r min-h-[100px] relative",
                      isToday && "bg-blue-50/50"
                    )}
                  >
                    <div className="space-y-1">
                      {dayShifts.map(shift => (
                        <ShiftCard key={shift.id} shift={shift} />
                      ))}
                    </div>
                    
                    {onCreateShift && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute bottom-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
                        onClick={() => onCreateShift(format(day, 'yyyy-MM-dd'), staff.id)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {displayStaff.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No staff members to display</p>
            <p className="text-sm">Select staff members to view their schedules</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

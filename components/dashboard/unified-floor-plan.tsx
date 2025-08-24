// components/dashboard/unified-floor-plan.tsx
"use client"

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table2,
  Users,
  Clock,
  ChefHat,
  AlertCircle,
  CheckCircle,
  Timer,
  CreditCard,
  Coffee,
  Utensils,
  Cake,
  UserCheck,
  Hand,
  Phone,
  AlertTriangle,
  Calendar,
  Eye,
  Move,
  Layers,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  Home,
  Trees,
  Wine,
  Lock,
  Sparkles,
  MapPin,
  Building,
  Maximize2,
  Pencil,
  X
} from "lucide-react"
import { format, addMinutes, differenceInMinutes } from "date-fns"
import { TableStatusService, type DiningStatus } from "@/lib/table-status"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { RestaurantSection } from "@/types"

const SECTION_ICONS = {
  grid: Grid3X3,
  home: Home,
  trees: Trees,
  wine: Wine,
  lock: Lock,
  sparkles: Sparkles,
  mappin: MapPin,
  building: Building,
  layers: Layers,
}

// Drag state interface for better performance
interface DragState {
  tableId: string | null
  element: HTMLElement | null
  startX: number
  startY: number
  offsetX: number
  offsetY: number
  initialLeft: number
  initialTop: number
  animationId: number | null
  touchId: number | null
  isDragConfirmed: boolean
  startTime: number
}

interface UnifiedFloorPlanProps {
  tables: any[]
  bookings: any[]
  currentTime: Date
  restaurantId: string
  userId: string
  onTableClick?: (table: any, status: any) => void
  onStatusUpdate?: (bookingId: string, newStatus: DiningStatus) => void
  onTableSwitch?: (bookingId: string, newTableIds: string[]) => void
  onCheckIn?: (bookingId: string, tableIds: string[]) => void
  onTableUpdate?: (tableId: string, position: { x: number; y: number }) => void
  searchQuery?: string
  defaultSectionId?: string
}

const STATUS_ICONS: any = {
  'pending': Timer,
  'confirmed': CheckCircle,
  'arrived': UserCheck,
  'seated': ChefHat,
  'ordered': Coffee,
  'appetizers': Utensils,
  'main_course': Utensils,
  'dessert': Cake,
  'payment': CreditCard,
  'completed': CheckCircle,
  'no_show': AlertCircle,
  'cancelled': AlertCircle
}

const STATUS_COLORS: any = {
  'pending': 'bg-secondary/50 border-secondary text-secondary-foreground',
  'confirmed': 'bg-primary/20 border-primary/40 text-primary',
  'arrived': 'bg-accent/30 border-accent text-accent-foreground',
  'seated': 'bg-primary/30 border-primary text-primary',
  'ordered': 'bg-secondary/70 border-secondary text-secondary-foreground',
  'appetizers': 'bg-accent/50 border-accent text-accent-foreground',
  'main_course': 'bg-secondary border-secondary text-secondary-foreground',
  'dessert': 'bg-accent/70 border-accent text-accent-foreground',
  'payment': 'bg-primary/40 border-primary text-primary',
  'completed': 'bg-muted border-border text-muted-foreground',
  'no_show': 'bg-destructive/20 border-destructive text-destructive',
  'cancelled': 'bg-destructive/20 border-destructive text-destructive'
}

const TABLE_TYPE_COLORS: Record<string, string> = {
  booth: "bg-gradient-to-br from-primary/10 to-primary/20 border-primary/30 shadow-primary/10",
  window: "bg-gradient-to-br from-accent/10 to-accent/20 border-accent/30 shadow-accent/10",
  patio: "bg-gradient-to-br from-secondary/20 to-secondary/30 border-secondary/40 shadow-secondary/10",
  standard: "bg-gradient-to-br from-card to-muted border-border shadow-sm",
  bar: "bg-gradient-to-br from-accent/20 to-accent/30 border-accent/40 shadow-accent/10",
  private: "bg-gradient-to-br from-primary/10 to-primary/20 border-primary/30 shadow-primary/10",
}

export const UnifiedFloorPlan = React.memo(function UnifiedFloorPlan({ 
  tables, 
  bookings, 
  currentTime,
  restaurantId,
  userId,
  onTableClick,
  onStatusUpdate,
  onTableSwitch,
  onCheckIn,
  onTableUpdate,
  searchQuery,
  defaultSectionId
}: UnifiedFloorPlanProps) {
  const [tableStatuses, setTableStatuses] = useState<Map<string, any>>(new Map())
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [draggedBookingId, setDraggedBookingId] = useState<string | null>(null)
  const [activeMenuTable, setActiveMenuTable] = useState<string | null>(null)
  const [hoveredTable, setHoveredTable] = useState<string | null>(null)
  const [loadingTransition, setLoadingTransition] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [selectedSection, setSelectedSection] = useState<string>(defaultSectionId || "all")
  const [sectionViewMode, setSectionViewMode] = useState<"tabs" | "dropdown">("tabs")
  const [showSectionOverview, setShowSectionOverview] = useState(false)
  const floorPlanRef = useRef<HTMLDivElement>(null)
  
  const supabase = createClient()

  // Use refs for drag state to avoid re-renders and improve performance
  const dragStateRef = useRef<DragState>({
    tableId: null,
    element: null,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
    initialLeft: 0,
    initialTop: 0,
    animationId: null,
    touchId: null,
    isDragConfirmed: false,
    startTime: 0
  })

  // Track final positions for smooth updates
  const finalPositionsRef = useRef<Record<string, { x: number; y: number }>>({})
  
  const tableStatusService = useMemo(() => new TableStatusService(), [])

  // Fetch sections
  const { data: sections } = useQuery({
    queryKey: ["restaurant-sections", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_sections")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("display_order", { ascending: true })

      if (error) throw error
      return data as RestaurantSection[]
    },
    enabled: !!restaurantId,
  })

  // Filter tables by selected section
  const filteredTables = useMemo(() => {
    if (selectedSection === "all") {
      return tables
    }
    return tables.filter(table => table.section_id === selectedSection)
  }, [tables, selectedSection])

  // Calculate section statistics
  const sectionStats = useMemo(() => {
    if (!sections) return []
    
    return sections.map(section => {
      const sectionTables = tables.filter(t => t.section_id === section.id)
      const occupiedTables = sectionTables.filter(table => {
        const hasActiveBooking = bookings.some(booking => 
          booking.tables?.some((t: any) => t.id === table.id) &&
          ['arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment'].includes(booking.status)
        )
        return hasActiveBooking
      })
      
      return {
        ...section,
        tableCount: sectionTables.length,
        occupiedCount: occupiedTables.length,
        availableCount: sectionTables.length - occupiedTables.length,
        occupancyRate: sectionTables.length > 0 
          ? Math.round((occupiedTables.length / sectionTables.length) * 100)
          : 0
      }
    })
  }, [sections, tables, bookings])

  // Section navigation
  const currentSectionIndex = sections?.findIndex(s => s.id === selectedSection) ?? -1
  const hasNextSection = currentSectionIndex < (sections?.length ?? 0) - 1
  const hasPrevSection = currentSectionIndex > 0

  const navigateSection = (direction: 'next' | 'prev') => {
    if (!sections) return
    
    if (direction === 'next' && hasNextSection) {
      setSelectedSection(sections[currentSectionIndex + 1].id)
    } else if (direction === 'prev' && hasPrevSection) {
      setSelectedSection(sections[currentSectionIndex - 1].id)
    }
  }

  // Initialize positions
  useEffect(() => {
    const positions: Record<string, { x: number; y: number }> = {}
    tables.forEach(table => {
      positions[table.id] = { x: table.x_position, y: table.y_position }
    })
    finalPositionsRef.current = { ...positions }
  }, [tables])

  // Section overview component
  const SectionOverview = () => {
    if (!showSectionOverview || !sections) return null

    return (
      <Card className="absolute top-4 right-4 w-64 z-50 shadow-xl">
        <div className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Section Overview
          </h3>
          <div className="space-y-2">
            {sectionStats.map(stat => {
              const Icon = SECTION_ICONS[stat.icon as keyof typeof SECTION_ICONS] || Grid3X3
              const isActive = stat.id === selectedSection
              
              return (
                <button
                  key={stat.id}
                  className={cn(
                    "w-full p-2 rounded-lg border text-left transition-all",
                    isActive 
                      ? "bg-primary/10 border-primary shadow-sm" 
                      : "hover:bg-muted border-border"
                  )}
                  onClick={() => setSelectedSection(stat.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon 
                        className="h-4 w-4" 
                        style={{ color: stat.color }}
                      />
                      <span className="font-medium text-sm">{stat.name}</span>
                    </div>
                    <Badge 
                      variant={stat.occupancyRate > 80 ? "destructive" : 
                               stat.occupancyRate > 50 ? "secondary" : "outline"}
                      className="text-xs"
                    >
                      {stat.occupancyRate}%
                    </Badge>
                  </div>
                  <div className="flex gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {stat.occupiedCount}/{stat.tableCount} occupied
                    </span>
                  </div>
                </button>
              )
            })}
            
            <button
              className={cn(
                "w-full p-2 rounded-lg border text-left transition-all",
                selectedSection === "all" 
                  ? "bg-primary/10 border-primary shadow-sm" 
                  : "hover:bg-muted border-border"
              )}
              onClick={() => setSelectedSection("all")}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Grid3X3 className="h-4 w-4" />
                  <span className="font-medium text-sm">All Sections</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {tables.length} tables
                </Badge>
              </div>
            </button>
          </div>
        </div>
      </Card>
    )
  }

  // Load table statuses
  useEffect(() => {
    const loadStatuses = async () => {
      const statuses = await tableStatusService.getTableStatuses(restaurantId, currentTime)
      setTableStatuses(statuses)
    }
    loadStatuses()

    const interval = setInterval(loadStatuses, 30000)
    return () => clearInterval(interval)
  }, [restaurantId, currentTime, tableStatusService])

  // Click outside to deselect
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (floorPlanRef.current && !floorPlanRef.current.contains(event.target as Node)) {
        setSelectedTable(null)
        setActiveMenuTable(null)
      }
    }

    if (selectedTable) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [selectedTable])

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedTable(null)
        setActiveMenuTable(null)
        setEditMode(false)
        // Reset drag state
        dragStateRef.current = {
          tableId: null,
          element: null,
          startX: 0,
          startY: 0,
          offsetX: 0,
          offsetY: 0,
          initialLeft: 0,
          initialTop: 0,
          animationId: null,
          touchId: null,
          isDragConfirmed: false,
          startTime: 0
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // Helper functions for event handling
  const getEventCoordinates = (e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e && e.touches.length > 0) {
      return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY }
    } else if ('clientX' in e) {
      return { clientX: e.clientX, clientY: e.clientY }
    }
    return { clientX: 0, clientY: 0 }
  }

  const getTouchById = (touches: TouchList, touchId: number) => {
    for (let i = 0; i < touches.length; i++) {
      if (touches[i].identifier === touchId) {
        return touches[i]
      }
    }
    return null
  }

  // Enhanced table drag handlers with proper touch support and performance optimization
  const handleTableDragStart = useCallback((e: React.MouseEvent | React.TouchEvent, tableId: string) => {
    if (!editMode) return

    e.preventDefault()
    e.stopPropagation()

    const table = tables.find(t => t.id === tableId)
    if (!table) return

    const element = document.querySelector(`[data-table-id="${tableId}"]`) as HTMLElement
    const container = floorPlanRef.current
    if (!element || !container) return

    setSelectedTable(tableId)

    const containerRect = container.getBoundingClientRect()
    const elementRect = element.getBoundingClientRect()
    const coords = getEventCoordinates(e)

    // Get touch ID for touch events
    const touchId = 'touches' in e && e.touches.length > 0 ? e.touches[0].identifier : null
    const isTouch = 'touches' in e

    // Calculate precise offset from touch/mouse to element's top-left
    const offsetX = coords.clientX - elementRect.left
    const offsetY = coords.clientY - elementRect.top

    // Get current position
    const currentLeft = elementRect.left - containerRect.left
    const currentTop = elementRect.top - containerRect.top

    dragStateRef.current = {
      tableId,
      element,
      startX: coords.clientX,
      startY: coords.clientY,
      offsetX,
      offsetY,
      initialLeft: currentLeft,
      initialTop: currentTop,
      animationId: null,
      touchId,
      isDragConfirmed: !isTouch, // For mouse, immediately confirm. For touch, wait for movement.
      startTime: Date.now()
    }

    // Visual feedback
    element.style.zIndex = '1000'
    element.style.touchAction = 'none'
  }, [editMode, tables])

  const handleTableDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    const dragState = dragStateRef.current

    // Handle dragging
    if (dragState.tableId && dragState.element && floorPlanRef.current && editMode) {
      let coords: { clientX: number; clientY: number }

      // For touch events, check if it's the same touch
      if ('touches' in e && dragState.touchId !== null) {
        const touch = getTouchById(e.touches, dragState.touchId)
        if (!touch) return
        coords = { clientX: touch.clientX, clientY: touch.clientY }
      } else {
        coords = getEventCoordinates(e)
      }

      // Calculate movement distance to determine if this is a drag or just a tap/scroll
      const deltaX = coords.clientX - dragState.startX
      const deltaY = coords.clientY - dragState.startY
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

      // For touch events, require minimum movement to confirm drag
      if (!dragState.isDragConfirmed) {
        const DRAG_THRESHOLD = 8 // pixels
        const TIME_THRESHOLD = 150 // ms

        if (distance > DRAG_THRESHOLD || (Date.now() - dragState.startTime) > TIME_THRESHOLD) {
          dragState.isDragConfirmed = true
          e.preventDefault()
        } else {
          return // Don't prevent default yet, allow scrolling
        }
      } else {
        e.preventDefault()
      }

      // Cancel any pending animation frame
      if (dragState.animationId) {
        cancelAnimationFrame(dragState.animationId)
      }

      // Use requestAnimationFrame for smooth 60fps updates
      dragState.animationId = requestAnimationFrame(() => {
        const containerRect = floorPlanRef.current!.getBoundingClientRect()

        const newLeft = dragState.initialLeft + deltaX
        const newTop = dragState.initialTop + deltaY

        // Apply boundaries
        const elementWidth = dragState.element!.offsetWidth
        const elementHeight = dragState.element!.offsetHeight

        const boundedLeft = Math.max(0, Math.min(containerRect.width - elementWidth, newLeft))
        const boundedTop = Math.max(0, Math.min(containerRect.height - elementHeight, newTop))

        // Apply position directly to DOM (super fast)
        dragState.element!.style.left = `${boundedLeft}px`
        dragState.element!.style.top = `${boundedTop}px`

        // Calculate percentage for final save
        const percentX = (boundedLeft / containerRect.width) * 100
        const percentY = (boundedTop / containerRect.height) * 100

        finalPositionsRef.current[dragState.tableId!] = { x: percentX, y: percentY }
      })
    }
  }, [editMode])

  const handleTableDragEnd = useCallback((e?: MouseEvent | TouchEvent) => {
    const dragState = dragStateRef.current

    // For touch events, check if the ended touch matches our tracked touch
    if (e && 'changedTouches' in e) {
      let relevantTouch = false
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === dragState.touchId) {
          relevantTouch = true
          break
        }
      }
      if (!relevantTouch) return
    }

    // Handle drag end
    if (dragState.tableId && dragState.element && editMode && onTableUpdate) {
      // Reset visual state
      dragState.element.style.zIndex = ''
      dragState.element.style.touchAction = ''

      // Save final position to database only if drag was confirmed
      if (dragState.isDragConfirmed) {
        const finalPos = finalPositionsRef.current[dragState.tableId]
        if (finalPos) {
          try {
            onTableUpdate(dragState.tableId, finalPos)
          } catch (error) {
            console.error('Failed to update table position:', error)
            // Reset position on error
            const table = tables.find(t => t.id === dragState.tableId)
            if (table && dragState.element) {
              dragState.element.style.left = `${table.x_position}%`
              dragState.element.style.top = `${table.y_position}%`
              finalPositionsRef.current[dragState.tableId] = { x: table.x_position, y: table.y_position }
            }
          }
        }
      }

      // Clean up animation frame
      if (dragState.animationId) {
        cancelAnimationFrame(dragState.animationId)
      }
    }

    // Reset drag state
    dragStateRef.current = {
      tableId: null,
      element: null,
      startX: 0,
      startY: 0,
      offsetX: 0,
      offsetY: 0,
      initialLeft: 0,
      initialTop: 0,
      animationId: null,
      touchId: null,
      isDragConfirmed: false,
      startTime: 0
    }
  }, [editMode, onTableUpdate, tables])

  // Setup global event listeners for both mouse and touch
  useEffect(() => {
    // Mouse events - always passive false for mouse move to allow prevention
    document.addEventListener('mousemove', handleTableDragMove, { passive: false })
    document.addEventListener('mouseup', handleTableDragEnd)

    // Touch events - conditional passive based on whether we have an active touch interaction
    const handleTouchMove = (e: TouchEvent) => {
      const dragState = dragStateRef.current

      // Check if this touch event is relevant to our current interaction
      let isRelevantTouch = false
      if (dragState.touchId !== null) {
        for (let i = 0; i < e.touches.length; i++) {
          if (e.touches[i].identifier === dragState.touchId) {
            isRelevantTouch = true
            break
          }
        }
      }

      if (isRelevantTouch) {
        handleTableDragMove(e)
      }
      // If not relevant, let the browser handle it normally for scrolling
    }

    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTableDragEnd)
    document.addEventListener('touchcancel', handleTableDragEnd)

    return () => {
      // Mouse events
      document.removeEventListener('mousemove', handleTableDragMove)
      document.removeEventListener('mouseup', handleTableDragEnd)

      // Touch events
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTableDragEnd)
      document.removeEventListener('touchcancel', handleTableDragEnd)

      // Clean up any pending animation frames
      if (dragStateRef.current.animationId) {
        cancelAnimationFrame(dragStateRef.current.animationId)
      }
    }
  }, [handleTableDragMove, handleTableDragEnd])

  const getTableBookingInfo = (table: any) => {
    // Get all bookings for this table (current, upcoming, and recent)
    const allTableBookings = bookings.filter(booking => 
      booking.tables?.some((t: any) => t.id === table.id)
    )

    // Current active bookings
    const activeBookings = allTableBookings.filter(booking =>
      ['confirmed', 'arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment'].includes(booking.status)
    )

    const currentBooking = activeBookings.find(booking => {
      const physicallyPresent = ['arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment'].includes(booking.status)
      if (physicallyPresent) return true
      
      const bookingStart = new Date(booking.booking_time)
      const bookingEnd = addMinutes(bookingStart, booking.turn_time_minutes || 120)
      return currentTime >= bookingStart && currentTime <= bookingEnd
    })

    // Upcoming bookings (next 3)
    const upcomingBookings = allTableBookings
      .filter(booking => 
        new Date(booking.booking_time) > currentTime &&
        ['confirmed', 'pending'].includes(booking.status)
      )
      .sort((a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())
      .slice(0, 3)

    // Recent history (last 3 completed bookings from today)
    const todayStart = new Date(currentTime)
    todayStart.setHours(0, 0, 0, 0)
    
    const recentHistory = allTableBookings
      .filter(booking => {
        const bookingDate = new Date(booking.booking_time)
        return bookingDate >= todayStart && 
               bookingDate < currentTime &&
               ['completed', 'no_show'].includes(booking.status)
      })
      .sort((a, b) => new Date(b.booking_time).getTime() - new Date(a.booking_time).getTime())
      .slice(0, 3)

    return {
      current: currentBooking,
      upcoming: upcomingBookings[0],
      allUpcoming: upcomingBookings,
      recentHistory,
      status: tableStatuses.get(table.id)
    }
  }

  const handleTableDrop = useCallback((tableId: string) => {
    if (draggedBookingId && onTableSwitch) {
      onTableSwitch(draggedBookingId, [tableId])
      setDraggedBookingId(null)
      setIsDragging(false)
    }
  }, [draggedBookingId, onTableSwitch])

  const handleStatusTransition = useCallback(async (bookingId: string, newStatus: DiningStatus) => {
    try {
      setLoadingTransition(bookingId)
      await tableStatusService.updateBookingStatus(bookingId, newStatus, userId)
      if (onStatusUpdate) {
        onStatusUpdate(bookingId, newStatus)
      }
    } catch (error) {
      console.error('Status update error:', error)
    } finally {
      setLoadingTransition(null)
    }
  }, [onStatusUpdate, userId, tableStatusService])

  // Highlight tables based on search
  const isTableHighlighted = (table: any, booking: any) => {
    if (!searchQuery) return false
    const query = searchQuery.toLowerCase()
    
    if (booking) {
      const guestName = (booking.guest_name || booking.user?.full_name || '').toLowerCase()
      const phone = (booking.user?.phone_number || booking.guest_phone || '').toLowerCase()
      return guestName.includes(query) || phone.includes(query)
    }
    
    return `t${table.table_number}`.toLowerCase().includes(query)
  }

  const renderTable = (table: any) => {
    const { current, upcoming, allUpcoming, recentHistory } = getTableBookingInfo(table)
    const isOccupied = !!current
    const StatusIcon = current ? STATUS_ICONS[current.status as DiningStatus] : Table2
    const isHighlighted = isTableHighlighted(table, current)
    const bookingTime = current ? new Date(current.booking_time) : null
    
    // Use checked_in_at for elapsed time if guest has checked in, otherwise use booking_time
    const timeReference = current?.checked_in_at ? new Date(current.checked_in_at) : bookingTime
    const minutesSinceArrival = timeReference ? differenceInMinutes(currentTime, timeReference) : 0

    return (
      <TooltipProvider key={table.id}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              role="button"
              tabIndex={0}
              data-table-id={table.id}
              aria-label={`Table ${table.table_number}, capacity ${table.min_capacity}-${table.max_capacity}${current ? `, occupied by ${current.guest_name || current.user?.full_name || 'Guest'}, status: ${current.status.replace(/_/g, ' ')}` : ', available'}`}
              className={cn(
                "relative rounded-2xl border-3 cursor-pointer transition-all duration-300 ease-out focus:outline-none focus:ring-4 focus:ring-primary focus:ring-offset-2",
                TABLE_TYPE_COLORS[table.table_type] || "bg-gradient-to-br from-background to-card border-border shadow-lg",
                // Occupied table styling
                isOccupied && "ring-4 ring-offset-2 ring-offset-background shadow-xl",
                isOccupied && STATUS_COLORS[current.status as DiningStatus],
                // Hover effects with better feedback
                hoveredTable === table.id && !isOccupied && "shadow-xl scale-102 ring-2 ring-blue-400/50 ring-offset-2",
                hoveredTable === table.id && isOccupied && "shadow-2xl scale-102 brightness-110",
                // Loading state
                loadingTransition === current?.id && "animate-pulse ring-4 ring-yellow-400 ring-offset-2",
                // Selection state
                selectedTable === table.id && "ring-4 ring-blue-500 ring-offset-2 ring-offset-background scale-105 shadow-2xl",
                // Search highlighting
                isHighlighted && "ring-4 ring-yellow-400 animate-pulse ring-offset-2 ring-offset-background",
                // Drag states
                isDragging && !isOccupied && "border-dashed border-green-500 bg-green-50/70 shadow-green-200/50",
                dragStateRef.current.tableId === table.id && "shadow-2xl scale-110 cursor-grabbing z-50",
                // Edit mode styling
                editMode && "hover:ring-2 hover:ring-purple-400",
                editMode && !isOccupied && "cursor-move",
                // Shape
                table.shape === "circle" ? "rounded-full" : "rounded-2xl",
                // Interactive states
                "transform-gpu will-change-transform overflow-hidden text-xs"
              )}
              style={{
                position: "absolute",
                left: `${finalPositionsRef.current[table.id]?.x ?? table.x_position}%`,
                top: `${finalPositionsRef.current[table.id]?.y ?? table.y_position}%`,
                width: `${(table.width || 120) * 0.8}px`,
                height: `${(table.height || 100) * 0.8}px`,
                padding: "6px",
                transition: dragStateRef.current.tableId === table.id ? 'none' : undefined,
                // Optimize for performance
                willChange: editMode ? "transform, left, top" : "auto",
                // Prevent iOS bounce and ensure proper touch handling
                touchAction: dragStateRef.current.tableId === table.id ? "none" : "manipulation"
              }}
              onClick={() => {
                if (editMode) return // Prevent click when in edit mode
                
                // Simple click-to-toggle selection
                if (selectedTable === table.id) {
                  setSelectedTable(null)
                  setActiveMenuTable(null)
                } else {
                  setSelectedTable(table.id)
                  // Auto-show menu for occupied tables
                  if (current) {
                    setActiveMenuTable(table.id)
                  } else {
                    // For empty tables, show details immediately
                    if (onTableClick) onTableClick(table, { 
                      current, 
                      upcoming, 
                      allUpcoming, 
                      recentHistory,
                      tableInfo: {
                        hasUpcoming: allUpcoming.length > 0,
                        hasHistory: recentHistory.length > 0,
                        nextBookingTime: allUpcoming[0]?.booking_time,
                        lastCompletedTime: recentHistory[0]?.booking_time
                      }
                    })
                  }
                }
              }}
              onMouseDown={(e) => {
                if (editMode && !isOccupied) {
                  handleTableDragStart(e, table.id)
                }
              }}
              onTouchStart={(e) => {
                if (editMode && !isOccupied) {
                  handleTableDragStart(e, table.id)
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  // Trigger same logic as click
                  if (selectedTable === table.id) {
                    setSelectedTable(null)
                    setActiveMenuTable(null)
                  } else {
                    setSelectedTable(table.id)
                    if (current) {
                      setActiveMenuTable(table.id)
                    } else if (onTableClick) {
                      onTableClick(table, { 
                        current, 
                        upcoming, 
                        allUpcoming, 
                        recentHistory,
                        tableInfo: {
                          hasUpcoming: allUpcoming.length > 0,
                          hasHistory: recentHistory.length > 0,
                          nextBookingTime: allUpcoming[0]?.booking_time,
                          lastCompletedTime: recentHistory[0]?.booking_time
                        }
                      })
                    }
                  }
                }
              }}
              onMouseEnter={() => setHoveredTable(table.id)}
              onMouseLeave={() => setHoveredTable(null)}
              onDragOver={(e) => {
                if (!isOccupied && !editMode) {
                  e.preventDefault()
                  e.currentTarget.classList.add("scale-105")
                }
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove("scale-105")
              }}
              onDrop={(e) => {
                e.preventDefault()
                e.currentTarget.classList.remove("scale-105")
                if (!isOccupied && !editMode) {
                  handleTableDrop(table.id)
                }
              }}
            >
              {/* Edit mode drag handle */}
              {editMode && !isOccupied && (
                <div className="absolute -top-2 -right-2 p-1.5 bg-primary text-primary-foreground rounded-full shadow-lg z-10">
                  <Move className="h-3 w-3" />
                </div>
              )}

              {/* Table header - Compact for tablets */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1">
                  <StatusIcon className="h-3 w-3 text-current" />
                  <span className="font-bold text-xs text-foreground whitespace-nowrap">T{table.table_number}</span>
                </div>
                <Badge variant="outline" className="text-[10px] px-1 py-0 bg-background/70 font-medium rounded-md whitespace-nowrap">
                  {table.min_capacity}-{table.max_capacity}
                </Badge>
              </div>

              {/* Current booking info */}
              {isOccupied && current ? (
                <div className="space-y-1">
                  {/* Guest info - Simplified with icons */}
                  <div>
                    <p className="font-bold text-[11px] truncate text-foreground mb-0.5">
                      {current.guest_name || current.user?.full_name || 'Guest'}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {/* Party size with visual indicators */}
                        <div className={cn(
                          "flex items-center gap-1 px-1.5 py-0.5 rounded-md transition-all duration-200 shadow-sm",
                          current.party_size > table.max_capacity 
                            ? "bg-red-100 text-red-800 border-2 border-red-300 animate-pulse" 
                            : "bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30"
                        )}>
                          <Users className="h-3 w-3" />
                          <span className="font-bold text-[11px]">{current.party_size}</span>
                          {current.party_size > table.max_capacity && (
                            <AlertTriangle className="h-3 w-3 animate-bounce text-destructive" />
                          )}
                        </div>
                        
                        {/* Time indicator with urgency colors */}
                        <div className={cn(
                          "flex items-center gap-1 px-1.5 py-0.5 rounded-md font-bold text-[11px] border transition-all duration-200 shadow-sm",
                          minutesSinceArrival > (current.turn_time_minutes || 120) 
                            ? "bg-red-100 text-red-800 border-red-300 animate-pulse shadow-red-200" :
                          minutesSinceArrival > (current.turn_time_minutes || 120) * 0.8 
                            ? "bg-orange-100 text-orange-800 border-orange-300 shadow-orange-200" :
                          "bg-green-100 text-green-800 border-green-300 shadow-green-200"
                        )}>
                          <Clock className="h-3 w-3" />
                          <span>{minutesSinceArrival}m</span>
                          {minutesSinceArrival > (current.turn_time_minutes || 120) && (
                            <AlertTriangle className="h-3 w-3 animate-bounce" />
                          )}
                        </div>
                      </div>
                      
                      {/* Enhanced quick call button */}
                      {(current.user?.phone_number || current.guest_phone) && (
                        <Button
                          size="icon"
                          aria-label={`Call ${current.guest_name || current.user?.full_name || 'Guest'} at ${current.user?.phone_number || current.guest_phone}`}
                          className="h-7 w-7 p-0 bg-gradient-to-br from-accent to-accent/80 hover:from-accent/80 hover:to-accent text-accent-foreground rounded-full shadow-md border border-accent/30 hover:scale-110 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:ring-offset-2"
                          onClick={(e) => {
                            e.stopPropagation()
                            const phone = current.user?.phone_number || current.guest_phone
                            window.open(`tel:${phone}`, '_self')
                          }}
                        >
                          <Phone className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Status indicator with enhanced visual feedback */}
                  <div className="flex items-center justify-center">
                    <div className={cn(
                      "px-1.5 py-0.5 rounded-md text-[11px] font-bold flex items-center gap-1 shadow-md border transition-all duration-300",
                      current.status === 'arrived' ? "bg-gradient-to-r from-primary/20 to-primary/30 text-primary border-primary/40 animate-pulse shadow-primary/20" :
                      current.status === 'seated' ? "bg-gradient-to-r from-purple-100 to-purple-200 text-purple-800 border-purple-400 shadow-purple-300/50" :
                      current.status === 'ordered' ? "bg-gradient-to-r from-orange-100 to-orange-200 text-orange-800 border-orange-400 shadow-orange-300/50" :
                      current.status === 'payment' ? "bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 border-yellow-400 shadow-yellow-300/50 animate-pulse" :
                      "bg-gradient-to-r from-green-100 to-green-200 text-green-800 border-green-400 shadow-green-300/50"
                    )}>
                      <StatusIcon className="h-2.5 w-2.5" />
                      <span className="capitalize">{current.status.replace(/_/g, ' ')}</span>
                      {/* Status emoji indicators */}
                      {current.status === 'arrived' && <span>👋</span>}
                      {current.status === 'seated' && <span>🪑</span>}
                      {current.status === 'ordered' && <span>📝</span>}
                      {current.status === 'payment' && <span>💳</span>}
                    </div>
                  </div>

                  {/* Quick actions - Compact for tablets */}
                  {selectedTable === table.id && activeMenuTable === table.id && (
                    <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 flex gap-1 z-50 animate-in fade-in-0 slide-in-from-top-4 duration-300">
                      {/* Enhanced quick status buttons */}
                      {current.status === 'arrived' && (
                        <Button 
                          size="sm"
                          className="h-7 text-xs px-2 shadow-lg bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground rounded-lg font-semibold border border-primary/40 hover:scale-105 transition-all duration-200"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStatusTransition(current.id, 'seated')
                          }}
                          disabled={loadingTransition === current.id}
                        >
                          <ChefHat className="h-2.5 w-2.5 mr-1" />
                          Seat
                        </Button>
                      )}
                      
                      {current.status === 'seated' && (
                        <Button 
                          size="sm"
                          className="h-7 text-xs px-2 shadow-lg bg-gradient-to-r from-secondary to-secondary/90 hover:from-secondary/90 hover:to-secondary text-secondary-foreground rounded-lg font-semibold border border-secondary/40 hover:scale-105 transition-all duration-200"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStatusTransition(current.id, 'ordered')
                          }}
                          disabled={loadingTransition === current.id}
                        >
                          <Coffee className="h-2.5 w-2.5 mr-1" />
                          Order
                        </Button>
                      )}
                      
                      {['ordered', 'appetizers', 'main_course', 'dessert'].includes(current.status) && (
                        <Button 
                          size="sm"
                          className="h-7 text-xs px-2 shadow-lg bg-gradient-to-r from-accent to-accent/90 hover:from-accent/90 hover:to-accent text-accent-foreground rounded-lg font-semibold border border-accent/40 hover:scale-105 transition-all duration-200"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStatusTransition(current.id, 'payment')
                          }}
                          disabled={loadingTransition === current.id}
                        >
                          <CreditCard className="h-2.5 w-2.5 mr-1" />
                          Bill
                        </Button>
                      )}
                      
                      {current.status === 'payment' && (
                        <Button 
                          size="sm"
                          className="h-7 text-xs px-2 shadow-lg bg-gradient-to-r from-accent to-accent/90 hover:from-accent/90 hover:to-accent text-accent-foreground rounded-lg font-semibold border border-accent/40 hover:scale-105 transition-all duration-200"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStatusTransition(current.id, 'completed')
                          }}
                          disabled={loadingTransition === current.id}
                        >
                          <CheckCircle className="h-2.5 w-2.5 mr-1" />
                          Done
                        </Button>
                      )}

                      {/* View Details button */}
                      <Button 
                        size="sm"
                        className="h-7 px-2 shadow-lg bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground rounded-lg font-semibold border border-primary/40 hover:scale-105 transition-all duration-200"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (onTableClick) onTableClick(table, { current, upcoming, allUpcoming, recentHistory })
                        }}
                      >
                        <Eye className="h-2.5 w-2.5 mr-1" />
                        Info
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-2">
                  <div className="mb-2">
                    <Badge 
                      variant="secondary" 
                      className="text-xs px-2 py-1 bg-accent/30 text-accent-foreground border-accent/50 font-medium shadow-sm"
                    >
                      ✅ Available
                    </Badge>
                  </div>
                  
                  {/* Show next upcoming booking with better visibility */}
                  {upcoming && (
                    <div className="text-xs p-2 bg-gradient-to-br from-accent/30 to-accent/40 border border-accent/50 rounded-lg shadow-sm">
                      <div className="flex items-start gap-2">
                        <div className="w-4 h-4 bg-accent rounded-full flex items-center justify-center flex-shrink-0">
                          <Clock className="h-2 w-2 text-accent-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-accent-foreground">
                            📅 {format(new Date(upcoming.booking_time), 'h:mm a')}
                          </p>
                          <p className="truncate text-accent-foreground flex items-center gap-1">
                            <Users className="h-2.5 w-2.5" />
                            {upcoming.guest_name || upcoming.user?.full_name} ({upcoming.party_size})
                          </p>
                          <p className="text-accent-foreground mt-1 flex items-center gap-1">
                            <Timer className="h-2.5 w-2.5" />
                            {differenceInMinutes(new Date(upcoming.booking_time), currentTime)}m away
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Enhanced activity indicators for empty tables */}
                  {!upcoming && (
                    <div className="space-y-3">
                      {/* Main availability indicator */}
                      <div className="text-center">
                        <div className="w-8 h-8 mx-auto bg-gradient-to-br from-accent to-accent/80 rounded-full flex items-center justify-center shadow-lg">
                          <span className="text-accent-foreground text-lg font-bold">✓</span>
                        </div>
                      </div>
                      
                      {/* Activity summary */}
                      {(allUpcoming.length > 0 || recentHistory.length > 0) && (
                        <div className="text-center space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">Table Activity</p>
                          <div className="flex justify-center gap-3">
                            {allUpcoming.length > 0 && (
                              <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/20 text-primary rounded-lg border border-primary/30">
                                <Calendar className="h-2.5 w-2.5" />
                                <span className="text-xs font-medium">{allUpcoming.length} upcoming</span>
                              </div>
                            )}
                            {recentHistory.length > 0 && (
                              <div className="flex items-center gap-1.5 px-2 py-1 bg-muted text-muted-foreground rounded-lg border border-border">
                                <CheckCircle className="h-2.5 w-2.5" />
                                <span className="text-xs font-medium">{recentHistory.length} today</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Drag handle for moving bookings between tables */}
              {isOccupied && current && !editMode && (
                <div
                  className="absolute top-1 right-1 p-1 bg-background/80 border border-border rounded cursor-move hover:bg-background transition-colors"
                  draggable
                  onDragStart={(e) => {
                    setIsDragging(true)
                    setDraggedBookingId(current.id)
                    e.dataTransfer.effectAllowed = "move"
                  }}
                  onDragEnd={() => {
                    setIsDragging(false)
                    setDraggedBookingId(null)
                  }}
                >
                  <Hand className="h-3 w-3 text-muted-foreground" />
                </div>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            {current ? (
              <div className="space-y-2">
                <p className="font-semibold">{current.guest_name || current.user?.full_name}</p>
                <div className="space-y-1 text-sm">
                  <p>Party of {current.party_size}</p>
                  <p>Arrived: {format(bookingTime!, 'h:mm a')}</p>
                  <p>Status: {current.status.replace(/_/g, ' ')}</p>
                  {current.special_requests && (
                    <p className="italic text-secondary-foreground">Note: {current.special_requests}</p>
                  )}
                  {(current.user?.phone_number || current.guest_phone) && (
                    <p className="font-mono text-accent-foreground">📞 {current.user?.phone_number || current.guest_phone}</p>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <p className="font-semibold">Table {table.table_number}</p>
                <p className="text-sm">Capacity: {table.min_capacity}-{table.max_capacity}</p>
                <p className="text-sm">Type: {table.table_type}</p>
                {upcoming && (
                  <p className="text-sm mt-2">
                    Next: {format(new Date(upcoming.booking_time), 'h:mm a')}
                  </p>
                )}
              </div>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }


  return (
    <div className="h-full w-full flex flex-col bg-gradient-to-br from-background to-card ">
      {/* Section Navigation Bar */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="p-3">
          {sectionViewMode === "tabs" ? (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigateSection('prev')}
                disabled={!hasPrevSection && selectedSection !== "all"}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <ScrollArea className="flex-1">
                <Tabs value={selectedSection} onValueChange={setSelectedSection}>
                  <TabsList className="w-full justify-start">
                    <TabsTrigger value="all" className="gap-2">
                      <Grid3X3 className="h-4 w-4" />
                      All
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {tables.length}
                      </Badge>
                    </TabsTrigger>
                    
                    {sectionStats.map(stat => {
                      const Icon = SECTION_ICONS[stat.icon as keyof typeof SECTION_ICONS] || Grid3X3
                      
                      return (
                        <TabsTrigger key={stat.id} value={stat.id} className="gap-2">
                          <Icon className="h-4 w-4" style={{ color: stat.color }} />
                          {stat.name}
                          <div className="flex gap-1 ml-1">
                            <Badge 
                              variant="secondary" 
                              className="text-xs"
                            >
                              {stat.tableCount}
                            </Badge>
                            {stat.occupiedCount > 0 && (
                              <Badge 
                                variant="destructive" 
                                className="text-xs"
                              >
                                {stat.occupiedCount}
                              </Badge>
                            )}
                          </div>
                        </TabsTrigger>
                      )
                    })}
                  </TabsList>
                </Tabs>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
              
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigateSection('next')}
                disabled={!hasNextSection}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSectionViewMode("dropdown")}
              >
                <Eye className="h-4 w-4" />
              </Button>
              
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowSectionOverview(!showSectionOverview)}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Select value={selectedSection} onValueChange={setSelectedSection}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <Grid3X3 className="h-4 w-4" />
                      All Sections ({tables.length} tables)
                    </div>
                  </SelectItem>
                  {sectionStats.map(stat => {
                    const Icon = SECTION_ICONS[stat.icon as keyof typeof SECTION_ICONS] || Grid3X3
                    
                    return (
                      <SelectItem key={stat.id} value={stat.id}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" style={{ color: stat.color }} />
                          {stat.name} ({stat.tableCount} tables, {stat.occupiedCount} occupied)
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSectionViewMode("tabs")}
              >
                <Layers className="h-4 w-4" />
              </Button>
              
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowSectionOverview(!showSectionOverview)}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
              
              {/* Section Stats Summary */}
              <div className="ml-auto flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span>Available: {filteredTables.filter(t => {
                    const hasBooking = bookings.some(b => 
                      b.tables?.some((bt: any) => bt.id === t.id) &&
                      ['arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment'].includes(b.status)
                    )
                    return !hasBooking
                  }).length}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full" />
                  <span>Occupied: {filteredTables.filter(t => {
                    const hasBooking = bookings.some(b => 
                      b.tables?.some((bt: any) => bt.id === t.id) &&
                      ['arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment'].includes(b.status)
                    )
                    return hasBooking
                  }).length}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Mode Toggle */}
      {onTableUpdate && (
        <div className="absolute top-20 left-20 z-20 ">
          <Button
            size="icon"
            aria-label={editMode ? "Exit Edit Layout" : "Edit Layout"}
            variant={editMode ? "destructive" : "secondary"}
            onClick={() => {
              setEditMode(!editMode)
              // Reset drag state when exiting edit mode
              dragStateRef.current = {
                tableId: null,
                element: null,
                startX: 0,
                startY: 0,
                offsetX: 0,
                offsetY: 0,
                initialLeft: 0,
                initialTop: 0,
                animationId: null,
                touchId: null,
                isDragConfirmed: false,
                startTime: 0
              }
            }}
            className={cn(
              "shadow-md transition-all duration-200",
              editMode 
                ? "bg-red-600 hover:bg-red-700 text-white" 
                : "bg-background/90 hover:bg-background text-foreground border border-border"
            )}
          >
            {editMode ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
          </Button>
        </div>
      )}

      {/* Floor Plan Area */}
      <div className="flex-1 relative bg-gradient-to-br from-card to-muted overflow-auto px-3 md:px-6" ref={floorPlanRef}>
        <div 
          className="relative w-full h-full"
          style={{ minHeight: "600px", minWidth: "700px" }}
          onClick={(e) => {
            // Only deselect if clicking on empty space
            if (e.target === e.currentTarget) {
              setSelectedTable(null)
              setActiveMenuTable(null)
            }
          }}
        >
          {/* Render filtered tables */}
          {filteredTables.filter(t => t.is_active).map(renderTable)}
          
          {/* Empty state for sections */}
          {filteredTables.length === 0 && selectedSection !== "all" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Layers className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No Tables in This Section</h3>
                <p className="text-sm text-muted-foreground">
                  {sections?.find(s => s.id === selectedSection)?.name || "This section"} has no tables yet
                </p>
              </div>
            </div>
          )}
          
          {/* Enhanced accessibility overlay for screen readers */}
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {selectedTable && (() => {
              const selectedTableData = filteredTables.find(t => t.id === selectedTable)
              const { current } = selectedTableData ? getTableBookingInfo(selectedTableData) : { current: null }
              return `Table ${selectedTableData?.table_number} selected. ${current ? `Occupied by ${current.guest_name || current.user?.full_name || 'Guest'}, status: ${current.status.replace(/_/g, ' ')}.` : 'Available for booking.'}`
            })()}
          </div>
        </div>
        
        {/* Section Overview Overlay */}
        <SectionOverview />
      </div>
    </div>
  )
})

// Add display name for debugging
UnifiedFloorPlan.displayName = 'UnifiedFloorPlan'
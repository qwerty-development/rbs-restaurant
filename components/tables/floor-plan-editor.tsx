// components/tables/floor-plan-editor.tsx
import { useState, useRef, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { 
  Move, 
  ZoomIn, 
  ZoomOut, 
  Grid3X3, 
  Trash2,
  Printer,
  Layers,
  ChevronLeft,
  ChevronRight,
  Home,
  Trees,
  Wine,
  Lock,
  Sparkles,
  MapPin,
  Building,
  Eye,
  EyeOff,
  Maximize2,
  Info,
  Utensils
} from "lucide-react"
import type { RestaurantTable, RestaurantSection } from "@/types"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface FloorPlanEditorProps {
  restaurantId: string
  tables: RestaurantTable[]
  onTableUpdate: (tableId: string, position: { x: number; y: number }) => void
  onTableResize?: (tableId: string, dimensions: { width: number; height: number }) => void
  onTableDelete?: (tableId: string) => void
  onTableSectionChange?: (tableId: string, sectionId: string) => void
}

const TABLE_TYPE_COLORS = {
  booth: "bg-blue-50 border-blue-400 text-blue-800 shadow-blue-100",
  window: "bg-emerald-50 border-emerald-400 text-emerald-800 shadow-emerald-100",
  patio: "bg-amber-50 border-amber-400 text-amber-800 shadow-amber-100",
  standard: "bg-slate-50 border-slate-400 text-slate-800 shadow-slate-100",
  bar: "bg-purple-50 border-purple-400 text-purple-800 shadow-purple-100",
  private: "bg-rose-50 border-rose-400 text-rose-800 shadow-rose-100",
}

const TABLE_TYPE_ICONS = {
  booth: "🛋️",
  window: "🪟",
  patio: "🌿",
  standard: "🪑",
  bar: "🍺",
  private: "🔒",
}

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
  utensils: Utensils, // fallback for 'utensils' icon used in migration
}

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

interface ResizeState {
  tableId: string | null
  element: HTMLElement | null
  startX: number
  startY: number
  initialWidth: number
  initialHeight: number
  animationId: number | null
  touchId: number | null
  isResizeConfirmed: boolean
  startTime: number
}

export function FloorPlanEditor({ 
  restaurantId,
  tables, 
  onTableUpdate, 
  onTableResize, 
  onTableDelete,
  onTableSectionChange 
}: FloorPlanEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
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
  
  const resizeStateRef = useRef<ResizeState>({
    tableId: null,
    element: null,
    startX: 0,
    startY: 0,
    initialWidth: 0,
    initialHeight: 0,
    animationId: null,
    touchId: null,
    isResizeConfirmed: false,
    startTime: 0
  })
  
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [selectedSection, setSelectedSection] = useState<string>("all")
  const [zoom, setZoom] = useState(100)
  const [showGrid, setShowGrid] = useState(true)
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit")
  const [editMode, setEditMode] = useState<"move" | "resize">("move")
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [showMinimap, setShowMinimap] = useState(false)
  const [sectionViewMode, setSectionViewMode] = useState<"tabs" | "dropdown">("tabs")
  
  const supabase = createClient()
  
  // Fetch sections
  const { data: sections, isLoading: sectionsLoading } = useQuery({
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
  const filteredTables = selectedSection === "all" 
    ? tables 
    : tables.filter(table => table.section_id === selectedSection)

  // Calculate section stats
  const sectionStats = sections?.map(section => {
    const sectionTables = tables.filter(t => t.section_id === section.id)
    return {
      ...section,
      tableCount: sectionTables.length,
      totalCapacity: sectionTables.reduce((sum, t) => sum + t.max_capacity, 0)
    }
  })
  
  // Store original positions and sizes for smooth updates
  const originalPositionsRef = useRef<Record<string, { x: number; y: number }>>({})
  const finalPositionsRef = useRef<Record<string, { x: number; y: number }>>({})
  const originalSizesRef = useRef<Record<string, { width: number; height: number }>>({})
  const finalSizesRef = useRef<Record<string, { width: number; height: number }>>({})

  // Section navigation helpers
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

  // Initialize positions and sizes
  useEffect(() => {
    const positions: Record<string, { x: number; y: number }> = {}
    const sizes: Record<string, { width: number; height: number }> = {}
    
    filteredTables.forEach(table => {
      positions[table.id] = { x: table.x_position, y: table.y_position }
      sizes[table.id] = { width: table.width || 60, height: table.height || 40 }
    })
    
    originalPositionsRef.current = positions
    finalPositionsRef.current = { ...positions }
    originalSizesRef.current = sizes
    finalSizesRef.current = { ...sizes }
  }, [filteredTables])

  // Constants for touch interaction thresholds
  const TOUCH_DRAG_THRESHOLD = 8 // pixels to move before confirming drag
  const TOUCH_TAP_MAX_DURATION = 200 // milliseconds for tap vs drag
  const TOUCH_DELAY_THRESHOLD = 100 // milliseconds to wait before confirming touch action

  // Helper function to get coordinates from mouse or touch event
  const getEventCoordinates = (e: MouseEvent | TouchEvent): { clientX: number; clientY: number } => {
    if ('touches' in e && e.touches.length > 0) {
      return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY }
    } else if ('changedTouches' in e && e.changedTouches.length > 0) {
      return { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY }
    } else if ('clientX' in e) {
      return { clientX: e.clientX, clientY: e.clientY }
    }
    return { clientX: 0, clientY: 0 }
  }

  // Helper function to get touch by identifier
  const getTouchById = (touches: TouchList, touchId: number): Touch | null => {
    for (let i = 0; i < touches.length; i++) {
      if (touches[i].identifier === touchId) {
        return touches[i]
      }
    }
    return null
  }

  // Unified drag start handler for mouse and touch
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent, tableId: string) => {
    if (viewMode === "preview" || isResizing) return
    
    // Only allow dragging in move mode
    if (editMode !== "move") return
    
    // For touch events, check if this is on a resize handle
    const target = e.target as HTMLElement
    if (target.hasAttribute('data-resize-handle') || target.closest('[data-resize-handle]')) {
      return // Don't start drag if clicking on resize handle
    }
    
    const element = e.currentTarget as HTMLElement
    const containerRect = containerRef.current?.getBoundingClientRect()
    if (!containerRect) return

    const elementRect = element.getBoundingClientRect()
    
    // Get coordinates based on event type
    let clientX: number, clientY: number
    let touchId: number | null = null
    let isTouch = false
    
    if ('touches' in e && e.touches.length === 1) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
      touchId = e.touches[0].identifier
      isTouch = true
    } else if ('clientX' in e) {
      clientX = e.clientX
      clientY = e.clientY
      e.preventDefault() // Always prevent default for mouse events
    } else {
      return
    }
    
    // Calculate precise offset from touch/mouse to element's top-left
    const offsetX = clientX - elementRect.left
    const offsetY = clientY - elementRect.top
    
    // Get current position
    const currentLeft = elementRect.left - containerRect.left
    const currentTop = elementRect.top - containerRect.top

    dragStateRef.current = {
      tableId,
      element,
      startX: clientX,
      startY: clientY,
      offsetX,
      offsetY,
      initialLeft: currentLeft,
      initialTop: currentTop,
      animationId: null,
      touchId,
      isDragConfirmed: !isTouch, // For mouse, immediately confirm. For touch, wait for movement.
      startTime: Date.now()
    }

    // For mouse events, apply visual feedback immediately
    if (!isTouch) {
      element.style.cursor = 'grabbing'
      element.style.zIndex = '1000'
      element.style.transition = 'none'
      document.body.style.userSelect = 'none'
      setIsDragging(true)
    }
    // For touch events, wait to confirm drag to allow for natural scrolling
  }, [viewMode, isResizing, editMode])

  // Unified resize start handler for mouse and touch
  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent, tableId: string) => {
    console.log('🔧 Resize start triggered for table:', tableId, 'editMode:', editMode)
    
    if (viewMode === "preview" || isDragging) {
      console.log('❌ Resize blocked - viewMode:', viewMode, 'isDragging:', isDragging)
      return
    }
    
    // Only allow resizing in resize mode
    if (editMode !== "resize") {
      console.log('❌ Resize blocked - not in resize mode, current mode:', editMode)
      return
    }
    
    console.log('✅ Resize proceeding...')
    
    // Always prevent default and stop propagation for resize handles
    e.preventDefault()
    e.stopPropagation()

    // Find the table element (parent of resize handle)
    const resizeHandle = e.currentTarget as HTMLElement
    const tableElement = resizeHandle.closest('[data-table-id]') as HTMLElement
    if (!tableElement) {
      console.log('❌ No table element found')
      return
    }

    // Get current dimensions - use the stored values for accuracy
    const storedSize = finalSizesRef.current[tableId] || originalSizesRef.current[tableId]
    const currentWidth = storedSize?.width || tableElement.offsetWidth / (zoom / 100)
    const currentHeight = storedSize?.height || tableElement.offsetHeight / (zoom / 100)
    
    console.log('📏 Current size:', { width: currentWidth, height: currentHeight })

    // Get coordinates based on event type
    let clientX: number, clientY: number
    let touchId: number | null = null
    let isTouch = false
    
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
      touchId = e.touches[0].identifier
      isTouch = true
      console.log('📱 Touch resize start')
    } else if ('clientX' in e) {
      clientX = e.clientX
      clientY = e.clientY
      console.log('🖱️ Mouse resize start')
    } else {
      console.log('❌ No valid coordinates')
      return
    }

    resizeStateRef.current = {
      tableId,
      element: tableElement,
      startX: clientX,
      startY: clientY,
      initialWidth: currentWidth,
      initialHeight: currentHeight,
      animationId: null,
      touchId,
      isResizeConfirmed: true, // Always confirm immediately for resize handles (both mouse and touch)
      startTime: Date.now()
    }

    // Apply visual feedback immediately for both mouse and touch
    tableElement.style.transition = 'none'
    tableElement.classList.add('resize-active')
    tableElement.style.zIndex = '1001'
    
    // Set body cursor for both mouse and touch
    document.body.style.cursor = 'se-resize'
    document.body.style.userSelect = 'none'
    
    // For touch, also disable scrolling immediately
    if (isTouch) {
      document.body.style.overflow = 'hidden'
      tableElement.style.touchAction = 'none'
      // Add haptic feedback for touch devices
      if ('vibrate' in navigator) {
        navigator.vibrate(50)
      }
    }
    
    setIsResizing(true)
    console.log('🎯 Resize state set to true')
  }, [viewMode, isDragging, editMode, zoom])

  // Unified move handler for mouse and touch
  const handleMove = useCallback((e: MouseEvent | TouchEvent) => {
    const dragState = dragStateRef.current
    const resizeState = resizeStateRef.current

    // Handle dragging
    if (dragState.tableId && dragState.element && containerRef.current && !isResizing) {
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
      
      // For touch events, confirm drag only after sufficient movement or time
      if (!dragState.isDragConfirmed && dragState.touchId !== null) {
        const timeSinceStart = Date.now() - dragState.startTime
        
        if (distance > TOUCH_DRAG_THRESHOLD || timeSinceStart > TOUCH_DELAY_THRESHOLD) {
          // Confirm the drag and prevent default touch behavior
          e.preventDefault()
          dragState.isDragConfirmed = true
          
          // Apply visual feedback for confirmed touch drag
          dragState.element.style.cursor = 'grabbing'
          dragState.element.style.zIndex = '1000'
          dragState.element.style.transition = 'none'
          dragState.element.style.touchAction = 'none'
          document.body.style.userSelect = 'none'
          setIsDragging(true)
        } else {
          // Not enough movement yet, allow natural scrolling
          return
        }
      }
      
      // Only proceed with drag if confirmed
      if (!dragState.isDragConfirmed) return

      // Prevent default for confirmed drags
      if ('touches' in e) {
        e.preventDefault()
      }

      // Cancel any pending animation frame
      if (dragState.animationId) {
        cancelAnimationFrame(dragState.animationId)
      }

      // Use requestAnimationFrame for smooth 60fps updates
      dragState.animationId = requestAnimationFrame(() => {
        const containerRect = containerRef.current!.getBoundingClientRect()
        
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

    // Handle resizing
    if (resizeState.tableId && resizeState.element && !isDragging) {
      let coords: { clientX: number; clientY: number }
      
      // For touch events, check if it's the same touch
      if ('touches' in e && resizeState.touchId !== null) {
        const touch = getTouchById(e.touches, resizeState.touchId)
        if (!touch) return
        coords = { clientX: touch.clientX, clientY: touch.clientY }
      } else {
        coords = getEventCoordinates(e)
      }

      // Calculate movement distance
      const deltaX = coords.clientX - resizeState.startX
      const deltaY = coords.clientY - resizeState.startY
      
      // Always proceed with resize if we have a resize state (no confirmation needed for resize handles)
      if (!resizeState.isResizeConfirmed) {
        e.preventDefault()
        resizeState.isResizeConfirmed = true
        document.body.style.cursor = 'se-resize'
        document.body.style.userSelect = 'none'
        resizeState.element.style.touchAction = 'none'
        
        // For touch, also disable body scrolling
        if ('touches' in e) {
          document.body.style.overflow = 'hidden'
        }
      }

      // Always prevent default for confirmed resizes
      if ('touches' in e) {
        e.preventDefault()
      }

      // Cancel any pending animation frame
      if (resizeState.animationId) {
        cancelAnimationFrame(resizeState.animationId)
      }

      // Use requestAnimationFrame for smooth 60fps updates
      resizeState.animationId = requestAnimationFrame(() => {
        // Account for zoom level in resize calculations
        const scaledDeltaX = deltaX / (zoom / 100)
        const scaledDeltaY = deltaY / (zoom / 100)
        
        // Calculate new dimensions with minimum sizes
        const newWidth = Math.max(40, resizeState.initialWidth + scaledDeltaX)
        const newHeight = Math.max(30, resizeState.initialHeight + scaledDeltaY)
        
        // Apply size directly to DOM (super fast)
        resizeState.element!.style.width = `${newWidth}px`
        resizeState.element!.style.height = `${newHeight}px`
        
        // Update the stored size reference
        finalSizesRef.current[resizeState.tableId!] = { width: newWidth, height: newHeight }
        
        // Also update the original size reference to maintain consistency
        originalSizesRef.current[resizeState.tableId!] = { width: newWidth, height: newHeight }
      })
    }
  }, [isDragging, isResizing, zoom])

  // Unified end handler for mouse and touch
  const handleEnd = useCallback((e?: MouseEvent | TouchEvent) => {
    const dragState = dragStateRef.current
    const resizeState = resizeStateRef.current
    
    // For touch events, check if the ended touch matches our tracked touch
    if (e && 'changedTouches' in e) {
      let relevantTouch = false
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i]
        if ((dragState.touchId !== null && touch.identifier === dragState.touchId) ||
            (resizeState.touchId !== null && touch.identifier === resizeState.touchId)) {
          relevantTouch = true
          break
        }
      }
      if (!relevantTouch) return
    }
    
    // Handle drag completion
    if (dragState.tableId && dragState.element) {
      // Re-enable CSS transitions
      dragState.element.style.transition = ''
      dragState.element.style.cursor = ''
      dragState.element.style.zIndex = ''
      dragState.element.style.touchAction = ''
      
      // Save final position to database only if drag was confirmed
      if (dragState.isDragConfirmed) {
        const finalPos = finalPositionsRef.current[dragState.tableId]
        if (finalPos) {
          onTableUpdate(dragState.tableId, finalPos)
        }
      }
      
      // Cancel any pending animation
      if (dragState.animationId) {
        cancelAnimationFrame(dragState.animationId)
      }
    }
    
    // Handle resize completion
    if (resizeState.tableId && resizeState.element) {
      console.log('🏁 Resize completion for table:', resizeState.tableId)
      
      // Re-enable CSS transitions
      resizeState.element.style.transition = ''
      resizeState.element.style.touchAction = ''
      resizeState.element.style.zIndex = ''
      
      // Remove resize indicator class
      resizeState.element.classList.remove('resize-active')
      
      // Save final size to database only if resize was confirmed
      if (resizeState.isResizeConfirmed) {
        const finalSize = finalSizesRef.current[resizeState.tableId]
        console.log('💾 Saving resize to database:', finalSize)
        if (finalSize && onTableResize) {
          onTableResize(resizeState.tableId, finalSize)
        } else {
          console.log('❌ No final size or onTableResize callback:', { finalSize, onTableResize: !!onTableResize })
        }
      } else {
        console.log('❌ Resize not confirmed, not saving')
      }
      
      // Cancel any pending animation
      if (resizeState.animationId) {
        cancelAnimationFrame(resizeState.animationId)
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
    
    // Reset resize state
    resizeStateRef.current = {
      tableId: null,
      element: null,
      startX: 0,
      startY: 0,
      initialWidth: 0,
      initialHeight: 0,
      animationId: null,
      touchId: null,
      isResizeConfirmed: false,
      startTime: 0
    }
    
    // Reset body styles
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    document.body.style.overflow = '' // Reset overflow for touch devices
    
    setIsDragging(false)
    setIsResizing(false)
  }, [onTableUpdate, onTableResize])

  // Setup global event listeners for both mouse and touch
  useEffect(() => {
    // Mouse events - always passive false for mouse move to allow prevention
    document.addEventListener('mousemove', handleMove, { passive: false })
    document.addEventListener('mouseup', handleEnd)
    
    // Touch events - conditional passive based on whether we have an active touch interaction
    const handleTouchMove = (e: TouchEvent) => {
      const dragState = dragStateRef.current
      const resizeState = resizeStateRef.current
      
      // Check if this touch event is relevant to our current interaction
      let isRelevantTouch = false
      if (dragState.touchId !== null || resizeState.touchId !== null) {
        for (let i = 0; i < e.touches.length; i++) {
          const touch = e.touches[i]
          if (touch.identifier === dragState.touchId || touch.identifier === resizeState.touchId) {
            isRelevantTouch = true
            break
          }
        }
      }
      
      if (isRelevantTouch) {
        // Always prevent default for resize operations to avoid scroll conflicts
        if (resizeState.touchId !== null) {
          e.preventDefault()
        }
        handleMove(e)
      }
      // If not relevant, let the browser handle it normally for scrolling
    }
    
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleEnd)
    document.addEventListener('touchcancel', handleEnd)
    
    return () => {
      // Mouse events
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleEnd)
      
      // Touch events
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleEnd)
      document.removeEventListener('touchcancel', handleEnd)
      
      // Clean up any pending animation frames
      if (dragStateRef.current.animationId) {
        cancelAnimationFrame(dragStateRef.current.animationId)
      }
      if (resizeStateRef.current.animationId) {
        cancelAnimationFrame(resizeStateRef.current.animationId)
      }
    }
  }, [handleMove, handleEnd])

  // Table click handler
  const handleTableClick = useCallback((e: React.MouseEvent | React.TouchEvent, tableId: string) => {
    e.stopPropagation()
    
    // Check if click/touch is on resize handle
    const target = e.target as HTMLElement
    if (target.hasAttribute('data-resize-handle') || target.closest('[data-resize-handle]')) {
      return
    }
    
    // Always allow selection in edit mode (both move and resize modes)
    if (viewMode === "edit") {
      setSelectedTable(selectedTable === tableId ? null : tableId)
    }
  }, [selectedTable, viewMode])

  // Container click handler
  const handleContainerClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    // Only deselect if clicking directly on container (not on table)
    if (e.currentTarget === e.target && !isDragging && !isResizing) {
      setSelectedTable(null)
    }
  }, [isDragging, isResizing])

  // Print handler
  const handlePrint = useCallback(() => {
    // Deselect any selected table for clean print
    setSelectedTable(null)

    // Build a dedicated print document to avoid in-app layout quirks
    setTimeout(() => {
      const printWindow = window.open('', '_blank', 'width=1200,height=800')
      if (!printWindow) {
        window.print()
        return
      }

      const safeTables = (tables || []).filter(t => t.is_active)
      const getPos = (id: string, fallback: {x:number;y:number}) => finalPositionsRef.current[id] || fallback
      const getSize = (id: string, fallback: {width:number;height:number}) => finalSizesRef.current[id] || fallback

      const tablesHtml = safeTables.map((t) => {
        const pos = getPos(t.id, { x: t.x_position, y: t.y_position })
        const size = getSize(t.id, { width: t.width || 60, height: t.height || 40 })
        const radius = t.shape === 'circle' ? '50%' : '8px'
        const icon = (TABLE_TYPE_ICONS as any)[t.table_type] || ''
        return `
          <div class="tbl" style="left:${pos.x}%; top:${pos.y}%; width:${size.width}px; height:${size.height}px; border-radius:${radius};">
            <div class="num">${icon} ${t.table_number}</div>
            <div class="cap">${t.min_capacity}-${t.max_capacity} seats</div>
          </div>
        `
      }).join('')

      const gridHtml = `
        <div class="grid"></div>
      `

      const doc = printWindow.document
      doc.open()
      doc.write(`<!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Restaurant Floor Plan</title>
            <style>
              @media print {
                @page { size: landscape; margin: 0; }
                html, body { margin: 0; padding: 0; }
              }
              html, body { margin:0; padding:0; background:#fff; }
              body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Arial, sans-serif; }
              .fp { width: 100vw; height: 100vh; overflow: hidden; }
              .area { position: relative; width: 100vw; height: 100vh; background: #ffffff; }
              .grid { position:absolute; inset:0; opacity:0.15; background-image:
                linear-gradient(to right, #cbd5e1 1px, transparent 1px),
                linear-gradient(to bottom, #cbd5e1 1px, transparent 1px);
                background-size: 30px 30px; }
              .tbl { position:absolute; box-sizing:border-box; border:2px solid #333; background:#fff; color:#000;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1); display:flex; flex-direction:column; align-items:center; justify-content:center; padding:6px; }
              .num { font-weight:700; font-size:11px; margin-bottom:2px; }
              .cap { font-size:9px; opacity:0.8; }
            </style>
          </head>
          <body>
            <div class="fp">
              <div class="area">
                ${showGrid ? gridHtml : ''}
                ${tablesHtml}
              </div>
            </div>
          </body>
        </html>`)
      doc.close()

      // Give styles a moment to apply before printing
      setTimeout(() => {
        printWindow.focus()
        printWindow.print()
        setTimeout(() => printWindow.close(), 500)
      }, 250)
    }, 50)
  }, [showGrid, tables])

  // Keyboard shortcuts with optimized movement and resizing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedTable || isDragging || isResizing || viewMode === "preview") return

      const step = e.shiftKey ? 5 : 1
      let deltaX = 0, deltaY = 0
      let deltaWidth = 0, deltaHeight = 0

      switch (e.key) {
        case "Delete":
        case "Backspace":
          if (onTableDelete) {
            onTableDelete(selectedTable)
            setSelectedTable(null)
          }
          break
        case "Escape":
          setSelectedTable(null)
          break
        case "ArrowUp":
          e.preventDefault()
          if (editMode === "move") {
            deltaY = -step
          } else if (editMode === "resize") {
            deltaHeight = -step
          }
          break
        case "ArrowDown":
          e.preventDefault()
          if (editMode === "move") {
            deltaY = step
          } else if (editMode === "resize") {
            deltaHeight = step
          }
          break
        case "ArrowLeft":
          e.preventDefault()
          if (editMode === "move") {
            deltaX = -step
          } else if (editMode === "resize") {
            deltaWidth = -step
          }
          break
        case "ArrowRight":
          e.preventDefault()
          if (editMode === "move") {
            deltaX = step
          } else if (editMode === "resize") {
            deltaWidth = step
          }
          break
      }

      // Handle movement
      if ((deltaX !== 0 || deltaY !== 0) && editMode === "move") {
        const currentPos = finalPositionsRef.current[selectedTable] || 
                          { x: filteredTables.find(t => t.id === selectedTable)?.x_position || 0,
                            y: filteredTables.find(t => t.id === selectedTable)?.y_position || 0 }
        
        const newPos = {
          x: Math.max(0, Math.min(95, currentPos.x + deltaX)),
          y: Math.max(0, Math.min(90, currentPos.y + deltaY))
        }
        
        finalPositionsRef.current[selectedTable] = newPos
        
        // Update DOM immediately for visual feedback
        const element = document.querySelector(`[data-table-id="${selectedTable}"]`) as HTMLElement
        if (element && containerRef.current) {
          const containerRect = containerRef.current.getBoundingClientRect()
          element.style.left = `${(newPos.x / 100) * containerRect.width}px`
          element.style.top = `${(newPos.y / 100) * containerRect.height}px`
        }
        
        // Save to database
        onTableUpdate(selectedTable, newPos)
      }

      // Handle resizing
      if ((deltaWidth !== 0 || deltaHeight !== 0) && editMode === "resize" && onTableResize) {
        const currentSize = finalSizesRef.current[selectedTable] || 
                           originalSizesRef.current[selectedTable] ||
                           { width: 60, height: 40 }
        
        const newSize = {
          width: Math.max(40, currentSize.width + deltaWidth),
          height: Math.max(30, currentSize.height + deltaHeight)
        }
        
        finalSizesRef.current[selectedTable] = newSize
        originalSizesRef.current[selectedTable] = newSize
        
        // Update DOM immediately for visual feedback
        const element = document.querySelector(`[data-table-id="${selectedTable}"]`) as HTMLElement
        if (element) {
          element.style.width = `${newSize.width}px`
          element.style.height = `${newSize.height}px`
        }
        
        // Save to database
        onTableResize(selectedTable, newSize)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedTable, isDragging, isResizing, viewMode, editMode, filteredTables, onTableDelete, onTableUpdate, onTableResize])

  // Minimap render function
  const renderMinimap = () => {
    if (!showMinimap) return null

  return (
      <Card className="absolute bottom-4 right-4 w-48 h-32 z-50 shadow-lg">
        <CardContent className="p-2 relative h-full">
          <div className="text-xs font-medium mb-1">Overview</div>
          <div className="relative w-full h-20 bg-slate-100 rounded border">
            {/* Mini representations of all sections */}
            {sections?.map((section, idx) => {
              const sectionTables = tables.filter(t => t.section_id === section.id)
              const isActive = section.id === selectedSection
              
              return (
                <div
                  key={section.id}
                  className={cn(
                    "absolute cursor-pointer transition-all",
                    isActive ? "ring-2 ring-blue-400 bg-blue-50" : "bg-white hover:bg-slate-50"
                  )}
                  style={{
                    left: `${(idx * 30) % 90}%`,
                    top: `${Math.floor(idx / 3) * 30}%`,
                    width: "25%",
                    height: "25%",
                    border: `1px solid ${section.color}`,
                    borderRadius: "2px"
                  }}
                  onClick={() => setSelectedSection(section.id)}
                >
                  <div className="text-[6px] text-center">{sectionTables.length}</div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Section Selector */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Floor Sections
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSectionViewMode(sectionViewMode === "tabs" ? "dropdown" : "tabs")}
              >
                {sectionViewMode === "tabs" ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowMinimap(!showMinimap)}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
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
                      All Sections
                      <Badge variant="secondary" className="ml-1">
                        {tables.length}
                      </Badge>
                    </TabsTrigger>
                    
                    {sections?.map(section => {
                      const Icon = SECTION_ICONS[section.icon as keyof typeof SECTION_ICONS] || Grid3X3
                      const tableCount = tables.filter(t => t.section_id === section.id).length
                      
                      return (
                        <TabsTrigger key={section.id} value={section.id} className="gap-2">
                          <Icon className="h-4 w-4" style={{ color: section.color }} />
                          {section.name}
                          <Badge variant="secondary" className="ml-1">
                            {tableCount}
                          </Badge>
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
            </div>
          ) : (
            <Select value={selectedSection} onValueChange={setSelectedSection}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <Grid3X3 className="h-4 w-4" />
                    All Sections ({tables.length} tables)
                  </div>
                </SelectItem>
                <Separator />
                {sections?.map(section => {
                  const Icon = SECTION_ICONS[section.icon as keyof typeof SECTION_ICONS] || Grid3X3
                  const tableCount = tables.filter(t => t.section_id === section.id).length
                  
                  return (
                    <SelectItem key={section.id} value={section.id}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" style={{ color: section.color }} />
                        {section.name} ({tableCount} tables)
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          )}

          {/* Section Info */}
          {selectedSection !== "all" && sections && (
            <div className="mt-3 p-3 bg-muted rounded-lg">
              {(() => {
                const section = sections.find(s => s.id === selectedSection)
                if (!section) return null
                
                const stats = sectionStats?.find(s => s.id === selectedSection)
                const Icon = SECTION_ICONS[section.icon as keyof typeof SECTION_ICONS] || Grid3X3
                
                return (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="p-2 rounded-lg"
                        style={{ backgroundColor: section.color + "20" }}
                      >
                        <Icon className="h-5 w-5" style={{ color: section.color }} />
                      </div>
                      <div>
                        <h4 className="font-medium">{section.name}</h4>
                        {section.description && (
                          <p className="text-sm text-muted-foreground">{section.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Badge variant="outline">
                        {stats?.tableCount || 0} tables
                      </Badge>
                      <Badge variant="outline">
                        {stats?.totalCapacity || 0} seats
                      </Badge>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Print Styles */}
      <style jsx global>{`
        /* Resize active animation */
        .resize-active {
          animation: resize-pulse 1.5s ease-in-out infinite;
        }
        
        @keyframes resize-pulse {
          0%, 100% { 
            border-color: rgba(34, 197, 94, 0.8);
            box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.3);
          }
          50% { 
            border-color: rgba(34, 197, 94, 1);
            box-shadow: 0 0 0 8px rgba(34, 197, 94, 0.2);
          }
        }
        
        /* Improve resize handle visibility and touch responsiveness */
        [data-resize-handle="true"] {
          backdrop-filter: blur(2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2), 0 0 0 2px white;
        }
        
        [data-resize-handle="true"]:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3), 0 0 0 3px white;
        }
        
        [data-resize-handle="true"]:active {
          transform: scale(0.95);
        }
        
        /* Enhanced touch handle styling */
        .touch-handle {
          /* Ensure consistent appearance across browsers */
          -webkit-appearance: none;
          -moz-appearance: none;
          appearance: none;
          
          /* Better touch interaction */
          user-select: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          
          /* Disable text selection */
          -webkit-touch-callout: none;
          -webkit-tap-highlight-color: transparent;
          
          /* Better touch responsiveness */
          touch-action: none;
          
          /* Smooth transitions for touch feedback */
          transition: all 0.1s ease-out;
        }
        
        /* Active state for touch */
        .touch-handle:active,
        .touch-handle.active {
          transform: scale(1.1) !important;
          background-color: #16a34a !important;
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4), 0 0 0 4px white !important;
        }
        
        /* Subtle pulse animation for resize handles on touch devices */
        @media (hover: none) and (pointer: coarse) {
          [data-resize-handle="true"] {
            animation: gentle-pulse 2s ease-in-out infinite;
          }
          
          @keyframes gentle-pulse {
            0%, 100% { 
              transform: scale(1);
              box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2), 0 0 0 2px white;
            }
            50% { 
              transform: scale(1.05);
              box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3), 0 0 0 3px white;
            }
          }
        }
        
        @media print {
          /* Set landscape orientation with no margins to maximize space */
          @page {
            size: landscape;
            margin: 0;
          }
          
          /* When we add 'printing-floor-plan' to body, isolate print to the clone */
          body.printing-floor-plan > *:not(#print-root) {
            display: none !important;
          }
          #print-root {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            background: white !important;
            display: block !important;
          }

          /* Prevent page breaks */
          * {
            page-break-before: avoid !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }
          
          /* Remove all browser headers and footers */
          html {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            height: 100% !important;
          }
          
          body {
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            height: 100% !important;
            overflow: hidden !important;
          }
          
          /* Hide toolbars and non-essential UI in print */
          .print-hide { display: none !important; }
          
          /* Position the floor plan container properly */
          .print-floor-plan {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100% !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
            background: white !important;
            overflow: hidden !important;
            page-break-before: avoid !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }
          
          /* Hide toolbar and controls in print */
          .print-hide {
            display: none !important;
          }
          
          /* Remove title in print to maximize space */
          .print-floor-plan::before {
            display: none !important;
            content: '' !important;
          }
          
          /* Optimize floor plan container for print */
          .print-floor-plan > div {
            position: relative !important;
            padding: 0 !important;
            margin: 0 !important;
            height: 100% !important;
            width: 100% !important;
          }
          
          /* Optimize floor plan area - maximize space */
          .print-floor-plan [data-floor-plan-container="true"] {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            height: auto !important;
            width: auto !important;
            margin: 0 !important;
            background: white !important;
            border: none !important;
            border-radius: 0 !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
          }
          
          /* Ensure tables are visible and properly sized */
          .print-floor-plan [data-table-id] {
            transform: none !important;
            border: 2px solid #333 !important;
            background: white !important;
            color: black !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
            font-size: 11px !important;
            line-height: 1.3 !important;
            border-radius: 8px !important;
          }
          
          /* Hide all interactive elements */
          .print-floor-plan button,
          .print-floor-plan [data-resize-handle],
          .print-floor-plan .absolute.bottom-6,
          .print-floor-plan .absolute.-top-12 {
            display: none !important;
          }
          
          /* Optimize table text for print */
          .print-floor-plan .font-bold {
            font-weight: bold !important;
            font-size: 10px !important;
          }
          
          .print-floor-plan .text-xs {
            font-size: 8px !important;
          }
          
          .print-floor-plan .text-sm {
            font-size: 9px !important;
          }
          
          /* Remove hover effects, transitions, and interactive styles */
          .print-floor-plan *,
          .print-floor-plan *:hover,
          .print-floor-plan *:focus {
            transition: none !important;
            animation: none !important;
            transform: none !important;
            box-shadow: 0 1px 2px rgba(0,0,0,0.1) !important;
            cursor: default !important;
          }
          
          /* Ensure grid is visible if enabled */
          .print-floor-plan .opacity-20 {
            opacity: 0.15 !important;
          }
          
          /* Remove any selection indicators */
          .print-floor-plan .ring-2,
          .print-floor-plan .ring-4,
          .print-floor-plan .shadow-lg,
          .print-floor-plan .shadow-2xl {
            box-shadow: none !important;
            ring: none !important;
          }
          
          /* Optimize spacing */
          .print-floor-plan * {
            margin: 0 !important;
          }
        }
      `}</style>

      {/* Toolbar */}
      <Card className="print-hide">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Grid3X3 className="h-5 w-5" />
              Floor Plan Editor
              {(isDragging || isResizing) && (
                <Badge variant="secondary" className="text-xs animate-pulse">
                  {isDragging ? "Moving..." : "Resizing..."}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {filteredTables.filter(t => t.is_active).length} Tables
              </Badge>
              <div className="flex items-center gap-2">
                <Select value={viewMode} onValueChange={(value: "edit" | "preview") => setViewMode(value)}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="edit">Edit</SelectItem>
                    <SelectItem value="preview">Preview</SelectItem>
                  </SelectContent>
                </Select>
                {viewMode === "edit" && (
                  <div className="flex items-center bg-slate-400 rounded-md p-1">
                    <Button
                      variant={editMode === "move" ? "default" : "ghost"}
                      size="sm"
                      className="h-8 px-3 text-xs"
                      onClick={() => setEditMode("move")}
                    >
                      <Move className="h-3 w-3 mr-1" />
                      Move
                    </Button>
                    <Button
                      variant={editMode === "resize" ? "default" : "ghost"}
                      size="sm"
                      className={cn(
                        "h-8 px-3 text-xs",
                        editMode === "resize" && "bg-green-600 hover:bg-green-700 text-white"
                      )}
                      onClick={() => setEditMode("resize")}
                    >
                      <Move className="h-3 w-3 mr-1" />
                      Resize
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Zoom Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Label className="text-sm font-medium">Zoom:</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setZoom(Math.max(50, zoom - 25))}
                disabled={zoom <= 50}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <div className="w-24 px-2">
                <Slider
                  value={[zoom]}
                  onValueChange={(value) => setZoom(value[0])}
                  min={50}
                  max={200}
                  step={25}
                  className="w-full"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setZoom(Math.min(200, zoom + 25))}
                disabled={zoom >= 200}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground w-12">{zoom}%</span>
              <Button variant="ghost" size="sm" onClick={() => setZoom(100)}>
                Reset
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={showGrid ? "default" : "outline"}
                size="sm"
                onClick={() => setShowGrid(!showGrid)}
              >
                <Grid3X3 className="h-4 w-4 mr-2" />
                Grid
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
              >
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
            </div>
          </div>

          {/* Legend */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Table Types:</Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(TABLE_TYPE_COLORS).map(([type, colors]) => (
                <Badge key={type} variant="outline" className={cn("capitalize text-xs", colors)}>
                  <span className="mr-1">{TABLE_TYPE_ICONS[type as keyof typeof TABLE_TYPE_ICONS]}</span>
                  {type}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Floor Plan */}
      <Card className="overflow-hidden print-floor-plan">
        <CardContent className="p-0">
          <div
            ref={containerRef}
            className="relative bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden select-none"
            style={{ 
              height: "700px",
              width: "100%",
              position: "relative",
              // Optimize for touch scrolling when no active drag/resize
              touchAction: isDragging || isResizing ? "none" : "auto"
            }}
            data-floor-plan-container="true"
            onClick={handleContainerClick}
            onTouchEnd={handleContainerClick}
          >
            {/* Grid */}
            {showGrid && (
              <div 
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  backgroundImage: `
                    linear-gradient(to right, #cbd5e1 1px, transparent 1px),
                    linear-gradient(to bottom, #cbd5e1 1px, transparent 1px)
                  `,
                  backgroundSize: "30px 30px",
                }}
              />
            )}

            {/* Empty State */}
            {filteredTables.filter(t => t.is_active).length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Info className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No Tables in This Section</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedSection === "all" 
                      ? "Add tables to get started"
                      : "Add or move tables to this section"}
                  </p>
                </div>
              </div>
            )}

            {/* Tables */}
            {filteredTables.filter(t => t.is_active).map((table) => {
              const colors = TABLE_TYPE_COLORS[table.table_type]
              const isSelected = selectedTable === table.id
              const isBeingDragged = dragStateRef.current.tableId === table.id
              const isBeingResized = resizeStateRef.current.tableId === table.id
              
              // Use final position if available, otherwise use original
              const position = finalPositionsRef.current[table.id] || 
                             { x: table.x_position, y: table.y_position }
              
              // Use final size if available, otherwise use original
              const size = finalSizesRef.current[table.id] || 
                          { width: table.width || 60, height: table.height || 40 }
              
              return (
                <div
                  key={table.id}
                  data-table-id={table.id}
                  className={cn(
                    "absolute border-2 rounded-xl p-3 transition-all duration-150",
                    colors,
                    viewMode === "edit" && !isBeingDragged && !isBeingResized ? "hover:shadow-md hover:scale-[1.02]" : "",
                    viewMode === "edit" && editMode === "move" ? "cursor-move" : "",
                    viewMode === "edit" && editMode === "resize" ? "cursor-crosshair" : "",
                    viewMode === "preview" ? "cursor-pointer" : "",
                    isBeingDragged && "shadow-2xl scale-105 cursor-grabbing",
                    isBeingResized && "shadow-2xl ring-4 ring-green-400 ring-opacity-75 scale-[1.02] resize-active",
                    isSelected && !isBeingDragged && !isBeingResized && editMode === "resize" && "ring-2 ring-green-400 shadow-lg z-40 bg-green-50/20",
                    isSelected && !isBeingDragged && !isBeingResized && editMode === "move" && "ring-2 ring-blue-400 shadow-lg z-40"
                  )}
                  style={{
                    left: `${position.x}%`,
                    top: `${position.y}%`,
                    width: `${size.width}px`,
                    height: `${size.height}px`,
                    borderRadius: table.shape === "circle" ? "50%" : "12px",
                    transform: `scale(${zoom / 100})`,
                    transformOrigin: "top left",
                    // Optimize for performance
                    willChange: viewMode === "edit" ? "transform, left, top, width, height" : "auto",
                    // Prevent iOS bounce and ensure proper touch handling
                    // Allow natural scrolling unless this table is being dragged/resized  
                    touchAction: isBeingDragged || isBeingResized ? "none" : "manipulation",
                    // Better touch responsiveness for resize mode
                    WebkitTapHighlightColor: editMode === "resize" ? "rgba(34, 197, 94, 0.1)" : "transparent"
                  }}
                  onMouseDown={(e) => {
                    if (editMode === "move") {
                      handleDragStart(e, table.id)
                    }
                    // In resize mode, let onClick handle the selection
                  }}
                  onTouchStart={(e) => {
                    if (editMode === "move") {
                      handleDragStart(e, table.id)
                    }
                    // In resize mode, let onClick handle the selection
                  }}
                  onClick={(e) => handleTableClick(e, table.id)}
                >
                  <div className="text-center h-full flex flex-col justify-center pointer-events-none">
                    <div className="font-bold text-sm mb-1">
                      {TABLE_TYPE_ICONS[table.table_type]} {table.table_number}
                    </div>
                    <div className="text-xs opacity-75 font-medium">
                      {table.min_capacity}-{table.max_capacity} seats
                    </div>
                    {table.features && table.features.length > 0 && (
                      <div className="text-xs opacity-60 mt-1 truncate">
                        {table.features[0]}
                      </div>
                    )}
                  </div>

                  {/* Selection indicators */}
                  {isSelected && viewMode === "edit" && !isBeingDragged && !isBeingResized && (
                    <>
                      {/* Resize handle - Enhanced for touch devices - Only show in resize mode */}
                      {onTableResize && editMode === "resize" && (
                        <div 
                          data-resize-handle="true"
                          className="absolute bg-green-500 rounded-full border-2 border-white shadow-lg cursor-se-resize hover:bg-green-600 active:bg-green-700 transition-all duration-150 z-50 flex items-center justify-center touch-handle"
                          style={{
                            // Position handle at bottom-right corner - compensate for zoom
                            bottom: `${-12 / (zoom / 100)}px`,
                            right: `${-12 / (zoom / 100)}px`,
                            // Make handle size consistent regardless of zoom level, but larger for touch
                            width: `${56 / (zoom / 100)}px`,
                            height: `${56 / (zoom / 100)}px`,
                            minWidth: `${56 / (zoom / 100)}px`,
                            minHeight: `${56 / (zoom / 100)}px`,
                            // Ensure handle is touchable and responsive
                            touchAction: 'none',
                            // Better transform origin for scaling
                            transformOrigin: 'center',
                            // Ensure it's always on top and accessible
                            zIndex: 1001,
                            // Reset any inherited transforms
                            transform: 'none',
                            // Better touch target
                            WebkitTapHighlightColor: 'transparent',
                            // Ensure it captures all touch events
                            pointerEvents: 'auto'
                          }}
                          onMouseDown={(e) => handleResizeStart(e, table.id)}
                          onTouchStart={(e) => {
                            // Add immediate visual feedback for touch
                            e.currentTarget.style.transform = 'scale(1.1)'
                            e.currentTarget.style.backgroundColor = '#16a34a'
                            handleResizeStart(e, table.id)
                          }}
                          onTouchEnd={(e) => {
                            // Reset visual feedback on touch end
                            e.currentTarget.style.transform = 'none'
                            e.currentTarget.style.backgroundColor = ''
                          }}
                        >
                          {/* Visual resize icon - clearer and larger for touch */}
                          <svg 
                            className="text-white opacity-95 pointer-events-none" 
                            width={`${28 / (zoom / 100)}`}
                            height={`${28 / (zoom / 100)}`}
                            fill="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path d="M13,21H21V13H19V17.59L13.41,12L12,13.41L17.59,19H13V21M3,3V11H5V6.41L10.59,12L12,10.59L6.41,5H11V3H3Z"/>
                          </svg>
                        </div>
                      )}
                      
                      {/* Action buttons - Enhanced for touch */}
                      <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 flex gap-2 pointer-events-auto">
                        {onTableDelete && (
                          <Button 
                            size="sm" 
                            variant="destructive" 
                            className="h-10 w-10 p-0 shadow-md touch-manipulation"
                            style={{ touchAction: 'manipulation' }}
                            onClick={(e) => {
                              e.stopPropagation()
                              onTableDelete(table.id)
                              setSelectedTable(null)
                            }}
                          >
                            <Trash2 className="h-5 w-5" />
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}

            {/* Instructions */}
            <div className="absolute bottom-6 left-6 right-6">
              <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Move className="h-5 w-5 text-blue-600" />
                    <div>
                      <div className="font-medium text-sm">
                        {viewMode === "edit" ? `${editMode === "move" ? "Move Mode" : "Resize Mode"}` : "Preview Mode"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {viewMode === "edit" 
                          ? editMode === "move" 
                            ? "Touch and drag tables to move • Tap to select • Arrow keys for precise movement" 
                            : "Select a table to reveal the green resize handle • Touch and hold the green circle to resize smoothly"
                          : "Read-only view of your floor plan"
                        }
                      </div>
                    </div>
                  </div>
                  {selectedTable && (
                    <Badge variant="secondary" className="text-xs">
                      Table {filteredTables.find(t => t.id === selectedTable)?.table_number} selected
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
        
        {/* Minimap Overlay */}
        {renderMinimap()}
      </Card>
    </div>
  )
}
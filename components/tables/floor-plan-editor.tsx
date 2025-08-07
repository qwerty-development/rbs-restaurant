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
  Settings, 
  Copy,
  Trash2
} from "lucide-react"
import type { RestaurantTable } from "@/types"

interface FloorPlanEditorProps {
  tables: RestaurantTable[]
  onTableUpdate: (tableId: string, position: { x: number; y: number }) => void
  onTableResize?: (tableId: string, dimensions: { width: number; height: number }) => void
  onTableDelete?: (tableId: string) => void
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
}

export function FloorPlanEditor({ tables, onTableUpdate, onTableResize, onTableDelete }: FloorPlanEditorProps) {
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
    touchId: null
  })
  
  const resizeStateRef = useRef<ResizeState>({
    tableId: null,
    element: null,
    startX: 0,
    startY: 0,
    initialWidth: 0,
    initialHeight: 0,
    animationId: null,
    touchId: null
  })
  
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [zoom, setZoom] = useState(100)
  const [showGrid, setShowGrid] = useState(true)
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit")
  const [editMode, setEditMode] = useState<"move" | "resize">("move")
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  
  // Store original positions and sizes for smooth updates
  const originalPositionsRef = useRef<Record<string, { x: number; y: number }>>({})
  const finalPositionsRef = useRef<Record<string, { x: number; y: number }>>({})
  const originalSizesRef = useRef<Record<string, { width: number; height: number }>>({})
  const finalSizesRef = useRef<Record<string, { width: number; height: number }>>({})

  // Initialize positions and sizes
  useEffect(() => {
    const positions: Record<string, { x: number; y: number }> = {}
    const sizes: Record<string, { width: number; height: number }> = {}
    
    tables.forEach(table => {
      positions[table.id] = { x: table.x_position, y: table.y_position }
      sizes[table.id] = { width: table.width || 60, height: table.height || 40 }
    })
    
    originalPositionsRef.current = positions
    finalPositionsRef.current = { ...positions }
    originalSizesRef.current = sizes
    finalSizesRef.current = { ...sizes }
  }, [tables])

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
    
    // Only prevent default for actual drag operations, not for scrolling
    if ('touches' in e && e.touches.length === 1) {
      e.preventDefault()
    } else if ('clientX' in e) {
      e.preventDefault()
    }
    
    const element = e.currentTarget as HTMLElement
    const containerRect = containerRef.current?.getBoundingClientRect()
    if (!containerRect) return

    const elementRect = element.getBoundingClientRect()
    
    // Get coordinates based on event type
    let clientX: number, clientY: number
    let touchId: number | null = null
    
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
      touchId = e.touches[0].identifier
    } else if ('clientX' in e) {
      clientX = e.clientX
      clientY = e.clientY
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
      touchId
    }

    // Add visual feedback immediately
    element.style.cursor = 'grabbing'
    element.style.zIndex = '1000'
    element.style.transition = 'none' // Disable CSS transitions during drag
    
    // Prevent text selection and image dragging, but allow scrolling
    document.body.style.userSelect = 'none'
    // Only disable touch action on the dragged element, not the entire body
    element.style.touchAction = 'none'
    
    setIsDragging(true)
  }, [viewMode, isResizing, editMode])

  // Unified resize start handler for mouse and touch
  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent, tableId: string) => {
    if (viewMode === "preview" || isDragging) return
    
    // Only allow resizing in resize mode
    if (editMode !== "resize") return
    
    e.preventDefault()
    e.stopPropagation()

    // Find the table element (parent of resize handle)
    const resizeHandle = e.currentTarget as HTMLElement
    const tableElement = resizeHandle.closest('[data-table-id]') as HTMLElement
    if (!tableElement) return

    // Get current dimensions more accurately
    const currentWidth = tableElement.offsetWidth / (zoom / 100)
    const currentHeight = tableElement.offsetHeight / (zoom / 100)

    // Get coordinates based on event type
    let clientX: number, clientY: number
    let touchId: number | null = null
    
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
      touchId = e.touches[0].identifier
    } else if ('clientX' in e) {
      clientX = e.clientX
      clientY = e.clientY
    } else {
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
      touchId
    }

    // Add visual feedback
    tableElement.style.transition = 'none'
    document.body.style.cursor = 'se-resize'
    document.body.style.userSelect = 'none'
    // Only disable touch action on the resized element, not the entire body
    tableElement.style.touchAction = 'none'
    
    // Add resize indicator class for better visual feedback
    tableElement.classList.add('resize-active')
    
    // Temporarily increase z-index for better touch interaction
    tableElement.style.zIndex = '1001'
    
    setIsResizing(true)
  }, [viewMode, isDragging, editMode])

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

      // Cancel any pending animation frame
      if (dragState.animationId) {
        cancelAnimationFrame(dragState.animationId)
      }

      // Use requestAnimationFrame for smooth 60fps updates
      dragState.animationId = requestAnimationFrame(() => {
        const containerRect = containerRef.current!.getBoundingClientRect()
        
        // Calculate new position based on movement
        const deltaX = coords.clientX - dragState.startX
        const deltaY = coords.clientY - dragState.startY
        
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

      // Cancel any pending animation frame
      if (resizeState.animationId) {
        cancelAnimationFrame(resizeState.animationId)
      }

      // Use requestAnimationFrame for smooth 60fps updates
      resizeState.animationId = requestAnimationFrame(() => {
        const deltaX = coords.clientX - resizeState.startX
        const deltaY = coords.clientY - resizeState.startY
        
        // Account for zoom level in resize calculations
        const scaledDeltaX = deltaX / (zoom / 100)
        const scaledDeltaY = deltaY / (zoom / 100)
        
        // Calculate new dimensions with minimum sizes
        const newWidth = Math.max(40, resizeState.initialWidth + scaledDeltaX)
        const newHeight = Math.max(30, resizeState.initialHeight + scaledDeltaY)
        
        // Apply size directly to DOM (super fast)
        resizeState.element!.style.width = `${newWidth}px`
        resizeState.element!.style.height = `${newHeight}px`
        
        finalSizesRef.current[resizeState.tableId!] = { width: newWidth, height: newHeight }
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
      
      // Save final position to database
      const finalPos = finalPositionsRef.current[dragState.tableId]
      if (finalPos) {
        onTableUpdate(dragState.tableId, finalPos)
      }
      
      // Cancel any pending animation
      if (dragState.animationId) {
        cancelAnimationFrame(dragState.animationId)
      }
    }
    
    // Handle resize completion
    if (resizeState.tableId && resizeState.element) {
      // Re-enable CSS transitions
      resizeState.element.style.transition = ''
      resizeState.element.style.touchAction = ''
      resizeState.element.style.zIndex = ''
      
      // Remove resize indicator class
      resizeState.element.classList.remove('resize-active')
      
      // Save final size to database
      const finalSize = finalSizesRef.current[resizeState.tableId]
      if (finalSize && onTableResize) {
        onTableResize(resizeState.tableId, finalSize)
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
      touchId: null
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
      touchId: null
    }
    
    // Reset body styles
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    
    setIsDragging(false)
    setIsResizing(false)
  }, [onTableUpdate, onTableResize])

  // Setup global event listeners for both mouse and touch
  useEffect(() => {
    // Mouse events
    document.addEventListener('mousemove', handleMove, { passive: false })
    document.addEventListener('mouseup', handleEnd)
    
    // Touch events - using { passive: false } to allow preventDefault
    document.addEventListener('touchmove', handleMove, { passive: false })
    document.addEventListener('touchend', handleEnd, { passive: false })
    document.addEventListener('touchcancel', handleEnd, { passive: false })
    
    return () => {
      // Mouse events
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleEnd)
      
      // Touch events
      document.removeEventListener('touchmove', handleMove)
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

  // Keyboard shortcuts with optimized movement
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedTable || isDragging || isResizing || viewMode === "preview") return

      const step = e.shiftKey ? 5 : 1
      let deltaX = 0, deltaY = 0

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
          deltaY = -step
          break
        case "ArrowDown":
          e.preventDefault()
          deltaY = step
          break
        case "ArrowLeft":
          e.preventDefault()
          deltaX = -step
          break
        case "ArrowRight":
          e.preventDefault()
          deltaX = step
          break
      }

      if (deltaX !== 0 || deltaY !== 0) {
        const currentPos = finalPositionsRef.current[selectedTable] || 
                          { x: tables.find(t => t.id === selectedTable)?.x_position || 0,
                            y: tables.find(t => t.id === selectedTable)?.y_position || 0 }
        
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
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedTable, isDragging, isResizing, viewMode, tables, onTableDelete, onTableUpdate])

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <Card>
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
                {tables.filter(t => t.is_active).length} Tables
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
                      className="h-8 px-3 text-xs"
                      onClick={() => setEditMode("resize")}
                    >
                      <Settings className="h-3 w-3 mr-1" />
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
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div
            ref={containerRef}
            className="relative bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden select-none"
            style={{ 
              height: "700px",
              width: "100%",
              position: "relative"
            }}
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

            {/* Tables */}
            {tables.filter(t => t.is_active).map((table) => {
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
                    isBeingResized && "shadow-2xl ring-4 ring-green-400 ring-opacity-75 scale-[1.02]",
                    isSelected && !isBeingDragged && !isBeingResized && "ring-2 ring-blue-400 shadow-lg z-40"
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
                    touchAction: isBeingDragged || isBeingResized ? "none" : "auto"
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
                          className="absolute bg-green-500 rounded-full border-2 border-white shadow-lg cursor-se-resize hover:bg-green-600 active:bg-green-700 transition-all duration-150 z-50 flex items-center justify-center w-12 h-12 md:w-7 md:h-7"
                          style={{
                            // Position handle at bottom-right corner with better spacing
                            bottom: '-8px',
                            right: '-8px',
                            // Ensure handle is touchable and responsive
                            touchAction: 'none',
                            // Better transform origin for scaling
                            transformOrigin: 'center'
                          }}
                          onMouseDown={(e) => handleResizeStart(e, table.id)}
                          onTouchStart={(e) => handleResizeStart(e, table.id)}
                        >
                          {/* Visual resize icon - clearer for touch */}
                          <svg 
                            className="text-white opacity-95 pointer-events-none" 
                            width="20"
                            height="20"
                            fill="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path d="M13,21H21V13H19V17.59L13.41,12L12,13.41L17.59,19H13V21M3,3V11H5V6.41L10.59,12L12,10.59L6.41,5H11V3H3Z"/>
                          </svg>
                        </div>
                      )}
                      
                      {/* Action buttons */}
                      <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 flex gap-1 pointer-events-auto">
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          className="h-8 w-8 md:h-7 md:w-7 p-0 shadow-md"
                          onClick={(e) => {
                            e.stopPropagation()
                          }}
                        >
                          <Settings className="h-4 w-4 md:h-3 md:w-3" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          className="h-8 w-8 md:h-7 md:w-7 p-0 shadow-md"
                          onClick={(e) => {
                            e.stopPropagation()
                          }}
                        >
                          <Copy className="h-4 w-4 md:h-3 md:w-3" />
                        </Button>
                        {onTableDelete && (
                          <Button 
                            size="sm" 
                            variant="destructive" 
                            className="h-8 w-8 md:h-7 md:w-7 p-0 shadow-md"
                            onClick={(e) => {
                              e.stopPropagation()
                              onTableDelete(table.id)
                              setSelectedTable(null)
                            }}
                          >
                            <Trash2 className="h-4 w-4 md:h-3 md:w-3" />
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
                            ? "Drag tables to move • Tap to select • Arrow keys to nudge • Switch to Resize mode to resize" 
                            : "Tap table to select • Drag green handle to resize • Switch to Move mode to move tables"
                          : "Read-only view of your floor plan"
                        }
                      </div>
                    </div>
                  </div>
                  {selectedTable && (
                    <Badge variant="secondary" className="text-xs">
                      Table {tables.find(t => t.id === selectedTable)?.table_number} selected
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
// components/tables/floor-plan-editor.tsx
import { useState, useRef, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { 
  Move, 
  Save, 
  RotateCw, 
  ZoomIn, 
  ZoomOut, 
  Grid3X3, 
  Settings, 
  Maximize, 
  Minimize,
  Eye,
  EyeOff,
  Copy,
  Trash2
} from "lucide-react"
import type { RestaurantTable } from "@/types"

interface FloorPlanEditorProps {
  tables: RestaurantTable[]
  floorPlanId?: string
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

export function FloorPlanEditor({ tables, floorPlanId, onTableUpdate, onTableResize, onTableDelete }: FloorPlanEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [zoom, setZoom] = useState(100)
  const [showGrid, setShowGrid] = useState(true)
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit")
  const [activeInteraction, setActiveInteraction] = useState<"none" | "drag" | "resize">("none")
  
  // Single state for tracking active operation
  const interactionRef = useRef<{
    type: "none" | "drag" | "resize"
    tableId: string | null
    element: HTMLElement | null
    startX: number
    startY: number
    initialLeft: number
    initialTop: number
    initialWidth: number
    initialHeight: number
    offsetX: number
    offsetY: number
    touchId: number | null
  }>({
    type: "none",
    tableId: null,
    element: null,
    startX: 0,
    startY: 0,
    initialLeft: 0,
    initialTop: 0,
    initialWidth: 0,
    initialHeight: 0,
    offsetX: 0,
    offsetY: 0,
    touchId: null
  })
  
  // Store positions and sizes
  const positionsRef = useRef<Record<string, { x: number; y: number }>>({})
  const sizesRef = useRef<Record<string, { width: number; height: number }>>({})

  // Initialize positions and sizes
  useEffect(() => {
    const positions: Record<string, { x: number; y: number }> = {}
    const sizes: Record<string, { width: number; height: number }> = {}
    
    tables.forEach(table => {
      positions[table.id] = { x: table.x_position, y: table.y_position }
      sizes[table.id] = { width: table.width || 60, height: table.height || 40 }
    })
    
    positionsRef.current = positions
    sizesRef.current = sizes
  }, [tables])

  // Start drag operation
  const startDrag = useCallback((e: React.MouseEvent | React.TouchEvent, tableId: string) => {
    if (viewMode === "preview" || activeInteraction !== "none") return
    
    e.preventDefault()
    e.stopPropagation()
    
    const element = e.currentTarget as HTMLElement
    const containerRect = containerRef.current?.getBoundingClientRect()
    if (!containerRect) return

    const elementRect = element.getBoundingClientRect()
    
    let clientX: number, clientY: number
    let touchId: number | null = null
    
    if ('touches' in e) {
      const touch = e.touches[0]
      clientX = touch.clientX
      clientY = touch.clientY
      touchId = touch.identifier
    } else {
      clientX = (e as React.MouseEvent).clientX
      clientY = (e as React.MouseEvent).clientY
    }
    
    interactionRef.current = {
      type: "drag",
      tableId,
      element,
      startX: clientX,
      startY: clientY,
      initialLeft: elementRect.left - containerRect.left,
      initialTop: elementRect.top - containerRect.top,
      initialWidth: 0,
      initialHeight: 0,
      offsetX: clientX - elementRect.left,
      offsetY: clientY - elementRect.top,
      touchId
    }
    
    setActiveInteraction("drag")
    element.style.cursor = 'grabbing'
    element.style.zIndex = '1000'
    element.style.transition = 'none'
  }, [viewMode, activeInteraction])

  // Start resize operation
  const startResize = useCallback((e: React.MouseEvent | React.TouchEvent, tableId: string) => {
    if (viewMode === "preview" || activeInteraction !== "none") return
    
    e.preventDefault()
    e.stopPropagation()
    
    const tableElement = document.querySelector(`[data-table-id="${tableId}"]`) as HTMLElement
    if (!tableElement) return

    let clientX: number, clientY: number
    let touchId: number | null = null
    
    if ('touches' in e) {
      const touch = e.touches[0]
      clientX = touch.clientX
      clientY = touch.clientY
      touchId = touch.identifier
    } else {
      clientX = (e as React.MouseEvent).clientX
      clientY = (e as React.MouseEvent).clientY
    }

    interactionRef.current = {
      type: "resize",
      tableId,
      element: tableElement,
      startX: clientX,
      startY: clientY,
      initialLeft: 0,
      initialTop: 0,
      initialWidth: tableElement.offsetWidth,
      initialHeight: tableElement.offsetHeight,
      offsetX: 0,
      offsetY: 0,
      touchId
    }
    
    setActiveInteraction("resize")
    tableElement.style.transition = 'none'
    document.body.style.cursor = 'se-resize'
  }, [viewMode, activeInteraction])

  // Handle move for both drag and resize
  const handleMove = useCallback((e: MouseEvent | TouchEvent) => {
    const interaction = interactionRef.current
    if (interaction.type === "none" || !interaction.element || !containerRef.current) return

    let clientX: number, clientY: number
    
    if ('touches' in e) {
      if (interaction.touchId !== null) {
        const touch = Array.from(e.touches).find(t => t.identifier === interaction.touchId)
        if (!touch) return
        clientX = touch.clientX
        clientY = touch.clientY
      } else {
        return
      }
    } else {
      clientX = (e as MouseEvent).clientX
      clientY = (e as MouseEvent).clientY
    }

    if (interaction.type === "drag") {
      const containerRect = containerRef.current.getBoundingClientRect()
      const deltaX = clientX - interaction.startX
      const deltaY = clientY - interaction.startY
      
      let newLeft = interaction.initialLeft + deltaX
      let newTop = interaction.initialTop + deltaY
      
      // Apply boundaries
      const elementWidth = interaction.element.offsetWidth
      const elementHeight = interaction.element.offsetHeight
      
      newLeft = Math.max(0, Math.min(containerRect.width - elementWidth, newLeft))
      newTop = Math.max(0, Math.min(containerRect.height - elementHeight, newTop))
      
      interaction.element.style.left = `${newLeft}px`
      interaction.element.style.top = `${newTop}px`
      
      // Update position reference
      const percentX = (newLeft / containerRect.width) * 100
      const percentY = (newTop / containerRect.height) * 100
      positionsRef.current[interaction.tableId!] = { x: percentX, y: percentY }
    } 
    else if (interaction.type === "resize") {
      const deltaX = clientX - interaction.startX
      const deltaY = clientY - interaction.startY
      
      const newWidth = Math.max(50, interaction.initialWidth + deltaX)
      const newHeight = Math.max(30, interaction.initialHeight + deltaY)
      
      interaction.element.style.width = `${newWidth}px`
      interaction.element.style.height = `${newHeight}px`
      
      // Update size reference
      sizesRef.current[interaction.tableId!] = { width: newWidth, height: newHeight }
    }
  }, [])

  // End interaction
  const handleEnd = useCallback(() => {
    const interaction = interactionRef.current
    
    if (interaction.type === "drag" && interaction.tableId && interaction.element) {
      interaction.element.style.cursor = ''
      interaction.element.style.zIndex = ''
      interaction.element.style.transition = ''
      
      const position = positionsRef.current[interaction.tableId]
      if (position) {
        onTableUpdate(interaction.tableId, position)
      }
    }
    else if (interaction.type === "resize" && interaction.tableId && interaction.element) {
      interaction.element.style.transition = ''
      
      const size = sizesRef.current[interaction.tableId]
      if (size && onTableResize) {
        onTableResize(interaction.tableId, size)
      }
    }
    
    // Reset interaction state
    interactionRef.current = {
      type: "none",
      tableId: null,
      element: null,
      startX: 0,
      startY: 0,
      initialLeft: 0,
      initialTop: 0,
      initialWidth: 0,
      initialHeight: 0,
      offsetX: 0,
      offsetY: 0,
      touchId: null
    }
    
    setActiveInteraction("none")
    document.body.style.cursor = ''
  }, [onTableUpdate, onTableResize])

  // Setup global event listeners
  useEffect(() => {
    const options = { passive: false }
    
    document.addEventListener('mousemove', handleMove, options)
    document.addEventListener('mouseup', handleEnd)
    document.addEventListener('touchmove', handleMove, options)
    document.addEventListener('touchend', handleEnd, options)
    document.addEventListener('touchcancel', handleEnd, options)
    
    return () => {
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleEnd)
      document.removeEventListener('touchmove', handleMove)
      document.removeEventListener('touchend', handleEnd)
      document.removeEventListener('touchcancel', handleEnd)
    }
  }, [handleMove, handleEnd])

  // Handle table selection
  const handleTableClick = useCallback((tableId: string) => {
    if (viewMode === "edit" && activeInteraction === "none") {
      setSelectedTable(selectedTable === tableId ? null : tableId)
    }
  }, [selectedTable, viewMode, activeInteraction])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedTable || activeInteraction !== "none" || viewMode === "preview") return

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
        const currentPos = positionsRef.current[selectedTable] || 
                          { x: tables.find(t => t.id === selectedTable)?.x_position || 0,
                            y: tables.find(t => t.id === selectedTable)?.y_position || 0 }
        
        const newPos = {
          x: Math.max(0, Math.min(95, currentPos.x + deltaX)),
          y: Math.max(0, Math.min(90, currentPos.y + deltaY))
        }
        
        positionsRef.current[selectedTable] = newPos
        onTableUpdate(selectedTable, newPos)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedTable, activeInteraction, viewMode, tables, onTableDelete, onTableUpdate])

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Grid3X3 className="h-5 w-5" />
              Floor Plan Editor
              {activeInteraction !== "none" && (
                <Badge variant="secondary" className="text-xs animate-pulse">
                  {activeInteraction === "drag" ? "Moving..." : "Resizing..."}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {tables.filter(t => t.is_active).length} Tables
              </Badge>
              <Select value={viewMode} onValueChange={(value: "edit" | "preview") => setViewMode(value)}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="edit">Edit</SelectItem>
                  <SelectItem value="preview">Preview</SelectItem>
                </SelectContent>
              </Select>
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
            className="relative bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden select-none touch-none"
            style={{ height: "700px" }}
            onClick={(e) => {
              if (e.currentTarget === e.target && activeInteraction === "none") {
                setSelectedTable(null)
              }
            }}
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
              const isInteracting = interactionRef.current.tableId === table.id
              
              const position = positionsRef.current[table.id] || 
                             { x: table.x_position, y: table.y_position }
              
              const size = sizesRef.current[table.id] || 
                          { width: table.width || 60, height: table.height || 40 }
              
              return (
                <div
                  key={table.id}
                  data-table-id={table.id}
                  className={cn(
                    "absolute border-2 rounded-xl p-3 transition-all duration-150",
                    colors,
                    viewMode === "edit" && !isInteracting ? "hover:shadow-md hover:scale-[1.02]" : "",
                    viewMode === "edit" ? "cursor-move" : "cursor-pointer",
                    isInteracting && activeInteraction === "drag" && "shadow-2xl scale-105 cursor-grabbing",
                    isInteracting && activeInteraction === "resize" && "shadow-2xl ring-2 ring-green-400",
                    isSelected && !isInteracting && "ring-2 ring-blue-400 shadow-lg z-40"
                  )}
                  style={{
                    left: `${position.x}%`,
                    top: `${position.y}%`,
                    width: `${size.width}px`,
                    height: `${size.height}px`,
                    borderRadius: table.shape === "circle" ? "50%" : "12px",
                    transform: `scale(${zoom / 100})`,
                    transformOrigin: "top left",
                    touchAction: "none",
                    WebkitTouchCallout: "none",
                    WebkitUserSelect: "none"
                  }}
                  onMouseDown={(e) => {
                    if (activeInteraction === "none" && viewMode === "edit") {
                      startDrag(e, table.id)
                    }
                  }}
                  onTouchStart={(e) => {
                    if (activeInteraction === "none" && viewMode === "edit") {
                      // Check if touch is on resize handle first
                      const touch = e.touches[0]
                      const target = document.elementFromPoint(touch.clientX, touch.clientY)
                      if (target && target.hasAttribute('data-resize-handle')) {
                        return // Let resize handle's onTouchStart handle it
                      }
                      startDrag(e, table.id)
                    }
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleTableClick(table.id)
                  }}
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
                  {isSelected && viewMode === "edit" && !isInteracting && (
                    <>
                      {/* Resize handle - Simplified and larger for touch */}
                      {onTableResize && (
                        <div 
                          data-resize-handle="true"
                          className="absolute -bottom-1 -right-1 w-12 h-12 bg-blue-500 rounded-full border-3 border-white shadow-xl cursor-se-resize hover:bg-blue-600 active:bg-blue-700 transition-colors z-[60] flex items-center justify-center"
                          style={{
                            touchAction: 'none',
                            WebkitTouchCallout: 'none',
                            WebkitUserSelect: 'none',
                            pointerEvents: 'auto'
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation()
                            startResize(e, table.id)
                          }}
                          onTouchStart={(e) => {
                            e.stopPropagation()
                            startResize(e, table.id)
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                          }}
                        >
                          <svg 
                            className="w-6 h-6 text-white pointer-events-none" 
                            fill="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path d="M21,15L15,21V18H11V14H14V17L21,15M3,9L9,3V6H13V10H10V7L3,9Z"/>
                          </svg>
                        </div>
                      )}
                      
                      {/* Action buttons */}
                      <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 flex gap-1">
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          className="h-9 w-9 p-0 shadow-md"
                          onClick={(e) => {
                            e.stopPropagation()
                          }}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          className="h-9 w-9 p-0 shadow-md"
                          onClick={(e) => {
                            e.stopPropagation()
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        {onTableDelete && (
                          <Button 
                            size="sm" 
                            variant="destructive" 
                            className="h-9 w-9 p-0 shadow-md"
                            onClick={(e) => {
                              e.stopPropagation()
                              onTableDelete(table.id)
                              setSelectedTable(null)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
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
                        {viewMode === "edit" ? "Edit Mode" : "Preview Mode"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {viewMode === "edit" 
                          ? "Tap to select • Drag to move • Drag blue handle to resize" 
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
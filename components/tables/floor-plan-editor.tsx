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
  const [draggedTable, setDraggedTable] = useState<string | null>(null)
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [resizingTable, setResizingTable] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragThreshold] = useState(5) // pixels to move before dragging starts
  const [initialMousePos, setInitialMousePos] = useState({ x: 0, y: 0 })
  const [localTablePositions, setLocalTablePositions] = useState<Record<string, { x: number; y: number }>>({})
  const [localTableSizes, setLocalTableSizes] = useState<Record<string, { width: number; height: number }>>({})
  const [zoom, setZoom] = useState(100)
  const [showGrid, setShowGrid] = useState(true)
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit")
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Debounced update functions
  const debouncedUpdate = useCallback((tableId: string, position: { x: number; y: number }) => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current)
    }
    
    updateTimeoutRef.current = setTimeout(() => {
      onTableUpdate(tableId, position)
    }, 100) // Faster updates
  }, [onTableUpdate])

  const debouncedResize = useCallback((tableId: string, dimensions: { width: number; height: number }) => {
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current)
    }
    
    if (onTableResize) {
      resizeTimeoutRef.current = setTimeout(() => {
        onTableResize(tableId, dimensions)
      }, 100)
    }
  }, [onTableResize])

  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedTable) return

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
          moveTable(selectedTable, 0, -1)
          break
        case "ArrowDown":
          e.preventDefault()
          moveTable(selectedTable, 0, 1)
          break
        case "ArrowLeft":
          e.preventDefault()
          moveTable(selectedTable, -1, 0)
          break
        case "ArrowRight":
          e.preventDefault()
          moveTable(selectedTable, 1, 0)
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedTable, onTableDelete])

  const moveTable = (tableId: string, deltaX: number, deltaY: number) => {
    const table = tables.find(t => t.id === tableId)
    if (!table) return

    const currentPos = localTablePositions[tableId] || { x: table.x_position, y: table.y_position }
    const newPos = {
      x: Math.max(0, Math.min(95, currentPos.x + deltaX)),
      y: Math.max(0, Math.min(90, currentPos.y + deltaY))
    }

    setLocalTablePositions(prev => ({
      ...prev,
      [tableId]: newPos
    }))

    debouncedUpdate(tableId, newPos)
  }

  // Improved mouse handlers
  const handleTableMouseDown = (e: React.MouseEvent, tableId: string) => {
    if (viewMode === "preview") return
    
    e.preventDefault()
    e.stopPropagation()

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setInitialMousePos({ x: e.clientX, y: e.clientY })
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
    setDraggedTable(tableId)
    setIsDragging(false)
  }

  const handleResizeMouseDown = (e: React.MouseEvent, tableId: string, direction: string) => {
    e.preventDefault()
    e.stopPropagation()
    
    setResizingTable(tableId)
    setInitialMousePos({ x: e.clientX, y: e.clientY })
  }

  const handleTableClick = (e: React.MouseEvent, tableId: string) => {
    e.stopPropagation()
    
    // Only select if we didn't drag
    if (!isDragging && viewMode === "edit") {
      setSelectedTable(selectedTable === tableId ? null : tableId)
    }
  }

  const handleContainerClick = () => {
    if (!isDragging) {
      setSelectedTable(null)
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (viewMode === "preview") return

    if (draggedTable && !resizingTable) {
      // Check if we should start dragging
      const deltaX = Math.abs(e.clientX - initialMousePos.x)
      const deltaY = Math.abs(e.clientY - initialMousePos.y)
      
      if (!isDragging && (deltaX > dragThreshold || deltaY > dragThreshold)) {
        setIsDragging(true)
      }

      if (isDragging && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const x = ((e.clientX - rect.left - dragOffset.x) / rect.width) * 100
        const y = ((e.clientY - rect.top - dragOffset.y) / rect.height) * 100

        const clampedX = Math.max(0, Math.min(95, x))
        const clampedY = Math.max(0, Math.min(90, y))

        setLocalTablePositions(prev => ({
          ...prev,
          [draggedTable]: { x: clampedX, y: clampedY }
        }))

        debouncedUpdate(draggedTable, { x: clampedX, y: clampedY })
      }
    }

    if (resizingTable && onTableResize) {
      const table = tables.find(t => t.id === resizingTable)
      if (table) {
        const deltaX = e.clientX - initialMousePos.x
        const deltaY = e.clientY - initialMousePos.y
        
        const currentSize = localTableSizes[resizingTable] || { width: table.width || 60, height: table.height || 40 }
        const newSize = {
          width: Math.max(30, currentSize.width + deltaX * 0.5),
          height: Math.max(20, currentSize.height + deltaY * 0.5)
        }

        setLocalTableSizes(prev => ({
          ...prev,
          [resizingTable]: newSize
        }))

        debouncedResize(resizingTable, newSize)
        setInitialMousePos({ x: e.clientX, y: e.clientY })
      }
    }
  }

  const handleMouseUp = () => {
    if (draggedTable && isDragging) {
      const localPos = localTablePositions[draggedTable]
      if (localPos) {
        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current)
        }
        onTableUpdate(draggedTable, localPos)
      }
    }

    if (resizingTable) {
      const localSize = localTableSizes[resizingTable]
      if (localSize && onTableResize) {
        if (resizeTimeoutRef.current) {
          clearTimeout(resizeTimeoutRef.current)
        }
        onTableResize(resizingTable, localSize)
      }
    }

    // Reset all drag states
    setTimeout(() => {
      setDraggedTable(null)
      setResizingTable(null)
      setIsDragging(false)
    }, 50) // Small delay to prevent immediate click handling
  }

  const handleZoomChange = (newZoom: number[]) => {
    setZoom(newZoom[0])
  }

  const resetZoom = () => setZoom(100)

  const getTableDimensions = (table: RestaurantTable) => {
    const localSize = localTableSizes[table.id]
    const baseWidth = localSize?.width || table.width || 60
    const baseHeight = localSize?.height || table.height || 40

    return {
      width: table.shape === "circle" ? baseWidth : baseWidth,
      height: table.shape === "circle" ? baseWidth : baseHeight,
    }
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Toolbar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Grid3X3 className="h-5 w-5" />
              Floor Plan Editor
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {tables.length} Tables
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
          {/* Enhanced Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Zoom Controls */}
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
                  onValueChange={handleZoomChange}
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
              <Button variant="ghost" size="sm" onClick={resetZoom}>
                Reset
              </Button>
            </div>

            {/* View Options */}
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
                onClick={() => setViewMode(viewMode === "edit" ? "preview" : "edit")}
              >
                {viewMode === "edit" ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Enhanced Legend */}
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

      {/* Enhanced Floor Plan */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div
            ref={containerRef}
            className="relative bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden"
            style={{ 
              height: "700px"
            }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={handleContainerClick}
          >
            {/* Enhanced Grid Pattern */}
            {showGrid && (
              <div 
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage: `
                    linear-gradient(to right, #cbd5e1 1px, transparent 1px),
                    linear-gradient(to bottom, #cbd5e1 1px, transparent 1px)
                  `,
                  backgroundSize: "30px 30px",
                }}
              />
            )}

            {/* Enhanced Tables */}
            {tables.map((table) => {
              const colors = TABLE_TYPE_COLORS[table.table_type]
              const localPos = localTablePositions[table.id]
              const xPos = localPos ? localPos.x : table.x_position
              const yPos = localPos ? localPos.y : table.y_position
              const dimensions = getTableDimensions(table)
              const isSelected = selectedTable === table.id
              const isBeingDragged = draggedTable === table.id && isDragging
              const isBeingResized = resizingTable === table.id
              
              return (
                <div
                  key={table.id}
                  className={cn(
                    "absolute border-2 rounded-xl p-3 select-none transition-all duration-150",
                    colors,
                    viewMode === "edit" && !isBeingDragged ? "hover:shadow-md hover:scale-[1.02]" : "",
                    viewMode === "edit" ? "cursor-move" : "cursor-pointer",
                    isBeingDragged && "shadow-2xl z-50 scale-105 cursor-grabbing",
                    isSelected && !isBeingDragged && "ring-2 ring-blue-400 shadow-lg z-40",
                    isBeingResized && "ring-2 ring-green-400 shadow-lg z-40",
                    !table.is_active && "opacity-50 grayscale"
                  )}
                  style={{
                    left: `${xPos}%`,
                    top: `${yPos}%`,
                    width: `${dimensions.width}px`,
                    height: `${dimensions.height}px`,
                    borderRadius: table.shape === "circle" ? "50%" : "12px",
                    transform: `scale(${zoom / 100})`,
                    transformOrigin: "top left"
                  }}
                  onMouseDown={(e) => handleTableMouseDown(e, table.id)}
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

                  {/* Enhanced Selection Indicators */}
                  {isSelected && viewMode === "edit" && !isBeingDragged && (
                    <>
                      {/* Resize handles */}
                      {onTableResize && (
                        <>
                          <div 
                            className="absolute -top-2 -right-2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-md cursor-se-resize pointer-events-auto" 
                            onMouseDown={(e) => handleResizeMouseDown(e, table.id, "se")}
                          />
                          <div 
                            className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-md cursor-nw-resize pointer-events-auto"
                            onMouseDown={(e) => handleResizeMouseDown(e, table.id, "nw")}
                          />
                        </>
                      )}
                      
                      {/* Action buttons */}
                      <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 flex gap-1 pointer-events-auto">
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          className="h-7 w-7 p-0 shadow-md"
                          onClick={(e) => {
                            e.stopPropagation()
                            // Handle settings
                          }}
                        >
                          <Settings className="h-3 w-3" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          className="h-7 w-7 p-0 shadow-md"
                          onClick={(e) => {
                            e.stopPropagation()
                            // Handle copy
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        {onTableDelete && (
                          <Button 
                            size="sm" 
                            variant="destructive" 
                            className="h-7 w-7 p-0 shadow-md"
                            onClick={(e) => {
                              e.stopPropagation()
                              onTableDelete(table.id)
                              setSelectedTable(null)
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}

            {/* Enhanced Instructions */}
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
                          ? "Drag tables to move • Click to select • Use controls above" 
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

            {/* Loading Overlay */}
            {(isDragging || resizingTable) && (
              <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  {isDragging ? "Moving table..." : "Resizing table..."}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
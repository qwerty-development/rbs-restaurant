// components/tables/floor-plan-editor.tsx
import { useState, useRef, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Move, Save, RotateCw } from "lucide-react"
import type { RestaurantTable } from "@/types"

interface FloorPlanEditorProps {
  tables: RestaurantTable[]
  floorPlanId?: string
  onTableUpdate: (tableId: string, position: { x: number; y: number }) => void
}

const TABLE_TYPE_COLORS = {
  booth: "bg-blue-100 border-blue-500 text-blue-900",
  window: "bg-green-100 border-green-500 text-green-900",
  patio: "bg-yellow-100 border-yellow-500 text-yellow-900",
  standard: "bg-gray-100 border-gray-500 text-gray-900",
  bar: "bg-purple-100 border-purple-500 text-purple-900",
  private: "bg-red-100 border-red-500 text-red-900",
}

export function FloorPlanEditor({ tables, floorPlanId, onTableUpdate }: FloorPlanEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [draggedTable, setDraggedTable] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        })
      }
    }

    updateSize()
    window.addEventListener("resize", updateSize)
    return () => window.removeEventListener("resize", updateSize)
  }, [])

  const handleMouseDown = (e: React.MouseEvent, tableId: string) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
    setDraggedTable(tableId)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggedTable || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left - dragOffset.x) / rect.width) * 100
    const y = ((e.clientY - rect.top - dragOffset.y) / rect.height) * 100

    // Clamp values between 0 and 100
    const clampedX = Math.max(0, Math.min(90, x))
    const clampedY = Math.max(0, Math.min(85, y))

    onTableUpdate(draggedTable, { x: clampedX, y: clampedY })
  }

  const handleMouseUp = () => {
    setDraggedTable(null)
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(TABLE_TYPE_COLORS).map(([type, colors]) => (
          <Badge key={type} variant="outline" className={cn("capitalize", colors)}>
            {type}
          </Badge>
        ))}
      </div>

      {/* Floor Plan */}
      <Card>
        <CardContent className="p-0">
          <div
            ref={containerRef}
            className="relative bg-muted/20 rounded-lg overflow-hidden"
            style={{ height: "600px" }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Grid Pattern */}
            <div 
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: `
                  linear-gradient(to right, #ddd 1px, transparent 1px),
                  linear-gradient(to bottom, #ddd 1px, transparent 1px)
                `,
                backgroundSize: "40px 40px",
              }}
            />

            {/* Tables */}
            {tables.map((table) => {
              const colors = TABLE_TYPE_COLORS[table.table_type]
              
              return (
                <div
                  key={table.id}
                  className={cn(
                    "absolute border-2 rounded-lg p-2 cursor-move select-none transition-shadow",
                    colors,
                    draggedTable === table.id && "shadow-lg z-10",
                    !table.is_active && "opacity-50"
                  )}
                  style={{
                    left: `${table.x_position}%`,
                    top: `${table.y_position}%`,
                    width: table.shape === "circle" ? `${table.width}px` : `${table.width * 2}px`,
                    height: table.shape === "rectangle" ? `${table.height}px` : `${table.height * 2}px`,
                    borderRadius: table.shape === "circle" ? "50%" : "8px",
                  }}
                  onMouseDown={(e) => handleMouseDown(e, table.id)}
                >
                  <div className="text-center">
                    <div className="font-semibold text-sm">{table.table_number}</div>
                    <div className="text-xs opacity-75">
                      {table.min_capacity}-{table.max_capacity}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Instructions */}
            <div className="absolute bottom-4 left-4 bg-background/90 rounded-lg p-3 text-sm">
              <div className="flex items-center gap-2">
                <Move className="h-4 w-4" />
                Drag tables to rearrange
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
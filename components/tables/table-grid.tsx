// components/tables/table-grid.tsx
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Edit, 
  Users, 
  Maximize2,
  Circle,
  Square,
  Power,
  Layers,
  RectangleHorizontal,
  Filter,
  Eye,
  EyeOff,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { RestaurantTable } from "@/types"

interface TableGridProps {
  tables: RestaurantTable[]
  isLoading: boolean
  onEdit: (table: RestaurantTable) => void
  onDeactivate?: (table: RestaurantTable) => void
}

type FilterType = "active" | "inactive" | "all"

const TABLE_TYPE_CONFIG = {
  booth: { label: "Booth", color: "bg-primary" },
  window: { label: "Window", color: "bg-accent" },
  patio: { label: "Patio", color: "bg-secondary" },
  standard: { label: "Standard", color: "bg-muted" },
  bar: { label: "Bar", color: "bg-accent" },
  private: { label: "Private", color: "bg-primary" },
}

const SHAPE_ICONS = {
  rectangle: RectangleHorizontal,
  circle: Circle,
  square: Square,
}

export function TableGrid({ tables, isLoading, onEdit, onDeactivate }: TableGridProps) {
  const [filter, setFilter] = useState<FilterType>("active")

  if (isLoading) {
    return <div className="text-center py-8">Loading tables...</div>
  }

  if (tables.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">No tables added yet</p>
        </CardContent>
      </Card>
    )
  }

  // Filter tables based on status
  const filteredTables = tables.filter(table => {
    switch (filter) {
      case "active":
        return table.is_active
      case "inactive":
        return !table.is_active
      case "all":
        return true
      default:
        return true
    }
  })

  // Group filtered tables by type
  const groupedTables = filteredTables.reduce((acc, table) => {
    if (!acc[table.table_type]) {
      acc[table.table_type] = []
    }
    acc[table.table_type].push(table)
    return acc
  }, {} as Record<string, RestaurantTable[]>)

  const activeTables = tables.filter(t => t.is_active).length
  const inactiveTables = tables.filter(t => !t.is_active).length
  const totalTables = tables.length

  return (
    <div className="space-y-6">
      {/* Filter Controls */}
      <div className="flex items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filter Tables:</span>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant={filter === "active" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("active")}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            Active ({activeTables})
          </Button>
          
          <Button
            variant={filter === "inactive" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("inactive")}
            className="gap-2"
          >
            <EyeOff className="h-4 w-4" />
            Inactive ({inactiveTables})
          </Button>
          
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
            className="gap-2"
          >
            All ({totalTables})
          </Button>
        </div>
      </div>

      {/* Empty State for Filtered Results */}
      {filteredTables.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">
              No {filter === "all" ? "" : filter} tables found
            </p>
            {filter !== "all" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilter("all")}
                className="mt-2"
              >
                Show all tables
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedTables).map(([type, typeTables]) => {
          const config = TABLE_TYPE_CONFIG[type as keyof typeof TABLE_TYPE_CONFIG] || { label: type, color: "bg-muted" }
          
          return (
            <div key={type} className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={cn("w-3 h-3 rounded", config.color)} />
                <h3 className="text-lg font-semibold">{config.label} Tables</h3>
                <Badge variant="secondary">{typeTables.length}</Badge>
              </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {typeTables.map((table) => {
                const ShapeIcon = SHAPE_ICONS[table.shape]
                
                return (
                  <Card key={table.id} className={cn(
                    "relative",
                    !table.is_active && "opacity-60",
                    table.section && !table.section.is_active && "border-dashed border-muted-foreground/30"
                  )}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle 
                          className="text-lg"
                          title={`Table ${table.table_number} - ${table.table_type} (${table.min_capacity}-${table.max_capacity} guests)${table.section ? ` in ${table.section.name}` : ''}`}
                        >
                          Table {table.table_number}
                        </CardTitle>
                        <ShapeIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      {table.section && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Layers className="h-3 w-3" />
                          <span 
                            title={table.section.name.length > 20 ? table.section.name : undefined}
                            className="truncate"
                          >
                            {table.section.name}
                          </span>
                          {!table.section.is_active && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              Section Inactive
                            </Badge>
                          )}
                        </div>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{table.min_capacity}-{table.max_capacity} guests</span>
                        </div>
                        <Badge variant={table.is_active ? "default" : "secondary"}>
                          {table.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      
                      {table.features && table.features.length > 0 && (
                        <div 
                          className="flex flex-wrap gap-1"
                          title={table.features.length > 3 ? `Features: ${table.features.join(', ')}` : undefined}
                        >
                          {table.features.map((feature) => (
                            <Badge 
                              key={feature} 
                              variant="outline" 
                              className="text-xs"
                              title={feature.length > 10 ? feature : undefined}
                            >
                              {feature}
                            </Badge>
                          ))}
                        </div>
                      )}
                      
                      {table.is_combinable && (
                        <div className="text-xs text-muted-foreground">
                          <Maximize2 className="inline h-3 w-3 mr-1" />
                          Can be combined
                        </div>
                      )}
                      
                      <div className="flex gap-2 pt-2 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEdit(table)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {onDeactivate && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onDeactivate(table)}
                            disabled={!table.is_active && table.section && !table.section.is_active}
                            className={table.is_active 
                              ? "text-destructive hover:text-destructive hover:border-destructive/50"
                              : "text-green-600 hover:text-green-600 hover:border-green-500/50"
                            }
                            title={
                              !table.is_active && table.section && !table.section.is_active
                                ? "Cannot activate table - section is inactive"
                                : table.is_active ? "Deactivate table" : "Activate table"
                            }
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )
      })
      )}
    </div>
  )
}

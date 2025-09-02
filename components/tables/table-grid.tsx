// components/tables/table-grid.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Edit, 
  Trash2, 
  Users, 
  Maximize2,
  Circle,
  Square,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { RestaurantTable } from "@/types"
import { Rectangle } from "recharts"

interface TableGridProps {
  tables: RestaurantTable[]
  isLoading: boolean
  onEdit: (table: RestaurantTable) => void
  onDelete: (tableId: string) => void
}

const TABLE_TYPE_CONFIG = {
  booth: { label: "Booth", color: "bg-primary" },
  window: { label: "Window", color: "bg-accent" },
  patio: { label: "Patio", color: "bg-secondary" },
  standard: { label: "Standard", color: "bg-muted" },
  bar: { label: "Bar", color: "bg-accent" },
  private: { label: "Private", color: "bg-primary" },
}

const SHAPE_ICONS = {
  rectangle: Rectangle,
  circle: Circle,
  square: Square,
}

export function TableGrid({ tables, isLoading, onEdit, onDelete }: TableGridProps) {
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

  // Group tables by type
  const groupedTables = tables.reduce((acc, table) => {
    if (!acc[table.table_type]) {
      acc[table.table_type] = []
    }
    acc[table.table_type].push(table)
    return acc
  }, {} as Record<string, RestaurantTable[]>)

  return (
    <div className="space-y-6">
      {Object.entries(groupedTables).map(([type, typeTables]) => {
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
                    !table.is_active && "opacity-60"
                  )}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">
                          Table {table.table_number}
                        </CardTitle>
                        <ShapeIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
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
                        <div className="flex flex-wrap gap-1">
                          {table.features.map((feature) => (
                            <Badge key={feature} variant="outline" className="text-xs">
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onDelete(table.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

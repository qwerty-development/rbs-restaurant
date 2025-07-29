// app/(dashboard)/tables/page.tsx
"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { TableGrid } from "@/components/tables/table-grid"
import { FloorPlanEditor } from "@/components/tables/floor-plan-editor"
import { TableForm } from "@/components/tables/table-form"
import { toast } from "react-hot-toast"
import { Plus, Edit2, LayoutGrid, Map } from "lucide-react"
import type { RestaurantTable, FloorPlan } from "@/types"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function TablesPage() {
  const [viewMode, setViewMode] = useState<"grid" | "floor-plan">("grid")
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null)
  const [isAddingTable, setIsAddingTable] = useState(false)
  const [selectedFloorPlan, setSelectedFloorPlan] = useState<string>("")
  
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Get restaurant ID
  const [restaurantId, setRestaurantId] = useState<string>("")
  
  useEffect(() => {
    async function getRestaurantId() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: staffData } = await supabase
          .from("restaurant_staff")
          .select("restaurant_id")
          .eq("user_id", user.id)
          .single()
        
        if (staffData) {
          setRestaurantId(staffData.restaurant_id)
        }
      }
    }
    getRestaurantId()
  }, [supabase])

  // Fetch tables
  const { data: tables, isLoading: tablesLoading } = useQuery({
    queryKey: ["tables", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("table_number", { ascending: true })

      if (error) throw error
      return data as RestaurantTable[]
    },
    enabled: !!restaurantId,
  })

  // Fetch floor plans
  const { data: floorPlans } = useQuery({
    queryKey: ["floor-plans", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      
      const { data, error } = await supabase
        .from("floor_plans")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("name", { ascending: true })

      if (error) throw error
      return data as FloorPlan[]
    },
    enabled: !!restaurantId,
  })

  // Create/Update table
  const tableMutation = useMutation({
    mutationFn: async (tableData: Partial<RestaurantTable>) => {
      if (tableData.id) {
        // Update existing table
        const { error } = await supabase
          .from("restaurant_tables")
          .update(tableData)
          .eq("id", tableData.id)

        if (error) throw error
      } else {
        // Create new table
        const { error } = await supabase
          .from("restaurant_tables")
          .insert({
            ...tableData,
            restaurant_id: restaurantId,
          })

        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] })
      toast.success(selectedTable ? "Table updated" : "Table created")
      setSelectedTable(null)
      setIsAddingTable(false)
    },
    onError: () => {
      toast.error("Failed to save table")
    },
  })

  // Delete table
  const deleteTableMutation = useMutation({
    mutationFn: async (tableId: string) => {
      const { error } = await supabase
        .from("restaurant_tables")
        .update({ is_active: false })
        .eq("id", tableId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] })
      toast.success("Table deleted")
    },
    onError: () => {
      toast.error("Failed to delete table")
    },
  })

  // Get table statistics
  const getTableStats = () => {
    if (!tables) return { total: 0, active: 0, inactive: 0, byType: {} }
    
    const stats = {
      total: tables.length,
      active: tables.filter(t => t.is_active).length,
      inactive: tables.filter(t => !t.is_active).length,
      byType: {} as Record<string, number>,
    }

    tables.forEach(table => {
      stats.byType[table.table_type] = (stats.byType[table.table_type] || 0) + 1
    })

    return stats
  }

  const stats = getTableStats()

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tables</h1>
          <p className="text-muted-foreground">
            Manage your restaurant tables and floor layout
          </p>
        </div>
        <Dialog open={isAddingTable} onOpenChange={setIsAddingTable}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Table
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Table</DialogTitle>
            </DialogHeader>
            <TableForm
              onSubmit={(data) => tableMutation.mutate(data)}
              onCancel={() => setIsAddingTable(false)}
              isLoading={tableMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tables</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tables</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-muted-foreground">
              {stats.inactive} inactive
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Table Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(stats.byType).length}</div>
            <p className="text-xs text-muted-foreground">
              Different types
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Capacity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tables?.reduce((sum, t) => sum + t.capacity, 0) || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Seats available
            </p>
          </CardContent>
        </Card>
      </div>

      {/* View Toggle */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "grid" | "floor-plan")}>
        <TabsList className="grid w-[200px] grid-cols-2">
          <TabsTrigger value="grid">
            <LayoutGrid className="mr-2 h-4 w-4" />
            Grid View
          </TabsTrigger>
          <TabsTrigger value="floor-plan">
            <Map className="mr-2 h-4 w-4" />
            Floor Plan
          </TabsTrigger>
        </TabsList>

        <TabsContent value="grid" className="space-y-4">
          {/* Tables Grid */}
          <TableGrid
            tables={tables || []}
            isLoading={tablesLoading}
            onEdit={setSelectedTable}
            onDelete={(id) => deleteTableMutation.mutate(id)}
          />
        </TabsContent>

        <TabsContent value="floor-plan" className="space-y-4">
          {/* Floor Plan Editor */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Floor Plan</CardTitle>
                  <CardDescription>
                    Drag and drop tables to arrange your floor layout
                  </CardDescription>
                </div>
                {floorPlans && floorPlans.length > 0 && (
                  <Select
                    value={selectedFloorPlan}
                    onValueChange={setSelectedFloorPlan}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Select floor plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {floorPlans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <FloorPlanEditor
                tables={tables || []}
                floorPlanId={selectedFloorPlan}
                onTableUpdate={(tableId, position) => {
                  tableMutation.mutate({
                    id: tableId,
                    x_position: position.x,
                    y_position: position.y,
                  })
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Table Dialog */}
      {selectedTable && (
        <Dialog open={!!selectedTable} onOpenChange={() => setSelectedTable(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Table</DialogTitle>
            </DialogHeader>
            <TableForm
              table={selectedTable}
              onSubmit={(data) => tableMutation.mutate({ ...data, id: selectedTable.id })}
              onCancel={() => setSelectedTable(null)}
              isLoading={tableMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
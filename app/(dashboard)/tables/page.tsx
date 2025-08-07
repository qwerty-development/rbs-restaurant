// app/(dashboard)/tables/page.tsx
"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
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
import { TableCombinationsManager } from "@/components/tables/table-combinations-manager"
import { toast } from "react-hot-toast"
import { Plus, Edit2, LayoutGrid, Map, Link, RefreshCw } from "lucide-react"
import type { RestaurantTable, FloorPlan } from "@/types"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function TablesPage() {
  const [viewMode, setViewMode] = useState<"grid" | "floor-plan" | "combinations">("grid")
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

  // Fetch tables with optimized query
  const { data: tables, isLoading: tablesLoading, error: tablesError } = useQuery({
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
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: 1, // Retry once on failure
  })

  // Fetch floor plans
  const { data: floorPlans, isLoading: floorPlansLoading } = useQuery({
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
    staleTime: 60000, // 1 minute
  })

  // Fetch table combinations
  const { data: tableCombinations, isLoading: combinationsLoading } = useQuery({
    queryKey: ["table-combinations", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      
      const { data, error } = await supabase
        .from("table_combinations")
        .select(`
          *,
          primary_table:restaurant_tables!table_combinations_primary_table_id_fkey(*),
          secondary_table:restaurant_tables!table_combinations_secondary_table_id_fkey(*)
        `)
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)

      if (error) throw error
      return data
    },
    enabled: !!restaurantId,
    staleTime: 60000, // 1 minute
  })

  // Optimized table update mutation
  const tableMutation = useMutation({
    mutationFn: async (tableData: Partial<RestaurantTable>) => {
      if (tableData.id) {
        // Update existing table
        const { error } = await supabase
          .from("restaurant_tables")
          .update(tableData)
          .eq("id", tableData.id)

        if (error) throw error

        // Update combinable_with array if provided
        if (tableData.combinable_with !== undefined) {
          await supabase
            .from("restaurant_tables")
            .update({ combinable_with: tableData.combinable_with })
            .eq("id", tableData.id)
        }
      } else {
        // Create new table
        const { error } = await supabase
          .from("restaurant_tables")
          .insert({
            ...tableData,
            restaurant_id: restaurantId,
            x_position: tableData.x_position || 50,
            y_position: tableData.y_position || 50,
          })

        if (error) throw error
      }
    },
    onMutate: async (newTable) => {
      // Optimistic update for position changes
      if (newTable.id && (newTable.x_position !== undefined || newTable.y_position !== undefined)) {
        await queryClient.cancelQueries({ queryKey: ["tables", restaurantId] })
        
        const previousTables = queryClient.getQueryData<RestaurantTable[]>(["tables", restaurantId])
        
        queryClient.setQueryData<RestaurantTable[]>(["tables", restaurantId], (old) => {
          if (!old) return []
          return old.map(table => 
            table.id === newTable.id 
              ? { ...table, ...newTable }
              : table
          )
        })
        
        return { previousTables }
      }
    },
    onSuccess: () => {
      // Only show success toast for non-position updates
      if (!selectedTable || selectedTable.x_position === undefined) {
        toast.success(selectedTable ? "Table updated" : "Table created")
      }
      setSelectedTable(null)
      setIsAddingTable(false)
    },
    onError: (error, newTable, context) => {
      // Rollback optimistic update
      if (context?.previousTables) {
        queryClient.setQueryData(["tables", restaurantId], context.previousTables)
      }
      console.error("Table mutation error:", error)
      toast.error("Failed to save table")
    },
    onSettled: () => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ["tables", restaurantId] })
    },
  })

  // Delete table mutation
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

  // Create table combination mutation
  const createCombinationMutation = useMutation({
    mutationFn: async ({ primaryTableId, secondaryTableId, combinedCapacity }: {
      primaryTableId: string;
      secondaryTableId: string;
      combinedCapacity: number;
    }) => {
      const { error } = await supabase
        .from("table_combinations")
        .insert({
          restaurant_id: restaurantId,
          primary_table_id: primaryTableId,
          secondary_table_id: secondaryTableId,
          combined_capacity: combinedCapacity,
        })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["table-combinations"] })
      toast.success("Table combination created")
    },
    onError: (error) => {
      console.error("Combination error:", error)
      toast.error("Failed to create combination")
    },
  })

  // Optimized table update handlers
  const handleTableUpdate = useCallback((tableId: string, position: { x: number; y: number }) => {
    tableMutation.mutate({
      id: tableId,
      x_position: position.x,
      y_position: position.y,
    })
  }, [tableMutation])

  const handleTableResize = useCallback((tableId: string, dimensions: { width: number; height: number }) => {
    tableMutation.mutate({
      id: tableId,
      width: dimensions.width,
      height: dimensions.height,
    })
  }, [tableMutation])

  const handleTableDelete = useCallback((tableId: string) => {
    deleteTableMutation.mutate(tableId)
  }, [deleteTableMutation])

  // Memoized table statistics
  const tableStats = useMemo(() => {
    if (!tables) return { total: 0, active: 0, inactive: 0, byType: {}, totalCapacity: 0 }
    
    const stats = {
      total: tables.length,
      active: tables.filter(t => t.is_active).length,
      inactive: tables.filter(t => !t.is_active).length,
      byType: {} as Record<string, number>,
      totalCapacity: 0,
    }

    tables.forEach(table => {
      if (table.is_active) {
        stats.byType[table.table_type] = (stats.byType[table.table_type] || 0) + 1
        stats.totalCapacity += table.max_capacity
      }
    })

    return stats
  }, [tables])

  // Handle refresh
  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["tables", restaurantId] })
    queryClient.invalidateQueries({ queryKey: ["floor-plans", restaurantId] })
    queryClient.invalidateQueries({ queryKey: ["table-combinations", restaurantId] })
    toast.success("Data refreshed")
  }, [queryClient, restaurantId])

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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Dialog open={isAddingTable} onOpenChange={setIsAddingTable}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Table
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Add New Table</DialogTitle>
              </DialogHeader>
              <TableForm
                tables={tables || []}
                onSubmit={(data) => tableMutation.mutate(data)}
                onCancel={() => setIsAddingTable(false)}
                isLoading={tableMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Enhanced Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tables</CardTitle>
            {tablesLoading && <div className="w-4 h-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tableStats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tables</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tableStats.active}</div>
            <p className="text-xs text-muted-foreground">
              {tableStats.inactive} inactive
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Table Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(tableStats.byType).length}</div>
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
              {tableStats.totalCapacity}
            </div>
            <p className="text-xs text-muted-foreground">
              Seats available
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Error Handling */}
      {tablesError && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Tables</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              There was an error loading your tables. Please try refreshing the page.
            </p>
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* View Toggle */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "grid" | "floor-plan" | "combinations")}>
        <TabsList className="grid w-[300px] grid-cols-3">
          <TabsTrigger value="grid">
            <LayoutGrid className="mr-2 h-4 w-4" />
            Grid View
          </TabsTrigger>
          <TabsTrigger value="floor-plan">
            <Map className="mr-2 h-4 w-4" />
            Floor Plan
          </TabsTrigger>
          <TabsTrigger value="combinations">
            <Link className="mr-2 h-4 w-4" />
            Combinations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="grid" className="space-y-4">
          {/* Tables Grid */}
          <TableGrid
            tables={tables || []}
            isLoading={tablesLoading}
            onEdit={(table) => {
              setSelectedTable(table)
              setIsAddingTable(true)
            }}
            onDelete={handleTableDelete}
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
                    disabled={floorPlansLoading}
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
              {tablesLoading ? (
                <div className="flex items-center justify-center h-[700px]">
                  <div className="text-center">
                    <div className="w-8 h-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading tables...</p>
                  </div>
                </div>
              ) : (
                <FloorPlanEditor
                  tables={tables || []}
                  onTableUpdate={handleTableUpdate}
                  onTableResize={handleTableResize}
                  onTableDelete={handleTableDelete}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="combinations" className="space-y-4">
          <TableCombinationsManager
            tables={tables || []}
            combinations={tableCombinations || []}
            onCreateCombination={createCombinationMutation.mutate}
            onDeleteCombination={async (id) => {
              await supabase
                .from("table_combinations")
                .update({ is_active: false })
                .eq("id", id)
              queryClient.invalidateQueries({ queryKey: ["table-combinations"] })
            }}
          
          />
        </TabsContent>
      </Tabs>

      {/* Edit Table Dialog */}
      {selectedTable && isAddingTable && (
        <Dialog open={!!selectedTable} onOpenChange={() => {
          setSelectedTable(null)
          setIsAddingTable(false)
        }}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Edit Table</DialogTitle>
            </DialogHeader>
            <TableForm
              table={selectedTable}
              tables={tables || []}
              onSubmit={(data) => tableMutation.mutate({ ...data, id: selectedTable.id })}
              onCancel={() => {
                setSelectedTable(null)
                setIsAddingTable(false)
              }}
              isLoading={tableMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
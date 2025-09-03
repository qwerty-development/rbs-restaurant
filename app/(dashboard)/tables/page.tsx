// app/(dashboard)/tables/page.tsx - Updated version with sections
"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TableGrid } from "@/components/tables/table-grid"
import { FloorPlanEditor } from "@/components/tables/floor-plan-editor"
import { TableForm } from "@/components/tables/table-form"
import { SectionManager } from "@/components/tables/section-manager"
import { TableCombinationsManager } from "@/components/tables/table-combinations-manager"
import { useTableCombinations, useCreateTableCombination, useDeleteTableCombination } from "@/lib/hooks/use-table-combinations"
import { toast } from "react-hot-toast"
import { 
  Plus, 
  LayoutGrid, 
  Map, 
  Link, 
  RefreshCw, 
  Layers,
  Settings,
  Info,
  Building
} from "lucide-react"
import type { RestaurantTable, RestaurantSection } from "@/types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { SharedTablesOverview } from "@/components/shared-tables"
import { Separator } from "@/components/ui/separator"

export default function TablesPage() {
  const [viewMode, setViewMode] = useState<"sections" | "grid" | "floor-plan" | "combinations">("sections")
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null)
  const [isAddingTable, setIsAddingTable] = useState(false)
  const [selectedSectionId, setSelectedSectionId] = useState<string>("all")
  const [showSectionManager, setShowSectionManager] = useState(false)
  
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

  // Fetch tables with section information
  const { data: tables, isLoading: tablesLoading, error: tablesError } = useQuery({
    queryKey: ["tables-with-sections", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select(`
          *,
          section:restaurant_sections(*)
        `)
        .eq("restaurant_id", restaurantId)
        .order("table_number", { ascending: true })

      if (error) throw error
      return data as RestaurantTable[]
    },
    enabled: !!restaurantId,
  })

  // Fetch sections with table counts for management
  const { data: sections, isLoading: sectionsLoading } = useQuery({
    queryKey: ["restaurant-sections-with-counts", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      
      // Fetch sections (including disabled ones for management)
      const { data: sectionsData, error: sectionsError } = await supabase
        .from("restaurant_sections")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("display_order", { ascending: true })

      if (sectionsError) throw sectionsError
      if (!sectionsData) return []

      // Fetch all tables (active and inactive) for each section
      const { data: tablesData, error: tablesError } = await supabase
        .from("restaurant_tables")
        .select("section_id, id, is_active")
        .eq("restaurant_id", restaurantId)

      if (tablesError) throw tablesError

      // Count active and inactive tables per section
      const tableCounts = tablesData?.reduce((acc, table) => {
        if (table.section_id) {
          if (!acc[table.section_id]) {
            acc[table.section_id] = { active: 0, inactive: 0 }
          }
          if (table.is_active) {
            acc[table.section_id].active += 1
          } else {
            acc[table.section_id].inactive += 1
          }
        }
        return acc
      }, {} as Record<string, { active: number; inactive: number }>)

      // Add table counts to sections
      return sectionsData.map(section => ({
        ...section,
        active_table_count: tableCounts?.[section.id]?.active || 0,
        inactive_table_count: tableCounts?.[section.id]?.inactive || 0,
        table_count: (tableCounts?.[section.id]?.active || 0) + (tableCounts?.[section.id]?.inactive || 0)
      })) as RestaurantSection[]
    },
    enabled: !!restaurantId,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Fetch table combinations
  const { data: tableCombinations, isLoading: combinationsLoading } = useTableCombinations(restaurantId)
  
  // Table combination mutations
  const createCombinationMutation = useCreateTableCombination()
  const deleteCombinationMutation = useDeleteTableCombination()

  // Table mutations
  const tableMutation = useMutation({
    mutationFn: async (tableData: Partial<RestaurantTable>) => {
      const dataToSave = {
        ...tableData,
        restaurant_id: restaurantId,
      }

      if (selectedTable) {
        const { error } = await supabase
          .from("restaurant_tables")
          .update(dataToSave)
          .eq("id", selectedTable.id)
        if (error) throw error
      } else {
        // Set default position based on section
        if (!dataToSave.x_position) {
          dataToSave.x_position = 50
          dataToSave.y_position = 50
        }
        
        const { error } = await supabase
          .from("restaurant_tables")
          .insert(dataToSave)
        if (error) throw error
      }
    },
    onSuccess: () => {
      // Use refetchQueries to ensure fresh data
      queryClient.refetchQueries({ queryKey: ["tables-with-sections", restaurantId] })
      queryClient.refetchQueries({ queryKey: ["restaurant-sections-with-counts", restaurantId] })
      queryClient.refetchQueries({ queryKey: ["restaurant-sections-active", restaurantId] })
      toast.success(selectedTable ? "Table updated" : "Table created")
      setIsAddingTable(false)
      setSelectedTable(null)
    },
    onError: (error: any) => {
      console.error("Table mutation error:", error)
      toast.error("Failed to save table")
    },
  })

  const updateTablePosition = useMutation({
    mutationFn: async ({ tableId, position }: { tableId: string; position: { x: number; y: number } }) => {
      const { error } = await supabase
        .from("restaurant_tables")
        .update({
          x_position: position.x,
          y_position: position.y,
        })
        .eq("id", tableId)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables-with-sections", restaurantId] })
    },
    onError: (error: any) => {
      console.error("Position update error:", error)
      toast.error("Failed to update table position")
    },
  })

  const updateTableSize = useMutation({
    mutationFn: async ({ tableId, dimensions }: { tableId: string; dimensions: { width: number; height: number } }) => {
      const { error } = await supabase
        .from("restaurant_tables")
        .update({
          width: dimensions.width,
          height: dimensions.height,
        })
        .eq("id", tableId)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables-with-sections", restaurantId] })
      toast.success("Table size updated successfully")
    },
    onError: (error: any) => {
      console.error("Size update error:", error)
      toast.error("Failed to update table size")
    },
  })

  const updateTableSection = useMutation({
    mutationFn: async ({ tableId, sectionId }: { tableId: string; sectionId: string }) => {
      const { error } = await supabase
        .from("restaurant_tables")
        .update({ section_id: sectionId })
        .eq("id", tableId)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["tables-with-sections", restaurantId] })
      queryClient.refetchQueries({ queryKey: ["restaurant-sections-with-counts", restaurantId] })
      queryClient.refetchQueries({ queryKey: ["restaurant-sections-active", restaurantId] })
      toast.success("Table moved to new section")
    },
    onError: (error: any) => {
      console.error("Section update error:", error)
      toast.error("Failed to move table to section")
    },
  })

  const toggleTableStatusMutation = useMutation({
    mutationFn: async ({ tableId, isActive }: { tableId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("restaurant_tables")
        .update({ is_active: isActive })
        .eq("id", tableId)
      
      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.refetchQueries({ queryKey: ["tables-with-sections", restaurantId] })
      queryClient.refetchQueries({ queryKey: ["restaurant-sections-with-counts", restaurantId] })
      toast.success(variables.isActive ? "Table activated successfully" : "Table deactivated successfully")
    },
    onError: (error: any) => {
      console.error("Table status toggle error:", error)
      toast.error("Failed to update table status")
    },
  })

  // Handlers
  const handleEdit = (table: RestaurantTable) => {
    setSelectedTable(table)
    setIsAddingTable(true)
  }

  const handleToggleStatus = (table: RestaurantTable) => {
    // Check if trying to activate a table in a deactivated section
    if (!table.is_active && table.section && !table.section.is_active) {
      toast.error(`Cannot activate table in deactivated section "${table.section.name}". Please activate the section first.`)
      return
    }

    const message = table.is_active 
      ? `Are you sure you want to deactivate Table ${table.table_number}? This will make it unavailable for bookings.`
      : `Are you sure you want to activate Table ${table.table_number}? This will make it available for bookings.`
    
    if (confirm(message)) {
      toggleTableStatusMutation.mutate({ tableId: table.id, isActive: !table.is_active })
    }
  }

  const handleAdd = () => {
    setSelectedTable(null)
    setIsAddingTable(true)
  }


  const handleTableUpdate = (tableId: string, position: { x: number; y: number }) => {
    updateTablePosition.mutate({ tableId, position })
  }

  const handleTableResize = (tableId: string, dimensions: { width: number; height: number }) => {
    updateTableSize.mutate({ tableId, dimensions })
  }

  const handleTableSectionChange = (tableId: string, sectionId: string) => {
    updateTableSection.mutate({ tableId, sectionId })
  }

  const handleCreateCombination = (data: {
    primaryTableId: string
    secondaryTableId: string
    combinedCapacity: number
  }) => {
    if (!restaurantId) return
    
    createCombinationMutation.mutate({
      restaurantId,
      ...data,
    })
  }

  const handleDeleteCombination = (id: string) => {
    if (!restaurantId) return
    
    if (confirm("Are you sure you want to delete this table combination?")) {
      deleteCombinationMutation.mutate({ id, restaurantId })
    }
  }

  // Calculate statistics
  const totalTables = tables?.length || 0
  const totalCapacity = tables?.reduce((sum, t) => sum + t.max_capacity, 0) || 0
  const sectionsWithTables = new Set(tables?.map(t => t.section_id).filter(Boolean)).size

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Table Management</h1>
        <p className="text-muted-foreground">
          Organize and manage your restaurant tables with sections
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Tables</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTables}</div>
            <p className="text-xs text-muted-foreground">Active tables</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Capacity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCapacity}</div>
            <p className="text-xs text-muted-foreground">Maximum seats</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sections?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              {sectionsWithTables} with tables
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg per Section</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sections?.length ? Math.round(totalTables / sections.length) : 0}
            </div>
            <p className="text-xs text-muted-foreground">Tables per section</p>
          </CardContent>
        </Card>
      </div>

      {/* Check if sections exist */}
      {sections && sections.length === 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>No Sections Found</AlertTitle>
          <AlertDescription className="mt-2">
            <p>You need to create at least one section before adding tables.</p>
            <Button 
              className="mt-3"
              onClick={() => setShowSectionManager(true)}
            >
              <Layers className="h-4 w-4 mr-2" />
              Create Your First Section
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="sections" className="gap-2">
              <Layers className="h-4 w-4" />
              Sections
            </TabsTrigger>
            <TabsTrigger value="floor-plan" className="gap-2">
              <Map className="h-4 w-4" />
              Floor Plan
            </TabsTrigger>
            <TabsTrigger value="grid" className="gap-2">
              <LayoutGrid className="h-4 w-4" />
              Grid View
            </TabsTrigger>
            <TabsTrigger value="combinations" className="gap-2">
              <Link className="h-4 w-4" />
              Combinations
            </TabsTrigger>
            <TabsTrigger value="shared-tables" className="gap-2">
              <Building className="h-4 w-4" />
              Shared Tables
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                queryClient.refetchQueries({ queryKey: ["tables-with-sections", restaurantId] })
                queryClient.refetchQueries({ queryKey: ["restaurant-sections-with-counts", restaurantId] })
                queryClient.refetchQueries({ queryKey: ["restaurant-sections-active", restaurantId] })
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            
            {viewMode === "sections" && (
              <Button
                variant="outline"
                onClick={() => setShowSectionManager(true)}
              >
                <Settings className="h-4 w-4 mr-2" />
                Manage Sections
              </Button>
            )}
            
            <Button 
              onClick={handleAdd}
              disabled={!sections || sections.length === 0}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Table
            </Button>
          </div>
        </div>

        {/* Sections View */}
        <TabsContent value="sections" className="space-y-6">
          <SectionManager
            restaurantId={restaurantId}
            onSectionSelect={setSelectedSectionId}
            selectedSectionId={selectedSectionId}
          />
          
          <Separator />
          
          {/* Tables in selected section */}
          {selectedSectionId && selectedSectionId !== "all" && (
            <Card>
              <CardHeader>
                <CardTitle>
                  Tables in {sections?.find(s => s.id === selectedSectionId)?.name || "Section"}
                </CardTitle>
                <CardDescription>
                  Manage tables assigned to this section
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TableGrid
                  tables={tables?.filter(t => t.section_id === selectedSectionId) || []}
                  isLoading={tablesLoading}
                  onEdit={handleEdit}
                  onDeactivate={handleToggleStatus}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Floor Plan View */}
        <TabsContent value="floor-plan">
          <FloorPlanEditor
            restaurantId={restaurantId}
            tables={tables || []}
            onTableUpdate={handleTableUpdate}
            onTableResize={handleTableResize}
            onTableSectionChange={handleTableSectionChange}
          />
        </TabsContent>

        {/* Grid View */}
        <TabsContent value="grid">
          <TableGrid
            tables={tables || []}
            isLoading={tablesLoading}
            onEdit={handleEdit}
            onDeactivate={handleToggleStatus}
          />
        </TabsContent>

        {/* Combinations View */}
        <TabsContent value="combinations">
          <TableCombinationsManager
            tables={tables || []}
            combinations={tableCombinations || []}
            onCreateCombination={handleCreateCombination}
            onDeleteCombination={handleDeleteCombination}
          />
        </TabsContent>

        {/* Shared Tables View */}
        <TabsContent value="shared-tables">
          <SharedTablesOverview restaurantId={restaurantId} />
        </TabsContent>
      </Tabs>

      {/* Table Form Dialog */}
      <Dialog open={isAddingTable} onOpenChange={setIsAddingTable}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedTable ? "Edit Table" : "Add New Table"}
            </DialogTitle>
          </DialogHeader>
          <TableForm
            table={selectedTable || undefined}
            tables={tables || []}
            restaurantId={restaurantId}
            onSubmit={(data) => tableMutation.mutate(data)}
            onCancel={() => {
              setIsAddingTable(false)
              setSelectedTable(null)
            }}
            isLoading={tableMutation.isPending}
            defaultSectionId={selectedSectionId !== "all" ? selectedSectionId : undefined}
          />
        </DialogContent>
      </Dialog>

      {/* Section Manager Dialog */}
      <Dialog open={showSectionManager} onOpenChange={setShowSectionManager}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Manage Restaurant Sections
            </DialogTitle>
          </DialogHeader>
          <SectionManager
            restaurantId={restaurantId}
            onSectionSelect={(id) => {
              setSelectedSectionId(id)
              setShowSectionManager(false)
              setViewMode("sections")
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
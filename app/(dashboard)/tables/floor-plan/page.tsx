// app/(dashboard)/tables/floor-plan/page.tsx
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "react-hot-toast"
import { 
  Plus, 
  Edit,
  Trash2,
  ArrowLeft,
  Layers,
  Square,
  Circle,
  Grid,
  Move,
  RotateCw,
  Users,
  Settings
} from "lucide-react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"

const floorPlanFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  description: z.string().optional(),
  width: z.number().min(100).max(2000).default(800).optional(),
  height: z.number().min(100).max(2000).default(600).optional(),
  isDefault: z.boolean().default(false).optional(),
})

type FloorPlanFormData = z.infer<typeof floorPlanFormSchema>

type FloorPlan = {
  id: string
  restaurant_id: string
  name: string
  svg_layout: string | null
  width: number
  height: number
  is_default: boolean
  created_at: string
}

type RestaurantTable = {
  id: string
  restaurant_id: string
  table_number: string
  table_type: "booth" | "window" | "patio" | "standard" | "bar" | "private"
  capacity: number
  x_position: number
  y_position: number
  shape: "rectangle" | "circle" | "square"
  width: number
  height: number
  is_active: boolean
  features: string[] | null
  min_capacity: number
  max_capacity: number
  is_combinable: boolean
  priority_score: number
}

const TABLE_TYPE_COLORS = {
  booth: "#8B5CF6",
  window: "#06B6D4", 
  patio: "#10B981",
  standard: "#6B7280",
  bar: "#F59E0B",
  private: "#EF4444"
}

const TABLE_TYPE_LABELS = {
  booth: "Booth",
  window: "Window",
  patio: "Patio", 
  standard: "Standard",
  bar: "Bar",
  private: "Private"
}

export default function FloorPlanPage() {
  const router = useRouter()
  const supabase = createClient()
  const queryClient = useQueryClient()
  
  const [selectedFloorPlan, setSelectedFloorPlan] = useState<string>("")
  const [isAddingFloorPlan, setIsAddingFloorPlan] = useState(false)
  const [isEditingFloorPlan, setIsEditingFloorPlan] = useState(false)
  const [draggedTable, setDraggedTable] = useState<string | null>(null)
  const [showTablesByType, setShowTablesByType] = useState<string>("all")
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
  })

  // Set default floor plan
  useEffect(() => {
    if (floorPlans && floorPlans.length > 0 && !selectedFloorPlan) {
      const defaultPlan = floorPlans.find(p => p.is_default) || floorPlans[0]
      setSelectedFloorPlan(defaultPlan.id)
    }
  }, [floorPlans, selectedFloorPlan])

  // Fetch all restaurant tables
  const { data: tables } = useQuery({
    queryKey: ["restaurant-tables", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("table_number", { ascending: true })

      if (error) throw error
      return data as RestaurantTable[]
    },
    enabled: !!restaurantId,
  })

  // Group tables by type
  const tablesByType = tables?.reduce((acc, table) => {
    if (!acc[table.table_type]) {
      acc[table.table_type] = []
    }
    acc[table.table_type].push(table)
    return acc
  }, {} as Record<string, RestaurantTable[]>) || {}

  // Filter tables for display
  const displayTables = showTablesByType === "all" 
    ? tables || []
    : tablesByType[showTablesByType] || []

  // Forms
  const floorPlanForm = useForm<FloorPlanFormData>({
    resolver: zodResolver(floorPlanFormSchema),
    defaultValues: {
      name: "",
      description: "",
      width: 800,
      height: 600,
      isDefault: false,
    },
  })

  // Create floor plan mutation
  const createFloorPlanMutation = useMutation({
    mutationFn: async (data: FloorPlanFormData) => {
      // If setting as default, unset other defaults
      if (data.isDefault) {
        await supabase
          .from("floor_plans")
          .update({ is_default: false })
          .eq("restaurant_id", restaurantId)
      }

      const { data: newPlan, error } = await supabase
        .from("floor_plans")
        .insert({
          restaurant_id: restaurantId,
          name: data.name,
          width: data.width,
          height: data.height,
          is_default: data.isDefault,
        })
        .select()
        .single()

      if (error) throw error
      return newPlan
    },
    onSuccess: (newPlan) => {
      queryClient.invalidateQueries({ queryKey: ["floor-plans"] })
      toast.success("Floor plan created")
      setSelectedFloorPlan(newPlan.id)
      setIsAddingFloorPlan(false)
      floorPlanForm.reset()
    },
    onError: () => {
      toast.error("Failed to create floor plan")
    },
  })

  // Update floor plan mutation
  const updateFloorPlanMutation = useMutation({
    mutationFn: async ({ planId, data }: { planId: string; data: FloorPlanFormData }) => {
      // If setting as default, unset other defaults
      if (data.isDefault) {
        await supabase
          .from("floor_plans")
          .update({ is_default: false })
          .eq("restaurant_id", restaurantId)
      }

      const { error } = await supabase
        .from("floor_plans")
        .update({
          name: data.name,
          width: data.width,
          height: data.height,
          is_default: data.isDefault,
        })
        .eq("id", planId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["floor-plans"] })
      toast.success("Floor plan updated")
      setIsEditingFloorPlan(false)
      floorPlanForm.reset()
    },
    onError: () => {
      toast.error("Failed to update floor plan")
    },
  })

  // Delete floor plan mutation
  const deleteFloorPlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase
        .from("floor_plans")
        .delete()
        .eq("id", planId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["floor-plans"] })
      toast.success("Floor plan deleted")
      if (floorPlans && floorPlans.length > 1) {
        const remainingPlans = floorPlans.filter(p => p.id !== selectedFloorPlan)
        setSelectedFloorPlan(remainingPlans[0]?.id || "")
      }
    },
    onError: () => {
      toast.error("Failed to delete floor plan")
    },
  })

  // Update table position
  const updateTablePositionMutation = useMutation({
    mutationFn: async ({ tableId, position }: { 
      tableId: string; 
      position: { x: number; y: number };
    }) => {
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
      queryClient.invalidateQueries({ queryKey: ["restaurant-tables"] })
    },
    onError: () => {
      toast.error("Failed to update table position")
    },
  })

  const currentFloorPlan = floorPlans?.find(p => p.id === selectedFloorPlan)

  const handleTableDrop = (e: React.DragEvent, tableId: string) => {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.max(0, Math.min(e.clientX - rect.left - 40, (currentFloorPlan?.width || 800) - 80)) // Account for table size
    const y = Math.max(0, Math.min(e.clientY - rect.top - 40, (currentFloorPlan?.height || 600) - 80))
    
    updateTablePositionMutation.mutate({
      tableId,
      position: { x, y },
    })
    setDraggedTable(null)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => router.push("/dashboard/tables")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Tables
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Floor Plan Management</h1>
        <p className="text-muted-foreground">
          Design your restaurant layout and position tables
        </p>
      </div>

      {/* Floor Plan Selector */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Floor Plans</CardTitle>
            <Dialog open={isAddingFloorPlan} onOpenChange={setIsAddingFloorPlan}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Floor Plan
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Floor Plan</DialogTitle>
                  <DialogDescription>
                    Add a new floor plan for your restaurant
                  </DialogDescription>
                </DialogHeader>
                <Form {...floorPlanForm}>
                  <form onSubmit={floorPlanForm.handleSubmit((data) => createFloorPlanMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={floorPlanForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Main Floor, Terrace, etc."
                              {...field}
                              disabled={createFloorPlanMutation.isPending}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={floorPlanForm.control}
                        name="width"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Width (px)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value))}
                                disabled={createFloorPlanMutation.isPending}
                                min="100"
                                max="2000"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={floorPlanForm.control}
                        name="height"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Height (px)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value))}
                                disabled={createFloorPlanMutation.isPending}
                                min="100"
                                max="2000"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={floorPlanForm.control}
                      name="isDefault"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4"
                              disabled={createFloorPlanMutation.isPending}
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-normal">
                            Set as default floor plan
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                    
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsAddingFloorPlan(false)}
                        disabled={createFloorPlanMutation.isPending}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createFloorPlanMutation.isPending}>
                        {createFloorPlanMutation.isPending ? "Creating..." : "Create"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {floorPlansLoading ? (
            <div className="text-center py-4">Loading floor plans...</div>
          ) : floorPlans && floorPlans.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {floorPlans.map((plan) => (
                <div key={plan.id} className="flex items-center gap-2">
                  <Button
                    variant={selectedFloorPlan === plan.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedFloorPlan(plan.id)}
                  >
                    <Layers className="mr-2 h-4 w-4" />
                    {plan.name}
                    {plan.is_default && (
                      <Badge variant="secondary" className="ml-2">
                        Default
                      </Badge>
                    )}
                  </Button>
                  {selectedFloorPlan === plan.id && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setIsEditingFloorPlan(true)
                          floorPlanForm.reset({
                            name: plan.name,
                            width: plan.width,
                            height: plan.height,
                            isDefault: plan.is_default,
                          })
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {floorPlans.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Delete this floor plan?")) {
                              deleteFloorPlanMutation.mutate(plan.id)
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground mb-4">No floor plans created yet</p>
              <Button onClick={() => setIsAddingFloorPlan(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Floor Plan
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedFloorPlan && currentFloorPlan && (
        <>
          {/* Table Type Filter */}
          <Card>
            <CardHeader>
              <CardTitle>Table Filter</CardTitle>
              <CardDescription>
                Show tables by type on the floor plan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={showTablesByType === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowTablesByType("all")}
                >
                  All Tables ({tables?.length || 0})
                </Button>
                {Object.entries(TABLE_TYPE_LABELS).map(([type, label]) => {
                  const count = tablesByType[type]?.length || 0
                  return (
                    <Button
                      key={type}
                      variant={showTablesByType === type ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowTablesByType(type)}
                      className="gap-2"
                    >
                      <div
                        className="h-3 w-3 rounded"
                        style={{ backgroundColor: TABLE_TYPE_COLORS[type as keyof typeof TABLE_TYPE_COLORS] }}
                      />
                      {label} ({count})
                    </Button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Floor Layout Designer */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Floor Layout: {currentFloorPlan.name}</CardTitle>
                  <CardDescription>
                    Drag tables to arrange your floor plan • Size: {currentFloorPlan.width}×{currentFloorPlan.height}px
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline">
                    <Users className="mr-1 h-3 w-3" />
                    {displayTables.length} tables
                  </Badge>
                  <Badge variant="outline">
                    <Settings className="mr-1 h-3 w-3" />
                    {displayTables.reduce((sum, t) => sum + t.max_capacity, 0)} seats
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div 
                className="relative bg-muted rounded-lg border-2 border-dashed overflow-hidden"
                style={{ 
                  width: Math.min(currentFloorPlan.width, 1000) + "px",
                  height: Math.min(currentFloorPlan.height, 600) + "px"
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  if (draggedTable) {
                    handleTableDrop(e, draggedTable)
                  }
                }}
              >
                {/* Grid Background */}
                <div 
                  className="absolute inset-0 opacity-10"
                  style={{
                    backgroundImage: `
                      linear-gradient(to right, #000 1px, transparent 1px),
                      linear-gradient(to bottom, #000 1px, transparent 1px)
                    `,
                    backgroundSize: "20px 20px",
                  }}
                />

                {/* Tables */}
                {displayTables.map((table) => {
                  const tableColor = TABLE_TYPE_COLORS[table.table_type]
                  return (
                    <div
                      key={table.id}
                      className={`
                        absolute cursor-move transition-all duration-200 hover:scale-105
                        ${draggedTable === table.id ? "opacity-50 z-50" : "z-10"}
                      `}
                      style={{
                        left: `${Math.min(table.x_position, currentFloorPlan.width - 80)}px`,
                        top: `${Math.min(table.y_position, currentFloorPlan.height - 80)}px`,
                      }}
                      draggable
                      onDragStart={() => setDraggedTable(table.id)}
                      onDragEnd={() => setDraggedTable(null)}
                    >
                      <div
                        className={`
                          flex items-center justify-center bg-background border-2 shadow-lg
                          ${table.shape === "circle" ? "rounded-full" : "rounded-lg"}
                        `}
                        style={{
                          width: `${table.width * 8}px`, // Scale up for visibility
                          height: `${table.height * 8}px`,
                          borderColor: tableColor,
                          minWidth: "60px",
                          minHeight: "60px",
                        }}
                      >
                        <div className="text-center">
                          <div className="font-semibold text-sm">{table.table_number}</div>
                          <div className="text-xs text-muted-foreground">
                            {table.min_capacity}-{table.max_capacity}
                          </div>
                        </div>
                      </div>
                      
                      {/* Table type indicator */}
                      <div
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-background"
                        style={{ backgroundColor: tableColor }}
                        title={TABLE_TYPE_LABELS[table.table_type]}
                      />
                    </div>
                  )
                })}

                {displayTables.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <Grid className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="font-medium">No tables to display</p>
                      <p className="text-sm">
                        {showTablesByType === "all" 
                          ? "Create some tables to see them on your floor plan"
                          : `No ${TABLE_TYPE_LABELS[showTablesByType as keyof typeof TABLE_TYPE_LABELS]} tables found`
                        }
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Legend */}
              {displayTables.length > 0 && (
                <div className="mt-4 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Move className="h-4 w-4" />
                      <span>Drag to reposition</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Square className="h-4 w-4" />
                      <span>Rectangle/Square</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Circle className="h-4 w-4" />
                      <span>Round Table</span>
                    </div>
                  </div>
                  <div className="text-muted-foreground">
                    {displayTables.length} tables • {displayTables.reduce((sum, t) => sum + t.max_capacity, 0)} total seats
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Edit Floor Plan Dialog */}
      <Dialog open={isEditingFloorPlan} onOpenChange={setIsEditingFloorPlan}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Floor Plan</DialogTitle>
          </DialogHeader>
          <Form {...floorPlanForm}>
            <form onSubmit={floorPlanForm.handleSubmit((data) => 
              updateFloorPlanMutation.mutate({ planId: selectedFloorPlan, data })
            )} className="space-y-4">
              <FormField
                control={floorPlanForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={updateFloorPlanMutation.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={floorPlanForm.control}
                  name="width"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Width (px)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          disabled={updateFloorPlanMutation.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={floorPlanForm.control}
                  name="height"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Height (px)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          disabled={updateFloorPlanMutation.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={floorPlanForm.control}
                name="isDefault"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="h-4 w-4"
                        disabled={updateFloorPlanMutation.isPending}
                      />
                    </FormControl>
                    <FormLabel className="text-sm font-normal">
                      Set as default floor plan
                    </FormLabel>
                  </FormItem>
                )}
              />
              
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditingFloorPlan(false)}
                  disabled={updateFloorPlanMutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateFloorPlanMutation.isPending}>
                  {updateFloorPlanMutation.isPending ? "Updating..." : "Update"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
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
  FormDescription,
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
  Map, 
  Edit,
  Trash2,
  Save,
  ArrowLeft,
  Layers,
  Move,
  Square,
  Circle,
  RotateCw,
  Copy,
  Grid
} from "lucide-react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import type { FloorPlan, RestaurantTable } from "@/types"

const floorPlanFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  isDefault: z.boolean(),
})

const sectionFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  color: z.string(),
  smokingAllowed: z.boolean(),
  minPartySize: z.number().min(1).max(20),
  maxPartySize: z.number().min(1).max(50),
})

type FloorPlanFormData = z.infer<typeof floorPlanFormSchema>
type SectionFormData = z.infer<typeof sectionFormSchema>

const SECTION_COLORS = [
  { value: "#3b82f6", label: "Blue" },
  { value: "#10b981", label: "Green" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#ef4444", label: "Red" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#ec4899", label: "Pink" },
  { value: "#6366f1", label: "Indigo" },
  { value: "#14b8a6", label: "Teal" },
]

export default function FloorPlanPage() {
  const router = useRouter()
  const supabase = createClient()
  const queryClient = useQueryClient()
  
  const [selectedFloorPlan, setSelectedFloorPlan] = useState<string>("")
  const [isAddingFloorPlan, setIsAddingFloorPlan] = useState(false)
  const [isEditingFloorPlan, setIsEditingFloorPlan] = useState(false)
  const [isAddingSection, setIsAddingSection] = useState(false)
  const [selectedSection, setSelectedSection] = useState<any | null>(null)
  const [draggedTable, setDraggedTable] = useState<string | null>(null)
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

  // Fetch sections for selected floor plan
  const { data: sections } = useQuery({
    queryKey: ["sections", selectedFloorPlan],
    queryFn: async () => {
      if (!selectedFloorPlan) return []
      
      const { data, error } = await supabase
        .from("restaurant_sections")
        .select("*")
        .eq("floor_plan_id", selectedFloorPlan)
        .order("name", { ascending: true })

      if (error) throw error
      return data as any[]
    },
    enabled: !!selectedFloorPlan,
  })

  // Fetch tables for selected floor plan
  const { data: tables } = useQuery({
    queryKey: ["floor-plan-tables", selectedFloorPlan],
    queryFn: async () => {
      if (!selectedFloorPlan) return []
      
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select("*")
        .eq("floor_plan_id", selectedFloorPlan)
        .eq("is_active", true)
        .order("table_number", { ascending: true })

      if (error) throw error
      return data as RestaurantTable[]
    },
    enabled: !!selectedFloorPlan,
  })

  // Forms
  const floorPlanForm = useForm<FloorPlanFormData>({
    resolver: zodResolver(floorPlanFormSchema),
    defaultValues: {
      name: "",
      description: "",
      isDefault: false,
    },
  })

  const sectionForm = useForm<SectionFormData>({
    resolver: zodResolver(sectionFormSchema),
    defaultValues: {
      name: "",
      description: "",
      color: "#3b82f6",
      smokingAllowed: false,
      minPartySize: 1,
      maxPartySize: 20,
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
          description: data.description,
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
          description: data.description,
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

  // Create section mutation
  const createSectionMutation = useMutation({
    mutationFn: async (data: SectionFormData) => {
      const { error } = await supabase
        .from("restaurant_sections")
        .insert({
          floor_plan_id: selectedFloorPlan,
          name: data.name,
          description: data.description,
          color: data.color,
          smoking_allowed: data.smokingAllowed,
          min_party_size: data.minPartySize,
          max_party_size: data.maxPartySize,
        })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sections"] })
      toast.success("Section created")
      setIsAddingSection(false)
      sectionForm.reset()
    },
    onError: () => {
      toast.error("Failed to create section")
    },
  })

  // Update section mutation
  const updateSectionMutation = useMutation({
    mutationFn: async ({ sectionId, data }: { sectionId: string; data: SectionFormData }) => {
      const { error } = await supabase
        .from("restaurant_sections")
        .update({
          name: data.name,
          description: data.description,
          color: data.color,
          smoking_allowed: data.smokingAllowed,
          min_party_size: data.minPartySize,
          max_party_size: data.maxPartySize,
        })
        .eq("id", sectionId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sections"] })
      toast.success("Section updated")
      setSelectedSection(null)
      sectionForm.reset()
    },
    onError: () => {
      toast.error("Failed to update section")
    },
  })

  // Delete section mutation
  const deleteSectionMutation = useMutation({
    mutationFn: async (sectionId: string) => {
      // First, unassign tables from this section
      await supabase
        .from("restaurant_tables")
        .update({ section_id: null })
        .eq("section_id", sectionId)

      const { error } = await supabase
        .from("restaurant_sections")
        .delete()
        .eq("id", sectionId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sections", "floor-plan-tables"] })
      toast.success("Section deleted")
    },
    onError: () => {
      toast.error("Failed to delete section")
    },
  })

  // Update table position
  const updateTablePositionMutation = useMutation({
    mutationFn: async ({ tableId, position, sectionId }: { 
      tableId: string; 
      position: { x: number; y: number };
      sectionId?: string;
    }) => {
      const { error } = await supabase
        .from("restaurant_tables")
        .update({
          x_position: position.x,
          y_position: position.y,
          section_id: sectionId,
        })
        .eq("id", tableId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["floor-plan-tables"] })
    },
    onError: () => {
      toast.error("Failed to update table position")
    },
  })

  const currentFloorPlan = floorPlans?.find(p => p.id === selectedFloorPlan)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => router.push("/tables")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Tables
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Floor Plan Management</h1>
        <p className="text-muted-foreground">
          Design your restaurant layout and organize tables into sections
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
                    
                    <FormField
                      control={floorPlanForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Indoor dining area with bar"
                              {...field}
                              disabled={createFloorPlanMutation.isPending}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
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
              {floorPlans.map((plan:any) => (
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
                            description: plan.description || "",
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
                            if (confirm("Delete this floor plan? All sections will be removed.")) {
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
            <p className="text-sm text-muted-foreground">No floor plans created yet</p>
          )}
        </CardContent>
      </Card>

      {selectedFloorPlan && (
        <Tabs defaultValue="layout" className="space-y-4">
          <TabsList>
            <TabsTrigger value="layout">Layout Designer</TabsTrigger>
            <TabsTrigger value="sections">Sections</TabsTrigger>
          </TabsList>

          {/* Layout Designer */}
          <TabsContent value="layout" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Floor Layout</CardTitle>
                <CardDescription>
                  Drag tables to arrange your floor plan
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative bg-muted rounded-lg" style={{ minHeight: "600px" }}>
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

                  {/* Sections */}
                  {sections?.map((section) => (
                    <div
                      key={section.id}
                      className="absolute rounded-lg border-2 border-dashed p-4"
                      style={{
                        backgroundColor: `${section.color}20`,
                        borderColor: section.color,
                        // Position would be based on section coordinates
                        top: "50px",
                        left: "50px",
                        width: "300px",
                        height: "200px",
                      }}
                    >
                      <div className="text-sm font-medium" style={{ color: section.color }}>
                        {section.name}
                      </div>
                    </div>
                  ))}

                  {/* Tables */}
                  {tables?.map((table:any) => {
                    const section = sections?.find(s => s.id === table.section_id)
                    return (
                      <div
                        key={table.id}
                        className="absolute cursor-move"
                        style={{
                          left: `${table.x_position || 0}px`,
                          top: `${table.y_position || 0}px`,
                        }}
                        draggable
                        onDragStart={() => setDraggedTable(table.id)}
                        onDragEnd={(e) => {
                          const rect = e.currentTarget.parentElement?.getBoundingClientRect()
                          if (rect) {
                            const x = e.clientX - rect.left
                            const y = e.clientY - rect.top
                            updateTablePositionMutation.mutate({
                              tableId: table.id,
                              position: { x, y },
                            })
                          }
                          setDraggedTable(null)
                        }}
                      >
                        <div
                          className={`
                            flex items-center justify-center rounded-lg border-2 bg-background
                            ${table.table_type === "circular" ? "rounded-full" : ""}
                            ${draggedTable === table.id ? "opacity-50" : ""}
                          `}
                          style={{
                            width: table.table_type === "small" ? "60px" : table.table_type === "large" ? "120px" : "80px",
                            height: table.table_type === "small" ? "60px" : table.table_type === "large" ? "80px" : "80px",
                            borderColor: section?.color || "#666",
                          }}
                        >
                          <div className="text-center">
                            <div className="font-semibold">{table.table_number}</div>
                            <div className="text-xs text-muted-foreground">
                              {table.capacity} seats
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Legend */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Square className="h-4 w-4" />
                      <span>Regular Table</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Circle className="h-4 w-4" />
                      <span>Round Table</span>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Drag tables to reposition • Tables: {tables?.length || 0}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sections Management */}
          <TabsContent value="sections" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Sections</CardTitle>
                    <CardDescription>
                      Organize tables into sections for better management
                    </CardDescription>
                  </div>
                  <Dialog open={isAddingSection} onOpenChange={setIsAddingSection}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Section
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Section</DialogTitle>
                        <DialogDescription>
                          Define a new section for this floor plan
                        </DialogDescription>
                      </DialogHeader>
                      <Form {...sectionForm}>
                        <form onSubmit={sectionForm.handleSubmit((data) => createSectionMutation.mutate(data))} className="space-y-4">
                          <FormField
                            control={sectionForm.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Name</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="VIP Area, Bar Section, etc."
                                    {...field}
                                    disabled={createSectionMutation.isPending}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={sectionForm.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Description (Optional)</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Quiet area perfect for business meetings"
                                    {...field}
                                    disabled={createSectionMutation.isPending}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={sectionForm.control}
                            name="color"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Color</FormLabel>
                                <Select
                                  value={field.value}
                                  onValueChange={field.onChange}
                                  disabled={createSectionMutation.isPending}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {SECTION_COLORS.map((color) => (
                                      <SelectItem key={color.value} value={color.value}>
                                        <div className="flex items-center gap-2">
                                          <div
                                            className="h-4 w-4 rounded"
                                            style={{ backgroundColor: color.value }}
                                          />
                                          {color.label}
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={sectionForm.control}
                              name="minPartySize"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Min Party Size</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      {...field}
                                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                                      disabled={createSectionMutation.isPending}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={sectionForm.control}
                              name="maxPartySize"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Max Party Size</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      {...field}
                                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                                      disabled={createSectionMutation.isPending}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          
                          <FormField
                            control={sectionForm.control}
                            name="smokingAllowed"
                            render={({ field }) => (
                              <FormItem className="flex items-center space-x-2">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4"
                                    disabled={createSectionMutation.isPending}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-normal">
                                  Smoking allowed in this section
                                </FormLabel>
                              </FormItem>
                            )}
                          />
                          
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setIsAddingSection(false)}
                              disabled={createSectionMutation.isPending}
                            >
                              Cancel
                            </Button>
                            <Button type="submit" disabled={createSectionMutation.isPending}>
                              {createSectionMutation.isPending ? "Creating..." : "Create"}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {sections && sections.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {sections.map((section) => {
                      const sectionTables = tables?.filter((t:any) => t.section_id === section.id) || []
                      return (
                        <Card key={section.id}>
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <div
                                  className="h-4 w-4 rounded"
                                  style={{ backgroundColor: section.color }}
                                />
                                <CardTitle className="text-lg">{section.name}</CardTitle>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setSelectedSection(section)
                                    sectionForm.reset({
                                      name: section.name,
                                      description: section.description || "",
                                      color: section.color,
                                      smokingAllowed: section.smoking_allowed,
                                      minPartySize: section.min_party_size,
                                      maxPartySize: section.max_party_size,
                                    })
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    if (confirm("Delete this section? Tables will be unassigned.")) {
                                      deleteSectionMutation.mutate(section.id)
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            {section.description && (
                              <CardDescription>{section.description}</CardDescription>
                            )}
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Tables:</span>
                                <span className="font-medium">{sectionTables.length}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Capacity:</span>
                                <span className="font-medium">
                                  {sectionTables.reduce((sum, t) => sum + t.capacity, 0)} seats
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Party Size:</span>
                                <span className="font-medium">
                                  {section.min_party_size}-{section.max_party_size} guests
                                </span>
                              </div>
                              {section.smoking_allowed && (
                                <Badge variant="secondary" className="mt-2">
                                  Smoking Allowed
                                </Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No sections created for this floor plan yet
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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
              
              <FormField
                control={floorPlanForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
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

      {/* Edit Section Dialog */}
      {selectedSection && (
        <Dialog open={!!selectedSection} onOpenChange={() => setSelectedSection(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Section</DialogTitle>
            </DialogHeader>
            <Form {...sectionForm}>
              <form onSubmit={sectionForm.handleSubmit((data) => 
                updateSectionMutation.mutate({ sectionId: selectedSection.id, data })
              )} className="space-y-4">
                {/* Same form fields as create section */}
                <FormField
                  control={sectionForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          disabled={updateSectionMutation.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* ... other fields ... */}
                
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedSection(null)}
                    disabled={updateSectionMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateSectionMutation.isPending}>
                    {updateSectionMutation.isPending ? "Updating..." : "Update"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
// components/tables/section-manager.tsx
"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { toast } from "react-hot-toast"
import {
  Plus,
  Edit,
  Trash2,
  Layers,
  Grid3X3,
  Home,
  Trees,
  Wine,
  Lock,
  Sparkles,
  MapPin,
  Building,
  Palette,
  Move,
  Check,
  Power,
  PowerOff
} from "lucide-react"
import type { RestaurantSection } from "@/types"

const SECTION_ICONS = {
  grid: Grid3X3,
  home: Home,
  trees: Trees,
  wine: Wine,
  lock: Lock,
  sparkles: Sparkles,
  mappin: MapPin,
  building: Building,
  layers: Layers,
}

const SECTION_COLORS = [
  { value: '#3b82f6', label: 'Blue' },
  { value: '#10b981', label: 'Green' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#ef4444', label: 'Red' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#64748b', label: 'Slate' },
]

const sectionSchema = z.object({
  name: z.string()
    .min(1, "Section name is required")
    .max(30, "Section name must be 30 characters or less"),
  description: z.string()
    .max(100, "Description must be 100 characters or less")
    .optional(),
  color: z.string(),
  icon: z.string(),
  display_order: z.number().min(0),
})

type SectionFormData = z.infer<typeof sectionSchema>

interface SectionManagerProps {
  restaurantId: string
  onSectionSelect?: (sectionId: string) => void
  selectedSectionId?: string
}

export function SectionManager({ 
  restaurantId, 
  onSectionSelect,
  selectedSectionId 
}: SectionManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingSection, setEditingSection] = useState<RestaurantSection | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  
  const supabase = createClient()
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<SectionFormData>({
    resolver: zodResolver(sectionSchema),
    defaultValues: {
      name: "",
      description: "",
      color: "#3b82f6",
      icon: "grid",
      display_order: 0,
    },
  })

  const selectedColor = watch("color")
  const selectedIcon = watch("icon")

  // Fetch sections with table count
  const { data: sections, isLoading } = useQuery({
    queryKey: ["restaurant-sections-with-counts", restaurantId],
    queryFn: async () => {
      // Fetch sections (including disabled ones for management)
      const { data: sectionsData, error: sectionsError } = await supabase
        .from("restaurant_sections")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("display_order", { ascending: true })

      if (sectionsError) throw sectionsError

      // Fetch table counts for each section
      const { data: tablesData, error: tablesError } = await supabase
        .from("restaurant_tables")
        .select("section_id, id")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)

      if (tablesError) throw tablesError

      // Count tables per section
      const tableCounts = tablesData?.reduce((acc, table) => {
        if (table.section_id) {
          acc[table.section_id] = (acc[table.section_id] || 0) + 1
        }
        return acc
      }, {} as Record<string, number>)

      // Add table counts to sections
      return sectionsData?.map(section => ({
        ...section,
        table_count: tableCounts?.[section.id] || 0
      })) as RestaurantSection[]
    },
    enabled: !!restaurantId,
  })

  // Create/Update section mutation
  const sectionMutation = useMutation({
    mutationFn: async (data: SectionFormData) => {
      if (editingSection) {
        // Update existing section
        const { error } = await supabase
          .from("restaurant_sections")
          .update({
            name: data.name,
            description: data.description,
            color: data.color,
            icon: data.icon,
            display_order: data.display_order,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingSection.id)

        if (error) throw error
      } else {
        // Create new section
        const { error } = await supabase
          .from("restaurant_sections")
          .insert({
            restaurant_id: restaurantId,
            name: data.name,
            description: data.description,
            color: data.color,
            icon: data.icon,
            display_order: data.display_order,
          })

        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["restaurant-sections-with-counts", restaurantId] })
      queryClient.refetchQueries({ queryKey: ["restaurant-sections-active", restaurantId] })
      queryClient.refetchQueries({ queryKey: ["tables-with-sections", restaurantId] })
      toast.success(editingSection ? "Section updated" : "Section created")
      setIsDialogOpen(false)
      setEditingSection(null)
      reset()
    },
    onError: (error: any) => {
      console.error("Section mutation error:", error)
      toast.error("Failed to save section")
    },
  })

  // Delete section mutation
  const deleteMutation = useMutation({
    mutationFn: async (sectionId: string) => {
      // First check if there are tables in this section
      const { data: tables } = await supabase
        .from("restaurant_tables")
        .select("id")
        .eq("section_id", sectionId)
        .eq("is_active", true)

      if (tables && tables.length > 0) {
        throw new Error("Cannot delete section with active tables")
      }

      // Soft delete the section
      const { error } = await supabase
        .from("restaurant_sections")
        .update({ is_active: false })
        .eq("id", sectionId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["restaurant-sections-with-counts", restaurantId] })
      queryClient.refetchQueries({ queryKey: ["restaurant-sections-active", restaurantId] })
      queryClient.refetchQueries({ queryKey: ["tables-with-sections", restaurantId] })
      toast.success("Section deleted")
      setDeletingId(null)
    },
    onError: (error: any) => {
      console.error("Delete section error:", error)
      if (error.message === "Cannot delete section with active tables") {
        toast.error("Cannot delete section with active tables. Move or delete tables first.")
      } else {
        toast.error("Failed to delete section")
      }
      setDeletingId(null)
    },
  })

  // Toggle section status mutation (disable/enable)
  const toggleSectionMutation = useMutation({
    mutationFn: async ({ sectionId, isActive }: { sectionId: string; isActive: boolean }) => {
      // Start a transaction-like operation
      if (!isActive) {
        // Disabling section - also disable all tables in this section
        const { error: tablesError } = await supabase
          .from("restaurant_tables")
          .update({ is_active: false })
          .eq("section_id", sectionId)
          .eq("is_active", true)

        if (tablesError) throw tablesError
      } else {
        // Enabling section - also enable all tables in this section
        const { error: tablesError } = await supabase
          .from("restaurant_tables")
          .update({ is_active: true })
          .eq("section_id", sectionId)
          .eq("is_active", false)

        if (tablesError) throw tablesError
      }

      // Update the section itself
      const { error: sectionError } = await supabase
        .from("restaurant_sections")
        .update({ is_active: isActive })
        .eq("id", sectionId)

      if (sectionError) throw sectionError
    },
    onSuccess: (_, { isActive }) => {
      queryClient.refetchQueries({ queryKey: ["restaurant-sections-with-counts", restaurantId] })
      queryClient.refetchQueries({ queryKey: ["restaurant-sections-active", restaurantId] })
      queryClient.refetchQueries({ queryKey: ["tables-with-sections", restaurantId] })
      toast.success(isActive ? "Section enabled successfully" : "Section disabled successfully")
      setTogglingId(null)
    },
    onError: (error: any) => {
      console.error("Toggle section error:", error)
      toast.error("Failed to update section status")
      setTogglingId(null)
    },
  })

  const handleEdit = (section: RestaurantSection) => {
    setEditingSection(section)
    setValue("name", section.name)
    setValue("description", section.description || "")
    setValue("color", section.color)
    setValue("icon", section.icon)
    setValue("display_order", section.display_order)
    setIsDialogOpen(true)
  }

  const handleDelete = (sectionId: string) => {
    if (confirm("Are you sure you want to delete this section?")) {
      setDeletingId(sectionId)
      deleteMutation.mutate(sectionId)
    }
  }

  const handleToggleStatus = (sectionId: string, currentStatus: boolean) => {
    const message = currentStatus 
      ? "Are you sure you want to disable this section? All tables in this section will also be disabled."
      : "Are you sure you want to enable this section? All tables in this section will also be enabled."
    
    if (confirm(message)) {
      setTogglingId(sectionId)
      toggleSectionMutation.mutate({ sectionId, isActive: !currentStatus })
    }
  }

  const handleFormSubmit = (data: SectionFormData) => {
    sectionMutation.mutate(data)
  }

  const handleDialogClose = () => {
    setIsDialogOpen(false)
    setEditingSection(null)
    reset()
  }

  return (
    <div className="space-y-4">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Restaurant Sections</h3>
          <p className="text-sm text-muted-foreground">
            Organize your tables into logical sections
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Section
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingSection ? "Edit Section" : "Create New Section"}
              </DialogTitle>
              <DialogDescription>
                Organize your tables into logical sections for easier management
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="name">Section Name *</Label>
                <Input
                  id="name"
                  {...register("name")}
                  placeholder="e.g., Main Floor, Patio, VIP Area"
                  disabled={sectionMutation.isPending}
                  maxLength={30}
                />
                <div className="flex justify-between items-center mt-1">
                  <div>
                    {errors.name && (
                      <p className="text-sm text-red-600">{errors.name.message}</p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {watch("name")?.length || 0}/30
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...register("description")}
                  placeholder="Optional description of this section"
                  disabled={sectionMutation.isPending}
                  rows={2}
                  maxLength={100}
                />
                <div className="flex justify-between items-center mt-1">
                  <div>
                    {errors.description && (
                      <p className="text-sm text-red-600">{errors.description.message}</p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {watch("description")?.length || 0}/100
                  </p>
                </div>
              </div>

              <div>
                <Label>Icon</Label>
                <div className="grid grid-cols-5 gap-2 mt-2">
                  {Object.entries(SECTION_ICONS).map(([key, Icon]) => (
                    <Button
                      key={key}
                      type="button"
                      variant={selectedIcon === key ? "default" : "outline"}
                      size="sm"
                      className="h-9 w-full"
                      onClick={() => setValue("icon", key)}
                      disabled={sectionMutation.isPending}
                    >
                      <Icon className="h-4 w-4" />
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Color</Label>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {SECTION_COLORS.map((color) => (
                    <Button
                      key={color.value}
                      type="button"
                      variant={selectedColor === color.value ? "default" : "outline"}
                      size="sm"
                      className="h-9 w-full relative"
                      onClick={() => setValue("color", color.value)}
                      disabled={sectionMutation.isPending}
                    >
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: color.value }}
                      />
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="display_order">Display Order</Label>
                <Input
                  id="display_order"
                  type="number"
                  min="0"
                  {...register("display_order", { valueAsNumber: true })}
                  disabled={sectionMutation.isPending}
                />
                {errors.display_order && (
                  <p className="text-sm text-red-600 mt-1">{errors.display_order.message}</p>
                )}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleDialogClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={sectionMutation.isPending}>
                  {sectionMutation.isPending 
                    ? "Saving..." 
                    : editingSection 
                    ? "Update Section" 
                    : "Create Section"
                  }
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Sections Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full text-center py-8">
            <div className="text-sm text-muted-foreground">Loading sections...</div>
          </div>
        ) : (
          sections?.map((section: any) => {
            const Icon = SECTION_ICONS[section.icon as keyof typeof SECTION_ICONS] || Grid3X3
            const isSelected = section.id === selectedSectionId

            return (
              <Card
                key={section.id}
                className={cn(
                  "cursor-pointer hover:shadow-md transition-all",
                  isSelected && "ring-2 ring-primary shadow-md",
                  (deletingId === section.id || togglingId === section.id) && "opacity-50",
                  !section.is_active && "opacity-60 border-dashed"
                )}
                onClick={() => onSectionSelect?.(section.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div
                      className="p-2 rounded-lg flex-shrink-0"
                      style={{ backgroundColor: section.color + "20" }}
                    >
                      <Icon 
                        className="h-4 w-4" 
                        style={{ color: section.color }}
                      />
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleStatus(section.id, section.is_active)
                        }}
                        disabled={deletingId === section.id || togglingId === section.id}
                        title={section.is_active ? "Disable section" : "Enable section"}
                      >
                        {section.is_active ? (
                          <PowerOff className="h-3 w-3" />
                        ) : (
                          <Power className="h-3 w-3 text-green-600" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEdit(section)
                        }}
                        disabled={deletingId === section.id || togglingId === section.id}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(section.id)
                        }}
                        disabled={deletingId === section.id || togglingId === section.id}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <CardTitle className="text-sm font-medium line-clamp-1 break-words">{section.name}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {section.description && (
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-2 break-words">
                      {section.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1 flex-wrap">
                      <Badge variant="secondary" className="text-xs">
                        {section.table_count || 0} tables
                      </Badge>
                      {!section.is_active && (
                        <Badge variant="destructive" className="text-xs">
                          Disabled
                        </Badge>
                      )}
                    </div>
                    {isSelected && section.is_active && (
                      <Badge variant="default" className="text-xs">
                        <Check className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Quick Stats */}
      {sections && sections.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Section Overview</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-4 text-xs">
              <div>
                <span className="text-muted-foreground">Total Sections:</span>
                <span className="ml-2 font-medium">{sections.length}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Total Tables:</span>
                <span className="ml-2 font-medium">
                  {sections.reduce((sum, s: any) => sum + (s.table_count || 0), 0)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Average per Section:</span>
                <span className="ml-2 font-medium">
                  {Math.round(
                    sections.reduce((sum, s: any) => sum + (s.table_count || 0), 0) / sections.length
                  )}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
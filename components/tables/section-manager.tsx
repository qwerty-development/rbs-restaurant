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
  Check
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
  name: z.string().min(1, "Section name is required"),
  description: z.string().optional(),
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
    queryKey: ["restaurant-sections", restaurantId],
    queryFn: async () => {
      // Fetch sections
      const { data: sectionsData, error: sectionsError } = await supabase
        .from("restaurant_sections")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
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
      queryClient.invalidateQueries({ queryKey: ["restaurant-sections"] })
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
      queryClient.invalidateQueries({ queryKey: ["restaurant-sections"] })
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

  const handleFormSubmit = (data: SectionFormData) => {
    sectionMutation.mutate(data)
  }

  const handleDialogClose = () => {
    setIsDialogOpen(false)
    setEditingSection(null)
    reset()
  }

  const IconComponent = SECTION_ICONS[selectedIcon as keyof typeof SECTION_ICONS] || Grid3X3

  return (
    <div className="space-y-4">
      {/* Section Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {/* Add New Section Card */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:shadow-lg transition-shadow border-dashed">
              <CardContent className="flex flex-col items-center justify-center h-32">
                <Plus className="h-8 w-8 mb-2 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Add Section</p>
              </CardContent>
            </Card>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[500px]">
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
                />
                {errors.name && (
                  <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...register("description")}
                  placeholder="Optional description of this section"
                  disabled={sectionMutation.isPending}
                />
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
                      className="h-10 w-full"
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
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-10 w-full relative",
                        selectedColor === color.value && "ring-2 ring-offset-2 ring-primary"
                      )}
                      style={{ backgroundColor: color.value + "20", borderColor: color.value }}
                      onClick={() => setValue("color", color.value)}
                      disabled={sectionMutation.isPending}
                    >
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: color.value }}
                      />
                      {selectedColor === color.value && (
                        <Check className="h-3 w-3 absolute top-1 right-1" />
                      )}
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
                <p className="text-xs text-muted-foreground mt-1">
                  Lower numbers appear first
                </p>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDialogClose}
                  disabled={sectionMutation.isPending}
                >
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

        {/* Existing Sections */}
        {isLoading ? (
          <div className="col-span-full text-center py-8">
            Loading sections...
          </div>
        ) : (
          sections?.map((section:any) => {
            const Icon = SECTION_ICONS[section.icon as keyof typeof SECTION_ICONS] || Grid3X3
            const isSelected = section.id === selectedSectionId

            return (
              <Card
                key={section.id}
                className={cn(
                  "cursor-pointer hover:shadow-lg transition-all",
                  isSelected && "ring-2 ring-primary shadow-lg",
                  deletingId === section.id && "opacity-50"
                )}
                onClick={() => onSectionSelect?.(section.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: section.color + "20" }}
                    >
                      <Icon 
                        className="h-5 w-5" 
                        style={{ color: section.color }}
                      />
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEdit(section)
                        }}
                        disabled={deletingId === section.id}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(section.id)
                        }}
                        disabled={deletingId === section.id}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <CardTitle className="text-base">{section.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  {section.description && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {section.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">
                      {section.table_count || 0} tables
                    </Badge>
                    {isSelected && (
                      <Badge variant="default">
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
          <CardHeader>
            <CardTitle className="text-sm font-medium">Section Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total Sections:</span>
                <span className="ml-2 font-medium">{sections.length}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Total Tables:</span>
                <span className="ml-2 font-medium">
                  {sections.reduce((sum, s:any) => sum + (s.table_count || 0), 0)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Average per Section:</span>
                <span className="ml-2 font-medium">
                  {Math.round(
                    sections.reduce((sum, s:any) => sum + (s.table_count || 0), 0) / sections.length
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
// app/basic-dashboard/sections/page.tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useRestaurantContext } from "@/lib/contexts/restaurant-context"
import { 
  useRestaurantSections, 
  useCreateSection, 
  useUpdateSection, 
  useDeleteSection,
  useReorderSections,
  type RestaurantSection,
  type CreateSectionData 
} from "@/hooks/use-restaurant-sections"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { toast } from "react-hot-toast"
import { cn } from "@/lib/utils"
import { 
  Plus,
  Edit,
  Trash2,
  Grid,
  ArrowUp,
  ArrowDown,
  Palette
} from "lucide-react"

interface SectionFormData {
  name: string
  description: string
  color: string
  icon: string
  is_active: boolean
}

const PRESET_COLORS = [
  "#3b82f6", // Blue
  "#ef4444", // Red
  "#10b981", // Green
  "#f59e0b", // Yellow
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#84cc16", // Lime
  "#f97316", // Orange
  "#6b7280"  // Gray
]

const PRESET_ICONS = [
  { value: "grid", label: "Grid" },
  { value: "home", label: "Home" },
  { value: "users", label: "Family" },
  { value: "wine", label: "Bar" },
  { value: "coffee", label: "Cafe" },
  { value: "sun", label: "Outdoor" },
  { value: "shield", label: "VIP" },
  { value: "star", label: "Premium" }
]

export default function SectionsPage() {
  const router = useRouter()
  const { currentRestaurant } = useRestaurantContext()
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingSection, setEditingSection] = useState<RestaurantSection | null>(null)
  const [formData, setFormData] = useState<SectionFormData>({
    name: "",
    description: "",
    color: "#3b82f6",
    icon: "grid",
    is_active: true
  })

  const restaurantId = currentRestaurant?.restaurant.id

  // Use the custom hooks
  const { data: sections, isLoading } = useRestaurantSections(restaurantId)
  const createSectionMutation = useCreateSection(restaurantId)
  const updateSectionMutation = useUpdateSection(restaurantId)
  const deleteSectionMutation = useDeleteSection(restaurantId)
  const reorderSectionsMutation = useReorderSections(restaurantId)

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      color: "#3b82f6",
      icon: "grid",
      is_active: true
    })
  }

  const handleCreate = () => {
    if (!formData.name.trim()) {
      toast.error("Section name is required")
      return
    }
    
    createSectionMutation.mutate({
      name: formData.name,
      description: formData.description || undefined,
      color: formData.color,
      icon: formData.icon,
      is_active: formData.is_active
    }, {
      onSuccess: () => {
        setIsCreateDialogOpen(false)
        resetForm()
      }
    })
  }

  const handleEdit = (section: RestaurantSection) => {
    setEditingSection(section)
    setFormData({
      name: section.name,
      description: section.description || "",
      color: section.color,
      icon: section.icon,
      is_active: section.is_active
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdate = () => {
    if (!editingSection || !formData.name.trim()) {
      toast.error("Section name is required")
      return
    }
    
    updateSectionMutation.mutate({
      id: editingSection.id,
      data: {
        name: formData.name,
        description: formData.description || undefined,
        color: formData.color,
        icon: formData.icon,
        is_active: formData.is_active
      }
    }, {
      onSuccess: () => {
        setIsEditDialogOpen(false)
        setEditingSection(null)
        resetForm()
      }
    })
  }

  const handleDelete = (section: RestaurantSection) => {
    if (confirm(`Are you sure you want to delete the section "${section.name}"?`)) {
      deleteSectionMutation.mutate(section.id)
    }
  }

  const moveSection = (section: RestaurantSection, direction: 'up' | 'down') => {
    if (!sections) return

    const currentIndex = sections.findIndex(s => s.id === section.id)
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1

    if (targetIndex < 0 || targetIndex >= sections.length) return

    const newSections = [...sections]
    const [movedSection] = newSections.splice(currentIndex, 1)
    newSections.splice(targetIndex, 0, movedSection)

    // Update display orders
    const updates = newSections.map((s, index) => ({
      id: s.id,
      display_order: index + 1
    }))

    reorderSectionsMutation.mutate(updates)
  }

  if (!currentRestaurant) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Restaurant Sections</h1>
          <p className="text-muted-foreground">
            Organize your restaurant into sections for better booking management
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Section
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Section</DialogTitle>
              <DialogDescription>
                Add a new section to organize your restaurant layout
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Section Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Main Dining, Patio, Bar Area"
                />
              </div>

              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this section"
                />
              </div>

              <div>
                <Label>Color</Label>
                <div className="flex gap-2 mt-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      className={cn(
                        "w-8 h-8 rounded-full border-2",
                        formData.color === color ? "border-gray-900" : "border-gray-300"
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => setFormData({ ...formData, color })}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={handleCreate}
                  disabled={createSectionMutation.isPending}
                >
                  {createSectionMutation.isPending ? "Creating..." : "Create Section"}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsCreateDialogOpen(false)
                    resetForm()
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sections</CardTitle>
          <CardDescription>
            Manage your restaurant sections. Customers can specify their preferred section when making bookings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Loading sections...</div>
          ) : !sections || sections.length === 0 ? (
            <div className="text-center py-8">
              <Grid className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No sections yet</h3>
              <p className="text-muted-foreground mb-4">
                Create sections to organize your restaurant for better booking management
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Section
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sections.map((section, index) => (
                  <TableRow key={section.id}>
                    <TableCell className="font-medium">{section.name}</TableCell>
                    <TableCell>{section.description || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: section.color }}
                        />
                        <span className="text-sm text-muted-foreground">{section.color}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={section.is_active ? "default" : "secondary"}>
                        {section.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveSection(section, 'up')}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveSection(section, 'down')}
                          disabled={index === sections.length - 1}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(section)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(section)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Section</DialogTitle>
            <DialogDescription>
              Update the section details
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Section Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Main Dining, Patio, Bar Area"
              />
            </div>

            <div>
              <Label htmlFor="edit-description">Description (Optional)</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of this section"
              />
            </div>

            <div>
              <Label>Color</Label>
              <div className="flex gap-2 mt-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    className={cn(
                      "w-8 h-8 rounded-full border-2",
                      formData.color === color ? "border-gray-900" : "border-gray-300"
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData({ ...formData, color })}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="edit-is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="edit-is_active">Active</Label>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleUpdate}
                disabled={updateSectionMutation.isPending}
              >
                {updateSectionMutation.isPending ? "Updating..." : "Update Section"}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsEditDialogOpen(false)
                  setEditingSection(null)
                  resetForm()
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
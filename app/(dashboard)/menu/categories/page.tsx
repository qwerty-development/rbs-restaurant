// app/(dashboard)/menu/categories/page.tsx
"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog"
import { CategoryForm } from "@/components/menu/category-form"
import { toast } from "react-hot-toast"
import { Plus, Edit, Trash2 } from "lucide-react"
import type { MenuCategory } from "@/types"

export default function MenuCategoriesPage() {
  const [selectedCategory, setSelectedCategory] = useState<MenuCategory | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)

  const supabase = createClient()
  const queryClient = useQueryClient()

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

  const { data: categories, isLoading } = useQuery({
    queryKey: ["menu-categories", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      
      const { data, error } = await supabase
        .from("menu_categories")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("display_order", { ascending: true })

      if (error) throw error
      return data as MenuCategory[]
    },
    enabled: !!restaurantId,
  })

  const { data: itemCounts } = useQuery({
    queryKey: ["menu-item-counts", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return {}
      const { data, error } = await supabase
        .from('menu_items')
        .select('category_id, id')
        .eq('restaurant_id', restaurantId)

      if (error) throw error

      return data.reduce((acc, item) => {
        acc[item.category_id] = (acc[item.category_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    },
    enabled: !!restaurantId,
  })

  const categoryMutation = useMutation({
    mutationFn: async (categoryData: Partial<MenuCategory>) => {
      if (selectedCategory) {
        const { error } = await supabase
          .from("menu_categories")
          .update({ ...categoryData, updated_at: new Date().toISOString() })
          .eq("id", selectedCategory.id)
        if (error) throw error
      } else {
        const { data: maxOrder } = await supabase
          .from('menu_categories')
          .select('display_order')
          .eq('restaurant_id', restaurantId)
          .order('display_order', { ascending: false })
          .limit(1)
          .single()

        const newOrder = (maxOrder?.display_order || 0) + 1;

        const { error } = await supabase
          .from("menu_categories")
          .insert({ ...categoryData, restaurant_id: restaurantId, display_order: newOrder })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-categories"] })
      toast.success(selectedCategory ? "Category updated" : "Category created")
      setIsFormOpen(false)
      setSelectedCategory(null)
    },
    onError: () => {
      toast.error("Failed to save category")
    },
  })

  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      const { error } = await supabase
        .from("menu_categories")
        .delete()
        .eq("id", categoryId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-categories"] })
      toast.success("Category deleted")
    },
    onError: (error: any) => {
      if (error.message.includes('foreign key constraint')) {
        toast.error("Cannot delete category with items. Please move items first.")
      } else {
        toast.error("Failed to delete category")
      }
    },
  })

  const toggleCategoryMutation = useMutation({
    mutationFn: async ({ categoryId, isActive }: { categoryId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("menu_categories")
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq("id", categoryId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-categories"] })
      toast.success("Category status updated")
    },
    onError: () => {
      toast.error("Failed to update category status")
    },
  })

  const handleEdit = (category: MenuCategory) => {
    setSelectedCategory(category)
    setIsFormOpen(true)
  }

  const handleAdd = () => {
    setSelectedCategory(null)
    setIsFormOpen(true)
  }

  const handleDelete = (categoryId: string) => {
    if (confirm("Are you sure you want to delete this category?")) {
      deleteCategoryMutation.mutate(categoryId)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Menu Categories</h1>
          <p className="text-muted-foreground">
            Organize your menu items into categories
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add Category
        </Button>
      </div>

      <Dialog 
        open={isFormOpen} 
        onOpenChange={(open) => {
          if (!open) {
            setIsFormOpen(false)
            setSelectedCategory(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedCategory ? "Edit Category" : "Add Category"}</DialogTitle>
          </DialogHeader>
          <CategoryForm
            category={selectedCategory || undefined}
            onSubmit={(data) => categoryMutation.mutate(data)}
            onCancel={() => {
              setIsFormOpen(false)
              setSelectedCategory(null)
            }}
            isLoading={categoryMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>All Categories</CardTitle>
          <CardDescription>
            Manage your menu categories.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Item Count</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">Loading...</TableCell>
                </TableRow>
              ) : categories?.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell>{category.description}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{itemCounts?.[category.id] || 0} items</Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={category.is_active}
                      onCheckedChange={(checked) => toggleCategoryMutation.mutate({ categoryId: category.id, isActive: checked })}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(category)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(category.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

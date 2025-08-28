// app/(dashboard)/menu/page.tsx
"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { MenuCategories } from "@/components/menu/menu-categories"
import { MenuItemCard } from "@/components/menu/menu-item-card"
import { MenuItemForm } from "@/components/menu/menu-item-form"
import { CategoryForm } from "@/components/menu/category-form"
import { toast } from "react-hot-toast"
import { Plus, Search, Filter, Upload, Download } from "lucide-react"
import type { MenuItem, MenuCategory } from "@/types"

export default function MenuPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [isAddingItem, setIsAddingItem] = useState(false)
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [dietaryFilter, setDietaryFilter] = useState<string[]>([])
  
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

  // Fetch categories
  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ["menu-categories", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      
      const { data, error } = await supabase
        .from("menu_categories")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("display_order", { ascending: true })

      if (error) {
        console.error("Error fetching categories:", error)
        throw error
      }
      return data as MenuCategory[]
    },
    enabled: !!restaurantId,
  })

  // Fetch all menu items (for category counts)
  const { data: allMenuItems, isLoading: allItemsLoading } = useQuery({
    queryKey: ["all-menu-items", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      
      const { data, error } = await supabase
        .from("menu_items")
        .select(`
          *,
          category:menu_categories!menu_items_category_id_fkey(*)
        `)
        .eq("restaurant_id", restaurantId)
        .order("display_order", { ascending: true })

      if (error) {
        console.error("Error fetching all menu items:", error)
        throw error
      }
      return data as MenuItem[]
    },
    enabled: !!restaurantId,
  })

  // Fetch displayed menu items (filtered by category)
  const { data: displayedMenuItems, isLoading: itemsLoading } = useQuery({
    queryKey: ["displayed-menu-items", restaurantId, selectedCategory],
    queryFn: async () => {
      if (!restaurantId) return []
      
      let query = supabase
        .from("menu_items")
        .select(`
          *,
          category:menu_categories!menu_items_category_id_fkey(*)
        `)
        .eq("restaurant_id", restaurantId)
        .order("display_order", { ascending: true })

      if (selectedCategory !== "all") {
        query = query.eq("category_id", selectedCategory)
      }

      const { data, error } = await query

      if (error) {
        console.error("Error fetching displayed menu items:", error)
        throw error
      }
      return data as MenuItem[]
    },
    enabled: !!restaurantId,
  })

  // Create/Update menu item
  const itemMutation = useMutation({
    mutationFn: async (itemData: Partial<MenuItem>) => {
      if (itemData.id) {
        // Update existing item
        const { error } = await supabase
          .from("menu_items")
          .update({
            ...itemData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", itemData.id)

        if (error) throw error
      } else {
        // Create new item
        const { error } = await supabase
          .from("menu_items")
          .insert({
            ...itemData,
            restaurant_id: restaurantId,
            display_order: allMenuItems?.length || 0,
          })

        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-menu-items"] })
      queryClient.invalidateQueries({ queryKey: ["displayed-menu-items"] })
      toast.success(selectedItem ? "Item updated" : "Item created")
      setSelectedItem(null)
      setIsAddingItem(false)
    },
    onError: (error) => {
      console.error("Item mutation error:", error)
      toast.error("Failed to save menu item")
    },
  })

  // Create category
  const categoryMutation = useMutation({
    mutationFn: async (categoryData: Partial<MenuCategory>) => {
      const displayOrder = categories?.length || 0
      
      const { error } = await supabase
        .from("menu_categories")
        .insert({
          ...categoryData,
          restaurant_id: restaurantId,
          display_order: displayOrder,
        })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-categories"] })
      toast.success("Category created")
      setIsAddingCategory(false)
    },
    onError: (error) => {
      console.error("Category mutation error:", error)
      toast.error("Failed to create category")
    },
  })

  // Toggle item availability
  const toggleAvailabilityMutation = useMutation({
    mutationFn: async ({ itemId, isAvailable }: { itemId: string; isAvailable: boolean }) => {
      const { error } = await supabase
        .from("menu_items")
        .update({ 
          is_available: isAvailable,
          updated_at: new Date().toISOString(),
        })
        .eq("id", itemId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-menu-items"] })
      queryClient.invalidateQueries({ queryKey: ["displayed-menu-items"] })
      toast.success("Availability updated")
    },
    onError: () => {
      toast.error("Failed to update availability")
    },
  })

  // Filter items based on search and dietary preferences
  const filteredItems = displayedMenuItems?.filter((item) => {
    const matchesSearch = !searchQuery || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesDietary = dietaryFilter.length === 0 ||
      dietaryFilter.every(tag => item.dietary_tags?.includes(tag))
    
    return matchesSearch && matchesDietary
  })

  // Get menu statistics
  const getMenuStats = () => {
    if (!allMenuItems) return { total: 0, available: 0, featured: 0, avgPrice: 0 }
    
    const available = allMenuItems.filter(item => item.is_available)
    const featured = allMenuItems.filter(item => item.is_featured)
    const avgPrice = allMenuItems.reduce((sum, item) => sum + Number(item.price), 0) / allMenuItems.length
    
    return {
      total: allMenuItems.length,
      available: available.length,
      featured: featured.length,
      avgPrice: avgPrice || 0,
    }
  }

  const stats = getMenuStats()

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Menu Management</h1>
          <p className="text-muted-foreground">
            Manage your restaurant menu items and categories
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Dialog open={isAddingItem} onOpenChange={setIsAddingItem}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Menu Item</DialogTitle>
                <DialogDescription>
                  Create a new item for your menu
                </DialogDescription>
              </DialogHeader>
              <MenuItemForm
                categories={categories || []}
                onSubmit={(data) => itemMutation.mutate(data)}
                onCancel={() => setIsAddingItem(false)}
                isLoading={itemMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.available}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total - stats.available} unavailable
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Featured</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.featured}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Price</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stats.avgPrice.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content */}
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Categories Sidebar */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Categories</h3>
            <Dialog open={isAddingCategory} onOpenChange={setIsAddingCategory}>
              <DialogTrigger asChild>
                <Button size="sm" variant="ghost">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Category</DialogTitle>
                </DialogHeader>
                <CategoryForm
                  onSubmit={(data) => categoryMutation.mutate(data)}
                  onCancel={() => setIsAddingCategory(false)}
                  isLoading={categoryMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>
          
          <MenuCategories
            categories={categories || []}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            isLoading={categoriesLoading}
            itemCounts={
              allMenuItems?.reduce((acc, item) => {
                acc[item.category_id] = (acc[item.category_id] || 0) + 1
                return acc
              }, {} as Record<string, number>) || {}
            }
          />
        </div>

        {/* Menu Items */}
        <div className="space-y-4">
          {/* Search and Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search menu items..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex gap-2">
                  {["vegetarian", "vegan", "gluten-free"].map((tag) => (
                    <Badge
                      key={tag}
                      variant={dietaryFilter.includes(tag) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => {
                        setDietaryFilter(prev =>
                          prev.includes(tag)
                            ? prev.filter(t => t !== tag)
                            : [...prev, tag]
                        )
                      }}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items Grid */}
          {itemsLoading ? (
            <div className="text-center py-8">Loading menu items...</div>
          ) : filteredItems?.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-muted-foreground">
                  {allMenuItems?.length === 0 
                    ? "No menu items added yet. Click 'Add Item' to get started."
                    : "No menu items found matching your filters."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredItems?.map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  onEdit={() => {
                    setSelectedItem(item)
                    setIsAddingItem(true)
                  }}
                  onToggleAvailability={(isAvailable) =>
                    toggleAvailabilityMutation.mutate({ itemId: item.id, isAvailable })
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Item Dialog */}
      {selectedItem && isAddingItem && (
        <Dialog open={!!selectedItem} onOpenChange={() => {
          setSelectedItem(null)
          setIsAddingItem(false)
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Menu Item</DialogTitle>
            </DialogHeader>
            <MenuItemForm
              item={selectedItem}
              categories={categories || []}
              onSubmit={(data) => itemMutation.mutate({ ...data, id: selectedItem.id })}
              onCancel={() => {
                setSelectedItem(null)
                setIsAddingItem(false)
              }}
              isLoading={itemMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
// app/admin/menu/page.tsx
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MenuCategories } from "@/components/menu/menu-categories"
import { MenuItemCard } from "@/components/menu/menu-item-card"
import { MenuItemForm } from "@/components/menu/menu-item-form"
import { CategoryForm } from "@/components/menu/category-form"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DeleteCategoryDialog } from "@/components/menu/delete-category-dialog"
import { CSVImportDialog } from "@/components/menu/csv-import-dialog"
import { CSVCategoryImportDialog } from "@/components/menu/csv-category-import-dialog"
import { toast } from "react-hot-toast"
import { Plus, Search, Filter, Upload, Download, ExternalLink, Copy, QrCode, MoreHorizontal, Building, FolderUp } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { MenuItem, MenuCategory } from "@/types"

export default function AdminMenuPage() {
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>("")
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedCategoryForEdit, setSelectedCategoryForEdit] = useState<MenuCategory | null>(null)
  const [isAddingItem, setIsAddingItem] = useState(false)
  const [isEditingItem, setIsEditingItem] = useState(false)
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [isEditingCategory, setIsEditingCategory] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null)
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [dietaryFilter, setDietaryFilter] = useState<string[]>([])
  const [isCSVImportOpen, setIsCSVImportOpen] = useState(false)
  const [isCategoryCsvImportOpen, setIsCategoryCsvImportOpen] = useState(false)

  const supabase = createClient()
  const queryClient = useQueryClient()
  const [isQrOpen, setIsQrOpen] = useState(false)

  const publicMenuUrl = selectedRestaurantId ? `https://www.plate-app.com/menu/${selectedRestaurantId}` : ""

  const handleOpenLink = () => {
    if (!publicMenuUrl) return
    window.open(publicMenuUrl, "_blank")
  }

  const handleCopyLink = async () => {
    if (!publicMenuUrl) return
    try {
      await navigator.clipboard.writeText(publicMenuUrl)
      toast.success("Link copied")
    } catch {
      toast.error("Failed to copy link")
    }
  }

  const qrPngUrl = publicMenuUrl
    ? `https://quickchart.io/qr?text=${encodeURIComponent(publicMenuUrl)}&format=png&margin=1&size=280&backgroundColor=transparent&dark=000000`
    : ""

  const handleDownloadQr = async () => {
    if (!qrPngUrl || !selectedRestaurantId) return
    try {
      const resp = await fetch(qrPngUrl)
      const blob = await resp.blob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = objectUrl
      link.download = `menu-qr-${selectedRestaurantId}.png`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
    } catch {
      toast.error("Failed to download QR image")
    }
  }

  // Fetch all restaurants
  const { data: restaurants, isLoading: restaurantsLoading } = useQuery({
    queryKey: ["admin-restaurants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name")
        .order("name")

      if (error) {
        console.error("Error fetching restaurants:", error)
        throw error
      }
      return data
    },
  })

  // Auto-select first restaurant if none selected
  useEffect(() => {
    if (restaurants && restaurants.length > 0 && !selectedRestaurantId) {
      setSelectedRestaurantId(restaurants[0].id)
    }
  }, [restaurants, selectedRestaurantId])

  // Fetch categories for selected restaurant
  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ["admin-menu-categories", selectedRestaurantId],
    queryFn: async () => {
      if (!selectedRestaurantId) return []
      
      const { data, error } = await supabase
        .from("menu_categories")
        .select("*")
        .eq("restaurant_id", selectedRestaurantId)
        .eq("is_active", true)
        .order("display_order", { ascending: true })

      if (error) {
        console.error("Error fetching categories:", error)
        throw error
      }
      return data as MenuCategory[]
    },
    enabled: !!selectedRestaurantId,
  })

  // Fetch all menu items (for category counts)
  const { data: allMenuItems, isLoading: allItemsLoading } = useQuery({
    queryKey: ["admin-all-menu-items", selectedRestaurantId],
    queryFn: async () => {
      if (!selectedRestaurantId) return []
      
      const { data, error } = await supabase
        .from("menu_items")
        .select(`
          *,
          category:menu_categories!menu_items_category_id_fkey(*)
        `)
        .eq("restaurant_id", selectedRestaurantId)
        .order("display_order", { ascending: true })

      if (error) {
        console.error("Error fetching all menu items:", error)
        throw error
      }
      return data as MenuItem[]
    },
    enabled: !!selectedRestaurantId,
  })

  // Fetch displayed menu items (filtered by category)
  const { data: displayedMenuItems, isLoading: itemsLoading } = useQuery({
    queryKey: ["admin-displayed-menu-items", selectedRestaurantId, selectedCategory],
    queryFn: async () => {
      if (!selectedRestaurantId) return []
      
      let query = supabase
        .from("menu_items")
        .select(`
          *,
          category:menu_categories!menu_items_category_id_fkey(*)
        `)
        .eq("restaurant_id", selectedRestaurantId)
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
    enabled: !!selectedRestaurantId,
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
            restaurant_id: selectedRestaurantId,
            display_order: allMenuItems?.length || 0,
          })

        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-all-menu-items"] })
      queryClient.invalidateQueries({ queryKey: ["admin-displayed-menu-items"] })
      toast.success(selectedItem ? "Item updated" : "Item created")
      setSelectedItem(null)
      setIsAddingItem(false)
      setIsEditingItem(false)
    },
    onError: (error) => {
      console.error("Item mutation error:", error)
      toast.error("Failed to save menu item")
    },
  })

  // Delete menu item
  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from("menu_items")
        .delete()
        .eq("id", itemId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-all-menu-items"] })
      queryClient.invalidateQueries({ queryKey: ["admin-displayed-menu-items"] })
      toast.success("Item deleted successfully")
      setItemToDelete(null)
    },
    onError: (error) => {
      console.error("Delete item error:", error)
      toast.error("Failed to delete menu item")
    },
  })

  // Create category
  const categoryMutation = useMutation({
    mutationFn: async (categoryData: Partial<MenuCategory>) => {
      if (categoryData.id) {
        // Update existing category
        const { error } = await supabase
          .from("menu_categories")
          .update({
            ...categoryData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", categoryData.id)

        if (error) throw error
      } else {
        // Create new category
        const displayOrder = categories?.length || 0
        
        const { error } = await supabase
          .from("menu_categories")
          .insert({
            ...categoryData,
            restaurant_id: selectedRestaurantId,
            display_order: displayOrder,
          })

        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-menu-categories"] })
      toast.success(selectedCategoryForEdit ? "Category updated" : "Category created")
      setIsAddingCategory(false)
      setIsEditingCategory(false)
      setSelectedCategoryForEdit(null)
    },
    onError: (error) => {
      console.error("Category mutation error:", error)
      toast.error("Failed to save category")
    },
  })

  // Delete category
  const deleteCategoryMutation = useMutation({
    mutationFn: async ({
      categoryId,
      action,
      targetCategoryId
    }: {
      categoryId: string
      action: "delete-all" | "reassign"
      targetCategoryId?: string
    }) => {
      if (action === "reassign" && targetCategoryId) {
        // Reassign all items to target category
        const { error: reassignError } = await supabase
          .from("menu_items")
          .update({
            category_id: targetCategoryId,
            updated_at: new Date().toISOString(),
          })
          .eq("category_id", categoryId)

        if (reassignError) throw reassignError
      } else if (action === "delete-all") {
        // Delete all items in the category
        const { error: deleteItemsError } = await supabase
          .from("menu_items")
          .delete()
          .eq("category_id", categoryId)

        if (deleteItemsError) throw deleteItemsError
      }

      // Delete the category
      const { error } = await supabase
        .from("menu_categories")
        .delete()
        .eq("id", categoryId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-menu-categories"] })
      queryClient.invalidateQueries({ queryKey: ["admin-all-menu-items"] })
      queryClient.invalidateQueries({ queryKey: ["admin-displayed-menu-items"] })
      toast.success("Category deleted successfully")
      setCategoryToDelete(null)
      if (selectedCategory === categoryToDelete) {
        setSelectedCategory("all")
      }
    },
    onError: (error) => {
      console.error("Delete category error:", error)
      toast.error(error.message || "Failed to delete category")
    },
  })

  // Toggle category status
  const toggleCategoryStatusMutation = useMutation({
    mutationFn: async ({ categoryId, isActive }: { categoryId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("menu_categories")
        .update({ 
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", categoryId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-menu-categories"] })
      toast.success("Category status updated")
    },
    onError: () => {
      toast.error("Failed to update category status")
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
      queryClient.invalidateQueries({ queryKey: ["admin-all-menu-items"] })
      queryClient.invalidateQueries({ queryKey: ["admin-displayed-menu-items"] })
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
            Manage restaurant menu items and categories
          </p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={!selectedRestaurantId}>
                <MoreHorizontal className="mr-2 h-4 w-4" />
                Link
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={!publicMenuUrl} onClick={handleOpenLink}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Open link
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!publicMenuUrl} onClick={handleCopyLink}>
                <Copy className="mr-2 h-4 w-4" />
                Copy link
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!publicMenuUrl} onClick={() => setIsQrOpen(true)}>
                <QrCode className="mr-2 h-4 w-4" />
                Generate QR code
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            disabled={!selectedRestaurantId}
            onClick={() => setIsCategoryCsvImportOpen(true)}
          >
            <FolderUp className="mr-2 h-4 w-4" />
            Import Categories
          </Button>
          <Button
            variant="outline"
            disabled={!selectedRestaurantId}
            onClick={() => setIsCSVImportOpen(true)}
          >
            <Upload className="mr-2 h-4 w-4" />
            Import Items
          </Button>
          <Button variant="outline" disabled={!selectedRestaurantId}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Dialog open={isAddingItem} onOpenChange={setIsAddingItem}>
            <DialogTrigger asChild>
              <Button disabled={!selectedRestaurantId}>
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Menu Item</DialogTitle>
                <DialogDescription>
                  Create a new item for the selected restaurant menu
                </DialogDescription>
              </DialogHeader>
              <div className="overflow-y-auto">
                <MenuItemForm
                  categories={categories || []}
                  restaurantId={selectedRestaurantId}
                  onSubmit={(data) => itemMutation.mutate(data)}
                  onCancel={() => setIsAddingItem(false)}
                  isLoading={itemMutation.isPending}
                />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Restaurant Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Restaurant Selection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedRestaurantId} onValueChange={setSelectedRestaurantId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a restaurant to manage" />
            </SelectTrigger>
            <SelectContent>
              {restaurants?.map((restaurant) => (
                <SelectItem key={restaurant.id} value={restaurant.id}>
                  {restaurant.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {restaurantsLoading && (
            <p className="text-sm text-muted-foreground mt-2">Loading restaurants...</p>
          )}
        </CardContent>
      </Card>

      {selectedRestaurantId && (
        <>
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
                onEditCategory={(category) => {
                  setSelectedCategoryForEdit(category)
                  setIsEditingCategory(true)
                }}
                onDeleteCategory={(categoryId) => setCategoryToDelete(categoryId)}
                onToggleCategoryStatus={(categoryId, isActive) =>
                  toggleCategoryStatusMutation.mutate({ categoryId, isActive })
                }
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
                        setIsEditingItem(true)
                      }}
                      onDelete={() => setItemToDelete(item)}
                      onToggleAvailability={(isAvailable) =>
                        toggleAvailabilityMutation.mutate({ itemId: item.id, isAvailable })
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Edit Item Dialog */}
      <Dialog open={isEditingItem} onOpenChange={(open) => {
        if (!open) {
          setSelectedItem(null)
          setIsEditingItem(false)
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Menu Item</DialogTitle>
            <DialogDescription>
              Update the details of this menu item
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto">
            <MenuItemForm
              item={selectedItem || undefined}
              categories={categories || []}
              restaurantId={selectedRestaurantId}
              onSubmit={(data) => itemMutation.mutate({ ...data, id: selectedItem?.id })}
              onCancel={() => {
                setSelectedItem(null)
                setIsEditingItem(false)
              }}
              isLoading={itemMutation.isPending}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={isQrOpen} onOpenChange={setIsQrOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Menu QR Code</DialogTitle>
            <DialogDescription>
              Scan to open {publicMenuUrl}
            </DialogDescription>
          </DialogHeader>
          {publicMenuUrl && (
            <div className="w-full flex items-center justify-center py-4">
              <img
                alt="Menu QR"
                className="h-56 w-56"
                src={qrPngUrl}
              />
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={handleDownloadQr} disabled={!qrPngUrl}>
              Download PNG
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={isEditingCategory} onOpenChange={(open) => {
        if (!open) {
          setSelectedCategoryForEdit(null)
          setIsEditingCategory(false)
        }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>
              Update the details of this category
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto">
            <CategoryForm
              category={selectedCategoryForEdit || undefined}
              onSubmit={(data) => categoryMutation.mutate({ ...data, id: selectedCategoryForEdit?.id })}
              onCancel={() => {
                setSelectedCategoryForEdit(null)
                setIsEditingCategory(false)
              }}
              isLoading={categoryMutation.isPending}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Item Confirmation */}
      <ConfirmDialog
        open={!!itemToDelete}
        onOpenChange={(open) => !open && setItemToDelete(null)}
        title="Delete Menu Item"
        description={`Are you sure you want to delete "${itemToDelete?.name}"? This action cannot be undone.`}
        onConfirm={() => itemToDelete && deleteItemMutation.mutate(itemToDelete.id)}
        isLoading={deleteItemMutation.isPending}
      />

      {/* Delete Category Dialog */}
      <DeleteCategoryDialog
        open={!!categoryToDelete}
        onOpenChange={(open) => !open && setCategoryToDelete(null)}
        categoryName={
          categories?.find((cat) => cat.id === categoryToDelete)?.name || ""
        }
        itemCount={
          allMenuItems?.filter((item) => item.category_id === categoryToDelete).length || 0
        }
        categories={
          categories?.filter((cat) => cat.id !== categoryToDelete) || []
        }
        onConfirm={(action, targetCategoryId) => {
          if (categoryToDelete) {
            deleteCategoryMutation.mutate({
              categoryId: categoryToDelete,
              action,
              targetCategoryId,
            })
          }
        }}
        isLoading={deleteCategoryMutation.isPending}
      />

      {/* CSV Category Import Dialog */}
      <CSVCategoryImportDialog
        open={isCategoryCsvImportOpen}
        onOpenChange={setIsCategoryCsvImportOpen}
        restaurantId={selectedRestaurantId}
        onImportComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["admin-menu-categories"] })
        }}
      />

      {/* CSV Items Import Dialog */}
      <CSVImportDialog
        open={isCSVImportOpen}
        onOpenChange={setIsCSVImportOpen}
        categories={categories || []}
        restaurantId={selectedRestaurantId}
        onImportComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["admin-all-menu-items"] })
          queryClient.invalidateQueries({ queryKey: ["admin-displayed-menu-items"] })
        }}
      />
    </div>
  )
}
// app/(dashboard)/menu/items/page.tsx
"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  DialogTitle 
} from "@/components/ui/dialog"
import { MenuItemForm } from "@/components/menu/menu-item-form"
import { CSVImportDialog } from "@/components/menu/csv-import-dialog"
import { CSVCategoryImportDialog } from "@/components/menu/csv-category-import-dialog"
import { toast } from "react-hot-toast"
import { Plus, Edit, Trash2, Search, ArrowUpDown, Upload, FolderUp } from "lucide-react"
import type { MenuItem, MenuCategory } from "@/types"

export default function MenuItemsPage() {
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isCSVImportOpen, setIsCSVImportOpen] = useState(false)
  const [isCategoryCsvImportOpen, setIsCategoryCsvImportOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortConfig, setSortConfig] = useState<{ key: keyof MenuItem; direction: 'asc' | 'desc' } | null>(null);

  const supabase = createClient()
  const queryClient = useQueryClient()
  const router = useRouter()

  const [restaurantId, setRestaurantId] = useState<string>("")

  useEffect(() => {
    console.log('🔄 useEffect running to fetch restaurant ID...')
    async function getRestaurantId() {
      const { data: { user } } = await supabase.auth.getUser()
      console.log('👤 User fetched:', user?.id)
      if (user) {
        const { data: staffData, error } = await supabase
          .from("restaurant_staff")
          .select("restaurant_id")
          .eq("user_id", user.id)
          .single()

        if (error) {
          console.error('❌ Error fetching restaurant staff:', error)
        }

        if (staffData) {
          console.log('✅ Restaurant ID loaded:', staffData.restaurant_id)
          console.log('✅ Setting restaurantId state to:', staffData.restaurant_id)
          setRestaurantId(staffData.restaurant_id)
        } else {
          console.error('❌ No restaurant staff data found for user')
        }
      }
    }
    getRestaurantId()
  }, [supabase])

  // Log whenever restaurantId state changes
  useEffect(() => {
    console.log('📍 restaurantId state changed to:', restaurantId)
    console.log('📍 restaurantId type:', typeof restaurantId)
    console.log('📍 restaurantId length:', restaurantId.length)
  }, [restaurantId])

  const { data: menuItems, isLoading: itemsLoading } = useQuery({
    queryKey: ["menu-items", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      const { data, error } = await supabase
        .from("menu_items")
        .select('*, category:menu_categories(name)')
        .eq("restaurant_id", restaurantId)
        .order("name", { ascending: true })

      if (error) throw error
      return data as MenuItem[]
    },
    enabled: !!restaurantId,
  })

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ["menu-categories", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      const { data, error } = await supabase
        .from("menu_categories")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("name", { ascending: true })

      if (error) throw error
      return data as MenuCategory[]
    },
    enabled: !!restaurantId,
  })

  const itemMutation = useMutation({
    mutationFn: async (itemData: Partial<MenuItem>) => {
      if (selectedItem) {
        const { error } = await supabase
          .from("menu_items")
          .update({ ...itemData, updated_at: new Date().toISOString() })
          .eq("id", selectedItem.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from("menu_items")
          .insert({ ...itemData, restaurant_id: restaurantId })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-items"] })
      toast.success(selectedItem ? "Item updated" : "Item created")
      setIsFormOpen(false)
      setSelectedItem(null)
    },
    onError: () => {
      toast.error("Failed to save item")
    },
  })

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from("menu_items")
        .delete()
        .eq("id", itemId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-items"] })
      toast.success("Item deleted")
    },
    onError: () => {
      toast.error("Failed to delete item")
    },
  })

  const toggleAvailabilityMutation = useMutation({
    mutationFn: async ({ itemId, isAvailable }: { itemId: string; isAvailable: boolean }) => {
      const { error } = await supabase
        .from("menu_items")
        .update({ is_available: isAvailable, updated_at: new Date().toISOString() })
        .eq("id", itemId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-items"] })
    },
    onError: () => {
      toast.error("Failed to update availability")
    },
  })

  const handleEdit = (item: MenuItem) => {
    setSelectedItem(item)
    setIsFormOpen(true)
  }

  const handleAdd = () => {
    setSelectedItem(null)
    setIsFormOpen(true)
  }

  const handleDelete = (itemId: string) => {
    if (confirm("Are you sure you want to delete this item?")) {
      deleteItemMutation.mutate(itemId)
    }
  }

  const requestSort = (key: keyof MenuItem) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  }

  const sortedItems = useMemo(() => {
    let sortableItems = menuItems ? [...menuItems] : [];
    if (sortConfig !== null) {
      sortableItems.sort((a:any, b:any) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [menuItems, sortConfig]);

  const filteredItems = sortedItems.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.category as any)?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Menu Items</h1>
          <p className="text-muted-foreground">
            Manage all items on your menu
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              console.log('📤 Import Categories button clicked')
              console.log('📤 Current restaurantId:', restaurantId)
              setIsCategoryCsvImportOpen(true)
            }}
            disabled={!restaurantId}
          >
            <FolderUp className="mr-2 h-4 w-4" />
            Import Categories
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              console.log('📤 Import Items button clicked')
              console.log('📤 Current restaurantId:', restaurantId)
              setIsCSVImportOpen(true)
            }}
            disabled={!restaurantId}
          >
            <Upload className="mr-2 h-4 w-4" />
            Import Items
          </Button>
          <Button onClick={handleAdd} disabled={!restaurantId}>
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
        </div>
      </div>

      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsFormOpen(false)
            setSelectedItem(null)
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedItem ? "Edit Menu Item" : "Add Menu Item"}</DialogTitle>
          </DialogHeader>
          <MenuItemForm
            item={selectedItem || undefined}
            categories={categories || []}
            onSubmit={(data) => itemMutation.mutate(data)}
            onCancel={() => {
              setIsFormOpen(false)
              setSelectedItem(null)
            }}
            isLoading={itemMutation.isPending || categoriesLoading}
          />
        </DialogContent>
      </Dialog>

      <CSVCategoryImportDialog
        open={isCategoryCsvImportOpen}
        onOpenChange={setIsCategoryCsvImportOpen}
        restaurantId={restaurantId}
        onImportComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["menu-categories"] })
        }}
      />

      <CSVImportDialog
        open={isCSVImportOpen}
        onOpenChange={setIsCSVImportOpen}
        categories={categories || []}
        restaurantId={restaurantId}
        onImportComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["menu-items"] })
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>All Menu Items</CardTitle>
          <CardDescription>
            A complete list of all items on your menu.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead onClick={() => requestSort('name')} className="cursor-pointer">
                  Name <ArrowUpDown className="ml-2 h-4 w-4 inline" />
                </TableHead>
                <TableHead>Category</TableHead>
                <TableHead onClick={() => requestSort('price')} className="cursor-pointer">
                  Price <ArrowUpDown className="ml-2 h-4 w-4 inline" />
                </TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Featured</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemsLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">Loading...</TableCell>
                </TableRow>
              ) : filteredItems.map((item) => (
                <TableRow key={item.id} onClick={() => router.push(`/menu/items/${item.id}`)} className="cursor-pointer">
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{(item.category as any)?.name}</Badge>
                  </TableCell>
                  <TableCell>${item.price.toFixed(2)}</TableCell>
                  <TableCell>
                    <Switch
                      checked={item.is_available}
                      onCheckedChange={(checked) => toggleAvailabilityMutation.mutate({ itemId: item.id, isAvailable: checked })}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.is_featured ? "default" : "secondary"}>
                      {item.is_featured ? "Yes" : "No"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
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

// app/(dashboard)/menu/items/[id]/page.tsx
"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
import { MenuItemForm } from "@/components/menu/menu-item-form"
import { toast } from "react-hot-toast"
import { ArrowLeft, Edit, Trash2, DollarSign, Clock, Star, Tag, AlertTriangle } from "lucide-react"
import type { MenuItem, MenuCategory } from "@/types"

export default function MenuItemDetailsPage() {
  const { id: itemId } = useParams()
  const router = useRouter()
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [isEditing, setIsEditing] = useState(false)
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

  const { data: menuItem, isLoading }:any = useQuery({
    queryKey: ["menu-item", itemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("*, category:menu_categories(name)")
        .eq("id", itemId)
        .single()

      if (error) throw error
      return data as MenuItem
    },
    enabled: !!itemId,
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
      const { error } = await supabase
        .from("menu_items")
        .update({ ...itemData, updated_at: new Date().toISOString() })
        .eq("id", itemId as string)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-item", itemId] })
      queryClient.invalidateQueries({ queryKey: ["menu-items"] })
      toast.success("Item updated")
      setIsEditing(false)
    },
    onError: () => {
      toast.error("Failed to update item")
    },
  })

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("menu_items").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-items"] })
      toast.success("Item deleted")
      router.push("/menu/items")
    },
    onError: () => {
      toast.error("Failed to delete item")
    },
  })

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Loading item details...</div>
  }

  if (!menuItem) {
    return <div className="flex justify-center items-center h-64">Item not found.</div>
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Menu Items
        </Button>
        <div className="flex gap-2">
          <Button onClick={() => setIsEditing(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button 
            variant="destructive"
            onClick={() => {
              if (confirm("Are you sure you want to delete this item?")) {
                deleteItemMutation.mutate(menuItem.id)
              }
            }}
            disabled={deleteItemMutation.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Menu Item</DialogTitle>
          </DialogHeader>
          <MenuItemForm
            item={menuItem}
            categories={categories || []}
            onSubmit={(data) => itemMutation.mutate(data)}
            onCancel={() => setIsEditing(false)}
            isLoading={itemMutation.isPending || categoriesLoading}
          />
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-3xl">{menuItem.name}</CardTitle>
              <CardDescription>
                <Badge variant="secondary">{(menuItem.category as any)?.name}</Badge>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={menuItem.is_available ? "default" : "outline"}>
                {menuItem.is_available ? "Available" : "Unavailable"}
              </Badge>
              {menuItem.is_featured && <Badge variant="secondary"><Star className="h-3 w-3 mr-1"/>Featured</Badge>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-8">
          <div>
            {menuItem.image_url ? (
              <Image 
                src={menuItem.image_url} 
                alt={menuItem.name} 
                width={500} 
                height={400} 
                className="rounded-lg object-cover w-full aspect-[4/3]"
              />
            ) : (
              <div className="bg-muted rounded-lg w-full aspect-[4/3] flex items-center justify-center">
                <p className="text-muted-foreground">No image</p>
              </div>
            )}
          </div>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-lg mb-2">Description</h3>
              <p className="text-muted-foreground">{menuItem.description || "No description provided."}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-semibold">${menuItem.price.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">Price</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-semibold">{menuItem.preparation_time || "N/A"} min</p>
                  <p className="text-sm text-muted-foreground">Prep Time</p>
                </div>
              </div>
              {menuItem.calories && (
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-semibold">{menuItem.calories}</p>
                    <p className="text-sm text-muted-foreground">Calories</p>
                  </div>
                </div>
              )}
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-2">Dietary Information</h3>
              <div className="flex flex-wrap gap-2">
                {menuItem.dietary_tags?.length > 0 ? (
                  menuItem.dietary_tags.map((tag:any) => <Badge key={tag}>{tag}</Badge>)
                ) : (
                  <p className="text-sm text-muted-foreground">No dietary tags.</p>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-2">Allergens</h3>
              <div className="flex flex-wrap gap-2">
                {menuItem.allergens?.length > 0 ? (
                  menuItem.allergens.map((allergen:any) => <Badge key={allergen} variant="destructive">{allergen}</Badge>)
                ) : (
                  <p className="text-sm text-muted-foreground">No listed allergens.</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery } from "@tanstack/react-query"
import { getWorkflowAutomationService } from "@/lib/services/workflow-automation"
import { getRestaurantOrchestrator } from "@/lib/services/restaurant-orchestrator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  Plus, 
  Minus, 
  Search, 
  ShoppingCart,
  Users,
  Clock,
  AlertTriangle,
  Utensils,
  Coffee,
  Cake
} from "lucide-react"
import { toast } from "react-hot-toast"
import { cn } from "@/lib/utils"

interface OrderEntryModalProps {
  isOpen: boolean
  onClose: () => void
  restaurantId: string
  onSuccess: () => void
  editOrder?: any
}

interface MenuItem {
  id: string
  name: string
  description?: string
  price: number
  dietary_tags: string[]
  allergens: string[]
  preparation_time?: number
  is_available: boolean
  category: {
    id: string
    name: string
  }
}

interface OrderItem {
  menu_item_id: string
  menu_item: MenuItem
  quantity: number
  special_instructions?: string
  dietary_modifications: string[]
}

interface Booking {
  id: string
  guest_name: string
  party_size: number
  booking_time: string
  status: string
  table?: {
    id: string
    table_number: string
  }
}

export function OrderEntryModal({ 
  isOpen, 
  onClose, 
  restaurantId, 
  onSuccess,
  editOrder 
}: OrderEntryModalProps) {
  const [selectedBooking, setSelectedBooking] = useState<string>("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [orderType, setOrderType] = useState("dine_in")
  const [courseType, setCourseType] = useState("all_courses")
  const [specialInstructions, setSpecialInstructions] = useState("")
  const [dietaryRequirements, setDietaryRequirements] = useState<string[]>([])
  const [priorityLevel, setPriorityLevel] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const supabase = createClient()

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedBooking("")
      setOrderItems([])
      setSpecialInstructions("")
      setDietaryRequirements([])
      setPriorityLevel(1)
      setSearchQuery("")
    }
  }, [isOpen])

  // Fetch active bookings that can have orders added
  const { data: bookingsData } = useQuery({
    queryKey: ['active-bookings', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return { bookings: [] }

      const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`
          id,
          guest_name,
          guest_email,
          party_size,
          booking_time,
          status,
          booking_tables(
            table:restaurant_tables(
              id,
              table_number,
              table_type,
              capacity
            )
          )
        `)
        .eq('restaurant_id', restaurantId)
        .in('status', ['seated', 'ordered', 'appetizers', 'main_course', 'dessert'])
        .gte('booking_time', new Date().toISOString().split('T')[0])
        .order('booking_time', { ascending: true })

      if (error) {
        console.error('Error fetching bookings:', error)
        throw new Error('Failed to fetch bookings')
      }

      return { bookings: bookings || [] }
    },
    enabled: isOpen && !!restaurantId
  })

  // Fetch menu items
  const { data: menuData } = useQuery({
    queryKey: ['menu-items', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return { categories: [], items: [] }

      // Fetch categories
      const { data: categories, error: categoriesError } = await supabase
        .from('menu_categories')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .order('display_order', { ascending: true })

      if (categoriesError) {
        console.error('Error fetching categories:', categoriesError)
        throw new Error('Failed to fetch menu categories')
      }

      // Fetch menu items with category information
      const { data: items, error: itemsError } = await supabase
        .from('menu_items')
        .select(`
          id,
          restaurant_id,
          category_id,
          name,
          description,
          price,
          image_url,
          dietary_tags,
          allergens,
          calories,
          preparation_time,
          is_available,
          is_featured,
          display_order,
          created_at,
          updated_at,
          category:menu_categories!menu_items_category_id_fkey(
            id,
            name,
            description
          )
        `)
        .eq('restaurant_id', restaurantId)
        .eq('is_available', true)
        .order('display_order', { ascending: true })

      if (itemsError) {
        console.error('Error fetching menu items:', itemsError)
        throw new Error('Failed to fetch menu items')
      }

      return { categories: categories || [], items: items || [] }
    },
    enabled: isOpen && !!restaurantId
  })

  const bookings = bookingsData?.bookings || []
  const categories = menuData?.categories || []
  const menuItems = menuData?.items || []

  // Filter menu items
  const filteredItems = menuItems.filter((item: any) => {
    const matchesCategory = selectedCategory === "all" || item.category?.id === selectedCategory
    const matchesSearch = !searchQuery || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch && item.is_available
  })

  const addToOrder = (menuItem: MenuItem) => {
    const existingItem = orderItems.find(item => item.menu_item_id === menuItem.id)
    
    if (existingItem) {
      setOrderItems(items => 
        items.map(item => 
          item.menu_item_id === menuItem.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      )
    } else {
      setOrderItems(items => [...items, {
        menu_item_id: menuItem.id,
        menu_item: menuItem,
        quantity: 1,
        special_instructions: "",
        dietary_modifications: []
      }])
    }
  }

  const updateQuantity = (menuItemId: string, quantity: number) => {
    if (quantity <= 0) {
      setOrderItems(items => items.filter(item => item.menu_item_id !== menuItemId))
    } else {
      setOrderItems(items => 
        items.map(item => 
          item.menu_item_id === menuItemId 
            ? { ...item, quantity }
            : item
        )
      )
    }
  }

  const updateItemInstructions = (menuItemId: string, instructions: string) => {
    setOrderItems(items => 
      items.map(item => 
        item.menu_item_id === menuItemId 
          ? { ...item, special_instructions: instructions }
          : item
      )
    )
  }

  const calculateTotal = () => {
    const subtotal = orderItems.reduce((sum, item) => 
      sum + (item.menu_item.price * item.quantity), 0
    )
    const tax = subtotal * 0.10 // 10% tax
    return { subtotal, tax, total: subtotal + tax }
  }

  const handleSubmit = async () => {
    if (!selectedBooking || orderItems.length === 0) {
      toast.error("Please select a booking and add items to the order")
      return
    }

    setIsSubmitting(true)

    try {
      const selectedBookingData = bookings.find((b: any) => b.id === selectedBooking)
      const { subtotal, tax, total } = calculateTotal()

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('You must be logged in to create orders')
      }

      // Generate order number
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`

      // Create the order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          booking_id: selectedBooking,
          restaurant_id: restaurantId,
          table_id: (selectedBookingData as any)?.booking_tables?.[0]?.table?.id || null,
          order_number: orderNumber,
          status: 'pending',
          order_type: orderType,
          course_type: courseType === "all_courses" ? null : courseType,
          subtotal: subtotal,
          tax_amount: tax,
          total_amount: total,
          special_instructions: specialInstructions || null,
          dietary_requirements: dietaryRequirements,
          priority_level: priorityLevel,
          created_by: user.id
        })
        .select()
        .single()

      if (orderError) {
        console.error('Order creation error:', orderError)
        throw new Error('Failed to create order')
      }

      // Create order items
      const orderItemsData = orderItems.map(item => ({
        order_id: order.id,
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        unit_price: item.menu_item.price,
        total_price: item.menu_item.price * item.quantity,
        special_instructions: item.special_instructions || null,
        dietary_modifications: item.dietary_modifications,
        status: 'pending',
        estimated_prep_time: item.menu_item.preparation_time
      }))

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemsData)

      if (itemsError) {
        console.error('Order items creation error:', itemsError)
        // Try to delete the order if items failed
        await supabase.from('orders').delete().eq('id', order.id)
        throw new Error('Failed to create order items')
      }

      // Trigger workflow automation for order creation
      const workflowService = getWorkflowAutomationService(restaurantId)
      await workflowService.processTrigger(
        'order_status_change',
        order.id,
        undefined,
        'pending',
        { booking_id: selectedBooking, table_id: order.table_id }
      )

      // Update orchestrator state
      const orchestrator = getRestaurantOrchestrator(restaurantId)
      // The orchestrator will automatically pick up the database changes via real-time subscriptions

      toast.success("Order created successfully")
      onSuccess()

    } catch (error: any) {
      console.error('Order creation error:', error)
      toast.error(error.message || "Failed to create order")
    } finally {
      setIsSubmitting(false)
    }
  }

  const { subtotal, tax, total } = calculateTotal()

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Create New Order</DialogTitle>
          <DialogDescription>
            Select a booking and add menu items to create an order
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 grid grid-cols-3 gap-6 overflow-hidden">
          {/* Left Column - Menu Selection */}
          <div className="col-span-2 space-y-4 overflow-hidden">
            {/* Booking Selection */}
            <div className="space-y-2">
              <Label>Select Booking</Label>
              <Select value={selectedBooking} onValueChange={setSelectedBooking}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a booking..." />
                </SelectTrigger>
                <SelectContent>
                  {bookings.map((booking: any) => (
                    <SelectItem key={booking.id} value={booking.id}>
                      <div className="flex items-center gap-2">
                        <span>Table {booking.booking_tables?.[0]?.table?.table_number || 'N/A'}</span>
                        <span>•</span>
                        <span>{booking.guest_name}</span>
                        <span>•</span>
                        <span>{booking.party_size} guests</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Order Settings */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Order Type</Label>
                <Select value={orderType} onValueChange={setOrderType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dine_in">Dine In</SelectItem>
                    <SelectItem value="takeaway">Takeaway</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Course Type</Label>
                <Select value={courseType} onValueChange={setCourseType}>
                  <SelectTrigger>
                    <SelectValue placeholder="All courses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_courses">All courses</SelectItem>
                    <SelectItem value="appetizer">Appetizer</SelectItem>
                    <SelectItem value="main_course">Main Course</SelectItem>
                    <SelectItem value="dessert">Dessert</SelectItem>
                    <SelectItem value="beverage">Beverage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priorityLevel.toString()} onValueChange={(value) => setPriorityLevel(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Normal</SelectItem>
                    <SelectItem value="2">Medium</SelectItem>
                    <SelectItem value="3">High</SelectItem>
                    <SelectItem value="4">Urgent</SelectItem>
                    <SelectItem value="5">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Menu Categories */}
            <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="all">All</TabsTrigger>
                {categories.slice(0, 4).map((category: any) => (
                  <TabsTrigger key={category.id} value={category.id}>
                    {category.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search menu items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Menu Items */}
            <ScrollArea className="flex-1">
              <div className="grid grid-cols-2 gap-3">
                {filteredItems.map((item: any) => (
                  <Card
                    key={item.id}
                    className="cursor-pointer hover:shadow-md transition-shadow bg-card border-border hover:border-primary/50"
                    onClick={() => addToOrder(item)}
                  >
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="flex justify-between items-start">
                          <h4 className="font-medium text-sm text-card-foreground">{item.name}</h4>
                          <span className="font-bold text-sm text-card-foreground">${item.price.toFixed(2)}</span>
                        </div>

                        {item.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {item.description}
                          </p>
                        )}
                        
                        <div className="flex flex-wrap gap-1">
                          {item.dietary_tags?.map((tag: any) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        
                        {item.preparation_time && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{item.preparation_time}min</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Right Column - Order Summary */}
          <div className="space-y-4 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              <h3 className="font-semibold">Order Summary</h3>
              <Badge variant="secondary">{orderItems.length} items</Badge>
            </div>

            <ScrollArea className="flex-1">
              <div className="space-y-3">
                {orderItems.map((item) => (
                  <Card key={item.menu_item_id} className="bg-card border-border">
                    <CardContent className="p-3">
                      <div className="space-y-2">
                        <div className="flex justify-between items-start">
                          <span className="font-medium text-sm text-card-foreground">{item.menu_item.name}</span>
                          <span className="font-bold text-sm text-card-foreground">
                            ${(item.menu_item.price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateQuantity(item.menu_item_id, item.quantity - 1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateQuantity(item.menu_item_id, item.quantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        
                        <Input
                          placeholder="Special instructions..."
                          value={item.special_instructions || ""}
                          onChange={(e) => updateItemInstructions(item.menu_item_id, e.target.value)}
                          className="text-xs"
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>

            {/* Special Instructions */}
            <div className="space-y-2">
              <Label>Order Instructions</Label>
              <Textarea
                placeholder="Special instructions for the entire order..."
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                rows={3}
              />
            </div>

            {/* Order Total */}
            <div className="space-y-2 border-t border-border pt-4">
              <div className="flex justify-between text-sm text-foreground">
                <span>Subtotal:</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-foreground">
                <span>Tax (10%):</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-foreground">
                <span>Total:</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedBooking || orderItems.length === 0}
              className="w-full"
            >
              {isSubmitting ? "Creating Order..." : "Create Order"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

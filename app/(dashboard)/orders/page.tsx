"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useOrders, useUpdateOrderStatus } from "@/lib/hooks/use-orders"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Plus, 
  Search, 
  Filter,
  Clock,
  Users,
  ChefHat,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Receipt,
  Edit,
  Trash2
} from "lucide-react"
import { format } from "date-fns"
import { toast } from "react-hot-toast"
import { cn } from "@/lib/utils"
import { OrderEntryModal } from "@/components/orders/order-entry-modal"
import { getPrintService } from "@/lib/services/print-service"
import { QuickPrintButton } from "@/components/orders/order-receipt-actions"

interface Order {
  id: string
  order_number: string
  status: string
  order_type: string
  course_type?: string
  subtotal: number
  tax_amount: number
  total_amount: number
  special_instructions?: string
  dietary_requirements: string[]
  priority_level: number
  created_at: string
  updated_at: string
  booking?: {
    id: string
    guest_name: string
    party_size: number
    booking_time: string
  }
  table?: {
    id: string
    table_number: string
    table_type: string
  }
  order_items: any[]
  created_by_profile?: {
    full_name: string
  }
}

const STATUS_COLORS = {
  pending: "bg-muted",
  confirmed: "bg-primary",
  preparing: "bg-secondary",
  ready: "bg-accent",
  served: "bg-primary/80",
  completed: "bg-muted",
  cancelled: "bg-destructive"
}

const STATUS_LABELS = {
  pending: "Pending",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready: "Ready",
  served: "Served",
  completed: "Completed",
  cancelled: "Cancelled"
}

// Order Card Component
function OrderCard({
  order,
  onStatusUpdate,
  onCancel,
  onEdit,
  isUpdating
}: {
  order: Order
  onStatusUpdate: (orderId: string, status: string) => void
  onCancel: (orderId: string) => void
  onEdit: () => void
  isUpdating: boolean
}) {
  const nextStatus = getNextStatus(order.status)
  const statusAction = getStatusAction(order.status)

  return (
    <Card className="transition-all duration-200 hover:shadow-lg bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-3 h-3 rounded-full",
              STATUS_COLORS[order.status as keyof typeof STATUS_COLORS]
            )} />
            <CardTitle className="text-lg font-bold text-card-foreground">
              {order.order_number}
            </CardTitle>
            <Badge variant="outline">
              {STATUS_LABELS[order.status as keyof typeof STATUS_LABELS]}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Print Button */}
            <QuickPrintButton
              order={order}
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            />

            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              disabled={isUpdating}
            >
              <Edit className="h-4 w-4" />
            </Button>
            {!['completed', 'cancelled'].includes(order.status) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCancel(order.id)}
                disabled={isUpdating}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Order Info */}
        <div className="space-y-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>Table {order.table?.table_number || 'N/A'}</span>
            <span>•</span>
            <span>{order.booking?.guest_name}</span>
            <span>•</span>
            <span>{order.booking?.party_size} guests</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>{format(new Date(order.created_at), 'HH:mm')}</span>
            <span>•</span>
            <span>{order.order_type}</span>
            {order.course_type && (
              <>
                <span>•</span>
                <span className="capitalize">{order.course_type.replace('_', ' ')}</span>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Order Items Summary */}
        <div className="space-y-2">
          <div className="text-sm font-medium">
            Items ({order.order_items.length})
          </div>
          <div className="space-y-1">
            {order.order_items.slice(0, 3).map((item: any, index: number) => (
              <div key={index} className="flex items-center justify-between text-sm text-foreground">
                <span>{item.quantity}x {item.menu_item.name}</span>
                <span>${item.total_price.toFixed(2)}</span>
              </div>
            ))}
            {order.order_items.length > 3 && (
              <div className="text-xs text-muted-foreground">
                +{order.order_items.length - 3} more items
              </div>
            )}
          </div>
        </div>

        {/* Special Instructions */}
        {order.special_instructions && (
          <Alert className="border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950/30">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <AlertDescription className="text-sm text-yellow-800 dark:text-yellow-200">
              {order.special_instructions}
            </AlertDescription>
          </Alert>
        )}

        {/* Dietary Requirements */}
        {order.dietary_requirements.length > 0 && (
          <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/30 rounded border border-blue-200 dark:border-blue-800">
            <ChefHat className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Dietary: {order.dietary_requirements.join(', ')}
            </span>
          </div>
        )}

        {/* Total */}
        <div className="border-t border-border pt-3">
          <div className="flex justify-between items-center">
            <span className="font-medium text-foreground">Total</span>
            <span className="font-bold text-lg text-foreground">${order.total_amount.toFixed(2)}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Subtotal: ${order.subtotal.toFixed(2)} + Tax: ${order.tax_amount.toFixed(2)}
          </div>
        </div>

        {/* Action Buttons */}
        {nextStatus && statusAction && (
          <Button
            onClick={() => onStatusUpdate(order.id, nextStatus)}
            disabled={isUpdating}
            className="w-full"
            variant={order.status === 'ready' ? 'default' : 'outline'}
          >
            {isUpdating ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            {statusAction}
          </Button>
        )}

        {/* Created By */}
        <div className="text-xs text-muted-foreground">
          Created by {order.created_by_profile?.full_name || 'Unknown'}
        </div>
      </CardContent>
    </Card>
  )
}

function getNextStatus(currentStatus: string) {
  switch (currentStatus) {
    case 'pending': return 'confirmed'
    case 'confirmed': return 'preparing'
    case 'preparing': return 'ready'
    case 'ready': return 'served'
    case 'served': return 'completed'
    default: return null
  }
}

function getStatusAction(currentStatus: string) {
  switch (currentStatus) {
    case 'pending': return 'Confirm Order'
    case 'confirmed': return 'Start Preparing'
    case 'preparing': return 'Mark Ready'
    case 'ready': return 'Mark Served'
    case 'served': return 'Complete Order'
    default: return null
  }
}

export default function OrdersPage() {
  const [selectedTab, setSelectedTab] = useState("active")
  const [isOrderEntryOpen, setIsOrderEntryOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [restaurantId, setRestaurantId] = useState<string>("")
  
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Get restaurant ID from staff data
  useEffect(() => {
    const getRestaurantId = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: staff } = await supabase
          .from('restaurant_staff')
          .select('restaurant_id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single()
        
        if (staff) {
          setRestaurantId(staff.restaurant_id)
        }
      }
    }
    getRestaurantId()
  }, [supabase])

  // Fetch orders using hooks
  const { data: ordersData, isLoading, error } = useOrders(restaurantId, {
    status: selectedTab === 'active' ? 'pending,confirmed,preparing,ready' : (selectedTab !== 'all' ? selectedTab : undefined),
    date: format(new Date(), 'yyyy-MM-dd')
  })

    // Update order status using hook
  const updateOrderMutation = useUpdateOrderStatus()

  // Delete order mutation
  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Cancelled by staff' })
      })
      
      if (!response.ok) throw new Error('Failed to cancel order')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      toast.success('Order cancelled successfully')
    },
    onError: (error) => {
      toast.error('Failed to cancel order')
      console.error('Delete error:', error)
    }
  })

  const orders = ordersData || []

  // Group orders by status for better organization
  const groupedOrders = orders.reduce((acc: any, order: Order) => {
    if (!acc[order.status]) acc[order.status] = []
    acc[order.status].push(order)
    return acc
  }, {})

  const handleStatusUpdate = (orderId: string, newStatus: string) => {
    updateOrderMutation.mutate({ orderId, status: newStatus })
  }

  const handleCancelOrder = (orderId: string) => {
    if (confirm('Are you sure you want to cancel this order?')) {
      deleteOrderMutation.mutate(orderId)
    }
  }

  const handlePrintReceipt = async (order: any) => {
    try {
      const printService = getPrintService()

      // Get booking information for the receipt
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select(`
          *,
          booking_tables(
            table:restaurant_tables(table_number)
          )
        `)
        .eq('id', order.booking_id)
        .single()

      if (bookingError) {
        console.error('Error fetching booking:', bookingError)
        toast.error("Failed to fetch booking information")
        return
      }

      // Get order items with menu item details
      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          *,
          menu_item:menu_items(name, price)
        `)
        .eq('order_id', order.id)

      if (itemsError) {
        console.error('Error fetching order items:', itemsError)
        toast.error("Failed to fetch order items")
        return
      }

      // Prepare receipt data
      const receiptData = {
        order_id: order.id,
        order_number: order.order_number,
        guest_name: booking.guest_name || 'Guest',
        table_number: booking.booking_tables?.[0]?.table?.table_number || 'N/A',
        order_items: orderItems || [],
        subtotal: order.subtotal,
        tax_amount: order.tax_amount,
        total_amount: order.total_amount,
        special_instructions: order.special_instructions,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString()
      }

      // Print order receipt
      await printService.printOrderReceipt(receiptData)
      toast.success("Receipt sent to printer!")

    } catch (error: any) {
      console.error('Error printing receipt:', error)
      toast.error(error.message || "Failed to print receipt")
    }
  }

  const handlePrintCustomerReceipt = async (bookingId: string) => {
    try {
      const printService = getPrintService()

      // Get complete booking information with all orders
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select(`
          *,
          booking_tables(
            table:restaurant_tables(table_number)
          ),
          orders(
            *,
            order_items(
              *,
              menu_item:menu_items(name, price)
            )
          )
        `)
        .eq('id', bookingId)
        .single()

      if (bookingError || !booking) {
        console.error('Error fetching booking:', bookingError)
        toast.error("Failed to fetch booking information")
        return
      }

      // Prepare customer receipt data
      const receiptData = {
        booking_id: booking.id,
        guest_name: booking.guest_name || 'Guest',
        party_size: booking.party_size,
        table_number: booking.booking_tables?.[0]?.table?.table_number || 'N/A',
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        orders: booking.orders || [],
        include_itemized: true,
        include_payment_summary: true,
        footer_message: 'Thank you for dining with us!'
      }

      // Print complete customer receipt
      await printService.printReceipt(receiptData)
      toast.success("Customer receipt sent to printer!")

    } catch (error: any) {
      console.error('Error printing customer receipt:', error)
      toast.error(error.message || "Failed to print customer receipt")
    }
  }

  const handlePrintDailyReport = async () => {
    try {
      const printService = getPrintService()

      // Get today's orders with details
      const today = new Date().toISOString().split('T')[0]
      const { data: todaysOrders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          booking:bookings!orders_booking_id_fkey(
            guest_name,
            party_size
          ),
          order_items(
            *,
            menu_item:menu_items(name, price)
          )
        `)
        .eq('restaurant_id', restaurantId)
        .gte('created_at', `${today}T00:00:00`)
        .lt('created_at', `${today}T23:59:59`)
        .order('created_at', { ascending: false })

      if (ordersError) {
        console.error('Error fetching daily orders:', ordersError)
        toast.error("Failed to fetch daily orders")
        return
      }

      // Calculate daily statistics
      const totalOrders = todaysOrders?.length || 0
      const completedOrders = todaysOrders?.filter(o => o.status === 'completed').length || 0
      const totalRevenue = todaysOrders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0

      // Prepare daily report data
      const reportData = {
        type: 'daily_report',
        date: new Date().toLocaleDateString(),
        restaurant_id: restaurantId,
        orders: todaysOrders || [],
        statistics: {
          total_orders: totalOrders,
          completed_orders: completedOrders,
          pending_orders: totalOrders - completedOrders,
          total_revenue: totalRevenue,
          average_order_value: totalOrders > 0 ? totalRevenue / totalOrders : 0
        }
      }

      // Print daily report using kitchen summary template (we can create a specific template later)
      await printService.printKitchenSummary({
        booking_id: 'daily-report',
        guest_name: 'Daily Report',
        table_number: 'All Tables',
        orders: todaysOrders || [],
        completion_time: new Date().toLocaleTimeString(),
        include_timing: true,
        include_notes: true,
        report_data: reportData
      })

      toast.success("Daily report sent to printer!")

    } catch (error: any) {
      console.error('Error printing daily report:', error)
      toast.error(error.message || "Failed to print daily report")
    }
  }



  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading orders...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert className="m-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load orders. Please refresh the page.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Order Management</h1>
          <p className="text-muted-foreground">
            Manage customer orders and track kitchen workflow
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handlePrintDailyReport()}
            className="gap-2"
          >
            <Receipt className="h-4 w-4" />
            Print Daily Report
          </Button>

          <Button onClick={() => setIsOrderEntryOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Order
          </Button>
        </div>
      </div>

      {/* Status Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="active">Active ({orders.filter((o: any) => ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status)).length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({orders.filter((o: any) => o.status === 'pending').length})</TabsTrigger>
          <TabsTrigger value="preparing">Preparing ({orders.filter((o: any) => o.status === 'preparing').length})</TabsTrigger>
          <TabsTrigger value="ready">Ready ({orders.filter((o: any) => o.status === 'ready').length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({orders.filter((o: any) => o.status === 'completed').length})</TabsTrigger>
          <TabsTrigger value="all">All ({orders.length})</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedTab} className="space-y-4">
          {orders.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground">No orders found</p>
              <p className="text-sm text-muted-foreground/70">Create a new order to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {orders.map((order: any) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onStatusUpdate={handleStatusUpdate}
                  onCancel={handleCancelOrder}
                  onEdit={() => setSelectedOrder(order)}
                  isUpdating={updateOrderMutation.isPending || deleteOrderMutation.isPending}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Order Entry Modal */}
      <OrderEntryModal
        isOpen={isOrderEntryOpen}
        onClose={() => setIsOrderEntryOpen(false)}
        restaurantId={restaurantId}
        onSuccess={() => {
          setIsOrderEntryOpen(false)
          queryClient.invalidateQueries({ queryKey: ['orders'] })
        }}
      />
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRealTimeService } from "@/lib/services/real-time-service"
import { getWorkflowAutomationService } from "@/lib/services/workflow-automation"
import { useRestaurantOrchestrator } from "@/lib/services/restaurant-orchestrator"
import { usePrintService } from "@/lib/services/print-service"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Clock,
  ChefHat,
  AlertTriangle,
  CheckCircle,
  Timer,
  Users,
  Utensils,
  Coffee,
  Cake,
  Play,
  Pause,
  Check,
  X,
  RefreshCw,
  Wifi,
  WifiOff,
  Volume2,
  VolumeX,
  Receipt
} from "lucide-react"
import { format, differenceInMinutes } from "date-fns"
import { toast } from "react-hot-toast"
import { cn } from "@/lib/utils"

interface Order {
  id: string
  order_number: string
  status: string
  priority_level: number
  created_at: string
  updated_at: string
  course_type?: string
  special_instructions?: string
  dietary_requirements: string[]
  table?: {
    table_number: string
  }
  booking?: {
    guest_name: string
    party_size: number
  }
  order_items: OrderItem[]
  timing?: {
    elapsed_minutes: number
    estimated_completion: Date
    is_overdue: boolean
    max_prep_time: number
  }
}

interface OrderItem {
  id: string
  quantity: number
  status: string
  special_instructions?: string
  dietary_modifications: string[]
  estimated_prep_time?: number
  menu_item: {
    id: string
    name: string
    description?: string
    dietary_tags: string[]
    allergens: string[]
    preparation_time?: number
    category?: {
      name: string
    }
  }
  order_modifications: any[]
}

const STATUS_COLORS = {
  confirmed: "bg-blue-500",
  preparing: "bg-yellow-500",
  ready: "bg-green-500",
  served: "bg-muted"
}

const STATUS_ICONS = {
  confirmed: Timer,
  preparing: ChefHat,
  ready: CheckCircle,
  served: Check
}

const PRIORITY_COLORS = {
  1: "border-border",
  2: "border-blue-400",
  3: "border-yellow-400",
  4: "border-orange-400",
  5: "border-destructive"
}

// Order Card Component
function OrderCard({
  order,
  onStatusUpdate,
  isUpdating,
  onPrint
}: {
  order: Order
  onStatusUpdate: (orderId: string, status: string, orderItemId?: string) => void
  isUpdating: boolean
  onPrint?: (orderId: string, ticketType: 'kitchen' | 'service') => void
}) {
  const StatusIcon = STATUS_ICONS[order.status as keyof typeof STATUS_ICONS] || Timer
  const elapsedMinutes = order.timing?.elapsed_minutes || 0
  const isOverdue = order.timing?.is_overdue || false

  const getNextStatus = (currentStatus: string) => {
    switch (currentStatus) {
      case 'confirmed': return 'preparing'
      case 'preparing': return 'ready'
      case 'ready': return 'served'
      default: return null
    }
  }

  const getStatusAction = (currentStatus: string) => {
    switch (currentStatus) {
      case 'confirmed': return 'Start Cooking'
      case 'preparing': return 'Mark Ready'
      case 'ready': return 'Mark Served'
      default: return null
    }
  }

  const nextStatus = getNextStatus(order.status)
  const statusAction = getStatusAction(order.status)

  return (
    <Card className={cn(
      "transition-all duration-200 hover:shadow-lg bg-card border-border",
      PRIORITY_COLORS[order.priority_level as keyof typeof PRIORITY_COLORS],
      isOverdue && "border-destructive bg-destructive/5 dark:bg-destructive/10",
      order.status === 'ready' && "ring-2 ring-green-500/50 border-green-500/50"
    )}>
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
            {order.priority_level > 3 && (
              <Badge variant="destructive" className="text-xs">
                HIGH PRIORITY
              </Badge>
            )}
          </div>

          <div className="text-right">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>Table {order.table?.table_number || 'N/A'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4" />
              <span className={cn(
                "font-medium",
                isOverdue ? "text-destructive" : elapsedMinutes > 15 ? "text-yellow-600 dark:text-yellow-400" : "text-green-600 dark:text-green-400"
              )}>
                {elapsedMinutes}m
              </span>
            </div>
          </div>
        </div>

        {/* Customer Info */}
        <div className="text-sm text-muted-foreground">
          {order.booking?.guest_name} • {order.booking?.party_size} guests
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Order Items */}
        <div className="space-y-2">
          {order.order_items.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-2 bg-muted/50 rounded border border-border">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{item.quantity}x</span>
                  <span className="font-medium text-foreground">{item.menu_item.name}</span>
                  {item.menu_item.dietary_tags.length > 0 && (
                    <div className="flex gap-1">
                      {item.menu_item.dietary_tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Special Instructions */}
                {item.special_instructions && (
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 font-medium">
                    Note: {item.special_instructions}
                  </p>
                )}

                {/* Dietary Modifications */}
                {item.dietary_modifications.length > 0 && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    Modifications: {item.dietary_modifications.join(', ')}
                  </p>
                )}

                {/* Allergen Warnings */}
                {item.menu_item.allergens.length > 0 && (
                  <p className="text-xs text-destructive mt-1 font-medium">
                    ⚠️ Allergens: {item.menu_item.allergens.join(', ')}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Badge variant={
                  item.status === 'ready' ? 'default' :
                  item.status === 'preparing' ? 'secondary' : 'outline'
                }>
                  {item.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>

        {/* Special Instructions for Order */}
        {order.special_instructions && (
          <Alert className="border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950/30">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <AlertDescription className="font-medium text-yellow-800 dark:text-yellow-200">
              {order.special_instructions}
            </AlertDescription>
          </Alert>
        )}

        {/* Dietary Requirements */}
        {order.dietary_requirements.length > 0 && (
          <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/30 rounded border border-blue-200 dark:border-blue-800">
            <Utensils className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Dietary: {order.dietary_requirements.join(', ')}
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2 pt-2">
          <div className="flex gap-2">
            {nextStatus && statusAction && (
              <Button
                onClick={() => onStatusUpdate(order.id, nextStatus)}
                disabled={isUpdating}
                className="flex-1"
                variant={order.status === 'ready' ? 'default' : 'outline'}
              >
                {isUpdating ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <StatusIcon className="h-4 w-4 mr-2" />
                )}
                {statusAction}
              </Button>
            )}

            {order.status !== 'served' && (
              <Button
                onClick={() => onStatusUpdate(order.id, 'cancelled')}
                disabled={isUpdating}
                variant="destructive"
                size="sm"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Print Buttons */}
          {onPrint && (
            <div className="flex gap-2">
              <Button
                onClick={() => onPrint(order.id, 'kitchen')}
                disabled={isUpdating}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                <Receipt className="h-4 w-4 mr-1" />
                Print Kitchen
              </Button>
              {order.status === 'ready' && (
                <Button
                  onClick={() => onPrint(order.id, 'service')}
                  disabled={isUpdating}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  <Receipt className="h-4 w-4 mr-1" />
                  Print Service
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Timing Info */}
        <div className="text-xs text-muted-foreground border-t border-border pt-2">
          <div className="flex justify-between">
            <span>Created: {format(new Date(order.created_at), 'HH:mm')}</span>
            {order.timing?.estimated_completion && (
              <span>
                Est. ready: {format(order.timing.estimated_completion, 'HH:mm')}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function KitchenDashboard() {
  const [selectedStation, setSelectedStation] = useState<string>("all")
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
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

  // Real-time service
  const { connectionStatus, subscribe, triggerOrderUpdate } = useRealTimeService(restaurantId)

  // Print service
  const { printOrderTicket, autoPrint, isPrinting } = usePrintService()

  // Subscribe to real-time updates
  useEffect(() => {
    if (!restaurantId) return

    const unsubscribe = subscribe('kitchen_update', (event) => {
      queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] })
      
      if (soundEnabled && event.type === 'order_created') {
        // Play notification sound
        const audio = new Audio('/sounds/notification.mp3')
        audio.play().catch(() => {}) // Ignore errors if sound fails
      }
    })

    return unsubscribe
  }, [restaurantId, subscribe, queryClient, soundEnabled])

  // Fetch kitchen orders
  const { data: ordersData, isLoading, error } = useQuery({
    queryKey: ['kitchen-orders', restaurantId, selectedStation],
    queryFn: async () => {
      if (!restaurantId) return { orders: [], summary: {} }
      
      const params = new URLSearchParams({
        status: 'active',
        ...(selectedStation !== 'all' && { station_id: selectedStation })
      })
      
      const response = await fetch(`/api/kitchen/orders?${params}`)
      if (!response.ok) throw new Error('Failed to fetch orders')
      return response.json()
    },
    enabled: !!restaurantId,
    refetchInterval: autoRefresh ? 30000 : false // 30 seconds
  })

  // Fetch kitchen stations
  const { data: stationsData } = useQuery({
    queryKey: ['kitchen-stations', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return { stations: [] }
      
      const response = await fetch('/api/kitchen/stations')
      if (!response.ok) throw new Error('Failed to fetch stations')
      return response.json()
    },
    enabled: !!restaurantId
  })

  // Update order status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, orderItemId, status, notes }: {
      orderId?: string
      orderItemId?: string
      status: string
      notes?: string
    }) => {
      const response = await fetch('/api/kitchen/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: [{
            order_id: orderId,
            order_item_id: orderItemId,
            status,
            notes
          }]
        })
      })
      
      if (!response.ok) throw new Error('Failed to update status')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] })
      toast.success('Status updated successfully')
    },
    onError: (error) => {
      toast.error('Failed to update status')
      console.error('Status update error:', error)
    }
  })

  const orders = ordersData?.orders || []
  const summary = ordersData?.summary || {}

  // Handle print requests
  const handlePrint = async (orderId: string, ticketType: 'kitchen' | 'service') => {
    try {
      const success = await printOrderTicket(orderId, ticketType)
      if (success) {
        toast.success(`${ticketType} ticket printed successfully`)
      } else {
        toast.error(`Failed to print ${ticketType} ticket`)
      }
    } catch (error) {
      toast.error(`Print error: ${error}`)
    }
  }

  // Group orders by course type for better organization
  const groupedOrders = orders.reduce((acc: any, order: Order) => {
    const courseType = order.course_type || 'all_courses'
    if (!acc[courseType]) acc[courseType] = []
    acc[courseType].push(order)
    return acc
  }, {})

  const handleStatusUpdate = (orderId: string, newStatus: string, orderItemId?: string) => {
    if (orderItemId) {
      // Handle order item status updates
      updateStatusMutation.mutate({
        orderId: orderItemId ? undefined : orderId,
        orderItemId,
        status: newStatus
      })
    } else {
      // Handle order-level status updates
      const updateOrderStatus = async () => {
        const response = await fetch(`/api/orders/${orderId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: newStatus,
            notes: `Status updated from kitchen display`
          })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to update status')
        }

        return response.json()
      }

      updateOrderStatus().then(async () => {
        // Trigger workflow automation
        const workflowService = getWorkflowAutomationService(restaurantId)
        const order = orders.find((o: any) => o.id === orderId)

        if (order) {
          await workflowService.processTrigger(
            'order_status_change',
            orderId,
            order.status,
            newStatus,
            {
              booking_id: order.booking_id,
              table_id: order.table_id,
              course_type: order.course_type
            }
          )
        }

        queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] })
        toast.success('Status updated successfully')

        // Auto-print tickets based on status change
        if (order) {
          await autoPrint(orderId, newStatus, order.order_type)
        }
      }).catch((error) => {
        toast.error(error.message || 'Failed to update status')
        console.error('Status update error:', error)
      })
    }

    // Trigger immediate UI update
    triggerOrderUpdate({
      type: 'order_status_changed',
      order_id: orderId,
      new_status: newStatus,
      timestamp: new Date().toISOString()
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading kitchen orders...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert className="m-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load kitchen orders. Please refresh the page.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header - Optimized for landscape tablets */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ChefHat className="h-6 w-6" />
            Kitchen Display
          </h1>
          
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            {connectionStatus === 'open' ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-destructive" />
            )}
            <span className="text-sm text-muted-foreground">
              {connectionStatus === 'open' ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-sm font-medium">{summary.confirmed || 0} New</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <span className="text-sm font-medium">{summary.preparing || 0} Preparing</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm font-medium">{summary.ready || 0} Ready</span>
          </div>
          {summary.overdue > 0 && (
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">{summary.overdue} Overdue</span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant={soundEnabled ? "default" : "outline"}
            size="sm"
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
          
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={cn("h-4 w-4", autoRefresh && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Station Filter Tabs */}
      <div className="bg-card border-b border-border px-4 py-2">
        <Tabs value={selectedStation} onValueChange={setSelectedStation}>
          <TabsList className="grid w-full grid-cols-8">
            <TabsTrigger value="all">All Stations</TabsTrigger>
            {stationsData?.stations?.map((station: any) => (
              <TabsTrigger key={station.id} value={station.id}>
                {station.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Orders Grid - Optimized for 8-inch landscape */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4">
            {Object.keys(groupedOrders).length === 0 ? (
              <div className="text-center py-12">
                <ChefHat className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg text-muted-foreground">No active orders</p>
                <p className="text-sm text-muted-foreground/70">New orders will appear here</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {Object.entries(groupedOrders).map(([courseType, courseOrders]) => (
                  <div key={courseType} className="space-y-4">
                    {courseType !== 'all_courses' && (
                      <h3 className="font-semibold text-lg capitalize flex items-center gap-2">
                        {courseType === 'appetizer' && <Coffee className="h-5 w-5" />}
                        {courseType === 'main_course' && <Utensils className="h-5 w-5" />}
                        {courseType === 'dessert' && <Cake className="h-5 w-5" />}
                        {courseType.replace('_', ' ')}
                      </h3>
                    )}
                    
                    {(courseOrders as Order[]).map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onStatusUpdate={handleStatusUpdate}
                        isUpdating={updateStatusMutation.isPending}
                        onPrint={handlePrint}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

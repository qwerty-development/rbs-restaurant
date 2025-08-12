"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"
import { getUnifiedWorkflow } from "@/lib/services/unified-restaurant-workflow"
import { 
  CheckCircle, 
  Users, 
  Plus, 
  Receipt, 
  Download,
  ChevronDown,
  Loader2,
  ClipboardCheck,
  Utensils,
  Clock
} from "lucide-react"
import { toast } from "react-hot-toast"

interface ContextualActionsProps {
  entityType: 'booking' | 'order' | 'table'
  entityId: string
  currentStatus: string
  restaurantId: string
  data?: any
  onActionComplete?: (action: string, result: any) => void
  triggeredBy?: string
  className?: string
}

export function ContextualActions({
  entityType,
  entityId,
  currentStatus,
  restaurantId,
  data,
  onActionComplete,
  triggeredBy = 'interface',
  className
}: ContextualActionsProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  const workflow = getUnifiedWorkflow(restaurantId)

  const handleAction = async (action: string, actionFn: () => Promise<any>) => {
    setIsLoading(true)
    setLoadingAction(action)
    
    try {
      const result = await actionFn()
      
      if (result.success) {
        toast.success(`${action} completed successfully`)
        result.actions.forEach((actionMsg: string) => {
          console.log(`✅ ${actionMsg}`)
        })
      } else {
        toast.error(`Failed to ${action.toLowerCase()}`)
        result.errors?.forEach((error: string) => {
          console.error(`❌ ${error}`)
        })
      }

      onActionComplete?.(action, result)
      
    } catch (error: any) {
      console.error(`Error in ${action}:`, error)
      toast.error(error.message || `Failed to ${action.toLowerCase()}`)
    } finally {
      setIsLoading(false)
      setLoadingAction(null)
    }
  }

  // Booking Actions
  if (entityType === 'booking') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {/* Seat Guests Action */}
        {currentStatus === 'confirmed' && (
          <Button
            onClick={() => handleAction('Seat Guests', () => 
              workflow.seatGuests(entityId, data?.table_ids || [], triggeredBy)
            )}
            disabled={isLoading}
            className="gap-2"
          >
            {loadingAction === 'Seat Guests' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Users className="h-4 w-4" />
            )}
            Seat Guests
          </Button>
        )}

        {/* Add Order Action */}
        {['seated', 'ordered', 'dining'].includes(currentStatus) && (
          <Button
            variant="outline"
            onClick={() => handleAction('Add Order', () => 
              // This would open order entry modal
              Promise.resolve({ success: true, actions: ['Order entry opened'] })
            )}
            disabled={isLoading}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Order
          </Button>
        )}

        {/* Complete Booking Action */}
        {['dining', 'ordered'].includes(currentStatus) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="default"
                disabled={isLoading}
                className="gap-2"
              >
                {loadingAction === 'Complete Booking' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Complete Booking
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => handleAction('Complete Booking', () => 
                  workflow.completeBooking(entityId, triggeredBy)
                )}
                disabled={isLoading}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Complete & Print Receipt
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleAction('Download Receipt', () => 
                  // This would generate and download receipt
                  Promise.resolve({ success: true, actions: ['Receipt downloaded'] })
                )}
                disabled={isLoading}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Receipt Only
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Download Receipt for Completed Bookings */}
        {currentStatus === 'completed' && (
          <Button
            variant="outline"
            onClick={() => handleAction('Download Receipt', () => 
              // This would regenerate and download receipt
              Promise.resolve({ success: true, actions: ['Receipt downloaded'] })
            )}
            disabled={isLoading}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Download Receipt
          </Button>
        )}
      </div>
    )
  }

  // Order Actions
  if (entityType === 'order') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {/* Complete Order Action */}
        {['preparing', 'ready', 'served'].includes(currentStatus) && (
          <Button
            onClick={() => handleAction('Complete Order', () => 
              workflow.completeOrder(entityId, triggeredBy)
            )}
            disabled={isLoading}
            variant={currentStatus === 'ready' ? 'default' : 'outline'}
            className="gap-2"
          >
            {loadingAction === 'Complete Order' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            Complete Order
          </Button>
        )}

        {/* Print Receipt Action */}
        {['served', 'completed'].includes(currentStatus) && (
          <Button
            variant="ghost"
            onClick={() => handleAction('Print Receipt', () => 
              // This would print order receipt
              Promise.resolve({ success: true, actions: ['Receipt printed'] })
            )}
            disabled={isLoading}
            className="gap-2"
          >
            <Receipt className="h-4 w-4" />
            Print Receipt
          </Button>
        )}
      </div>
    )
  }

  // Table Actions
  if (entityType === 'table') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {/* Clean Table Action */}
        {currentStatus === 'needs_cleaning' && (
          <Button
            onClick={() => handleAction('Clean Table', () => 
              // This would mark table as available
              Promise.resolve({ success: true, actions: ['Table marked as clean'] })
            )}
            disabled={isLoading}
            className="gap-2"
          >
            {loadingAction === 'Clean Table' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ClipboardCheck className="h-4 w-4" />
            )}
            Mark Clean
          </Button>
        )}
      </div>
    )
  }

  return null
}

// Status Badge Component with contextual styling
export function StatusBadge({ 
  status, 
  entityType 
}: { 
  status: string
  entityType: 'booking' | 'order' | 'table'
}) {
  const getStatusConfig = () => {
    if (entityType === 'booking') {
      switch (status) {
        case 'confirmed': return { variant: 'secondary' as const, icon: Clock, color: 'text-blue-600' }
        case 'seated': return { variant: 'default' as const, icon: Users, color: 'text-green-600' }
        case 'ordered': return { variant: 'default' as const, icon: Utensils, color: 'text-orange-600' }
        case 'dining': return { variant: 'default' as const, icon: Utensils, color: 'text-purple-600' }
        case 'completed': return { variant: 'secondary' as const, icon: CheckCircle, color: 'text-gray-600' }
        default: return { variant: 'outline' as const, icon: Clock, color: 'text-gray-500' }
      }
    }
    
    if (entityType === 'order') {
      switch (status) {
        case 'pending': return { variant: 'secondary' as const, icon: Clock, color: 'text-yellow-600' }
        case 'confirmed': return { variant: 'default' as const, icon: CheckCircle, color: 'text-blue-600' }
        case 'preparing': return { variant: 'default' as const, icon: Utensils, color: 'text-orange-600' }
        case 'ready': return { variant: 'destructive' as const, icon: CheckCircle, color: 'text-red-600' }
        case 'served': return { variant: 'default' as const, icon: CheckCircle, color: 'text-green-600' }
        case 'completed': return { variant: 'secondary' as const, icon: CheckCircle, color: 'text-gray-600' }
        default: return { variant: 'outline' as const, icon: Clock, color: 'text-gray-500' }
      }
    }

    if (entityType === 'table') {
      switch (status) {
        case 'available': return { variant: 'secondary' as const, icon: CheckCircle, color: 'text-green-600' }
        case 'occupied': return { variant: 'destructive' as const, icon: Users, color: 'text-red-600' }
        case 'reserved': return { variant: 'default' as const, icon: Clock, color: 'text-blue-600' }
        case 'needs_cleaning': return { variant: 'default' as const, icon: ClipboardCheck, color: 'text-orange-600' }
        default: return { variant: 'outline' as const, icon: Clock, color: 'text-gray-500' }
      }
    }

    return { variant: 'outline' as const, icon: Clock, color: 'text-gray-500' }
  }

  const { variant, icon: Icon, color } = getStatusConfig()

  return (
    <Badge variant={variant} className="gap-1">
      <Icon className={`h-3 w-3 ${color}`} />
      {status.replace('_', ' ').toUpperCase()}
    </Badge>
  )
}

// Quick Action Bar for common actions
export function QuickActionBar({
  bookingId,
  currentStatus,
  restaurantId,
  onActionComplete,
  className
}: {
  bookingId: string
  currentStatus: string
  restaurantId: string
  onActionComplete?: (action: string, result: any) => void
  className?: string
}) {
  return (
    <div className={`flex items-center gap-2 p-2 bg-muted rounded-lg ${className}`}>
      <StatusBadge status={currentStatus} entityType="booking" />
      
      <div className="flex-1" />
      
      <ContextualActions
        entityType="booking"
        entityId={bookingId}
        currentStatus={currentStatus}
        restaurantId={restaurantId}
        onActionComplete={onActionComplete}
        triggeredBy="quick_action_bar"
      />
    </div>
  )
}

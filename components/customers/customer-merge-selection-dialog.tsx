'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Users, AlertTriangle, Star, Ban } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { RestaurantCustomer } from '@/types/customer'
import { mergeCustomers } from '@/app/(dashboard)/customers/actions'

interface CustomerMergeSelectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  primaryCustomer: RestaurantCustomer | null
  restaurantId: string
  onSuccess: () => void
}

export default function CustomerMergeSelectionDialog({
  open,
  onOpenChange,
  primaryCustomer,
  restaurantId,
  onSuccess,
}: CustomerMergeSelectionDialogProps) {
  const router = useRouter()
  const supabase = createClient()
  
  const [eligibleCustomers, setEligibleCustomers] = useState<RestaurantCustomer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [merging, setMerging] = useState(false)

  // Load eligible customers for merging
  useEffect(() => {
    if (open && primaryCustomer && restaurantId) {
      loadEligibleCustomers()
    }
  }, [open, primaryCustomer, restaurantId])

  const loadEligibleCustomers = async () => {
    try {
      setLoading(true)

      if (!primaryCustomer) return

      // Get all customers from the same restaurant
      const { data: customersData, error: customersError } = await supabase
        .from('restaurant_customers')
        .select(`
          *,
          profile:profiles!restaurant_customers_user_id_fkey(
            id,
            full_name,
            email,
            phone_number,
            avatar_url
          )
        `)
        .eq('restaurant_id', restaurantId)
        .neq('id', primaryCustomer.id) // Exclude the primary customer

      if (customersError) throw customersError

      // Filter customers that can be merged:
      // 1. At least one must be a guest (user_id is null)
      // 2. Cannot merge two registered users
      const eligible = customersData?.filter(customer => {
        const primaryIsGuest = !primaryCustomer.user_id
        const customerIsGuest = !customer.user_id
        
        // At least one must be a guest
        return primaryIsGuest || customerIsGuest
      }) || []

      // Transform the data
      const transformedData = eligible.map(customer => ({
        ...customer,
        tags: [], // We'll load tags separately if needed
      }))

      setEligibleCustomers(transformedData)
    } catch (error) {
      console.error('Error loading eligible customers:', error)
      toast.error('Failed to load customers for merging')
    } finally {
      setLoading(false)
    }
  }

  const handleMerge = async () => {
    if (!primaryCustomer || !selectedCustomerId) return

    try {
      setMerging(true)

      const selectedCustomer = eligibleCustomers.find(c => c.id === selectedCustomerId)
      if (!selectedCustomer) {
        toast.error('Selected customer not found')
        return
      }

      // Determine which customer should be the target (keep registered user if available)
      const targetCustomer = primaryCustomer.user_id ? primaryCustomer : selectedCustomer
      const sourceCustomer = primaryCustomer.user_id ? selectedCustomer : primaryCustomer

      // Validate merge rules
      if (targetCustomer.user_id && sourceCustomer.user_id) {
        toast.error('Cannot merge two registered users')
        return
      }

      // Use server action instead of API route
      const result = await mergeCustomers(
        targetCustomer.id,
        sourceCustomer.id,
        restaurantId
      )

      if (!result.success) {
        throw new Error(result.error || 'Failed to merge customers')
      }

      toast.success('Customers merged successfully')
      onSuccess()
      onOpenChange(false)
      
    } catch (error) {
      console.error('Error merging customers:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to merge customers')
    } finally {
      setMerging(false)
    }
  }

  const selectedCustomer = eligibleCustomers.find(c => c.id === selectedCustomerId)

  const getCustomerDisplayName = (customer: RestaurantCustomer) => {
    return customer.profile?.full_name || customer.guest_name || 'Unknown'
  }

  const getCustomerEmail = (customer: RestaurantCustomer) => {
    return customer.profile?.email || customer.guest_email || ''
  }

  const getCustomerPhone = (customer: RestaurantCustomer) => {
    return customer.profile?.phone_number || customer.guest_phone || ''
  }

  const canMerge = primaryCustomer && selectedCustomer && 
    (!primaryCustomer.user_id || !selectedCustomer.user_id)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Merge Customers
          </DialogTitle>
          <DialogDescription>
            Merge customer records to consolidate their booking history and information.
            You can only merge guest customers (those without accounts) with other customers.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading customers...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Primary Customer Info */}
            {primaryCustomer && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-700">Primary Customer</h3>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Avatar>
                    <AvatarImage src={primaryCustomer.profile?.avatar_url} />
                    <AvatarFallback>
                      {getCustomerDisplayName(primaryCustomer)
                        .split(' ')
                        .map(n => n[0])
                        .join('')
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">
                        {getCustomerDisplayName(primaryCustomer)}
                      </p>
                      {primaryCustomer.user_id ? (
                        <Badge variant="default">Registered</Badge>
                      ) : (
                        <Badge variant="secondary">Guest</Badge>
                      )}
                      {primaryCustomer.vip_status && (
                        <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                          <Star className="h-3 w-3 mr-1" />
                          VIP
                        </Badge>
                      )}
                      {primaryCustomer.blacklisted && (
                        <Badge variant="destructive">
                          <Ban className="h-3 w-3 mr-1" />
                          Blacklisted
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      {getCustomerEmail(primaryCustomer)} • {getCustomerPhone(primaryCustomer)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {primaryCustomer.total_bookings} bookings • ${primaryCustomer.total_spent} spent
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Customer Selection */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700">Select Customer to Merge With</h3>
              {eligibleCustomers.length === 0 ? (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    No eligible customers found for merging. You can only merge guest customers 
                    (those without accounts) with other customers.
                  </AlertDescription>
                </Alert>
              ) : (
                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a customer to merge with..." />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleCustomers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        <div className="flex items-center gap-2 w-full">
                          <span className="font-medium">
                            {getCustomerDisplayName(customer)}
                          </span>
                          {customer.user_id ? (
                            <Badge variant="default" className="text-xs">Registered</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Guest</Badge>
                          )}
                          <span className="text-sm text-gray-600 ml-auto">
                            {customer.total_bookings} bookings
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Selected Customer Preview */}
            {selectedCustomer && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-700">Selected Customer</h3>
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <Avatar>
                    <AvatarImage src={selectedCustomer.profile?.avatar_url} />
                    <AvatarFallback>
                      {getCustomerDisplayName(selectedCustomer)
                        .split(' ')
                        .map(n => n[0])
                        .join('')
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">
                        {getCustomerDisplayName(selectedCustomer)}
                      </p>
                      {selectedCustomer.user_id ? (
                        <Badge variant="default">Registered</Badge>
                      ) : (
                        <Badge variant="secondary">Guest</Badge>
                      )}
                      {selectedCustomer.vip_status && (
                        <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                          <Star className="h-3 w-3 mr-1" />
                          VIP
                        </Badge>
                      )}
                      {selectedCustomer.blacklisted && (
                        <Badge variant="destructive">
                          <Ban className="h-3 w-3 mr-1" />
                          Blacklisted
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      {getCustomerEmail(selectedCustomer)} • {getCustomerPhone(selectedCustomer)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {selectedCustomer.total_bookings} bookings • ${selectedCustomer.total_spent} spent
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Merge Preview */}
            {canMerge && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Merge Result:</strong> The guest customer's data will be merged into the 
                  {primaryCustomer?.user_id ? ' registered' : selectedCustomer?.user_id ? ' registered' : ''} customer's 
                  record. Booking counts, spending totals, and other metrics will be combined. This action cannot be undone.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={merging}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleMerge}
            disabled={!canMerge || merging}
          >
            {merging ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Merging...
              </>
            ) : (
              'Merge Customers'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

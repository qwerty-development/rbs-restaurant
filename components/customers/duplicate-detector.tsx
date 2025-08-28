// components/customers/duplicate-detector.tsx

'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { createCustomerMergeService, type DuplicateCustomer } from '@/lib/services/customer-merge'
import type { RestaurantCustomer } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { AlertTriangle, Users, Merge, RefreshCw } from 'lucide-react'
import { CustomerMergeDialog } from './customer-merge-dialog'

interface DuplicateDetectorProps {
  restaurantId: string
  onCustomersUpdated: () => void
}

export function DuplicateDetector({ restaurantId, onCustomersUpdated }: DuplicateDetectorProps) {
  const [duplicates, setDuplicates] = useState<DuplicateCustomer[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedPair, setSelectedPair] = useState<DuplicateCustomer | null>(null)
  const [showMergeDialog, setShowMergeDialog] = useState(false)

  const loadDuplicates = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/customers/merge?restaurantId=${restaurantId}`)
      
      if (!response.ok) {
        throw new Error('Failed to load duplicates')
      }

      const data = await response.json()
      setDuplicates(data.duplicates || [])
    } catch (error) {
      console.error('Error loading duplicates:', error)
      toast.error('Failed to load duplicate customers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDuplicates()
  }, [restaurantId])

  const handleMergeCustomers = (duplicate: DuplicateCustomer) => {
    setSelectedPair(duplicate)
    setShowMergeDialog(true)
  }

  const handleMergeSuccess = () => {
    toast.success('Customers merged successfully')
    setShowMergeDialog(false)
    setSelectedPair(null)
    loadDuplicates()
    onCustomersUpdated()
  }

  const getMatchTypeDisplay = (matchType: DuplicateCustomer['matchType']) => {
    switch (matchType) {
      case 'exact_name':
        return { label: 'Exact Name Match', color: 'bg-red-100 text-red-800' }
      case 'similar_name':
        return { label: 'Similar Name', color: 'bg-yellow-100 text-yellow-800' }
      case 'email_match':
        return { label: 'Email Match', color: 'bg-red-100 text-red-800' }
      case 'phone_match':
        return { label: 'Phone Match', color: 'bg-orange-100 text-orange-800' }
    }
  }

  const getCustomerDisplayName = (customer: RestaurantCustomer) => {
    return customer.profile?.full_name || customer.guest_name || 'Unknown Customer'
  }

  const getCustomerEmail = (customer: RestaurantCustomer) => {
    return customer.guest_email || '—'
  }

  const getCustomerPhone = (customer: RestaurantCustomer) => {
    return customer.profile?.phone_number || customer.guest_phone || '—'
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Detecting Duplicates...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (duplicates.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Duplicate Customers
          </CardTitle>
          <CardDescription>
            No duplicate customers detected
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>All customers appear to be unique.</p>
            <Button variant="outline" onClick={loadDuplicates} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Duplicate Customers Detected
              </CardTitle>
              <CardDescription>
                Found {duplicates.length} potential duplicate customer groups
              </CardDescription>
            </div>
            <Button variant="outline" onClick={loadDuplicates} disabled={loading}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {duplicates.map((duplicate, index) => {
            const matchDisplay = getMatchTypeDisplay(duplicate.matchType)
            const [customer1, customer2] = duplicate.customers

            return (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Badge className={matchDisplay.color}>
                      {matchDisplay.label}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {Math.round(duplicate.confidence * 100)}% confidence
                    </span>
                  </div>
                  <Button 
                    onClick={() => handleMergeCustomers(duplicate)}
                    size="sm"
                  >
                    <Merge className="h-4 w-4 mr-2" />
                    Merge
                  </Button>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {/* Customer 1 */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={customer1.profile?.avatar_url} />
                        <AvatarFallback>
                          {getCustomerDisplayName(customer1).substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{getCustomerDisplayName(customer1)}</p>
                        <div className="flex items-center gap-2">
                          {customer1.user_id ? (
                            <Badge variant="default" className="text-xs">Registered</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">Guest</Badge>
                          )}
                          {customer1.vip_status && (
                            <Badge variant="secondary" className="text-xs">VIP</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Email: {getCustomerEmail(customer1)}</p>
                      <p>Phone: {getCustomerPhone(customer1)}</p>
                      <p>Bookings: {customer1.total_bookings}</p>
                      <p>Total Spent: ${customer1.total_spent}</p>
                    </div>
                  </div>

                  <div className="hidden md:flex items-center justify-center">
                    <Separator orientation="vertical" className="h-20" />
                  </div>

                  {/* Customer 2 */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={customer2.profile?.avatar_url} />
                        <AvatarFallback>
                          {getCustomerDisplayName(customer2).substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{getCustomerDisplayName(customer2)}</p>
                        <div className="flex items-center gap-2">
                          {customer2.user_id ? (
                            <Badge variant="default" className="text-xs">Registered</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">Guest</Badge>
                          )}
                          {customer2.vip_status && (
                            <Badge variant="secondary" className="text-xs">VIP</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Email: {getCustomerEmail(customer2)}</p>
                      <p>Phone: {getCustomerPhone(customer2)}</p>
                      <p>Bookings: {customer2.total_bookings}</p>
                      <p>Total Spent: ${customer2.total_spent}</p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {selectedPair && (
        <CustomerMergeDialog
          open={showMergeDialog}
          onOpenChange={setShowMergeDialog}
          duplicate={selectedPair}
          restaurantId={restaurantId}
          onSuccess={handleMergeSuccess}
        />
      )}
    </>
  )
}

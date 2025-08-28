// components/customers/customer-merge-dialog.tsx

'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  User, 
  Users, 
  AlertTriangle, 
  ArrowRight, 
  Star,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  CheckCircle2,
  XCircle,
  Info
} from 'lucide-react'
import { RestaurantCustomer } from '@/types/customer'
import { 
  customerMergeService, 
  CustomerMergePreview, 
  CustomerMergeOptions,
  CustomerMergeConflict 
} from '@/lib/services/customer-merge'
import { toast } from 'sonner'

interface CustomerMergeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceCustomer: RestaurantCustomer | null
  targetCustomer: RestaurantCustomer | null
  onMergeComplete: () => void
  currentUserId: string
}

export function CustomerMergeDialog({
  open,
  onOpenChange,
  sourceCustomer,
  targetCustomer,
  onMergeComplete,
  currentUserId
}: CustomerMergeDialogProps) {
  const [step, setStep] = useState<'validate' | 'preview' | 'resolve' | 'confirm'>('validate')
  const [loading, setLoading] = useState(false)
  const [mergePreview, setMergePreview] = useState<CustomerMergePreview | null>(null)
  const [canMerge, setCanMerge] = useState<{ canMerge: boolean; reason?: string } | null>(null)
  
  // Merge options
  const [options, setOptions] = useState<CustomerMergeOptions>({
    keepSourceTags: true,
    keepTargetTags: true,
    mergeNotes: true,
    transferBookings: false,
    resolveConflicts: {},
    manualValues: {}
  })

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open && sourceCustomer && targetCustomer) {
      setStep('validate')
      setMergePreview(null)
      setCanMerge(null)
      setOptions({
        keepSourceTags: true,
        keepTargetTags: true,
        mergeNotes: true,
        transferBookings: false,
        resolveConflicts: {},
        manualValues: {}
      })
      validateMerge()
    }
  }, [open, sourceCustomer, targetCustomer])

  const validateMerge = async () => {
    if (!sourceCustomer || !targetCustomer) return
    
    setLoading(true)
    try {
      const validation = await customerMergeService.validateMerge(sourceCustomer.id, targetCustomer.id)
      setCanMerge(validation)
      
      if (validation.canMerge) {
        const preview = await customerMergeService.generateMergePreview(sourceCustomer.id, targetCustomer.id)
        setMergePreview(preview)
        
        if (preview && preview.conflicts.length > 0) {
          setStep('resolve')
        } else {
          setStep('confirm')
        }
      }
    } catch (error) {
      console.error('Error validating merge:', error)
      toast.error('Failed to validate merge')
    } finally {
      setLoading(false)
    }
  }

  const handleConflictResolution = (field: string, resolution: 'source' | 'target' | 'manual') => {
    setOptions(prev => ({
      ...prev,
      resolveConflicts: {
        ...prev.resolveConflicts,
        [field]: resolution
      }
    }))
  }

  const handleManualValue = (field: string, value: any) => {
    setOptions(prev => ({
      ...prev,
      manualValues: {
        ...prev.manualValues,
        [field]: value
      }
    }))
  }

  const executeMerge = async () => {
    if (!sourceCustomer || !targetCustomer || !mergePreview) return
    
    setLoading(true)
    try {
      const result = await customerMergeService.executeMerge(
        sourceCustomer.id,
        targetCustomer.id,
        options,
        currentUserId
      )
      
      if (result.success) {
        toast.success('Customers merged successfully')
        onMergeComplete()
        onOpenChange(false)
      } else {
        toast.error(result.error || 'Failed to merge customers')
      }
    } catch (error) {
      console.error('Error executing merge:', error)
      toast.error('Failed to merge customers')
    } finally {
      setLoading(false)
    }
  }

  const getCustomerDisplayName = (customer: RestaurantCustomer) => {
    return customer.profile?.full_name || customer.guest_name || 'Unknown Customer'
  }

  const getCustomerEmail = (customer: RestaurantCustomer) => {
    return customer.profile?.email || customer.guest_email || 'No email'
  }

  const getCustomerPhone = (customer: RestaurantCustomer) => {
    return customer.profile?.phone_number || customer.guest_phone || 'No phone'
  }

  const renderCustomerCard = (customer: RestaurantCustomer, title: string, variant: 'source' | 'target' | 'merged') => (
    <Card className={`${variant === 'source' ? 'border-orange-200' : variant === 'target' ? 'border-blue-200' : 'border-green-200'}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4" />
          {title}
          {customer.user_id && (
            <Badge variant="secondary" className="text-xs">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Account
            </Badge>
          )}
          {!customer.user_id && (
            <Badge variant="outline" className="text-xs">
              Guest
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={customer.profile?.avatar_url} />
            <AvatarFallback>
              {getCustomerDisplayName(customer).charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{getCustomerDisplayName(customer)}</p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {getCustomerEmail(customer)}
              </div>
              <div className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {getCustomerPhone(customer)}
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <Label className="text-xs text-muted-foreground">Total Bookings</Label>
            <p className="font-medium">{customer.total_bookings}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Total Spent</Label>
            <p className="font-medium">${customer.total_spent}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Last Visit</Label>
            <p className="font-medium">{customer.last_visit ? new Date(customer.last_visit).toLocaleDateString() : 'Never'}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Status</Label>
            <div className="flex gap-1">
              {customer.vip_status && <Badge variant="default" className="text-xs">VIP</Badge>}
              {customer.blacklisted && <Badge variant="destructive" className="text-xs">Blacklisted</Badge>}
              {!customer.vip_status && !customer.blacklisted && <Badge variant="outline" className="text-xs">Regular</Badge>}
            </div>
          </div>
        </div>
        
        {customer.tags && customer.tags.length > 0 && (
          <div>
            <Label className="text-xs text-muted-foreground">Tags</Label>
            <div className="flex flex-wrap gap-1 mt-1">
              {customer.tags.map(tag => (
                <Badge key={tag.id} variant="secondary" className="text-xs" style={{ backgroundColor: tag.color + '20', color: tag.color }}>
                  {tag.name}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )

  const renderConflictResolution = (conflict: CustomerMergeConflict) => (
    <Card key={conflict.field} className="border-yellow-200">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          {conflict.field.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{conflict.reason}</p>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-medium">Source Value</Label>
            <p className="text-sm p-2 bg-orange-50 rounded border">
              {Array.isArray(conflict.sourceValue) 
                ? conflict.sourceValue.join(', ') 
                : String(conflict.sourceValue)
              }
            </p>
          </div>
          <div>
            <Label className="text-xs font-medium">Target Value</Label>
            <p className="text-sm p-2 bg-blue-50 rounded border">
              {Array.isArray(conflict.targetValue) 
                ? conflict.targetValue.join(', ') 
                : String(conflict.targetValue)
              }
            </p>
          </div>
        </div>
        
        <div>
          <Label className="text-sm font-medium">Resolution</Label>
          <div className="mt-2 space-y-2">
            <div className="flex gap-2">
              <Button
                variant={options.resolveConflicts[conflict.field] === 'source' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleConflictResolution(conflict.field, 'source')}
              >
                Use Source
              </Button>
              <Button
                variant={options.resolveConflicts[conflict.field] === 'target' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleConflictResolution(conflict.field, 'target')}
              >
                Use Target
              </Button>
              {conflict.recommendation === 'merge' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // For merge recommendation, we'll handle it automatically in the backend
                    // For now, just mark it as resolved
                    handleConflictResolution(conflict.field, 'source')
                  }}
                >
                  Merge Both
                </Button>
              )}
              <Button
                variant={options.resolveConflicts[conflict.field] === 'manual' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleConflictResolution(conflict.field, 'manual')}
              >
                Manual
              </Button>
            </div>
            
            {options.resolveConflicts[conflict.field] === 'manual' && (
              <Input
                placeholder="Enter custom value"
                value={options.manualValues[conflict.field] || ''}
                onChange={(e) => handleManualValue(conflict.field, e.target.value)}
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )

  if (!sourceCustomer || !targetCustomer) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Merge Customers
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Validation Step */}
          {step === 'validate' && (
            <div className="text-center py-8">
              {loading ? (
                <div>
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-600">Validating merge...</p>
                </div>
              ) : canMerge?.canMerge === false ? (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    Cannot merge customers: {canMerge.reason}
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>
          )}

          {/* Preview Step */}
          {step === 'preview' && mergePreview && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold">Merge Preview</h3>
                <p className="text-sm text-muted-foreground">Review the data that will be merged</p>
              </div>
              
              <div className="grid grid-cols-3 gap-4 items-center">
                {renderCustomerCard(mergePreview.source, 'Source Customer', 'source')}
                <div className="flex justify-center">
                  <ArrowRight className="h-6 w-6 text-muted-foreground" />
                </div>
                {renderCustomerCard(mergePreview.target, 'Target Customer (Keep)', 'target')}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Related Data to Transfer</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>Notes: {mergePreview.relatedData.notes}</div>
                    <div>Tags: {mergePreview.relatedData.tags}</div>
                    <div>Relationships: {mergePreview.relatedData.relationships}</div>
                    <div>Preferences: {mergePreview.relatedData.preferences}</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Resolve Conflicts Step */}
          {step === 'resolve' && mergePreview && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold">Resolve Conflicts</h3>
                <p className="text-sm text-muted-foreground">
                  Choose how to handle conflicting data between the customers
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {renderCustomerCard(mergePreview.source, 'Source Customer', 'source')}
                {renderCustomerCard(mergePreview.target, 'Target Customer (Keep)', 'target')}
              </div>

              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  Conflicts to Resolve ({mergePreview.conflicts.length})
                </h4>
                
                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {mergePreview.conflicts.map(renderConflictResolution)}
                  </div>
                </ScrollArea>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Merge Options</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="merge-notes"
                      checked={options.mergeNotes}
                      onCheckedChange={(checked) => setOptions(prev => ({ ...prev, mergeNotes: Boolean(checked) }))}
                    />
                    <Label htmlFor="merge-notes" className="text-sm">
                      Merge customer notes
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="keep-source-tags"
                      checked={options.keepSourceTags}
                      onCheckedChange={(checked) => setOptions(prev => ({ ...prev, keepSourceTags: Boolean(checked) }))}
                    />
                    <Label htmlFor="keep-source-tags" className="text-sm">
                      Keep source customer tags
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="transfer-bookings"
                      checked={options.transferBookings}
                      onCheckedChange={(checked) => setOptions(prev => ({ ...prev, transferBookings: Boolean(checked) }))}
                    />
                    <Label htmlFor="transfer-bookings" className="text-sm">
                      Transfer booking history (if applicable)
                    </Label>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Confirm Step */}
          {step === 'confirm' && mergePreview && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold">Confirm Merge</h3>
                <p className="text-sm text-muted-foreground">
                  Review the final merge result before proceeding
                </p>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  This action cannot be undone. The source customer will be deleted and all data will be transferred to the target customer.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-3 gap-4 items-center">
                {renderCustomerCard(mergePreview.source, 'Source (Will be deleted)', 'source')}
                <div className="flex justify-center">
                  <ArrowRight className="h-6 w-6 text-muted-foreground" />
                </div>
                {renderCustomerCard(mergePreview.target, 'Final Result', 'merged')}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          
          {step === 'resolve' && (
            <Button 
              onClick={() => setStep('confirm')}
              disabled={mergePreview?.conflicts.some(c => !options.resolveConflicts[c.field])}
            >
              Continue to Confirmation
            </Button>
          )}
          
          {step === 'confirm' && (
            <Button 
              onClick={executeMerge}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700"
            >
              {loading ? 'Merging...' : 'Confirm Merge'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// components/customers/customer-bulk-actions.tsx

'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  MoreHorizontal, 
  Tag, 
  Star, 
  Ban,
  Mail,
  MessageSquare,
  Download,
  Trash2
} from 'lucide-react'
import { toast } from 'sonner'
import type { RestaurantCustomer, CustomerTag } from '@/types/customer'

// Function to determine if a color is light and needs dark text
const isLightColor = (hexColor: string): boolean => {
  // Convert hex to RGB
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)
  
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  
  // Return true if light (needs dark text)
  return luminance > 0.6
}
import { Input } from '../ui/input'

interface CustomerBulkActionsProps {
  selectedCustomers: RestaurantCustomer[]
  tags: CustomerTag[]
  onUpdate: () => void
  onClearSelection: () => void
  currentUserId: string
}

export function CustomerBulkActions({
  selectedCustomers,
  tags,
  onUpdate,
  onClearSelection,
  currentUserId
}: CustomerBulkActionsProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [showTagDialog, setShowTagDialog] = useState(false)
  const [showMessageDialog, setShowMessageDialog] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [message, setMessage] = useState({ subject: '', body: '' })

  // Bulk tag assignment
  const handleBulkTagAssignment = async () => {
    if (selectedTags.length === 0) return

    try {
      setLoading(true)
      
      // Create tag assignments for each customer-tag combination
      const assignments = selectedCustomers.flatMap(customer =>
        selectedTags.map(tagId => ({
          customer_id: customer.id,
          tag_id: tagId,
          assigned_by: currentUserId
        }))
      )

      const { error } = await supabase
        .from('customer_tag_assignments')
        .upsert(assignments, { 
          onConflict: 'customer_id,tag_id',
          ignoreDuplicates: true 
        })

      if (error) throw error

      toast.success(`Tags assigned to ${selectedCustomers.length} customers`)
      setShowTagDialog(false)
      setSelectedTags([])
      onClearSelection()
      onUpdate()
    } catch (error) {
      console.error('Error assigning tags:', error)
      toast.error('Failed to assign tags')
    } finally {
      setLoading(false)
    }
  }

  // Bulk VIP status update
  const handleBulkVIPUpdate = async (vipStatus: boolean) => {
    try {
      setLoading(true)
      
      const { error } = await supabase
        .from('restaurant_customers')
        .update({ 
          vip_status: vipStatus,
          updated_at: new Date().toISOString()
        })
        .in('id', selectedCustomers.map(c => c.id))

      if (error) throw error

      toast.success(`${selectedCustomers.length} customers ${vipStatus ? 'marked as' : 'removed from'} VIP`)
      onClearSelection()
      onUpdate()
    } catch (error) {
      console.error('Error updating VIP status:', error)
      toast.error('Failed to update VIP status')
    } finally {
      setLoading(false)
    }
  }

  // Export selected customers
  const handleExportSelected = () => {
    const headers = ['Name', 'Email', 'Phone', 'Total Bookings', 'Last Visit', 'VIP', 'Tags']
    const rows = selectedCustomers.map((customer:any) => [
      customer.profile?.full_name || customer.guest_name || '',
      customer.profile?.email || customer.guest_email || '',
      customer.profile?.phone_number || customer.guest_phone || '',
      customer.total_bookings,
      customer.last_visit ? new Date(customer.last_visit).toLocaleDateString() : '',
      customer.vip_status ? 'Yes' : 'No',
      customer.tags?.map((t: { name: any }) => t.name).join(', ') || ''
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `selected-customers-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Send bulk message/email
  const handleSendMessage = async () => {
    if (!message.subject.trim() || !message.body.trim()) return

    try {
      setLoading(true)
      
      // Create a campaign record
      const { data: campaign, error: campaignError } = await supabase
        .from('customer_campaigns')
        .insert({
          restaurant_id: selectedCustomers[0].restaurant_id,
          name: message.subject,
          type: 'email',
          content: message.body,
          recipient_count: selectedCustomers.length,
          created_by: currentUserId
        })
        .select()
        .single()

      if (campaignError) throw campaignError

      // Create campaign recipients
      const recipients = selectedCustomers.map((customer:any) => ({
        campaign_id: campaign.id,
        customer_id: customer.id,
        email: customer.profile?.email || customer.guest_email,
        status: 'pending'
      }))

      const { error: recipientError } = await supabase
        .from('campaign_recipients')
        .insert(recipients)

      if (recipientError) throw recipientError

      toast.success(`Message queued for ${selectedCustomers.length} customers`)
      setShowMessageDialog(false)
      setMessage({ subject: '', body: '' })
      onClearSelection()
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Failed to send message')
    } finally {
      setLoading(false)
    }
  }

  if (selectedCustomers.length === 0) return null

  return (
    <>
      <div className="flex items-center gap-2 p-4 bg-blue-300 rounded-lg">
        <span className="text-sm font-medium">
          {selectedCustomers.length} customer{selectedCustomers.length > 1 ? 's' : ''} selected
        </span>
        
        <div className="flex gap-2 ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={onClearSelection}
          >
            Clear Selection
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                <MoreHorizontal className="h-4 w-4 mr-2" />
                Bulk Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Bulk Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              <DropdownMenuItem onClick={() => setShowTagDialog(true)}>
                <Tag className="mr-2 h-4 w-4" />
                Assign Tags
              </DropdownMenuItem>
              
              <DropdownMenuItem onClick={() => handleBulkVIPUpdate(true)}>
                <Star className="mr-2 h-4 w-4" />
                Mark as VIP
              </DropdownMenuItem>
              
              <DropdownMenuItem onClick={() => handleBulkVIPUpdate(false)}>
                <Star className="mr-2 h-4 w-4" />
                Remove VIP Status
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem onClick={() => setShowMessageDialog(true)}>
                <Mail className="mr-2 h-4 w-4" />
                Send Message
              </DropdownMenuItem>
              
              <DropdownMenuItem onClick={handleExportSelected}>
                <Download className="mr-2 h-4 w-4" />
                Export Selected
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tag Assignment Dialog */}
      <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Tags to Customers</DialogTitle>
            <DialogDescription>
              Select tags to assign to {selectedCustomers.length} selected customers
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              {tags.map(tag => (
                <label
                  key={tag.id}
                  className="flex items-center space-x-3 cursor-pointer p-2 rounded hover:bg-gray-400"
                >
                  <Checkbox
                    checked={selectedTags.includes(tag.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedTags([...selectedTags, tag.id])
                      } else {
                        setSelectedTags(selectedTags.filter(id => id !== tag.id))
                      }
                    }}
                  />
                  <Badge
                    variant="outline"
                    style={{ 
                      borderColor: tag.color, 
                      color: isLightColor(tag.color) ? '#000000' : tag.color,
                      backgroundColor: `${tag.color}20`
                    }}
                  >
                    {tag.name}
                  </Badge>
                  {tag.description && (
                    <span className="text-sm text-gray-600">{tag.description}</span>
                  )}
                </label>
              ))}
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowTagDialog(false)
                setSelectedTags([])
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkTagAssignment}
              disabled={loading || selectedTags.length === 0}
            >
              Assign Tags
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Message Dialog */}
      <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Send Message to Customers</DialogTitle>
            <DialogDescription>
              Compose a message to send to {selectedCustomers.length} selected customers
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="Special offer for our valued customers"
                value={message.subject}
                onChange={(e) => setMessage({ ...message, subject: e.target.value })}
              />
            </div>
            
            <div>
              <Label htmlFor="body">Message</Label>
              <Textarea
                id="body"
                placeholder="Type your message here..."
                rows={6}
                value={message.body}
                onChange={(e) => setMessage({ ...message, body: e.target.value })}
              />
            </div>
            
            <div className="text-sm text-gray-600">
              <p>This message will be sent to:</p>
              <ul className="list-disc list-inside mt-1">
                <li>{selectedCustomers.filter((c:any) => c.profile?.email || c.guest_email).length} customers with email addresses</li>
              </ul>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowMessageDialog(false)
                setMessage({ subject: '', body: '' })
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendMessage}
              disabled={loading || !message.subject.trim() || !message.body.trim()}
            >
              {loading ? 'Sending...' : 'Send Message'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
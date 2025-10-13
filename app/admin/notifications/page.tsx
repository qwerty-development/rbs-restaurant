'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { toast } from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { 
  Send, 
  Users, 
  Building, 
  Target, 
  Clock, 
  BarChart3, 
  AlertCircle,
  CheckCircle,
  XCircle,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  Search
} from 'lucide-react'

interface NotificationTemplate {
  id: string
  name: string
  category: string
  title_template: string
  message_template: string
  variables: string[]
  default_channels: string[]
  default_priority: string
}

interface NotificationStats {
  total_sent: number
  delivered: number
  failed: number
  clicked: number
  delivery_rate: number
  click_rate: number
}

interface FailedNotification {
  id: string
  title: string
  body: string
  user_name: string
  user_email: string
  error: string
  created_at: string
  attempts: number
}

export default function AdminNotificationsPage() {
  const [activeTab, setActiveTab] = useState('send')
  const supabase = createClient()

  // Send Notification State
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(null)
  const [targetType, setTargetType] = useState<'all_users' | 'restaurant_users' | 'specific_users'>('all_users')
  const [selectedRestaurants, setSelectedRestaurants] = useState<string[]>([])
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [channels, setChannels] = useState<string[]>(['push', 'inapp'])
  const [priority, setPriority] = useState<'high' | 'normal' | 'low'>('normal')
  const [scheduledSend, setScheduledSend] = useState(false)
  const [sendAt, setSendAt] = useState('')

  // Analytics State
  const [stats, setStats] = useState<NotificationStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [failedNotifications, setFailedNotifications] = useState<FailedNotification[]>([])
  const [loadingFailed, setLoadingFailed] = useState(false)

  // Data State
  const [templates, setTemplates] = useState<NotificationTemplate[]>([])
  const [restaurants, setRestaurants] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [isSearchingUsers, setIsSearchingUsers] = useState(false)

  // Load initial data
  useEffect(() => {
    loadTemplates()
    loadRestaurants()
    loadUsers()
    if (activeTab === 'analytics') {
      loadStats()
      loadFailedNotifications()
    }
  }, [activeTab])

  // Debounced user search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (targetType === 'specific_users') {
        loadUsers(userSearch)
      }
    }, 300) // 300ms debounce

    return () => clearTimeout(timer)
  }, [userSearch, targetType])

  const loadTemplates = async () => {
    // For now, using predefined templates. In production, these would come from database
    const defaultTemplates: NotificationTemplate[] = [
      {
        id: '1',
        name: 'Booking Confirmation',
        category: 'booking',
        title_template: 'Booking Confirmed - {{restaurant_name}}',
        message_template: 'Your booking for {{party_size}} people on {{booking_date}} at {{booking_time}} has been confirmed.',
        variables: ['restaurant_name', 'party_size', 'booking_date', 'booking_time'],
        default_channels: ['push', 'inapp'],
        default_priority: 'high'
      },
      {
        id: '2',
        name: 'Special Offer',
        category: 'marketing',
        title_template: '🎉 Special Offer - {{restaurant_name}}',
        message_template: 'Get {{discount_percentage}}% off your next visit! Valid until {{expiry_date}}.',
        variables: ['restaurant_name', 'discount_percentage', 'expiry_date'],
        default_channels: ['push', 'inapp'],
        default_priority: 'normal'
      },
      {
        id: '3',
        name: 'System Announcement',
        category: 'system',
        title_template: 'System Update',
        message_template: '{{announcement_text}}',
        variables: ['announcement_text'],
        default_channels: ['push', 'inapp'],
        default_priority: 'normal'
      }
    ]
    setTemplates(defaultTemplates)
  }

  const loadRestaurants = async () => {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, name, address')
        .order('name')
      
      if (error) throw error
      setRestaurants(data || [])
    } catch (error) {
      console.error('Failed to load restaurants:', error)
      toast.error('Failed to load restaurants')
    }
  }

  const loadUsers = async (searchTerm: string = '') => {
    try {
      setIsSearchingUsers(true)
      let query = supabase
        .from('profiles')
        .select('id, full_name, email')
      
      // If there's a search term, search by name or email
      if (searchTerm.trim()) {
        query = query.or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
      }
      
      const { data, error } = await query
        .order('full_name')
        .limit(200) // Increased limit, search helps narrow results
      
      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Failed to load users:', error)
      toast.error('Failed to load users')
    } finally {
      setIsSearchingUsers(false)
    }
  }

  const loadStats = async () => {
    setLoadingStats(true)
    try {
      // Use database function to get stats
      const { data, error } = await supabase
        .rpc('admin_get_notification_stats', { p_days: 7 })

      if (error) throw error

      if (data) {
        setStats({
          total_sent: data.total_sent || 0,
          delivered: data.delivered || 0,
          failed: data.failed || 0,
          clicked: Math.floor((data.delivered || 0) * 0.3), // Estimate 30% click rate
          delivery_rate: data.delivery_rate || 0,
          click_rate: Math.floor((data.delivery_rate || 0) * 0.3) // Estimate click rate
        })
      }
    } catch (error) {
      console.error('Failed to load stats:', error)
      toast.error('Failed to load analytics')
    } finally {
      setLoadingStats(false)
    }
  }

  const loadFailedNotifications = async () => {
    setLoadingFailed(true)
    try {
      // Use database function to get failed notifications
      const { data, error } = await supabase
        .rpc('admin_get_failed_notifications', { p_limit: 50 })

      if (error) throw error

      const failed = data?.map((item: any) => ({
        id: item.id,
        title: item.title || '',
        body: item.body || '',
        user_name: item.user_name || 'Unknown User',
        user_email: item.user_email || '',
        error: item.error || 'Unknown error',
        created_at: item.created_at,
        attempts: item.attempts || 0
      })) || []

      setFailedNotifications(failed)
    } catch (error) {
      console.error('Failed to load failed notifications:', error)
      toast.error('Failed to load failed notifications')
    } finally {
      setLoadingFailed(false)
    }
  }

  const handleTemplateSelect = (template: NotificationTemplate) => {
    setSelectedTemplate(template)
    setTitle(template.title_template)
    setBody(template.message_template)
    setChannels(template.default_channels)
    setPriority(template.default_priority as 'high' | 'normal' | 'low')
  }

  const sendNotification = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error('Please fill title and body')
      return
    }

    if (targetType === 'restaurant_users' && selectedRestaurants.length === 0) {
      toast.error('Please select at least one restaurant')
      return
    }

    if (targetType === 'specific_users' && selectedUsers.length === 0) {
      toast.error('Please select at least one user')
      return
    }

    try {
      setIsSending(true)
      
      const payload = {
        title: title.trim(),
        body: body.trim(),
        channels,
        priority,
        target: {
          type: targetType,
          restaurant_ids: selectedRestaurants,
          user_ids: selectedUsers
        },
        scheduling: scheduledSend ? {
          send_at: sendAt,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        } : undefined
      }

      const response = await fetch('/api/admin/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to send notification')
      }

      toast.success(`Notification ${scheduledSend ? 'scheduled' : 'sent'} successfully! Recipients: ${result.recipients}`)
      
      // Reset form
      setTitle('')
      setBody('')
      setSelectedTemplate(null)
      setTargetType('all_users')
      setSelectedRestaurants([])
      setSelectedUsers([])
      setScheduledSend(false)
      setSendAt('')

    } catch (error: any) {
      console.error('Failed to send notification:', error)
      toast.error(error.message || 'Failed to send notification')
    } finally {
      setIsSending(false)
    }
  }

  const retryFailedNotification = async (notificationId: string) => {
    try {
      const response = await fetch('/api/admin/notifications/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_ids: [notificationId] })
      })

      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to retry notification')
      }

      toast.success('Notification queued for retry')
      loadFailedNotifications() // Reload the list
      
    } catch (error: any) {
      console.error('Failed to retry notification:', error)
      toast.error(error.message || 'Failed to retry notification')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Notification Management</h2>
          <p className="text-muted-foreground">Send notifications to users and monitor delivery</p>
        </div>
        <Button variant="outline" onClick={() => {
          if (activeTab === 'analytics') {
            loadStats()
            loadFailedNotifications()
          }
        }}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="send" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Send Notification
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Compose Section */}
            <Card>
              <CardHeader>
                <CardTitle>Compose Notification</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Template Selection */}
                <div>
                  <Label>Templates</Label>
                  <div className="grid grid-cols-1 gap-2 mt-2">
                    {templates.map(template => (
                      <Button
                        key={template.id}
                        variant={selectedTemplate?.id === template.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleTemplateSelect(template)}
                        className="justify-start"
                      >
                        {template.name}
                        <Badge variant="secondary" className="ml-auto">
                          {template.category}
                        </Badge>
                      </Button>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Title and Body */}
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input 
                    id="title"
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)} 
                    placeholder="Notification title"
                  />
                </div>
                
                <div>
                  <Label htmlFor="body">Message *</Label>
                  <Textarea 
                    id="body"
                    value={body} 
                    onChange={(e) => setBody(e.target.value)} 
                    rows={4} 
                    placeholder="Notification message body"
                  />
                </div>

                {/* Channels */}
                <div>
                  <Label>Channels</Label>
                  <div className="flex gap-4 mt-2">
                    {['push', 'inapp', 'email', 'sms'].map(channel => (
                      <div key={channel} className="flex items-center space-x-2">
                        <Switch 
                          id={channel}
                          checked={channels.includes(channel)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setChannels([...channels, channel])
                            } else {
                              setChannels(channels.filter(c => c !== channel))
                            }
                          }}
                        />
                        <Label htmlFor={channel} className="capitalize">{channel}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={(value: 'high' | 'normal' | 'low') => setPriority(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Scheduling */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="scheduled"
                      checked={scheduledSend}
                      onCheckedChange={setScheduledSend}
                    />
                    <Label htmlFor="scheduled" className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Schedule for later
                    </Label>
                  </div>
                  
                  {scheduledSend && (
                    <Input
                      type="datetime-local"
                      value={sendAt}
                      onChange={(e) => setSendAt(e.target.value)}
                      min={new Date().toISOString().slice(0, 16)}
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Targeting Section */}
            <Card>
              <CardHeader>
                <CardTitle>Target Audience</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Target Type</Label>
                  <Select value={targetType} onValueChange={(value: 'all_users' | 'restaurant_users' | 'specific_users') => setTargetType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_users">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          All Users
                        </div>
                      </SelectItem>
                      <SelectItem value="restaurant_users">
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4" />
                          Restaurant Users
                        </div>
                      </SelectItem>
                      <SelectItem value="specific_users">
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4" />
                          Specific Users
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {targetType === 'restaurant_users' && (
                  <div>
                    <Label>Select Restaurants</Label>
                    <div className="max-h-40 overflow-y-auto border rounded p-2 mt-2">
                      {restaurants.map(restaurant => (
                        <div key={restaurant.id} className="flex items-center space-x-2 p-1">
                          <input
                            type="checkbox"
                            id={`restaurant-${restaurant.id}`}
                            checked={selectedRestaurants.includes(restaurant.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedRestaurants([...selectedRestaurants, restaurant.id])
                              } else {
                                setSelectedRestaurants(selectedRestaurants.filter(id => id !== restaurant.id))
                              }
                            }}
                          />
                          <Label htmlFor={`restaurant-${restaurant.id}`} className="text-sm">
                            {restaurant.name} ({restaurant.address?.slice(0, 30)}{restaurant.address?.length > 30 ? '...' : ''})
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {targetType === 'specific_users' && (
                  <div className="space-y-3">
                    <div>
                      <Label>Search Users</Label>
                      <div className="relative mt-2">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search by name or email..."
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      {isSearchingUsers && (
                        <p className="text-xs text-muted-foreground mt-1">Searching...</p>
                      )}
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Select Users</Label>
                        <Badge variant="secondary">
                          {selectedUsers.length} selected / {users.length} shown
                        </Badge>
                      </div>
                      <div className="max-h-60 overflow-y-auto border rounded p-2">
                        {users.length === 0 ? (
                          <div className="text-center py-4 text-sm text-muted-foreground">
                            {userSearch.trim() ? 'No users found. Try a different search.' : 'Start typing to search for users'}
                          </div>
                        ) : (
                          users.map(user => (
                            <div key={user.id} className="flex items-center space-x-2 p-1 hover:bg-muted/50 rounded">
                              <input
                                type="checkbox"
                                id={`user-${user.id}`}
                                checked={selectedUsers.includes(user.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedUsers([...selectedUsers, user.id])
                                  } else {
                                    setSelectedUsers(selectedUsers.filter(id => id !== user.id))
                                  }
                                }}
                                className="cursor-pointer"
                              />
                              <Label htmlFor={`user-${user.id}`} className="text-sm cursor-pointer flex-1">
                                {user.full_name || 'Unknown'} ({user.email})
                              </Label>
                            </div>
                          ))
                        )}
                      </div>
                      {selectedUsers.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedUsers([])}
                          className="mt-2 w-full"
                        >
                          Clear Selection
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                <Button onClick={sendNotification} disabled={isSending} className="w-full">
                  {isSending ? (
                    <>Sending...</>
                  ) : scheduledSend ? (
                    <>
                      <Calendar className="h-4 w-4 mr-2" />
                      Schedule Notification
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Notification
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {/* Stats Overview */}
          {loadingStats ? (
            <div className="text-center py-8">Loading stats...</div>
          ) : stats ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total_sent.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">Last 7 days</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{stats.delivery_rate}%</div>
                  <p className="text-xs text-muted-foreground">{stats.delivered} delivered</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Failed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
                  <p className="text-xs text-muted-foreground">Need attention</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Click Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{stats.click_rate}%</div>
                  <p className="text-xs text-muted-foreground">{stats.clicked} clicked</p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-8">No stats available</div>
          )}

          {/* Failed Notifications */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Failed Notifications</CardTitle>
              <Button variant="outline" size="sm" onClick={loadFailedNotifications} disabled={loadingFailed}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {loadingFailed ? (
                <div className="text-center py-4">Loading...</div>
              ) : failedNotifications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  No failed notifications
                </div>
              ) : (
                <div className="space-y-4">
                  {failedNotifications.map(notification => (
                    <div key={notification.id} className="border rounded p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <XCircle className="h-4 w-4 text-red-500" />
                            <h4 className="font-medium">{notification.title}</h4>
                            <Badge variant="destructive">
                              {notification.attempts} attempts
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{notification.body}</p>
                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium">User:</span> {notification.user_name} ({notification.user_email})
                          </div>
                          <div className="text-xs text-red-600 mt-1">
                            <span className="font-medium">Error:</span> {notification.error}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {new Date(notification.created_at).toLocaleString()}
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => retryFailedNotification(notification.id)}
                        >
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Retry
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}



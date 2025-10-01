'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { toast } from 'react-hot-toast'
import { Users, RefreshCw, Plus, Mail, Unlink, Trash2, X, Loader2 } from 'lucide-react'

type StaffRow = {
  id: string
  user_id: string
  restaurant_id: string
  role: 'owner' | 'manager' | 'staff' | 'viewer'
  permissions: string[]
  is_active: boolean
  created_at: string
  profiles?: { full_name: string | null; email: string | null } | null
  restaurants?: { name: string | null } | null
}

type SearchedUser = {
  id: string
  email: string
  full_name: string
  phone_number: string | null
  avatar_url: string | null
}

export default function AdminRestaurantStaffPage() {
  const supabase = createClient()

  const [restaurants, setRestaurants] = useState<{ id: string; name: string }[]>([])
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [rows, setRows] = useState<StaffRow[]>([])
  const [loading, setLoading] = useState(false)

  // Link account modal
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [linkEmail, setLinkEmail] = useState('')
  const [linkRestaurantId, setLinkRestaurantId] = useState<string>('')
  const [linkRole, setLinkRole] = useState<'owner' | 'manager' | 'staff' | 'viewer'>('staff')
  const [linkPermissions, setLinkPermissions] = useState<string[]>([])
  const [linkLoading, setLinkLoading] = useState(false)

  // User search state for linking
  const [userSearch, setUserSearch] = useState('')
  const [searchedUsers, setSearchedUsers] = useState<SearchedUser[]>([])
  const [selectedUser, setSelectedUser] = useState<SearchedUser | null>(null)
  const [isSearchingUsers, setIsSearchingUsers] = useState(false)

  // Unlink account modal
  const [showUnlinkDialog, setShowUnlinkDialog] = useState(false)
  const [staffToUnlink, setStaffToUnlink] = useState<StaffRow | null>(null)
  const [unlinkLoading, setUnlinkLoading] = useState(false)

  const loadRestaurants = async () => {
    const { data } = await supabase.from('restaurants').select('id, name').order('name')
    setRestaurants(data || [])
  }

  const loadStaff = async () => {
    try {
      setLoading(true)
      let query = supabase
        .from('restaurant_staff')
        .select('id, user_id, restaurant_id, role, permissions, is_active, created_at, profiles:profiles!restaurant_staff_user_id_fkey(full_name, email), restaurants:restaurants(name)')
        .order('created_at', { ascending: false })
        .limit(500)
      if (selectedRestaurant !== 'all') query = query.eq('restaurant_id', selectedRestaurant)
      const { data, error } = await query
      if (error) throw error
      setRows((data as any) || [])
    } catch (e) {
      console.error(e)
      toast.error('Failed to load staff')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadRestaurants() }, [])
  useEffect(() => { loadStaff() }, [selectedRestaurant])

  // Search users when userSearch changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (userSearch && userSearch.length >= 3 && !selectedUser) {
        searchUsers(userSearch)
      } else if (userSearch.length < 3) {
        setSearchedUsers([])
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [userSearch, selectedUser])

  const list = useMemo(() => rows.filter(r => {
    const q = search.trim().toLowerCase()
    const matchesSearch = !q || (r.profiles?.full_name || '').toLowerCase().includes(q) || (r.profiles?.email || '').toLowerCase().includes(q) || (r.restaurants?.name || '').toLowerCase().includes(q)
    const matchesRole = roleFilter === 'all' || r.role === roleFilter
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? r.is_active : !r.is_active)
    return matchesSearch && matchesRole && matchesStatus
  }), [rows, search, roleFilter, statusFilter])

  const togglePermission = (perm: string) => {
    setLinkPermissions(prev => prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm])
  }

  // Search for users by email or name
  const searchUsers = async (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 3) {
      setSearchedUsers([])
      return
    }

    try {
      setIsSearchingUsers(true)

      const cleanSearch = searchTerm.trim().toLowerCase()

      // First try to search in profiles table by email
      const { data: profileUsers, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, phone_number, avatar_url, email')
        .or(`email.ilike.%${cleanSearch}%,email.eq.${cleanSearch}`)
        .limit(20)

      let users: SearchedUser[] = []

      if (profileUsers && profileUsers.length > 0) {
        users = profileUsers.filter(u => u.email && u.full_name) as any
      }

      // If no users found by email, try searching by name
      if (users.length === 0) {
        const { data: nameSearch } = await supabase
          .from('profiles')
          .select('id, full_name, phone_number, avatar_url, email')
          .ilike('full_name', `%${cleanSearch}%`)
          .limit(10)

        if (nameSearch && nameSearch.length > 0) {
          users = nameSearch.filter(u => u.email && u.full_name) as any
        }
      }

      // If still no results, try a broader search
      if (users.length === 0) {
        const searchParts = cleanSearch.includes('@') ? cleanSearch.split('@') : [cleanSearch]
        const { data: broadSearch } = await supabase
          .from('profiles')
          .select('id, full_name, phone_number, avatar_url, email')
          .or(`full_name.ilike.%${searchParts[0]}%,email.ilike.%${searchParts[0]}%`)
          .limit(15)

        if (broadSearch && broadSearch.length > 0) {
          users = broadSearch.filter(u => u.email && u.full_name) as any
        }
      }

      const validUsers = users.filter(u => u.email && u.full_name && u.id)
      setSearchedUsers(validUsers)

    } catch (error: any) {
      console.error('Error searching users:', error)
      toast.error(error.message || 'Failed to search users')
      setSearchedUsers([])
    } finally {
      setIsSearchingUsers(false)
    }
  }

  // Handle user selection
  const handleUserSelect = (user: SearchedUser) => {
    setSelectedUser(user)
    setUserSearch(user.email)
    setLinkEmail(user.email)
    setSearchedUsers([])
  }

  // Clear user selection
  const clearUserSelection = () => {
    setSelectedUser(null)
    setUserSearch('')
    setLinkEmail('')
    setSearchedUsers([])
  }

  const linkAccount = async () => {
    try {
      setLinkLoading(true)
      if (!selectedUser || !linkRestaurantId) { 
        toast.error('Please select a user and restaurant'); 
        return 
      }
      
      const { error: insertErr } = await supabase
        .from('restaurant_staff')
        .insert({ 
          user_id: selectedUser.id, 
          restaurant_id: linkRestaurantId, 
          role: linkRole, 
          permissions: linkPermissions, 
          is_active: true 
        })
      
      if (insertErr) throw insertErr
      
      toast.success(`Successfully linked ${selectedUser.full_name} (${selectedUser.email})`)
      setShowLinkDialog(false)
      setLinkEmail('')
      setLinkRestaurantId('')
      setLinkPermissions([])
      setLinkRole('staff')
      clearUserSelection()
      loadStaff()
    } catch (e: any) {
      console.error(e)
      toast.error(e.message || 'Failed to link account')
    } finally {
      setLinkLoading(false)
    }
  }

  const unlinkAccount = async () => {
    if (!staffToUnlink) return
    
    try {
      setUnlinkLoading(true)
      const { error } = await supabase
        .from('restaurant_staff')
        .delete()
        .eq('id', staffToUnlink.id)
        .eq('restaurant_id', staffToUnlink.restaurant_id)

      if (error) throw error

      toast.success('Staff account unlinked successfully')
      setShowUnlinkDialog(false)
      setStaffToUnlink(null)
      loadStaff()
    } catch (e: any) {
      console.error(e)
      toast.error(e.message || 'Failed to unlink account')
    } finally {
      setUnlinkLoading(false)
    }
  }

  const handleUnlinkClick = (staff: StaffRow) => {
    setStaffToUnlink(staff)
    setShowUnlinkDialog(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Restaurant Staff</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadStaff} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button size="sm" onClick={() => setShowLinkDialog(true)}>
            <Plus className="h-4 w-4 mr-2" /> Link Account
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="sm:col-span-2">
              <Input placeholder="Search by name/email/restaurant" value={search} onChange={(e)=>setSearch(e.target.value)} />
            </div>
            <div>
              <Select value={selectedRestaurant} onValueChange={setSelectedRestaurant}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All restaurants" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All restaurants</SelectItem>
                  {restaurants.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Results ({list.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : list.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-2" />
              No staff found
            </div>
          ) : (
            <div className="space-y-2">
              {list.map(row => (
                <div key={row.id} className="border rounded-lg p-3 bg-white flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{row.profiles?.full_name || 'Unknown'}</div>
                    <div className="text-xs text-muted-foreground truncate">{row.profiles?.email}</div>
                    <div className="text-xs text-muted-foreground">{row.restaurants?.name} • {row.role} • {row.is_active ? 'Active' : 'Inactive'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnlinkClick(row)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Unlink className="h-4 w-4 mr-1" />
                      Unlink
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Link Account to Restaurant</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>User Search *</Label>
              <div className="relative">
                <Input
                  type="email"
                  placeholder="Enter email or name to search for user..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pr-20"
                />
                {isSearchingUsers && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  </div>
                )}
                {selectedUser && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearUserSelection}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-7 px-2"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              
              {/* User suggestions dropdown */}
              {searchedUsers.length > 0 && !selectedUser && (
                <div className="mt-2 border rounded-lg shadow-lg bg-white max-h-64 overflow-y-auto">
                  {searchedUsers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleUserSelect(user)}
                      className="w-full p-3 hover:bg-muted/50 text-left border-b last:border-b-0 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold">
                          {user.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{user.full_name}</div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                          {user.phone_number && (
                            <div className="text-xs text-muted-foreground">{user.phone_number}</div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* No results message */}
              {userSearch && userSearch.length >= 3 && !isSearchingUsers && searchedUsers.length === 0 && !selectedUser && (
                <div className="mt-2 p-3 border rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    No users found matching "{userSearch}". Try a different email or name.
                  </p>
                </div>
              )}
              {userSearch && userSearch.length < 3 && (
                <p className="text-muted-foreground text-xs mt-1">
                  Type at least 3 characters to search for users
                </p>
              )}
            </div>

            {/* Selected User Display */}
            {selectedUser && (
              <div className="p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-lg">
                    {selectedUser.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{selectedUser.full_name}</div>
                    <div className="text-sm text-muted-foreground">{selectedUser.email}</div>
                    {selectedUser.phone_number && (
                      <div className="text-xs text-muted-foreground">{selectedUser.phone_number}</div>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div>
              <Label>Restaurant</Label>
              <Select value={linkRestaurantId} onValueChange={setLinkRestaurantId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select restaurant" />
                </SelectTrigger>
                <SelectContent>
                  {restaurants.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Role</Label>
              <Select value={linkRole} onValueChange={(v: any)=>setLinkRole(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="grid grid-cols-2 gap-2">
                {['view_bookings','manage_bookings','view_customers','manage_customers','view_tables','edit_tables','view_menu','edit_menu','export_data'].map(p => (
                  <div key={p} className="flex items-center gap-2">
                    <Checkbox checked={linkPermissions.includes(p)} onCheckedChange={()=>togglePermission(p)} />
                    <span className="text-sm capitalize">{p.replace('_',' ')}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={()=>setShowLinkDialog(false)}>Cancel</Button>
              <Button 
                onClick={linkAccount} 
                disabled={linkLoading || !selectedUser || !linkRestaurantId}
              >
                {linkLoading ? 'Linking...' : 'Link'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unlink Confirmation Dialog */}
      <Dialog open={showUnlinkDialog} onOpenChange={setShowUnlinkDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unlink className="h-5 w-5 text-red-600" />
              Unlink Staff Account
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {staffToUnlink && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="font-medium">{staffToUnlink.profiles?.full_name || 'Unknown'}</div>
                <div className="text-sm text-muted-foreground">{staffToUnlink.profiles?.email}</div>
                <div className="text-sm text-muted-foreground">
                  {staffToUnlink.restaurants?.name} • {staffToUnlink.role}
                </div>
              </div>
            )}
            <div className="text-sm text-gray-600">
              Are you sure you want to unlink this staff account from the restaurant? 
              This action will remove their access to the restaurant and cannot be undone.
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowUnlinkDialog(false)}
                disabled={unlinkLoading}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={unlinkAccount}
                disabled={unlinkLoading}
              >
                {unlinkLoading ? 'Unlinking...' : 'Unlink Account'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}



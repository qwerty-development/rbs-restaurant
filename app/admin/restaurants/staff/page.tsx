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
import { Users, RefreshCw, Plus, Mail, Unlink, Trash2 } from 'lucide-react'

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

  const linkAccount = async () => {
    try {
      setLinkLoading(true)
      const email = linkEmail.trim().toLowerCase()
      if (!email || !linkRestaurantId) { toast.error('Email and restaurant are required'); return }
      const { data: profile, error: pErr } = await supabase.from('profiles').select('id').eq('email', email).single()
      if (pErr || !profile) { toast.error('User not found'); return }
      const { error: insertErr } = await supabase.from('restaurant_staff').insert({ user_id: profile.id, restaurant_id: linkRestaurantId, role: linkRole, permissions: linkPermissions, is_active: true })
      if (insertErr) throw insertErr
      toast.success('Linked successfully')
      setShowLinkDialog(false)
      setLinkEmail(''); setLinkRestaurantId(''); setLinkPermissions([]); setLinkRole('staff')
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
              <Label>Email</Label>
              <div className="flex gap-2">
                <Mail className="h-4 w-4 mt-2 text-muted-foreground" />
                <Input value={linkEmail} onChange={(e)=>setLinkEmail(e.target.value)} placeholder="user@example.com" />
              </div>
            </div>
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
              <Button onClick={linkAccount} disabled={linkLoading}>{linkLoading ? 'Linking...' : 'Link'}</Button>
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



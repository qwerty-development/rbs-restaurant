// app/(dashboard)/staff/page.tsx
"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { restaurantAuth } from "@/lib/restaurant-auth"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "react-hot-toast"
import {
  UserPlus,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  Mail,
  Phone,
  Shield,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  Crown,
  Star,
  Coffee,
  Eye,
  Activity,
  Loader2,
  Settings,
  X
} from "lucide-react"

// Types
type StaffMember = {
  id: string
  role: 'owner' | 'manager' | 'staff' | 'viewer'
  permissions: string[]
  is_active: boolean
  hired_at: string
  last_login_at: string | null
  user: {
    id: string
    full_name: string
    email: string
    phone_number: string | null
    avatar_url: string | null
  }
}

type User = {
  id: string
  email: string
  user_metadata: {
    full_name?: string
    phone_number?: string
  }
}

// Form schemas
const staffFormSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phoneNumber: z.string().optional(),
  role: z.enum(["manager", "staff", "viewer"]),
  permissions: z.array(z.string()).min(1, "Select at least one permission"),
})

type StaffFormData = z.infer<typeof staffFormSchema>

// Constants
const ROLES = [
  { 
    value: 'owner', 
    label: 'Owner', 
    description: 'Full access to all features',
    icon: Crown,
    color: 'bg-yellow-100 text-yellow-800'
  },
  { 
    value: 'manager', 
    label: 'Manager', 
    description: 'Manage bookings, menu, and staff',
    icon: Star,
    color: 'bg-purple-100 text-purple-800'
  },
  { 
    value: 'staff', 
    label: 'Staff', 
    description: 'Handle bookings and customers',
    icon: Coffee,
    color: 'bg-blue-100 text-blue-800'
  },
  { 
    value: 'viewer', 
    label: 'Viewer', 
    description: 'View-only access',
    icon: Eye,
    color: 'bg-gray-100 text-gray-800'
  }
]

const PERMISSIONS = [
  { 
    id: 'bookings.view', 
    label: 'View Bookings', 
    category: 'Bookings',
    description: 'See all restaurant bookings'
  },
  { 
    id: 'bookings.manage', 
    label: 'Manage Bookings', 
    category: 'Bookings',
    description: 'Create, edit, and cancel bookings'
  },
  { 
    id: 'menu.view', 
    label: 'View Menu', 
    category: 'Menu',
    description: 'See restaurant menu items'
  },
  { 
    id: 'menu.manage', 
    label: 'Manage Menu', 
    category: 'Menu',
    description: 'Add, edit, and remove menu items'
  },
  { 
    id: 'tables.view', 
    label: 'View Tables', 
    category: 'Tables',
    description: 'See table layout and availability'
  },
  { 
    id: 'tables.manage', 
    label: 'Manage Tables', 
    category: 'Tables',
    description: 'Edit table configuration'
  },
  { 
    id: 'customers.view', 
    label: 'View Customers', 
    category: 'Customers',
    description: 'See customer information'
  },
  { 
    id: 'customers.manage', 
    label: 'Manage VIP/Loyalty', 
    category: 'Customers',
    description: 'Manage customer VIP status and loyalty'
  },
  { 
    id: 'analytics.view', 
    label: 'View Analytics', 
    category: 'Analytics',
    description: 'Access restaurant analytics'
  },
  { 
    id: 'settings.view', 
    label: 'View Settings', 
    category: 'Settings',
    description: 'See restaurant settings'
  },
  { 
    id: 'settings.manage', 
    label: 'Manage Settings', 
    category: 'Settings',
    description: 'Change restaurant configuration'
  },
  { 
    id: 'staff.manage', 
    label: 'Manage Staff', 
    category: 'Staff',
    description: 'Add, edit, and remove staff members'
  }
]

export default function StaffPage() {
  const router = useRouter()
  const supabase = createClient()
  
  // State
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [currentStaff, setCurrentStaff] = useState<StaffMember | null>(null)
  const [restaurantId, setRestaurantId] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [isAddingStaff, setIsAddingStaff] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")

  // Form
  const form = useForm<StaffFormData>({
    resolver: zodResolver(staffFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phoneNumber: "",
      role: "staff",
      permissions: restaurantAuth.getDefaultPermissions("staff"),
    },
  })

  // Watch role changes to update permissions
  const watchedRole = form.watch("role")
  useEffect(() => {
    if (watchedRole) {
      form.setValue("permissions", restaurantAuth.getDefaultPermissions(watchedRole))
    }
  }, [watchedRole, form])

  // Load initial data
  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    try {
      setLoading(true)

      // Get current user
      const { data: { user } }:any = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setCurrentUser(user)

      // Get current staff data
      const { data: staffData, error: staffError } = await supabase
        .from('restaurant_staff')
        .select(`
          id,
          role,
          permissions,
          restaurant_id,
          user:profiles(*)
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single()

      if (staffError || !staffData) {
        toast.error("You don't have access to manage staff")
        router.push('/dashboard')
        return
      }

      setCurrentStaff(staffData as any)
      setRestaurantId(staffData.restaurant_id)

      // Check if user can manage staff
      if (!restaurantAuth.hasPermission(staffData.permissions, 'staff.manage', staffData.role)) {
        toast.error("You don't have permission to manage staff")
        router.push('/dashboard')
        return
      }

      // Load staff members
      await loadStaffMembers(staffData.restaurant_id)

    } catch (error) {
      console.error('Error loading initial data:', error)
      toast.error('Failed to load staff data')
    } finally {
      setLoading(false)
    }
  }

  const loadStaffMembers = async (restaurantId: string) => {
    try {
      const staff:any = await restaurantAuth.getRestaurantStaff(restaurantId)
      setStaffMembers(staff as StaffMember[])
    } catch (error) {
      console.error('Error loading staff members:', error)
      toast.error('Failed to load staff members')
    }
  }

  // Add staff member
  const handleAddStaff = async (data: StaffFormData) => {
    if (!currentUser || !restaurantId) return

    try {
      setLoading(true)
      
      await restaurantAuth.addStaffMember(
        restaurantId,
        {
          fullName: data.fullName,
          email: data.email,
          phoneNumber: data.phoneNumber,
          role: data.role,
          permissions: data.permissions
        },
        currentUser.id
      )

      toast.success("Staff member added successfully")
      setIsAddingStaff(false)
      form.reset()
      await loadStaffMembers(restaurantId)

    } catch (error: any) {
      console.error('Error adding staff:', error)
      toast.error(error.message || "Failed to add staff member")
    } finally {
      setLoading(false)
    }
  }

  // Toggle staff status
  const handleToggleStatus = async (staffId: string, currentStatus: boolean) => {
    if (!currentUser) return

    try {
      await restaurantAuth.updateStaffMember(
        staffId,
        { is_active: !currentStatus },
        currentUser.id
      )

      toast.success(`Staff member ${!currentStatus ? 'activated' : 'deactivated'}`)
      await loadStaffMembers(restaurantId)

    } catch (error: any) {
      console.error('Error updating staff status:', error)
      toast.error(error.message || "Failed to update staff status")
    }
  }

  // Remove staff member
  const handleRemoveStaff = async (staffId: string, staffName: string) => {
    if (!currentUser) return
    if (!confirm(`Are you sure you want to remove ${staffName}?`)) return

    try {
      await restaurantAuth.removeStaffMember(staffId, currentUser.id)
      toast.success("Staff member removed successfully")
      await loadStaffMembers(restaurantId)

    } catch (error: any) {
      console.error('Error removing staff:', error)
      toast.error(error.message || "Failed to remove staff member")
    }
  }

  // Filter staff members
  const filteredStaff = useMemo(() => {
    return staffMembers.filter(staff => {
      const matchesSearch = !searchQuery || 
        staff.user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        staff.user.email.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesRole = roleFilter === 'all' || staff.role === roleFilter
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'active' && staff.is_active) ||
        (statusFilter === 'inactive' && !staff.is_active)
      
      return matchesSearch && matchesRole && matchesStatus
    })
  }, [staffMembers, searchQuery, roleFilter, statusFilter])

  // Staff statistics
  const stats = useMemo(() => {
    const total = staffMembers.length
    const active = staffMembers.filter(s => s.is_active).length
    const byRole = staffMembers.reduce((acc, staff) => {
      acc[staff.role] = (acc[staff.role] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return { total, active, inactive: total - active, byRole }
  }, [staffMembers])

  const StatsCard = ({ title, value, subtitle, icon: Icon }: {
    title: string
    value: string | number
    subtitle?: string
    icon: any
  }) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className="p-3 bg-primary/10 rounded-lg">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const RoleBadge = ({ role }: { role: string }) => {
    const roleConfig = ROLES.find(r => r.value === role)
    if (!roleConfig) return <Badge variant="secondary">{role}</Badge>

    return (
      <Badge variant="secondary" className={roleConfig.color}>
        <roleConfig.icon className="w-3 h-3 mr-1" />
        {roleConfig.label}
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff Management</h1>
          <p className="text-muted-foreground">
            Manage your restaurant team and their permissions
          </p>
        </div>
        
        <Dialog open={isAddingStaff} onOpenChange={setIsAddingStaff}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Add Staff Member
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Staff Member</DialogTitle>
              <DialogDescription>
                Invite a new team member to your restaurant
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleAddStaff)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="john@restaurant.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number (Optional)</FormLabel>
                        <FormControl>
                          <Input type="tel" placeholder="+961 70 123456" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ROLES.slice(1).map((role) => (
                              <SelectItem key={role.value} value={role.value}>
                                <div className="flex items-center space-x-2">
                                  <role.icon className="w-4 h-4" />
                                  <div>
                                    <div className="font-medium">{role.label}</div>
                                    <div className="text-sm text-muted-foreground">{role.description}</div>
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="permissions"
                  render={() => (
                    <FormItem>
                      <div className="mb-4">
                        <FormLabel className="text-base">Permissions</FormLabel>
                        <FormDescription>
                          Select what this staff member can do
                        </FormDescription>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-64 overflow-y-auto border rounded-lg p-4">
                        {Object.entries(
                          PERMISSIONS.reduce((acc, permission) => {
                            if (!acc[permission.category]) acc[permission.category] = []
                            acc[permission.category].push(permission)
                            return acc
                          }, {} as Record<string, typeof PERMISSIONS>)
                        ).map(([category, permissions]) => (
                          <div key={category} className="space-y-3">
                            <h4 className="font-medium text-sm">{category}</h4>
                            <div className="space-y-3">
                              {permissions.map((permission) => (
                                <FormField
                                  key={permission.id}
                                  control={form.control}
                                  name="permissions"
                                  render={({ field }) => {
                                    return (
                                      <FormItem
                                        key={permission.id}
                                        className="flex flex-row items-start space-x-3 space-y-0"
                                      >
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value?.includes(permission.id)}
                                            onCheckedChange={(checked) => {
                                              return checked
                                                ? field.onChange([...field.value, permission.id])
                                                : field.onChange(
                                                    field.value?.filter(
                                                      (value) => value !== permission.id
                                                    )
                                                  )
                                            }}
                                          />
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                          <FormLabel className="text-sm font-normal">
                                            {permission.label}
                                          </FormLabel>
                                          <p className="text-xs text-muted-foreground">
                                            {permission.description}
                                          </p>
                                        </div>
                                      </FormItem>
                                    )
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddingStaff(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Add Staff Member
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard
          title="Total Staff"
          value={stats.total}
          icon={Users}
        />
        <StatsCard
          title="Active Staff"
          value={stats.active}
          subtitle={`${stats.inactive} inactive`}
          icon={CheckCircle2}
        />
        <StatsCard
          title="Managers"
          value={stats.byRole.manager || 0}
          icon={Star}
        />
        <StatsCard
          title="Staff Members"
          value={stats.byRole.staff || 0}
          icon={Coffee}
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search staff members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-full md:w-64"
              />
            </div>
            
            <div className="flex space-x-2">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Staff Table */}
      <Card>
        <CardHeader>
          <CardTitle>Staff Members ({filteredStaff.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredStaff.length === 0 ? (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No staff members found</h3>
              <p className="text-muted-foreground mt-2">
                {searchQuery || roleFilter !== 'all' || statusFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Get started by adding your first staff member'
                }
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Hired</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaff.map((staff) => (
                  <TableRow key={staff.id}>
                    <TableCell>
                      <div className="flex items-center space-x-4">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                          <span className="text-sm font-semibold">
                            {staff.user.full_name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium">{staff.user.full_name}</div>
                          <div className="text-sm text-muted-foreground flex items-center space-x-4">
                            <span className="flex items-center">
                              <Mail className="h-3 w-3 mr-1" />
                              {staff.user.email}
                            </span>
                            {staff.user.phone_number && (
                              <span className="flex items-center">
                                <Phone className="h-3 w-3 mr-1" />
                                {staff.user.phone_number}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={staff.role} />
                    </TableCell>
                    <TableCell>
                      <Badge variant={staff.is_active ? "default" : "secondary"}>
                        {staff.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Clock className="h-3 w-3 mr-1" />
                        {staff.last_login_at 
                          ? new Date(staff.last_login_at).toLocaleDateString()
                          : 'Never'
                        }
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(staff.hired_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleStatus(staff.id, staff.is_active)}
                        >
                          {staff.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                        
                        {currentStaff?.role === 'owner' && staff.role !== 'owner' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveStaff(staff.id, staff.user.full_name)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
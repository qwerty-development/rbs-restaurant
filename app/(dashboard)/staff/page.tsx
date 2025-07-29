// app/(dashboard)/staff/page.tsx
"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "react-hot-toast"
import { 
  Plus, 
  Search, 
  UserPlus, 
  MoreHorizontal,
  Shield,
  Mail,
  Phone,
  Calendar,
  Edit,
  Trash2,
  UserX,
  UserCheck,
  Users
} from "lucide-react"
import { format } from "date-fns"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import type { RestaurantStaff, Profile } from "@/types"

const staffFormSchema = z.object({
  email: z.string().email("Invalid email address"),
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  phoneNumber: z.string().optional(),
  role: z.enum(["owner", "manager", "staff", "viewer"]),
  permissions: z.array(z.string()).min(1, "Select at least one permission"),
})

type StaffFormData = z.infer<typeof staffFormSchema>

const ROLES = [
  { value: "owner", label: "Owner", description: "Full access to all features" },
  { value: "manager", label: "Manager", description: "Manage bookings, menu, and staff" },
  { value: "staff", label: "Staff", description: "Handle bookings and customers" },
  { value: "viewer", label: "Viewer", description: "View-only access" },
]

const PERMISSIONS = [
  { value: "bookings.view", label: "View Bookings", category: "Bookings" },
  { value: "bookings.manage", label: "Manage Bookings", category: "Bookings" },
  { value: "menu.view", label: "View Menu", category: "Menu" },
  { value: "menu.manage", label: "Manage Menu", category: "Menu" },
  { value: "tables.view", label: "View Tables", category: "Tables" },
  { value: "tables.manage", label: "Manage Tables", category: "Tables" },
  { value: "customers.view", label: "View Customers", category: "Customers" },
  { value: "customers.manage", label: "Manage VIP/Loyalty", category: "Customers" },
  { value: "analytics.view", label: "View Analytics", category: "Analytics" },
  { value: "settings.view", label: "View Settings", category: "Settings" },
  { value: "settings.manage", label: "Manage Settings", category: "Settings" },
  { value: "staff.manage", label: "Manage Staff", category: "Staff" },
]

const DEFAULT_PERMISSIONS_BY_ROLE = {
  owner: ["all"],
  manager: [
    "bookings.view", "bookings.manage",
    "menu.view", "menu.manage",
    "tables.view", "tables.manage",
    "customers.view", "customers.manage",
    "analytics.view",
    "settings.view"
  ],
  staff: [
    "bookings.view", "bookings.manage",
    "menu.view",
    "tables.view",
    "customers.view"
  ],
  viewer: [
    "bookings.view",
    "menu.view",
    "tables.view",
    "analytics.view"
  ],
}

export default function StaffPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [isAddingStaff, setIsAddingStaff] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<RestaurantStaff | null>(null)
  const [roleFilter, setRoleFilter] = useState<string>("all")
  
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Get restaurant ID and current user role
  const [restaurantId, setRestaurantId] = useState<string>("")
  const [currentUserRole, setCurrentUserRole] = useState<string>("")
  
  useEffect(() => {
    async function getRestaurantInfo() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: staffData } = await supabase
          .from("restaurant_staff")
          .select("restaurant_id, role")
          .eq("user_id", user.id)
          .single()
        
        if (staffData) {
          setRestaurantId(staffData.restaurant_id)
          setCurrentUserRole(staffData.role)
        }
      }
    }
    getRestaurantInfo()
  }, [supabase])

  // Fetch staff members
  const { data: staffMembers, isLoading } = useQuery({
    queryKey: ["staff-members", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      
      const { data, error } = await supabase
        .from("restaurant_staff")
        .select(`
          *,
          user:profiles(
            id,
            full_name,
            email,
            phone_number,
            avatar_url
          )
        `)
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false })

      if (error) throw error
      return data as (RestaurantStaff & { user: Profile })[]
    },
    enabled: !!restaurantId,
  })

  // Form setup
  const form = useForm<StaffFormData>({
    resolver: zodResolver(staffFormSchema),
    defaultValues: {
      email: "",
      fullName: "",
      phoneNumber: "",
      role: "staff",
      permissions: DEFAULT_PERMISSIONS_BY_ROLE.staff,
    },
  })

  // Watch for role changes to update permissions
  const watchedRole = form.watch("role")
  useEffect(() => {
    if (watchedRole !== "owner") {
      form.setValue("permissions", DEFAULT_PERMISSIONS_BY_ROLE[watchedRole as keyof typeof DEFAULT_PERMISSIONS_BY_ROLE])
    }
  }, [watchedRole, form])

  // Add staff member mutation
  const addStaffMutation = useMutation({
    mutationFn: async (data: StaffFormData) => {
      // First check if user exists
      let userId: string | null = null
      
      const { data: existingUser } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", data.email)
        .single()

      if (existingUser) {
        userId = existingUser.id
        
        // Check if already a staff member
        const { data: existingStaff } = await supabase
          .from("restaurant_staff")
          .select("id")
          .eq("restaurant_id", restaurantId)
          .eq("user_id", userId)
          .single()

        if (existingStaff) {
          throw new Error("User is already a staff member")
        }
      } else {
        // Create user account with temporary password
        const tempPassword = Math.random().toString(36).slice(-8) + "Aa1!"
        
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: data.email,
          password: tempPassword,
          options: {
            data: {
              full_name: data.fullName,
              phone_number: data.phoneNumber,
            },
          },
        })

        if (authError) throw authError
        if (!authData.user) throw new Error("Failed to create user account")
        
        userId = authData.user.id

        // TODO: Send email with login credentials and password reset link
      }

      // Add staff member
      const { error } = await supabase
        .from("restaurant_staff")
        .insert({
          restaurant_id: restaurantId,
          user_id: userId,
          role: data.role,
          permissions: data.role === "owner" ? ["all"] : data.permissions,
          is_active: true,
        })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-members"] })
      toast.success("Staff member added successfully")
      setIsAddingStaff(false)
      form.reset()
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to add staff member")
    },
  })

  // Update staff member mutation
  const updateStaffMutation = useMutation({
    mutationFn: async ({ staffId, data }: { staffId: string; data: Partial<RestaurantStaff> }) => {
      const { error } = await supabase
        .from("restaurant_staff")
        .update(data)
        .eq("id", staffId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-members"] })
      toast.success("Staff member updated")
    },
    onError: () => {
      toast.error("Failed to update staff member")
    },
  })

  // Remove staff member mutation
  const removeStaffMutation = useMutation({
    mutationFn: async (staffId: string) => {
      const { error } = await supabase
        .from("restaurant_staff")
        .delete()
        .eq("id", staffId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-members"] })
      toast.success("Staff member removed")
    },
    onError: () => {
      toast.error("Failed to remove staff member")
    },
  })

  // Filter staff members
  const filteredStaff = staffMembers?.filter((staff) => {
    const matchesSearch = !searchQuery || 
      staff.user?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      staff.user?.email?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesRole = roleFilter === "all" || staff.role === roleFilter
    
    return matchesSearch && matchesRole
  })

  // Get staff statistics
  const getStaffStats = () => {
    if (!staffMembers) return { total: 0, active: 0, byRole: {} }
    
    const stats = {
      total: staffMembers.length,
      active: staffMembers.filter(s => s.is_active).length,
      byRole: staffMembers.reduce((acc, staff) => {
        acc[staff.role] = (acc[staff.role] || 0) + 1
        return acc
      }, {} as Record<string, number>),
    }

    return stats
  }

  const stats = getStaffStats()

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff Management</h1>
          <p className="text-muted-foreground">
            Manage your restaurant staff and their permissions
          </p>
        </div>
        {(currentUserRole === "owner" || currentUserRole === "manager") && (
          <Dialog open={isAddingStaff} onOpenChange={setIsAddingStaff}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Add Staff
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Add Staff Member</DialogTitle>
                <DialogDescription>
                  Invite a new staff member to your restaurant
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((data) => addStaffMutation.mutate(data))} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="John Doe"
                              {...field}
                              disabled={addStaffMutation.isPending}
                            />
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
                            <Input
                              type="email"
                              placeholder="john@example.com"
                              {...field}
                              disabled={addStaffMutation.isPending}
                            />
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
                            <Input
                              placeholder="+961 XX XXX XXX"
                              {...field}
                              disabled={addStaffMutation.isPending}
                            />
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
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={addStaffMutation.isPending || currentUserRole !== "owner"}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {ROLES.map((role) => (
                                <SelectItem 
                                  key={role.value} 
                                  value={role.value}
                                  disabled={role.value === "owner" && currentUserRole !== "owner"}
                                >
                                  <div>
                                    <div className="font-medium">{role.label}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {role.description}
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
                  
                  {watchedRole !== "owner" && (
                    <FormField
                      control={form.control}
                      name="permissions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Permissions</FormLabel>
                          <FormDescription>
                            Select the permissions for this staff member
                          </FormDescription>
                          <div className="space-y-4 mt-3">
                            {Object.entries(
                              PERMISSIONS.reduce((acc, perm) => {
                                if (!acc[perm.category]) acc[perm.category] = []
                                acc[perm.category].push(perm)
                                return acc
                              }, {} as Record<string, typeof PERMISSIONS>)
                            ).map(([category, perms]) => (
                              <div key={category}>
                                <h4 className="text-sm font-medium mb-2">{category}</h4>
                                <div className="space-y-2">
                                  {perms.map((permission) => (
                                    <div key={permission.value} className="flex items-center space-x-2">
                                      <Checkbox
                                        id={permission.value}
                                        checked={field.value.includes(permission.value)}
                                        onCheckedChange={(checked) => {
                                          if (checked) {
                                            field.onChange([...field.value, permission.value])
                                          } else {
                                            field.onChange(
                                              field.value.filter((v) => v !== permission.value)
                                            )
                                          }
                                        }}
                                        disabled={addStaffMutation.isPending}
                                      />
                                      <label
                                        htmlFor={permission.value}
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                      >
                                        {permission.label}
                                      </label>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsAddingStaff(false)}
                      disabled={addStaffMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={addStaffMutation.isPending}>
                      {addStaffMutation.isPending ? "Adding..." : "Add Staff Member"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Staff</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-muted-foreground">
              Currently active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Managers</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats.byRole.owner || 0) + (stats.byRole.manager || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              With admin access
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Staff Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.byRole.staff || 0}</div>
            <p className="text-xs text-muted-foreground">
              Regular staff
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Staff List */}
      <Card>
        <CardHeader>
          <CardTitle>Staff Members</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by role" />
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
          </div>

          {/* Staff Table */}
          {isLoading ? (
            <div className="text-center py-8">Loading staff members...</div>
          ) : filteredStaff?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery || roleFilter !== "all" 
                ? "No staff members found matching your filters" 
                : "No staff members yet"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaff?.map((staff) => (
                  <TableRow key={staff.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={staff.user?.avatar_url} />
                          <AvatarFallback>
                            {staff.user?.full_name?.split(" ").map(n => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{staff.user?.full_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {staff.user?.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={staff.role === "owner" ? "default" : "secondary"}>
                        {staff.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {staff.user?.phone_number && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {staff.user.phone_number}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={staff.is_active ? "default" : "secondary"}>
                        {staff.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(staff.created_at), "MMM d, yyyy")}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {currentUserRole === "owner" || 
                       (currentUserRole === "manager" && staff.role !== "owner" && staff.role !== "manager") ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => 
                                updateStaffMutation.mutate({
                                  staffId: staff.id,
                                  data: { is_active: !staff.is_active }
                                })
                              }
                            >
                              {staff.is_active ? (
                                <>
                                  <UserX className="mr-2 h-4 w-4" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <UserCheck className="mr-2 h-4 w-4" />
                                  Activate
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
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
// app/(dashboard)/staff/page.tsx
"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { restaurantAuth, type StaffMember, type Role } from "@/lib/restaurant-auth"
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
  selectedUserId: z.string().min(1, "Please select a user"),
  role: z.enum(["manager", "staff", "viewer"]),
  permissions: z.array(z.string()).min(1, "Select at least one permission"),
})

type StaffFormData = z.infer<typeof staffFormSchema>

// Edit Staff form schema
const editStaffFormSchema = z.object({
  role: z.enum(["owner", "manager", "staff", "viewer"]),
  permissions: z.array(z.string()).min(1, "Select at least one permission"),
})

type EditStaffFormData = z.infer<typeof editStaffFormSchema>

// User search types
type SearchedUser = {
  id: string
  email: string
  full_name: string
  phone_number: string | null
  avatar_url: string | null
  isAlreadyStaff?: boolean
}

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
  },
  { 
    id: 'schedules.view', 
    label: 'View Schedules', 
    category: 'Schedules',
    description: 'View staff schedules and time clock'
  },
  { 
    id: 'schedules.manage', 
    label: 'Manage Schedules', 
    category: 'Schedules',
    description: 'Create and edit staff schedules'
  }
]

export default function StaffPage() {
  const router = useRouter()
  const supabase = createClient()
  
  // State
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [currentStaff, setCurrentStaff] = useState<any>(null)
  const [restaurantId, setRestaurantId] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [isAddingStaff, setIsAddingStaff] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  
  // User search state
  const [emailSearch, setEmailSearch] = useState("")
  const [searchedUsers, setSearchedUsers] = useState<SearchedUser[]>([])
  const [selectedUser, setSelectedUser] = useState<SearchedUser | null>(null)
  const [isSearchingUsers, setIsSearchingUsers] = useState(false)

  // Edit staff state
  const [isEditingStaff, setIsEditingStaff] = useState(false)
  const [staffToEdit, setStaffToEdit] = useState<StaffMember | null>(null)

  // Form
  const form = useForm<StaffFormData>({
    resolver: zodResolver(staffFormSchema),
    defaultValues: {
      selectedUserId: "",
      role: "staff",
      permissions: restaurantAuth.getDefaultPermissions("staff"),
    },
  })

  const editForm = useForm<EditStaffFormData>({
    resolver: zodResolver(editStaffFormSchema),
    defaultValues: {
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

  // Search users when email changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (emailSearch && emailSearch.length >= 3 && !selectedUser) {
        console.log('Searching for users with email:', emailSearch)
        searchUsers(emailSearch)
      } else if (emailSearch.length < 3) {
        setSearchedUsers([])
      }
    }, 300) // Reduced delay for better responsiveness

    return () => clearTimeout(timer)
  }, [emailSearch, selectedUser, restaurantId])

  // Watch edit role changes to update permissions
  const editWatchedRole = editForm.watch("role")
  useEffect(() => {
    if (editWatchedRole && isEditingStaff) {
      editForm.setValue("permissions", restaurantAuth.getDefaultPermissions(editWatchedRole))
    }
  }, [editWatchedRole, editForm, isEditingStaff])

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
          restaurant_id
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single()

      if (staffError || !staffData) {
        console.error('Staff query error:', staffError)
        console.log('Staff data result:', staffData)
        toast.error("You don't have access to manage staff")
        router.push('/dashboard')
        return
      }

      // Debug: Log the complete staff data
      console.log('Complete staff data received:', staffData)

      setCurrentStaff(staffData)
      setRestaurantId(staffData.restaurant_id)

      // Debug: Log the permission check data
      console.log('Permission check debug:', {
        permissions: staffData.permissions,
        role: staffData.role,
        requiredPermission: 'staff.manage',
        hasPermission: restaurantAuth.hasPermission(staffData.permissions, 'staff.manage', staffData.role)
      })

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

  // Load initial data
  useEffect(() => {
    loadInitialData()
  }, [])

  const loadStaffMembers = async (restaurantId: string) => {
    try {
      const staff = await restaurantAuth.getRestaurantStaff(restaurantId)
      setStaffMembers(staff)
    } catch (error) {
      console.error('Error loading staff members:', error)
      toast.error('Failed to load staff members')
    }
  }

  // Search for users by email
  const searchUsers = async (email: string) => {
    if (!email || email.length < 3) {
      setSearchedUsers([])
      return
    }

    try {
      setIsSearchingUsers(true)

      // Clean and normalize the search email
      const cleanEmail = email.trim().toLowerCase()
      console.log('Searching for users with cleaned email:', cleanEmail)

      // First try to search in profiles table by email
      const { data: profileUsers, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, phone_number, avatar_url, email')
        .or(`email.ilike.%${cleanEmail}%,email.eq.${cleanEmail}`)
        .limit(20)

      console.log('Profile search results:', profileUsers, 'Error:', profileError)

      let users: SearchedUser[] = []

      // If we found users in profiles, use them
      if (profileUsers && profileUsers.length > 0) {
        users = profileUsers.filter(u => u.email && u.full_name) as any
      }

      // If no users found by email, try searching by name (in case they typed a name instead of email)
      if (users.length === 0) {
        console.log('No email matches, trying name search...')
        const { data: nameSearch, error: nameError } = await supabase
          .from('profiles')
          .select('id, full_name, phone_number, avatar_url, email')
          .ilike('full_name', `%${cleanEmail}%`)
          .limit(10)

        console.log('Name search results:', nameSearch, 'Error:', nameError)

        if (nameSearch && nameSearch.length > 0) {
          users = nameSearch.filter(u => u.email && u.full_name) as any
        }
      }

      // If still no results, try a broader search
      if (users.length === 0) {
        console.log('No name matches, trying broader search...')
        const emailParts = cleanEmail.includes('@') ? cleanEmail.split('@') : [cleanEmail]
        const { data: broadSearch, error: broadError } = await supabase
          .from('profiles')
          .select('id, full_name, phone_number, avatar_url, email')
          .or(`full_name.ilike.%${emailParts[0]}%,email.ilike.%${emailParts[0]}%`)
          .limit(15)

        console.log('Broad search results:', broadSearch, 'Error:', broadError)

        if (broadSearch && broadSearch.length > 0) {
          users = broadSearch.filter(u => u.email && u.full_name) as any
        }
      }

      console.log('Final user results before staff check:', users)

      // Mark users already staff for this restaurant
      if (users.length > 0 && restaurantId) {
        const userIds = users.map(u => u.id)
        const { data: existingStaff, error: staffCheckError } = await supabase
          .from('restaurant_staff')
          .select('user_id')
          .eq('restaurant_id', restaurantId)
          .in('user_id', userIds)

        console.log('Existing staff check:', existingStaff, 'Error:', staffCheckError)

        if (!staffCheckError && existingStaff) {
          const staffUserIds = new Set(existingStaff.map(s => s.user_id))
          users = users.map(u => ({ ...u, isAlreadyStaff: staffUserIds.has(u.id) }))
        }
      }

      // Filter out users with null/empty emails and ensure they have the required fields
      const validUsers = users.filter(u => 
        u.email && 
        u.full_name && 
        u.id
      )

      console.log('Final valid users:', validUsers)
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
    form.setValue('selectedUserId', user.id)
    setEmailSearch(user.email)
    setSearchedUsers([])
  }

  // Clear user selection
  const clearUserSelection = () => {
    setSelectedUser(null)
    setEmailSearch("")
    setSearchedUsers([])
    form.setValue('selectedUserId', "")
  }

  // Open Edit Staff dialog
  const handleOpenEdit = (staff: StaffMember) => {
    setStaffToEdit(staff)
    editForm.reset({
      role: staff.role,
      permissions: staff.permissions || [],
    })
    setIsEditingStaff(true)
  }

  // Close Edit Staff dialog
  const handleCloseEdit = () => {
    setIsEditingStaff(false)
    setStaffToEdit(null)
  }

  // Save edits
  const handleSaveEdit = async (data: EditStaffFormData) => {
    if (!currentUser || !staffToEdit) return
    try {
      setLoading(true)
      await restaurantAuth.updateStaffMember(
        staffToEdit.id,
        {
          // Only pass columns that exist in restaurant_staff
          role: data.role as any,
          permissions: data.permissions as any,
        } as any,
        currentUser.id
      )
      toast.success("Staff member updated")
      handleCloseEdit()
      await loadStaffMembers(restaurantId)
    } catch (error: any) {
      console.error('Error updating staff:', error)
      toast.error(error.message || 'Failed to update staff')
    } finally {
      setLoading(false)
    }
  }

  // Add staff member
  const handleAddStaff = async (data: StaffFormData) => {
    if (!currentUser || !restaurantId || !selectedUser) return

    try {
      setLoading(true)
      
      await restaurantAuth.addExistingUserAsStaff(
        restaurantId,
        data.selectedUserId,
        data.role,
        data.permissions,
        currentUser.id
      )

      toast.success(`${selectedUser.full_name} added as staff member successfully`)
      setIsAddingStaff(false)
      form.reset()
      clearUserSelection()
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
        
        <Dialog open={isAddingStaff} onOpenChange={(open) => {
          setIsAddingStaff(open)
          if (!open) {
            clearUserSelection()
            form.reset()
          }
        }}>
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
              <form onSubmit={form.handleSubmit(handleAddStaff)} className="space-y-6">
                {/* User Search Section */}
                <div className="space-y-4">
                  <div>
                    <FormLabel>Search User by Email</FormLabel>
                    <div className="relative">
                      <Input
                        type="email"
                        placeholder="Enter email to search for existing users..."
                        value={emailSearch}
                        onChange={(e) => setEmailSearch(e.target.value)}
                        className="pr-20"
                      />
                      <div className="absolute right-2 top-2 flex items-center gap-1">
                        {isSearchingUsers && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        {emailSearch && emailSearch.length >= 3 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => searchUsers(emailSearch)}
                            disabled={isSearchingUsers}
                          >
                            <Search className="h-3 w-3" />
                          </Button>
                        )}
                        {selectedUser && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={clearUserSelection}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {emailSearch && emailSearch.length >= 3 && !isSearchingUsers && searchedUsers.length === 0 && !selectedUser && (
                      <div className="text-sm text-muted-foreground mt-1 space-y-1">
                        <p>No users found with this email. Try:</p>
                        <ul className="text-xs list-disc list-inside ml-2 space-y-1">
                          <li>Checking the email spelling</li>
                          <li>Searching by name instead</li>
                          <li>Using just the username part (before @)</li>
                          <li>Making sure the user has registered</li>
                        </ul>
                      </div>
                    )}
                    {emailSearch && emailSearch.length < 3 && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Enter at least 3 characters to search
                      </p>
                    )}
                  </div>

                  {/* Selected User Display */}
                  {selectedUser && (
                    <div className="p-4 border rounded-lg bg-muted/50">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-semibold">
                            {selectedUser.full_name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium">{selectedUser.full_name}</h4>
                          <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                          {selectedUser.phone_number && (
                            <p className="text-sm text-muted-foreground">{selectedUser.phone_number}</p>
                          )}
                        </div>
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      </div>
                    </div>
                  )}

                  {/* Search Results */}
                  {searchedUsers.length > 0 && !selectedUser && (
                    <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg">
                      {searchedUsers.map((user) => (
                        <div
                          key={user.id}
                          className={`p-3 cursor-pointer hover:bg-muted/50 border-b last:border-b-0 ${
                            user.isAlreadyStaff ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                          onClick={() => !user.isAlreadyStaff && handleUserSelect(user)}
                        >
                          <div className="flex items-center space-x-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-xs font-semibold">
                                {user.full_name.split(' ').map(n => n[0]).join('')}
                              </span>
                            </div>
                            <div className="flex-1">
                              <div className="font-medium">{user.full_name}</div>
                              <div className="text-sm text-muted-foreground">{user.email}</div>
                              {user.phone_number && (
                                <div className="text-sm text-muted-foreground">{user.phone_number}</div>
                              )}
                              {user.isAlreadyStaff && (
                                <div className="text-xs text-orange-600 font-medium">Already staff member</div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Hidden form field for selected user */}
                  <FormField
                    control={form.control}
                    name="selectedUserId"
                    render={() => (
                      <FormItem className="hidden">
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Role Selection */}
                {selectedUser && (
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
                )}

                {/* Permissions Section */}
                {selectedUser && (
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
                )}

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddingStaff(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading || !selectedUser}>
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
                          onClick={() => handleOpenEdit(staff)}
                        >
                          <Edit className="h-4 w-4 mr-1" /> Edit
                        </Button>

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

      {/* Edit Staff Dialog */}
      <Dialog open={isEditingStaff} onOpenChange={(open) => {
        setIsEditingStaff(open)
        if (!open) handleCloseEdit()
      }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Staff</DialogTitle>
            <DialogDescription>
              Update role and permissions for this staff member
            </DialogDescription>
          </DialogHeader>

          {staffToEdit && (
            <div className="space-y-4">
              <div className="p-3 border rounded-lg bg-muted/50">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-sm font-semibold">
                      {staffToEdit.user.full_name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{staffToEdit.user.full_name}</div>
                    <div className="text-sm text-muted-foreground">{staffToEdit.user.email || 'No email'}</div>
                  </div>
                </div>
              </div>

              <Form {...editForm}>
                <form onSubmit={editForm.handleSubmit(handleSaveEdit)} className="space-y-6">
                  <FormField
                    control={editForm.control}
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
                            {ROLES.map((role) => (
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

                  <FormField
                    control={editForm.control}
                    name="permissions"
                    render={() => (
                      <FormItem>
                        <div className="mb-2">
                          <FormLabel>Permissions</FormLabel>
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
                                    control={editForm.control}
                                    name="permissions"
                                    render={({ field }) => (
                                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value?.includes(permission.id)}
                                            onCheckedChange={(checked) => {
                                              return checked
                                                ? field.onChange([...(field.value || []), permission.id])
                                                : field.onChange((field.value || []).filter((v: string) => v !== permission.id))
                                            }}
                                          />
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                          <FormLabel className="text-sm font-normal">
                                            {permission.label}
                                          </FormLabel>
                                          <p className="text-xs text-muted-foreground">{permission.description}</p>
                                        </div>
                                      </FormItem>
                                    )}
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
                    <Button type="button" variant="outline" onClick={handleCloseEdit}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save Changes'
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
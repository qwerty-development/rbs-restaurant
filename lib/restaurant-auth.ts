// lib/restaurant-auth.ts
import { createClient } from '@/lib/supabase/client'

export type Role = 'owner' | 'manager' | 'staff' | 'viewer'

export interface AddStaffMemberData {
  fullName: string
  email: string
  phoneNumber?: string
  role: Role
  permissions: string[]
}

export interface StaffMember {
  id: string
  role: Role
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

class RestaurantAuth {
  private supabase = createClient()

  // Default permissions by role
  getDefaultPermissions(role: Role): string[] {
    const permissions = {
      owner: [
        'bookings.view', 'bookings.manage',
        'menu.view', 'menu.manage',
        'tables.view', 'tables.manage',
        'customers.view', 'customers.manage',
        'analytics.view',
        'settings.view', 'settings.manage',
        'staff.manage'
      ],
      manager: [
        'bookings.view', 'bookings.manage',
        'menu.view', 'menu.manage',
        'tables.view', 'tables.manage',
        'customers.view', 'customers.manage',
        'analytics.view',
        'settings.view'
      ],
      staff: [
        'bookings.view', 'bookings.manage',
        'menu.view',
        'tables.view',
        'customers.view'
      ],
      viewer: [
        'bookings.view',
        'menu.view',
        'tables.view',
        'customers.view'
      ]
    }
    return permissions[role] || []
  }

  // Check if user has permission
  hasPermission(userPermissions: string[], requiredPermission: string, userRole: Role): boolean {
    // Owners have all permissions
    if (userRole === 'owner') return true
    
    // Check if user has "all" permission
    if (userPermissions.includes('all')) return true
    
    // Check if user has the specific permission
    return userPermissions.includes(requiredPermission)
  }

  // Get restaurant staff
  async getRestaurantStaff(restaurantId: string): Promise<StaffMember[]> {
    const { data, error } = await this.supabase
      .from('restaurant_staff')
      .select(`
        id,
        role,
        permissions,
        is_active,
        hired_at,
        last_login_at,
        user_id,
        user:profiles!restaurant_staff_user_id_fkey(
          id,
          full_name,
          phone_number,
          avatar_url
        )
      `)
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching restaurant staff:', error)
      throw new Error('Failed to fetch restaurant staff')
    }

    // For now, add a placeholder email - we'll get it from the user_id later
    const staffWithEmails = data?.map(staff => ({
      ...staff,
      user: {
        ...staff.user,
        email: `user-${staff.user_id.slice(0, 8)}@example.com` // Placeholder
      }
    })) || []

    return staffWithEmails as any[]
  }

  // Add staff member
  async addStaffMember(restaurantId: string, staffData: AddStaffMemberData, createdBy: string): Promise<void> {
    try {
      // Check if user with email already exists in auth.users
      const { data: authUsers, error: authError } = await this.supabase.auth.admin.listUsers()
      
      if (authError) {
        throw new Error('Failed to check existing users')
      }
      
      const existingUser = authUsers.users.find(user => user.email === staffData.email)

      let userId: string

      if (existingUser) {
        // User exists, just add them to restaurant staff
        userId = existingUser.id
        
        // Check if they're already staff at this restaurant
        const { data: existingStaff } = await this.supabase
          .from('restaurant_staff')
          .select('id')
          .eq('restaurant_id', restaurantId)
          .eq('user_id', userId)
          .single()

        if (existingStaff) {
          throw new Error('This user is already a staff member at this restaurant')
        }
      } else {
        // Create new user account
        const { data: authData, error: authError } = await this.supabase.auth.admin.createUser({
          email: staffData.email,
          password: this.generateTemporaryPassword(),
          email_confirm: true,
          user_metadata: {
            full_name: staffData.fullName,
            phone_number: staffData.phoneNumber
          }
        })

        if (authError || !authData.user) {
          throw new Error('Failed to create user account')
        }

        userId = authData.user.id

        // Create profile
        const { error: profileError } = await this.supabase
          .from('profiles')
          .insert({
            id: userId,
            full_name: staffData.fullName,
            phone_number: staffData.phoneNumber
          })

        if (profileError) {
          console.error('Error creating profile:', profileError)
          // Continue anyway as profile might be created by trigger
        }
      }

      // Add to restaurant staff
      const { error: staffError } = await this.supabase
        .from('restaurant_staff')
        .insert({
          restaurant_id: restaurantId,
          user_id: userId,
          role: staffData.role,
          permissions: staffData.permissions,
          created_by: createdBy,
          is_active: true
        })

      if (staffError) {
        console.error('Error adding staff member:', staffError)
        throw new Error('Failed to add staff member to restaurant')
      }

      // Send invitation email (you can implement this)
      // await this.sendInvitationEmail(staffData.email, staffData.fullName, restaurantId)

    } catch (error: any) {
      console.error('Error in addStaffMember:', error)
      throw error
    }
  }

  // Update staff member
  async updateStaffMember(staffId: string, updates: Partial<StaffMember>, updatedBy: string): Promise<void> {
    const { error } = await this.supabase
      .from('restaurant_staff')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', staffId)

    if (error) {
      console.error('Error updating staff member:', error)
      throw new Error('Failed to update staff member')
    }
  }

  // Remove staff member
  async removeStaffMember(staffId: string, removedBy: string): Promise<void> {
    const { error } = await this.supabase
      .from('restaurant_staff')
      .update({
        is_active: false,
        terminated_at: new Date().toISOString()
      })
      .eq('id', staffId)

    if (error) {
      console.error('Error removing staff member:', error)
      throw new Error('Failed to remove staff member')
    }
  }

  // Generate temporary password
  private generateTemporaryPassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let password = ''
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return password
  }

  // Send invitation email (placeholder - implement with your email service)
  private async sendInvitationEmail(email: string, name: string, restaurantId: string): Promise<void> {
    // Implement email sending logic here
    console.log(`Sending invitation email to ${email} for restaurant ${restaurantId}`)
  }
}

export const restaurantAuth = new RestaurantAuth()
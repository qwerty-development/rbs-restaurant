"use client"

import { useEffect, useState } from "react"
import { staffSchedulingService } from "@/lib/services/staff-scheduling"
import { createClient } from "@/lib/supabase/client"

export default function DebugPage() {
  const [data, setData] = useState<any>({})
  const [restaurantId, setRestaurantId] = useState<string>("")
  
  useEffect(() => {
    const testData = async () => {
      try {
        const supabase = createClient()
        
        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        console.log('Current user:', user)
        
        if (!user) {
          console.log('No user found')
          return
        }
        
        // Get current staff data
        const { data: staffData, error: staffError } = await supabase
          .from('restaurant_staff')
          .select('id, role, permissions, restaurant_id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single()
          
        console.log('Staff data:', staffData, 'Error:', staffError)
        
        if (staffError || !staffData) {
          console.log('No staff data found')
          return
        }
        
        setRestaurantId(staffData.restaurant_id)
        
        // Test restaurant staff loading
        console.log('Loading restaurant staff...')
        const staffMembers = await staffSchedulingService.getRestaurantStaff(staffData.restaurant_id)
        console.log('Restaurant staff loaded:', staffMembers)
        
        // Test time clock entries
        console.log('Loading time clock entries...')
        const timeClockEntries = await staffSchedulingService.getTimeClockEntries(staffData.restaurant_id, {
          startDate: '2025-09-01',
          endDate: '2025-09-01'
        })
        console.log('Time clock entries loaded:', timeClockEntries)
        
        // Test shifts
        console.log('Loading shifts...')
        const shifts = await staffSchedulingService.getStaffShifts(staffData.restaurant_id, {
          startDate: '2025-08-25',
          endDate: '2025-09-01'
        })
        console.log('Shifts loaded:', shifts)
        
        setData({
          user,
          staffData,
          staffMembers,
          timeClockEntries,
          shifts
        })
        
      } catch (error) {
        console.error('Debug error:', error)
      }
    }
    
    testData()
  }, [])
  
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Debug Page</h1>
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Restaurant ID:</h2>
          <p>{restaurantId}</p>
        </div>
        <div>
          <h2 className="text-lg font-semibold">Data:</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}

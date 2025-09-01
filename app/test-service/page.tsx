"use client"

import { useEffect, useState } from "react"
import { staffSchedulingService } from "@/lib/services/staff-scheduling"

export default function TestPage() {
  const [data, setData] = useState<any>({})
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    const testDirectly = async () => {
      try {
        console.log('Testing staff scheduling service directly...')
        
        // Test with the restaurant ID we know exists
        const restaurantId = '660e8400-e29b-41d4-a716-446655440005'
        
        // Test restaurant staff loading
        console.log('Loading restaurant staff...')
        const staffMembers = await staffSchedulingService.getRestaurantStaff(restaurantId)
        console.log('Restaurant staff loaded:', staffMembers)
        
        // Test time clock entries
        console.log('Loading time clock entries...')
        const timeClockEntries = await staffSchedulingService.getTimeClockEntries(restaurantId, {
          startDate: '2025-09-01',
          endDate: '2025-09-01'
        })
        console.log('Time clock entries loaded:', timeClockEntries)
        
        // Test shifts
        console.log('Loading shifts...')
        const shifts = await staffSchedulingService.getStaffShifts(restaurantId, {
          startDate: '2025-08-25',
          endDate: '2025-09-08'
        })
        console.log('Shifts loaded:', shifts)
        
        // Calculate stats like the page does
        const totalShifts = shifts.length
        const activeClockIns = timeClockEntries.filter(entry => {
          console.log('Checking entry status:', entry.status, entry)
          return entry.status === 'active'
        }).length
        
        console.log('Stats calculated:', {
          totalShifts,
          activeClockIns,
          staffCount: staffMembers.length,
          timeClockCount: timeClockEntries.length
        })
        
        setData({
          staffMembers,
          timeClockEntries,
          shifts,
          stats: {
            totalShifts,
            activeClockIns,
            staffCount: staffMembers.length,
            timeClockCount: timeClockEntries.length
          }
        })
        
      } catch (error) {
        console.error('Test error:', error)
        setData({ error: error instanceof Error ? error.message : 'Unknown error' })
      } finally {
        setLoading(false)
      }
    }
    
    testDirectly()
  }, [])
  
  if (loading) {
    return <div className="p-8">Loading...</div>
  }
  
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Direct Service Test</h1>
      
      {data.error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          Error: {data.error}
        </div>
      )}
      
      {data.stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-100 p-4 rounded">
            <h3 className="font-semibold">Staff Members</h3>
            <p className="text-2xl font-bold">{data.stats.staffCount}</p>
          </div>
          <div className="bg-green-100 p-4 rounded">
            <h3 className="font-semibold">Active Clock-ins</h3>
            <p className="text-2xl font-bold">{data.stats.activeClockIns}</p>
          </div>
          <div className="bg-purple-100 p-4 rounded">
            <h3 className="font-semibold">This Week's Shifts</h3>
            <p className="text-2xl font-bold">{data.stats.totalShifts}</p>
          </div>
          <div className="bg-orange-100 p-4 rounded">
            <h3 className="font-semibold">Time Clock Entries</h3>
            <p className="text-2xl font-bold">{data.stats.timeClockCount}</p>
          </div>
        </div>
      )}
      
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-2">Staff Members ({data.staffMembers?.length || 0})</h2>
          <div className="bg-gray-50 p-4 rounded">
            {data.staffMembers?.map((staff: any) => (
              <div key={staff.id} className="border-b py-2">
                <strong>{staff.user?.full_name}</strong> - {staff.role}
                <br />
                <small>{staff.user?.email}</small>
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <h2 className="text-lg font-semibold mb-2">Time Clock Entries ({data.timeClockEntries?.length || 0})</h2>
          <div className="bg-gray-50 p-4 rounded">
            {data.timeClockEntries?.map((entry: any) => (
              <div key={entry.id} className="border-b py-2">
                <strong>{entry.staff?.user?.full_name}</strong> - Status: {entry.status}
                <br />
                <small>Clock in: {new Date(entry.clock_in_time).toLocaleString()}</small>
                {entry.clock_out_time && (
                  <>
                    <br />
                    <small>Clock out: {new Date(entry.clock_out_time).toLocaleString()}</small>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <h2 className="text-lg font-semibold mb-2">Shifts ({data.shifts?.length || 0})</h2>
          <div className="bg-gray-50 p-4 rounded max-h-64 overflow-y-auto">
            {data.shifts?.map((shift: any) => (
              <div key={shift.id} className="border-b py-2">
                <strong>{shift.staff?.user?.full_name}</strong> - {shift.shift_date}
                <br />
                <small>{shift.start_time} - {shift.end_time} | Role: {shift.role} | Station: {shift.station}</small>
                <br />
                <span className={`text-xs px-2 py-1 rounded ${
                  shift.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                  shift.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {shift.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

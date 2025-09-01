'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

export default function TestAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [staffData, setStaffData] = useState<any>(null)
  const [shiftsData, setShiftsData] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      console.log('🔐 Session:', session?.user?.id || 'No session')
      
      if (sessionError) {
        console.error('Session error:', sessionError)
        return
      }

      setUser(session?.user || null)

      if (session?.user) {
        await testDataAccess(session.user.id)
      } else {
        console.log('🔑 No authenticated user - testing anonymous access...')
        await testDataAccess()
      }
    } catch (error) {
      console.error('Auth check error:', error)
    } finally {
      setLoading(false)
    }
  }

  const testDataAccess = async (userId?: string) => {
    const restaurantId = '660e8400-e29b-41d4-a716-446655440005'
    
    console.log('🧪 Testing data access for user:', userId || 'anonymous')

    // Test staff access
    const { data: staff, error: staffError } = await supabase
      .from('restaurant_staff')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)

    console.log('👥 Staff access:', staff?.length || 0, 'records')
    if (staffError) console.log('👥 Staff error:', staffError)
    setStaffData({ data: staff, error: staffError })

    // Test shifts access
    const { data: shifts, error: shiftsError } = await supabase
      .from('staff_shifts')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .gte('shift_date', '2025-08-31')
      .lte('shift_date', '2025-09-06')

    console.log('📅 Shifts access:', shifts?.length || 0, 'records')
    if (shiftsError) console.log('📅 Shifts error:', shiftsError)
    setShiftsData({ data: shifts, error: shiftsError })
  }

  const signInAsTestUser = async () => {
    try {
      // Try to sign in with a test user
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'password123'
      })

      if (error) {
        console.error('Sign in error:', error)
        // If test user doesn't exist, let's check what users we have
        console.log('🔍 No test user found. Checking available data...')
      } else {
        console.log('✅ Signed in as:', data.user?.email)
        setUser(data.user)
        await testDataAccess(data.user?.id)
      }
    } catch (error) {
      console.error('Sign in error:', error)
    }
  }

  if (loading) {
    return <div className="p-8">Loading authentication check...</div>
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">🔐 Authentication & Data Access Test</h1>
      
      <div className="space-y-6">
        {/* Auth Status */}
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">Authentication Status</h2>
          {user ? (
            <div>
              <p className="text-green-600">✅ Authenticated as: {user.email}</p>
              <p className="text-sm text-gray-600">User ID: {user.id}</p>
            </div>
          ) : (
            <div>
              <p className="text-orange-600">⚠️  Not authenticated (anonymous access)</p>
              <button 
                onClick={signInAsTestUser}
                className="mt-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Try Test Sign In
              </button>
            </div>
          )}
        </div>

        {/* Staff Data */}
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">👥 Restaurant Staff Access</h2>
          {staffData ? (
            <div>
              <p className="text-sm">Records found: {staffData.data?.length || 0}</p>
              {staffData.error && (
                <p className="text-red-600 text-sm">Error: {staffData.error.message}</p>
              )}
            </div>
          ) : (
            <p className="text-gray-500">Not tested yet</p>
          )}
        </div>

        {/* Shifts Data */}
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">📅 Staff Shifts Access</h2>
          {shiftsData ? (
            <div>
              <p className="text-sm">Records found: {shiftsData.data?.length || 0}</p>
              {shiftsData.error && (
                <p className="text-red-600 text-sm">Error: {shiftsData.error.message}</p>
              )}
            </div>
          ) : (
            <p className="text-gray-500">Not tested yet</p>
          )}
        </div>

        {/* Actions */}
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">🔧 Actions</h2>
          <div className="space-x-2">
            <button 
              onClick={() => testDataAccess(user?.id)}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              Retest Data Access
            </button>
            {user && (
              <button 
                onClick={async () => {
                  await supabase.auth.signOut()
                  setUser(null)
                  setStaffData(null)
                  setShiftsData(null)
                }}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
              >
                Sign Out
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

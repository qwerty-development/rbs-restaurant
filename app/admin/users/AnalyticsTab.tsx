'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Loader2, TrendingUp, Users } from 'lucide-react'

interface PresenceData {
  created_at: string
  online_count: number
}

interface ActivationMetrics {
  completedBookingActivationRate: number
  anyBookingActivationRate: number
  totalNewUsers: number
  usersWithCompletedBooking: number
  usersWithAnyBooking: number
}

export function AnalyticsTab() {
  const [data, setData] = useState<PresenceData[]>([])
  const [activationMetrics, setActivationMetrics] = useState<ActivationMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchHistory()
    fetchActivationMetrics()
  }, [])

  const fetchHistory = async () => {
    try {
      const { data: history, error } = await supabase
        .from('presence_history')
        .select('created_at, online_count')
        .order('created_at', { ascending: true })
        .limit(100) // Limit to last 100 points for now

      if (error) throw error

      if (history) {
        // Format data for chart
        const formatted = history.map(item => ({
          ...item,
          time: new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          fullDate: new Date(item.created_at).toLocaleString()
        }))
        setData(formatted)
      }
    } catch (error) {
      console.error('Error fetching presence history:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchActivationMetrics = async () => {
    try {
      const { data, error } = await supabase.rpc('get_activation_metrics')

      if (error) {
        console.error('Error fetching activation metrics:', error)
        throw error
      }

      if (data) {
        // The RPC returns a JSON object, we need to cast it to our interface
        // Note: The RPC returns keys matching our interface exactly
        setActivationMetrics(data as ActivationMetrics)
      }
    } catch (error) {
      console.error('Error fetching activation metrics:', error)
      // Set default values on error to prevent UI from breaking
      setActivationMetrics({
        completedBookingActivationRate: 0,
        anyBookingActivationRate: 0,
        totalNewUsers: 0,
        usersWithCompletedBooking: 0,
        usersWithAnyBooking: 0
      })
    } finally {
      setMetricsLoading(false)
    }
  }

  if (loading || metricsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Booking Activation Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              30-Day Completed Booking Activation Rate
            </CardTitle>
            <CardDescription>
              Percentage of new users who completed at least 1 booking within their first 30 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-4xl font-bold text-green-600">
                {activationMetrics?.completedBookingActivationRate.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span>Users with completed booking:</span>
                  <span className="font-semibold">{activationMetrics?.usersWithCompletedBooking}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total new users (last 30 days):</span>
                  <span className="font-semibold">{activationMetrics?.totalNewUsers}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              30-Day Any Booking Activation Rate
            </CardTitle>
            <CardDescription>
              Percentage of new users who made at least 1 booking (any status) within their first 30 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-4xl font-bold text-blue-600">
                {activationMetrics?.anyBookingActivationRate.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span>Users with any booking:</span>
                  <span className="font-semibold">{activationMetrics?.usersWithAnyBooking}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total new users (last 30 days):</span>
                  <span className="font-semibold">{activationMetrics?.totalNewUsers}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mobile Users Online History */}
      <Card>
        <CardHeader>
          <CardTitle>Mobile Users Online History</CardTitle>
          <CardDescription>
            Tracking the number of active mobile users over time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] w-full">
            {data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="time" 
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                    labelStyle={{ color: '#64748b' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="online_count"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex justify-center items-center h-full text-gray-400">
                No data recorded yet.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

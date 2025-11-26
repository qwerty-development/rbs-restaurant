'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Loader2, TrendingUp, Users, BarChart3 } from 'lucide-react'
import { format } from 'date-fns'

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

interface DailyActivationRate {
  date: string
  total_users: number
  users_with_any_booking: number
  users_with_completed_booking: number
  any_booking_rate: number
  completed_booking_rate: number
}

export function AnalyticsTab() {
  const [data, setData] = useState<PresenceData[]>([])
  const [activationMetrics, setActivationMetrics] = useState<ActivationMetrics | null>(null)
  const [dailyActivationRates, setDailyActivationRates] = useState<DailyActivationRate[]>([])
  const [loading, setLoading] = useState(true)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [dailyRatesLoading, setDailyRatesLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchHistory()
    fetchActivationMetrics()
    fetchDailyActivationRates()
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

  const fetchDailyActivationRates = async () => {
    try {
      setDailyRatesLoading(true)
      // Start from November 10, 2024 (one month after launch)
      const { data, error } = await supabase.rpc('get_daily_activation_rates', {
        start_date: '2024-11-10'
      })

      if (error) {
        console.error('Error fetching daily activation rates:', error)
        throw error
      }

      if (data) {
        // Format data for chart
        const formatted = data.map((item: DailyActivationRate) => ({
          ...item,
          date: format(new Date(item.date), 'MMM dd'),
          fullDate: format(new Date(item.date), 'MMM dd, yyyy')
        }))
        setDailyActivationRates(formatted)
      }
    } catch (error) {
      console.error('Error fetching daily activation rates:', error)
      setDailyActivationRates([])
    } finally {
      setDailyRatesLoading(false)
    }
  }

  if (loading || metricsLoading || dailyRatesLoading) {
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
              Percentage of users whose FIRST completed booking was within their first 30 days after joining
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
                  <span>Total users evaluated:</span>
                  <span className="font-semibold">{activationMetrics?.totalNewUsers}</span>
                </div>
                <div className="text-xs text-gray-500 mt-2 pt-2 border-t">
                  * Evaluates each user's FIRST booking only. Checks if their first booking was within 30 days of joining. Not about recent activity - looks at historical first booking.
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
              Percentage of users whose FIRST booking (any status) was within their first 30 days after joining
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
                  <span>Total users evaluated:</span>
                  <span className="font-semibold">{activationMetrics?.totalNewUsers}</span>
                </div>
                <div className="text-xs text-gray-500 mt-2 pt-2 border-t">
                  * Evaluates each user's FIRST booking only. Checks if their first booking was within 30 days of joining. Not about recent activity - looks at historical first booking.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily 30-Day Activation Rate Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-600" />
            Daily 30-Day Activation Rate Trend
          </CardTitle>
          <CardDescription>
            Tracking the 30-day activation rate over time since November 10, 2024 (one month after launch). Shows how user activation has evolved day by day.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] w-full">
            {dailyActivationRates.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyActivationRates}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#888888"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}%`}
                    domain={[0, 100]}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                    labelStyle={{ color: '#64748b', fontWeight: 'bold' }}
                    formatter={(value: number, name: string) => {
                      if (name === 'any_booking_rate') return [`${value.toFixed(2)}%`, 'Any Booking Rate']
                      if (name === 'completed_booking_rate') return [`${value.toFixed(2)}%`, 'Completed Booking Rate']
                      return [value, name]
                    }}
                    labelFormatter={(label) => {
                      const item = dailyActivationRates.find(d => d.date === label)
                      return item ? item.fullDate : label
                    }}
                  />
                  <Legend 
                    formatter={(value) => {
                      if (value === 'any_booking_rate') return 'Any Booking Rate'
                      if (value === 'completed_booking_rate') return 'Completed Booking Rate'
                      return value
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="any_booking_rate"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5 }}
                    name="any_booking_rate"
                  />
                  <Line
                    type="monotone"
                    dataKey="completed_booking_rate"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5 }}
                    name="completed_booking_rate"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex justify-center items-center h-full text-gray-400">
                No activation rate data available yet.
              </div>
            )}
          </div>
          {dailyActivationRates.length > 0 && (
            <div className="mt-4 text-sm text-gray-600 space-y-1">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                  <span>Any Booking Rate: {dailyActivationRates[dailyActivationRates.length - 1]?.any_booking_rate.toFixed(2)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span>Completed Booking Rate: {dailyActivationRates[dailyActivationRates.length - 1]?.completed_booking_rate.toFixed(2)}%</span>
                </div>
              </div>
              <div className="text-xs text-gray-500 mt-2">
                Latest data: {dailyActivationRates[dailyActivationRates.length - 1]?.fullDate} | 
                Total users evaluated: {dailyActivationRates[dailyActivationRates.length - 1]?.total_users}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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

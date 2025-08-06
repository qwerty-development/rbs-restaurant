// components/dashboard/checkin-queue.tsx
"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { format, differenceInMinutes } from "date-fns"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { 
  UserCheck, 
  Clock, 
  Users, 
  Table2,
  Phone,
  AlertCircle,
  Timer,
  UserPlus,
  MessageSquare,
  Sparkles,
  Ban,
  Search,
  X,
  Star
} from "lucide-react"
import { toast } from "react-hot-toast"

const TABLE_TYPE_COLORS: Record<string, string> = {
  booth: "bg-blue-900 text-blue-100",
  window: "bg-emerald-900 text-emerald-100",
  patio: "bg-amber-900 text-amber-100",
  standard: "bg-yellow-900 text-yellow-100",
  bar: "bg-purple-900 text-purple-100",
  private: "bg-rose-900 text-rose-100",
}

interface CheckInQueueProps {
  bookings: any[]
  tables: any[]
  currentTime: Date
  restaurantId: string
  onCheckIn: (bookingId: string, tableIds: string[]) => void
  onQuickSeat: (guestData: any, tableIds:string[]) => void
  customersData?: Record<string, any>
  onSelectBooking?: (booking: any) => void
}

export function CheckInQueue({
  bookings,
  tables,
  currentTime,
  restaurantId,
  onCheckIn,
  onQuickSeat,
  customersData = {},
  onSelectBooking
}: CheckInQueueProps) {
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [customerSearch, setCustomerSearch] = useState("")
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [walkInData, setWalkInData] = useState({
    guestName: "",
    guestPhone: "",
    partySize: 2
  })

  const supabase = createClient()

  // Fetch customers for search
  const { data: customers, error: customersError, isLoading: customersLoading } = useQuery({
    queryKey: ["restaurant-customers-walkin", restaurantId, customerSearch],
    queryFn: async () => {
      if (!customerSearch.trim()) return []
      if (!restaurantId) {
        console.error("Restaurant ID is required for customer search")
        throw new Error("Restaurant ID is required")
      }
      
      console.log("Searching for walk-in customers with:", customerSearch, "in restaurant:", restaurantId)
      
      const { data, error } = await supabase
        .from("restaurant_customers")
        .select(`
          *,
          profile:profiles!restaurant_customers_user_id_fkey(
            id,
            full_name,
            phone_number,
            avatar_url
          )
        `)
        .eq("restaurant_id", restaurantId)
        .or(`guest_name.ilike.%${customerSearch}%,guest_email.ilike.%${customerSearch}%,guest_phone.ilike.%${customerSearch}%`)
        .limit(10)
        .order("last_visit", { ascending: false })

      if (error) {
        console.error("Walk-in customer search error:", error)
        throw error
      }
      
      console.log("Walk-in customer search results:", data)
      return data || []
    },
    enabled: customerSearch.length >= 1 && !!restaurantId,
  })

  // Handle customer selection
  const handleCustomerSelect = (customer: any) => {
    setSelectedCustomer(customer)
    setCustomerSearch(customer.profile?.full_name || customer.guest_name || "")
    setShowCustomerDropdown(false)
    
    // Auto-fill walk-in form fields
    setWalkInData({
      guestName: customer.profile?.full_name || customer.guest_name || "",
      guestPhone: customer.profile?.phone_number || customer.guest_phone || "",
      partySize: walkInData.partySize // Keep existing party size
    })
  }

  const handleClearCustomer = () => {
    setSelectedCustomer(null)
    setCustomerSearch("")
    setWalkInData({
      guestName: "",
      guestPhone: "",
      partySize: 2
    })
  }
  
  // Filter arrivals (confirmed bookings within -30 to +60 minutes)
  const arrivalsQueue = bookings
    .filter(booking => {
      const bookingTime = new Date(booking.booking_time)
      const minutesUntil = differenceInMinutes(bookingTime, currentTime)
      return (
        booking.status === 'confirmed' && 
        minutesUntil >= -30 &&
        minutesUntil <= 60
      )
    })
    .sort((a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())

  // Already arrived guests waiting for seating
  const waitingForSeating = bookings.filter(b => b.status === 'arrived')
  
  // Separate into different categories
  const lateArrivals = arrivalsQueue.filter(b => {
    const minutesUntil = differenceInMinutes(new Date(b.booking_time), currentTime)
    return minutesUntil < -15
  })

  const currentArrivals = arrivalsQueue.filter(b => {
    const minutesUntil = differenceInMinutes(new Date(b.booking_time), currentTime)
    return minutesUntil >= -15 && minutesUntil <= 15
  })

  const upcomingArrivals = arrivalsQueue.filter(b => {
    const minutesUntil = differenceInMinutes(new Date(b.booking_time), currentTime)
    return minutesUntil > 15
  })

  // Get available tables
  const getAvailableTables = () => {
    return tables.filter(table => {
      const isOccupied = bookings.some(booking => {
        const occupiedStatuses = ['arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment']
        return occupiedStatuses.includes(booking.status) && 
               booking.tables?.some((t: any) => t.id === table.id)
      })
      return !isOccupied && table.is_active
    })
  }

  const availableTables = getAvailableTables()

  const getBookingStatus = (booking: any) => {
    const bookingTime = new Date(booking.booking_time)
    const minutesUntil = differenceInMinutes(bookingTime, currentTime)
    
    if (minutesUntil < -15) {
      return { 
        label: "Late", 
        subLabel: `${Math.abs(minutesUntil)}m late`,
        color: "text-red-400", 
        bgColor: "bg-gradient-to-br from-red-900/50 to-red-800/30 border-red-700", 
        icon: AlertCircle,
        pulseAnimation: true
      }
    } else if (minutesUntil < 0) {
      return { 
        label: "Now", 
        subLabel: "Ready to check-in",
        color: "text-blue-400", 
        bgColor: "bg-gradient-to-br from-blue-900/50 to-blue-800/30 border-blue-700", 
        icon: UserCheck,
        pulseAnimation: true
      }
    } else if (minutesUntil <= 15) {
      return { 
        label: `${minutesUntil}m`, 
        subLabel: "Arriving soon",
        color: "text-green-400", 
        bgColor: "bg-gradient-to-br from-green-900/50 to-green-800/30 border-green-700", 
        icon: Timer,
        pulseAnimation: false
      }
    } else {
      return { 
        label: `${minutesUntil}m`, 
        subLabel: "Upcoming",
        color: "text-gray-400", 
        bgColor: "bg-gradient-to-br from-gray-800/50 to-gray-700/30 border-gray-600", 
        icon: Clock,
        pulseAnimation: false
      }
    }
  }

  const handleQuickCheckIn = (booking: any) => {
    const hasTable = booking.tables && booking.tables.length > 0
    if (hasTable) {
      onCheckIn(booking.id, booking.tables.map((t: any) => t.id))
      toast.success(`Checked in ${booking.user?.full_name || booking.guest_name}`)
    } else {
      if (selectedTableIds.length === 0) {
        toast.error("Please select a table first")
        return
      }
      onCheckIn(booking.id, selectedTableIds)
      setSelectedTableIds([])
    }
  }

  const handleWalkIn = async () => {
    if (selectedTableIds.length === 0) {
      toast.error("Please select at least one table")
      return
    }

    const walkInBooking = {
      customer_id: selectedCustomer?.id || null,
      user_id: selectedCustomer?.user_id || null,
      guest_name: selectedCustomer 
        ? (selectedCustomer.profile?.full_name || selectedCustomer.guest_name)
        : (walkInData.guestName || `Walk-in ${format(currentTime, 'HH:mm')}`),
      guest_phone: selectedCustomer 
        ? (selectedCustomer.profile?.phone_number || selectedCustomer.guest_phone)
        : walkInData.guestPhone,
      guest_email: selectedCustomer?.guest_email || null,
      party_size: walkInData.partySize,
      table_ids: selectedTableIds,
      booking_time: currentTime.toISOString(),
      turn_time_minutes: 120,
      status: 'arrived'
    }

    onQuickSeat(walkInBooking, selectedTableIds)
    toast.success(`Walk-in guest ${walkInBooking.guest_name} seated`)
    
    // Reset form
    setWalkInData({ guestName: "", guestPhone: "", partySize: 2 })
    setSelectedTableIds([])
    setSelectedCustomer(null)
    setCustomerSearch("")
  }

  const renderBookingCard = (booking: any) => {
    const status = getBookingStatus(booking)
    const StatusIcon = status.icon
    const hasTable = booking.tables && booking.tables.length > 0
    const customerData = booking.user?.id ? customersData[booking.user.id] : null

    return (
      <div
        key={booking.id}
        className={cn(
          "p-4 rounded-xl border-2 cursor-pointer transition-all shadow-md",
          status.bgColor,
          "hover:shadow-xl hover:scale-[1.02]",
          status.pulseAnimation && "animate-pulse"
        )}
        onClick={() => onSelectBooking?.(booking)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {/* Status badge */}
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("p-1.5 rounded-lg bg-black/20", status.pulseAnimation && "animate-bounce")}>
                <StatusIcon className={cn("h-4 w-4", status.color)} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400">{status.subLabel}</p>
                <p className={cn("text-sm font-bold", status.color)}>{status.label}</p>
              </div>
            </div>

            {/* Guest info */}
            <div className="mb-2">
              <p className="font-semibold text-lg text-gray-100">
                {booking.user?.full_name || booking.guest_name || 'Guest'}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {customerData?.vip_status && (
                  <Badge className="text-xs px-2 py-0.5 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white border-yellow-700">
                    <Sparkles className="h-3 w-3 mr-1" />
                    VIP
                  </Badge>
                )}
                {customerData?.blacklisted && (
                  <Badge variant="destructive" className="text-xs px-2 py-0.5 animate-pulse">
                    <Ban className="h-3 w-3 mr-1" />
                    Alert
                  </Badge>
                )}
              </div>
            </div>

            {/* Booking details */}
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-gray-500" />
                <span className="font-medium text-gray-300">{format(new Date(booking.booking_time), 'h:mm a')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-gray-500" />
                <span className="font-medium text-gray-300">{booking.party_size} guests</span>
              </div>
              {hasTable ? (
                <div className="flex items-center gap-1.5">
                  <Table2 className="h-4 w-4 text-green-500" />
                  <span className="font-medium text-green-400">T{booking.tables.map((t: any) => t.table_number).join(", ")}</span>
                </div>
              ) : (
                <Badge variant="destructive" className="text-xs justify-center">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  No table
                </Badge>
              )}
            </div>

            {/* Special requests or alerts */}
            {(booking.special_requests || customerData?.blacklisted) && (
              <div className="mt-3 space-y-2">
                {booking.special_requests && (
                  <div className="p-2 bg-black/20 rounded-lg">
                    <p className="text-xs text-gray-300 flex items-start gap-1.5">
                      <MessageSquare className="h-3 w-3 mt-0.5 flex-shrink-0 text-gray-500" />
                      {booking.special_requests}
                    </p>
                  </div>
                )}
                {customerData?.blacklisted && customerData?.blacklist_reason && (
                  <div className="p-2 bg-red-900/50 rounded-lg border border-red-700">
                    <p className="text-xs text-red-400 flex items-start gap-1.5 font-medium">
                      <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      {customerData.blacklist_reason}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Check-in button */}
          <Button
            size="sm"
            variant={hasTable ? "default" : "outline"}
            onClick={(e) => {
              e.stopPropagation()
              handleQuickCheckIn(booking)
            }}
            className={cn(
              "ml-3 shadow-lg",
              hasTable 
                ? "bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white" 
                : "border-2 border-red-500 text-red-400 hover:bg-red-900/50"
            )}
          >
            <UserCheck className="h-4 w-4 mr-1.5" />
            {hasTable ? 'Check-in' : 'Assign Table'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[600px] h-full flex flex-col bg-gray-900 text-gray-200">
      <Tabs defaultValue="arrivals" className="flex-1 flex flex-col">
        <div className="px-4 pt-4">
          <h3 className="text-lg font-semibold text-gray-100 mb-3">Check-in Management</h3>
          <TabsList className="grid w-full grid-cols-2 bg-gray-800">
            <TabsTrigger value="arrivals" className="relative data-[state=active]:bg-gray-950 data-[state=active]:text-white data-[state=active]:shadow-sm text-gray-400">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                <span>Arrivals</span>
                {arrivalsQueue.length > 0 && (
                  <Badge 
                    variant="secondary" 
                    className={cn(
                      "ml-1 h-5 px-1.5 text-xs",
                      lateArrivals.length > 0 ? "bg-red-800 text-red-100" : "bg-blue-800 text-blue-100"
                    )}
                  >
                    {arrivalsQueue.length}
                  </Badge>
                )}
              </div>
            </TabsTrigger>
            <TabsTrigger value="walkin" className="data-[state=active]:bg-gray-950 data-[state=active]:text-white data-[state=active]:shadow-sm text-gray-400">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                <span>Walk-in</span>
              </div>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="arrivals" className="flex-1 px-4 pb-4 mt-4">
          <ScrollArea className="h-[500px]">
            <div className="space-y-4 pr-4">
              {/* Waiting for seating - TOP PRIORITY */}
              {waitingForSeating.length > 0 && (
                <div className="bg-gradient-to-r from-orange-900/30 to-red-900/30 border border-orange-600 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-orange-600 rounded-lg animate-pulse">
                      <UserCheck className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-orange-400">WAITING FOR SEATING</h4>
                      <p className="text-xs text-orange-300">Guests have arrived and need to be seated immediately</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {waitingForSeating.map(booking => (
                      <div key={booking.id} className="bg-orange-800/30 rounded-lg p-3 border border-orange-600">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-white text-lg">
                              {booking.user?.full_name || booking.guest_name}
                            </p>
                            <div className="flex items-center gap-3 text-sm text-orange-200">
                              <span className="flex items-center gap-1">
                                <Users className="h-4 w-4" />
                                {booking.party_size} guests
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {format(new Date(booking.booking_time), 'h:mm a')}
                              </span>
                              {(booking.user?.phone_number || booking.guest_phone) && (
                                <span className="flex items-center gap-1 font-mono">
                                  <Phone className="h-4 w-4" />
                                  {booking.user?.phone_number || booking.guest_phone}
                                </span>
                              )}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            className="bg-orange-600 hover:bg-orange-700 text-white font-medium animate-bounce"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleQuickCheckIn(booking)
                            }}
                          >
                            <UserCheck className="h-4 w-4 mr-1" />
                            Seat Now
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Late arrivals */}
              {lateArrivals.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1 bg-red-800/50 rounded">
                      <AlertCircle className="h-4 w-4 text-red-400" />
                    </div>
                    <h4 className="text-sm font-semibold text-red-400">Late Arrivals ({lateArrivals.length})</h4>
                  </div>
                  <div className="space-y-3">
                    {lateArrivals.map(renderBookingCard)}
                  </div>
                </div>
              )}

              {/* Current window */}
              {currentArrivals.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1 bg-blue-800/50 rounded">
                      <UserCheck className="h-4 w-4 text-blue-400" />
                    </div>
                    <h4 className="text-sm font-semibold text-blue-400">Check-in Now ({currentArrivals.length})</h4>
                  </div>
                  <div className="space-y-3">
                    {currentArrivals.map(renderBookingCard)}
                  </div>
                </div>
              )}

              {/* Upcoming */}
              {upcomingArrivals.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1 bg-gray-700/50 rounded">
                      <Clock className="h-4 w-4 text-gray-400" />
                    </div>
                    <h4 className="text-sm font-semibold text-gray-400">Arriving Soon ({upcomingArrivals.length})</h4>
                  </div>
                  <div className="space-y-3">
                    {upcomingArrivals.map(renderBookingCard)}
                  </div>
                </div>
              )}

              {arrivalsQueue.length === 0 && (
                <div className="text-center py-16">
                  <div className="p-4 bg-gray-800 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                    <UserCheck className="h-10 w-10 text-gray-500" />
                  </div>
                  <p className="text-sm text-gray-400 font-medium">No arrivals in the next hour</p>
                  <p className="text-xs text-gray-500 mt-1">Check back later for upcoming reservations</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="walkin" className="flex-1 px-4 pb-4 mt-4">
          <div className="space-y-4">
            {/* Available tables summary */}
            <div className="p-3 bg-gradient-to-r from-blue-900/50 to-indigo-900/50 rounded-lg border border-blue-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Table2 className="h-5 w-5 text-blue-400" />
                  <span className="font-medium text-blue-200">{availableTables.length} tables available</span>
                </div>
                <span className="text-sm text-blue-300">
                  Total capacity: {availableTables.reduce((sum, t) => sum + t.max_capacity, 0)} guests
                </span>
              </div>
            </div>

            {/* Walk-in form */}
            <div className="space-y-4 bg-gray-800/50 p-4 rounded-lg border border-gray-700 shadow-sm">
              {/* Customer Search */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-gray-300">Search Existing Customer (Optional)</Label>
                {!restaurantId && (
                  <div className="p-3 bg-red-900/50 rounded-lg border border-red-700">
                    <p className="text-sm text-red-400">Customer search unavailable - Restaurant ID missing</p>
                  </div>
                )}
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                    <Input
                      placeholder={restaurantId ? "Search customers by name, email, or phone..." : "Restaurant ID required for search"}
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value)
                        setShowCustomerDropdown(true)
                      }}
                      onFocus={() => setShowCustomerDropdown(customerSearch.length >= 1)}
                      onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 150)}
                      disabled={!restaurantId}
                      className="h-10 pl-10 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {selectedCustomer && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 text-gray-400 hover:text-white"
                        onClick={handleClearCustomer}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  
                  {/* Customer dropdown */}
                  {showCustomerDropdown && customerSearch.length >= 1 && (
                    <div className="absolute z-50 w-full mt-1 bg-gray-900 border border-gray-700 rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {customersLoading && (
                        <div className="p-3">
                          <p className="text-sm text-gray-400">Searching customers...</p>
                        </div>
                      )}
                      
                      {customersError && (
                        <div className="p-3">
                          <p className="text-sm text-red-400">Error: {customersError.message}</p>
                        </div>
                      )}
                      
                      {!customersLoading && !customersError && customers && customers.length > 0 && (
                        <>
                          {customers.map((customer) => (
                            <div
                              key={customer.id}
                              className="flex items-center gap-3 p-3 hover:bg-gray-800 cursor-pointer border-b border-gray-700 last:border-b-0"
                              onClick={() => handleCustomerSelect(customer)}
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-white">
                                    {customer.profile?.full_name || customer.guest_name || 'Guest'}
                                  </p>
                                  {customer.vip_status && (
                                    <Badge className="text-xs px-2 py-0.5 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white">
                                      <Star className="h-3 w-3 mr-1" />
                                      VIP
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-sm text-gray-400">
                                  {customer.guest_email && <span>{customer.guest_email}</span>}
                                  {customer.guest_email && (customer.profile?.phone_number || customer.guest_phone) && <span> • </span>}
                                  {(customer.profile?.phone_number || customer.guest_phone) && (
                                    <span>{customer.profile?.phone_number || customer.guest_phone}</span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {customer.total_bookings} bookings
                                  {customer.last_visit && (
                                    <span> • Last: {format(new Date(customer.last_visit), 'MMM d')}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                      
                      {!customersLoading && !customersError && customers && customers.length === 0 && (
                        <div className="p-3">
                          <p className="text-sm text-gray-400">No customers found matching "{customerSearch}"</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Selected customer display */}
                {selectedCustomer && (
                  <div className="p-3 bg-blue-900/30 rounded-lg border border-blue-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-blue-400" />
                        <span className="text-sm font-medium text-blue-300">Selected:</span>
                        <span className="text-white font-medium">{selectedCustomer.profile?.full_name || selectedCustomer.guest_name}</span>
                        {selectedCustomer.vip_status && (
                          <Badge className="text-xs px-2 py-0.5 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white">
                            <Star className="h-3 w-3 mr-1" />
                            VIP
                          </Badge>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleClearCustomer}
                        className="text-gray-400 hover:text-white"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="guest-name" className="text-sm font-medium text-gray-300">
                    Guest Name {selectedCustomer && <span className="text-blue-400">(Auto-filled)</span>}
                  </Label>
                  <Input
                    id="guest-name"
                    value={walkInData.guestName}
                    onChange={(e) => setWalkInData(prev => ({ ...prev, guestName: e.target.value }))}
                    placeholder={selectedCustomer ? "Auto-filled from selected customer" : "Optional"}
                    disabled={!!selectedCustomer}
                    className="h-10 mt-1 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <Label htmlFor="party-size" className="text-sm font-medium text-gray-300">Party Size</Label>
                  <Input
                    id="party-size"
                    type="number"
                    min="1"
                    max="20"
                    value={walkInData.partySize}
                    onChange={(e) => setWalkInData(prev => ({ ...prev, partySize: parseInt(e.target.value) || 1 }))}
                    className="h-10 mt-1 bg-gray-900 border-gray-700 text-white"
                  />
                </div>
              </div>

            

              {/* Table selection */}
              <div>
                <Label className="text-sm font-medium text-gray-300 mb-3 block">Select Table(s)</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {availableTables.map(table => {
                    const isSelected = selectedTableIds.includes(table.id)
                    const fitsParty = table.max_capacity >= walkInData.partySize
                    const tableTypeColor = TABLE_TYPE_COLORS[table.table_type] || "bg-gray-700 text-gray-200"

                    return (
                      <Button
                        key={table.id}
                        size="sm"
                        variant={isSelected ? "default" : "outline"}
                        className={cn(
                          "h-auto py-3 px-3 transition-all border",
                          isSelected 
                            ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg scale-105 border-blue-400" 
                            : cn(
                                "bg-gray-800 border-gray-700 hover:border-blue-500 text-gray-300",
                                "hover:scale-105",
                                fitsParty ? "hover:bg-gray-700" : "opacity-50 cursor-not-allowed"
                              )
                        )}
                        disabled={!fitsParty}
                        onClick={() => {
                          if (!fitsParty) return
                          setSelectedTableIds(prev => 
                            prev.includes(table.id)
                              ? prev.filter(id => id !== table.id)
                              : [...prev, table.id]
                          )
                        }}
                      >
                        <div className="text-center">
                          <div className={cn("w-8 h-8 rounded-lg mb-2 mx-auto flex items-center justify-center", tableTypeColor)}>
                            <Table2 className="h-4 w-4" />
                          </div>
                          <p className="font-semibold">T{table.table_number}</p>
                          <p className="text-xs opacity-80">{table.min_capacity}-{table.max_capacity} seats</p>
                        </div>
                      </Button>
                    )
                  })}
                </div>
              </div>

              {/* Seat button */}
              <Button
                className={cn(
                  "w-full h-12 text-base font-medium shadow-lg transition-all",
                  selectedTableIds.length > 0
                    ? "bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white"
                    : "bg-gray-700 text-gray-500 cursor-not-allowed"
                )}
                onClick={handleWalkIn}
                disabled={selectedTableIds.length === 0}
              >
                <UserPlus className="h-5 w-5 mr-2" />
                {selectedTableIds.length > 0 
                  ? `Seat Walk-in Guest at Table${selectedTableIds.length > 1 ? 's' : ''} ${selectedTableIds.map(id => {
                      const table = availableTables.find(t => t.id === id)
                      return table ? table.table_number : ''
                    }).join(', ')}`
                  : 'Select a Table to Continue'
                }
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

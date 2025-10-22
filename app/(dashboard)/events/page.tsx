"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useRestaurantContext } from "@/lib/contexts/restaurant-context"
import { useRestaurantEvents } from "@/lib/hooks/use-events"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Plus,
  Search,
  Calendar,
  Users,
  Clock,
  PartyPopper,
  Filter,
  X,
} from "lucide-react"
import { EventCard } from "@/components/events/event-card"
import { cn } from "@/lib/utils"
import type { EventFilters } from "@/types/events"
import { EVENT_TYPES } from "@/types/events"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function EventsPage() {
  const router = useRouter()
  const { currentRestaurant, tier, isLoading: contextLoading } = useRestaurantContext()
  const [restaurantId, setRestaurantId] = useState<string>("")
  const [filters, setFilters] = useState<EventFilters>({})
  const [searchQuery, setSearchQuery] = useState("")
  const [showFilters, setShowFilters] = useState(false)

  // Set restaurant ID from context
  useEffect(() => {
    if (currentRestaurant) {
      setRestaurantId(currentRestaurant.restaurant.id)
    } else {
      setRestaurantId("")
    }
  }, [currentRestaurant])

  // Fetch events
  const { data: events, isLoading } = useRestaurantEvents(restaurantId, {
    ...filters,
    search: searchQuery
  })

  // Calculate statistics
  const stats = {
    total: events?.length || 0,
    active: events?.filter(e => e.is_active)?.length || 0,
    upcomingOccurrences: events?.reduce((acc, e) => acc + (e.occurrences?.length || 0), 0) || 0,
    totalBookings: 0, // Would need to query bookings
  }

  const handleCreateEvent = () => {
    router.push('/events/new')
  }

  const handleEventClick = (eventId: string) => {
    router.push(`/events/${eventId}`)
  }

  const handleFilterChange = (key: keyof EventFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const clearFilters = () => {
    setFilters({})
    setSearchQuery("")
  }

  const hasActiveFilters = Object.keys(filters).length > 0 || searchQuery

  // Loading state
  if (contextLoading || !restaurantId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-border mx-auto mb-4" />
          <p className="text-lg font-medium">Loading events...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 tablet:space-y-8 animate-in fade-in-0 duration-500">
      {/* Header */}
      <div className="flex flex-col tablet:flex-row items-start tablet:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <PartyPopper className="h-8 w-8 text-primary" />
            Events
          </h1>
          <p className="text-muted-foreground mt-1">
            Create and manage restaurant events
          </p>
        </div>
        <Button
          onClick={handleCreateEvent}
          className="min-h-touch-lg px-6"
          size="lg"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Event
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <PartyPopper className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.active} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Dates</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.upcomingOccurrences}</div>
            <p className="text-xs text-muted-foreground">
              Scheduled occurrences
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Event Bookings</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalBookings}</div>
            <p className="text-xs text-muted-foreground">
              Confirmed attendees
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Event</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {events?.[0]?.occurrences?.[0] ? (
                new Date(events[0].occurrences[0].occurrence_date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                })
              ) : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {events?.[0]?.title || 'No upcoming events'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col tablet:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 min-h-touch-lg"
                />
              </div>
              <Button
                variant={showFilters ? "default" : "outline"}
                onClick={() => setShowFilters(!showFilters)}
                className="min-h-touch-lg"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
                {hasActiveFilters && (
                  <span className="ml-2 bg-primary-foreground text-primary rounded-full px-2 py-0.5 text-xs">
                    Active
                  </span>
                )}
              </Button>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  onClick={clearFilters}
                  className="min-h-touch-lg"
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              )}
            </div>

            {/* Filter Options */}
            {showFilters && (
              <div className="grid gap-4 md:grid-cols-3 pt-4 border-t">
                <div>
                  <label className="text-sm font-medium mb-2 block">Event Type</label>
                  <Select
                    value={filters.event_type || "all"}
                    onValueChange={(value) =>
                      handleFilterChange('event_type', value === "all" ? undefined : value)
                    }
                  >
                    <SelectTrigger className="min-h-touch-lg">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      {EVENT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Status</label>
                  <Select
                    value={filters.status || "all"}
                    onValueChange={(value) =>
                      handleFilterChange('status', value === "all" ? undefined : value)
                    }
                  >
                    <SelectTrigger className="min-h-touch-lg">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="full">Full</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Events List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-border" />
        </div>
      ) : events && events.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onClick={() => handleEventClick(event.id)}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <PartyPopper className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No events yet</h3>
            <p className="text-muted-foreground text-center mb-6">
              {hasActiveFilters
                ? "No events match your filters. Try adjusting your search criteria."
                : "Create your first event to start attracting more customers."}
            </p>
            {!hasActiveFilters && (
              <Button onClick={handleCreateEvent}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Event
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

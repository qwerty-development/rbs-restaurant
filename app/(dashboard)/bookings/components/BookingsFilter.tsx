"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Search,
  Calendar as CalendarIcon,
  Filter,
  X,
  Clock,
  Users,
  AlertCircle
} from "lucide-react"
import { format, addDays } from "date-fns"
import { cn } from "@/lib/utils"
import { ViewMode, StatusFilter, TimeFilter, DateRange } from "../hooks/useBookingsState"

interface BookingsFilterProps {
  // Current state
  viewMode: ViewMode
  searchQuery: string
  statusFilter: StatusFilter
  timeFilter: TimeFilter
  dateRange: DateRange
  selectedDate: Date

  // Stats for filter counts
  bookingStats: {
    all: number
    upcoming: number
    pending: number
    confirmed: number
    completed: number
    cancelled: number
    no_show: number
  }

  // Actions
  onSearchChange: (query: string) => void
  onStatusFilterChange: (filter: StatusFilter) => void
  onTimeFilterChange: (filter: TimeFilter) => void
  onDateRangeChange: (range: DateRange) => void
  onDatePickerOpen: () => void
  onResetFilters: () => void

  className?: string
}

export function BookingsFilter({
  viewMode,
  searchQuery,
  statusFilter,
  timeFilter,
  dateRange,
  selectedDate,
  bookingStats,
  onSearchChange,
  onStatusFilterChange,
  onTimeFilterChange,
  onDateRangeChange,
  onDatePickerOpen,
  onResetFilters,
  className
}: BookingsFilterProps) {
  const now = new Date()

  // Get filters relevant to current view
  const getRelevantFilters = () => {
    switch (viewMode) {
      case "today":
        return ["search", "time", "status"] // Simplified for today view
      case "management":
        return ["search", "status", "time", "date"] // Full filters for management
      case "tables":
        return ["search", "date"] // Minimal for tables view
      default:
        return ["search"]
    }
  }

  const relevantFilters = getRelevantFilters()
  const hasFilters = searchQuery || statusFilter !== "upcoming" || timeFilter !== "all" || dateRange !== "today"

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search - always visible */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={getSearchPlaceholder(viewMode)}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-12 h-12 text-base"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSearchChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Quick Filter Pills - Context aware */}
      {viewMode === "today" && (
        <div className="flex flex-wrap gap-2">
          <FilterPill
            active={statusFilter === "pending"}
            onClick={() => onStatusFilterChange("pending")}
            icon={AlertCircle}
            label={`Pending (${bookingStats.pending})`}
            variant="warning"
          />
          <FilterPill
            active={statusFilter === "confirmed"}
            onClick={() => onStatusFilterChange("confirmed")}
            icon={Users}
            label={`Confirmed (${bookingStats.confirmed})`}
          />
          <FilterPill
            active={timeFilter === "lunch"}
            onClick={() => onTimeFilterChange(timeFilter === "lunch" ? "all" : "lunch")}
            icon={Clock}
            label="Lunch (11-3)"
          />
          <FilterPill
            active={timeFilter === "dinner"}
            onClick={() => onTimeFilterChange(timeFilter === "dinner" ? "all" : "dinner")}
            icon={Clock}
            label="Dinner (5-11)"
          />
        </div>
      )}

      {/* Advanced Filters for Management View */}
      {viewMode === "management" && (
        <div className="flex flex-col tablet:flex-row gap-4">
          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="w-full tablet:w-[200px] h-12 text-base">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="py-3">
                All Bookings ({bookingStats.all})
              </SelectItem>
              <SelectItem value="upcoming" className="py-3">
                Upcoming ({bookingStats.upcoming})
              </SelectItem>
              <SelectItem value="pending" className="py-3">
                Pending ({bookingStats.pending})
              </SelectItem>
              <SelectItem value="confirmed" className="py-3">
                Confirmed ({bookingStats.confirmed})
              </SelectItem>
              <SelectItem value="completed" className="py-3">
                Completed ({bookingStats.completed})
              </SelectItem>
              <SelectItem value="cancelled_by_user" className="py-3">
                Cancelled ({bookingStats.cancelled})
              </SelectItem>
              <SelectItem value="no_show" className="py-3">
                No Shows ({bookingStats.no_show})
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Time Filter */}
          <Select value={timeFilter} onValueChange={onTimeFilterChange}>
            <SelectTrigger className="w-full tablet:w-[160px] h-12 text-base">
              <SelectValue placeholder="Time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="py-3">All Times</SelectItem>
              <SelectItem value="lunch" className="py-3">Lunch (11-3)</SelectItem>
              <SelectItem value="dinner" className="py-3">Dinner (5-11)</SelectItem>
            </SelectContent>
          </Select>

          {/* Date Range Filter */}
          <Select value={dateRange} onValueChange={onDateRangeChange}>
            <SelectTrigger className="w-full tablet:w-[180px] h-12 text-base">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today" className="py-3">
                Today ({format(now, "MMM d")})
              </SelectItem>
              <SelectItem value="tomorrow" className="py-3">
                Tomorrow ({format(addDays(now, 1), "MMM d")})
              </SelectItem>
              <SelectItem value="week" className="py-3">This Week</SelectItem>
              <SelectItem value="all" className="py-3">All Dates</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Date Filters for Tables View */}
      {viewMode === "tables" && (
        <div className="flex flex-wrap gap-3">
          <Button
            variant={dateRange === "today" ? "default" : "outline"}
            size="default"
            onClick={() => onDateRangeChange("today")}
            className="min-h-touch-lg font-medium"
          >
            Today ({format(now, "MMM d")})
          </Button>
          <Button
            variant={dateRange === "tomorrow" ? "default" : "outline"}
            size="default"
            onClick={() => onDateRangeChange("tomorrow")}
            className="min-h-touch-lg font-medium"
          >
            Tomorrow ({format(addDays(now, 1), "MMM d")})
          </Button>
          <Button
            variant={dateRange === "all" ? "default" : "outline"}
            size="default"
            onClick={() => onDateRangeChange("all")}
            className="min-h-touch-lg font-medium"
          >
            All Dates
          </Button>
          <Button
            variant="outline"
            size="default"
            onClick={onDatePickerOpen}
            className="min-h-touch-lg font-medium"
          >
            <CalendarIcon className="h-4 w-4 mr-2" />
            Pick a date
          </Button>
        </div>
      )}

      {/* Active Filters Display & Clear */}
      {hasFilters && (
        <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2 flex-1">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Active filters:</span>
            <div className="flex flex-wrap gap-2">
              {searchQuery && (
                <Badge variant="secondary" className="text-xs">
                  Search: "{searchQuery}"
                </Badge>
              )}
              {statusFilter !== "upcoming" && (
                <Badge variant="secondary" className="text-xs">
                  Status: {statusFilter.replace("_", " ")}
                </Badge>
              )}
              {timeFilter !== "all" && (
                <Badge variant="secondary" className="text-xs">
                  Time: {timeFilter}
                </Badge>
              )}
              {dateRange !== "today" && (
                <Badge variant="secondary" className="text-xs">
                  Date: {dateRange === "custom" ? format(selectedDate, "MMM d") : dateRange}
                </Badge>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetFilters}
            className="min-h-touch text-xs"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </div>
      )}
    </div>
  )
}

// Helper component for filter pills
interface FilterPillProps {
  active: boolean
  onClick: () => void
  icon: any
  label: string
  variant?: "default" | "warning" | "success"
}

function FilterPill({ active, onClick, icon: Icon, label, variant = "default" }: FilterPillProps) {
  const getVariantStyles = () => {
    if (active) {
      switch (variant) {
        case "warning":
          return "bg-yellow-100 text-yellow-800 border-yellow-300"
        case "success":
          return "bg-green-100 text-green-800 border-green-300"
        default:
          return "bg-primary text-primary-foreground border-primary"
      }
    }
    return "bg-muted hover:bg-muted/80 text-muted-foreground border-border"
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors min-h-touch",
        getVariantStyles()
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}

// Helper function for search placeholder text
function getSearchPlaceholder(viewMode: ViewMode): string {
  switch (viewMode) {
    case "today":
      return "Search today's bookings..."
    case "management":
      return "Search by name, code, phone, email, or table..."
    case "tables":
      return "Search table assignments..."
    default:
      return "Search bookings..."
  }
}
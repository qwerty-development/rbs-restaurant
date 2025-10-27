// app/(basic)/basic-dashboard/page.tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRestaurantContext } from "@/lib/contexts/restaurant-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  format,
  startOfDay,
  endOfDay,
  parseISO,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { toast } from "react-hot-toast";
import { useRealtimeHealth } from "@/hooks/use-realtime-health";
import { useConnectionRecovery } from "@/hooks/use-connection-recovery";
import { useAdaptiveBookingConfig } from "@/hooks/use-adaptive-refetch";
import { useBackgroundSync } from "@/hooks/use-background-sync";
import { ConnectionStatusIndicator } from "@/components/dashboard/connection-status-indicator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { getFirstName } from "@/lib/utils";
import { useNotifications } from "@/lib/contexts/notification-context";
import { PushNotificationPermission } from "@/components/notifications/push-notification-permission";
import { BookingActionDialog } from "@/components/bookings/booking-action-dialog";
import { WaitlistManager } from "@/components/basic/waitlist-manager";
import { ManualBookingDialog } from "@/components/basic/manual-booking-dialog";
import { CollapsedBookingView } from "@/components/bookings/collapsed-booking-view";
import {
  Calendar as CalendarIcon,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Users,
  Phone,
  Mail,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Bell,
  Star,
  MoreHorizontal,
  Gift,
  PartyPopper,
  Plus,
  Check,
  X,
  Loader2,
} from "lucide-react";

export default function BasicDashboardPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedDates, setSelectedDates] = useState<Date[]>([new Date()]);
  const [dateViewMode, setDateViewMode] = useState<
    "today" | "select" | "week" | "month" | "all"
  >("today");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [bookingTypeFilter, setBookingTypeFilter] = useState<string>("all"); // New: Filter for event bookings
  const [userId, setUserId] = useState<string>("");
  const [actionDialog, setActionDialog] = useState<{
    isOpen: boolean;
    action: "decline" | "cancel";
    bookingId: string | null;
    booking: any | null;
  }>({
    isOpen: false,
    action: "decline",
    bookingId: null,
    booking: null,
  });

  const [activeTab, setActiveTab] = useState<"bookings" | "waitlist">(
    "bookings"
  );

  const [viewMode, setViewMode] = useState<"card" | "collapsed">("card");
  const [tableInputs, setTableInputs] = useState<Record<string, string>>({});
  const [isUpdatingTable, setIsUpdatingTable] = useState<Record<string, boolean>>({});
  const [editingTable, setEditingTable] = useState<Record<string, boolean>>({});
  const [manualBookingDialogOpen, setManualBookingDialogOpen] = useState(false);

  const supabase = createClient();
  const queryClient = useQueryClient();
  const { currentRestaurant, isLoading: contextLoading } =
    useRestaurantContext();
  const restaurantId = currentRestaurant?.restaurant.id;

  // Initialize connection health monitoring
  const { healthStatus, registerChannel, unregisterChannel, forceReconnect } =
    useRealtimeHealth();

  // Setup connection recovery
  useConnectionRecovery({
    onForceReconnect: forceReconnect,
    enableVisibilityRecovery: true,
    enableFocusRecovery: true,
    enableOnlineRecovery: true,
  });

  // Get adaptive query configuration based on connection health
  const adaptiveConfig = useAdaptiveBookingConfig(healthStatus);

  // Setup background sync for when real-time fails
  const { forceSyncNow, isAggressivePolling, unhealthyDurationMinutes } =
    useBackgroundSync({
      restaurantId: restaurantId || "",
      healthStatus,
      onForceReconnect: forceReconnect,
      enableServiceWorkerSync: true,
      aggressivePollingThreshold: 2, // Start aggressive polling after 2 minutes
    });

  // Debug logging for date changes
  useEffect(() => {
    console.log("📅 Date mode changed:", {
      dateViewMode,
      selectedDate: format(selectedDate, "yyyy-MM-dd"),
      selectedDates: selectedDates.map((d) => format(d, "yyyy-MM-dd")),
    });
  }, [dateViewMode, selectedDate, selectedDates]);

  // Get date range based on view mode
  const getEffectiveDates = () => {
    switch (dateViewMode) {
      case "today":
        return [new Date()];
      case "select":
        return selectedDates;
      case "week": {
        const today = new Date();
        const startOfWeek = startOfDay(today);
        startOfWeek.setDate(today.getDate() - today.getDay()); // Start from Sunday
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6); // End on Saturday

        const weekDates = [];
        for (
          let date = new Date(startOfWeek);
          date <= endOfWeek;
          date.setDate(date.getDate() + 1)
        ) {
          weekDates.push(new Date(date));
        }
        return weekDates;
      }
      case "month": {
        const today = new Date();
        const monthStart = startOfMonth(today);
        const monthEnd = endOfMonth(today);

        const monthDates = [];
        for (
          let date = new Date(monthStart);
          date <= monthEnd;
          date.setDate(date.getDate() + 1)
        ) {
          monthDates.push(new Date(date));
        }
        return monthDates;
      }
      case "all":
        return null; // null means all dates from today onward
      default:
        return [new Date()];
    }
  };

  const notificationContext = useNotifications();
  const { addNotification, requestPushPermission, isPushEnabled } =
    notificationContext || {};

  // Resolve guest first name: prefer explicit guest_name, else lookup profile by user_id
  const resolveGuestFirstName = async (booking: any): Promise<string> => {
    const explicit = booking?.guest_name?.trim();
    if (explicit) return getFirstName(explicit);
    const userId = booking?.user_id;
    if (userId) {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", userId)
          .single();
        if (!error && data?.full_name) {
          return getFirstName(data.full_name);
        }
      } catch {}
    }
    return "Guest";
  };

  // Debug logging

  // Get user info
  useEffect(() => {
    async function getUserInfo() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    }
    getUserInfo();
  }, [supabase]);

  // Fetch bookings - combines date-specific bookings with ALL pending requests
  const {
    data: bookings = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["basic-bookings", restaurantId, dateViewMode, selectedDates],
    queryFn: async () => {
      if (!restaurantId) return [];

      // Get effective dates based on current mode
      const effectiveDates = getEffectiveDates();

      console.log("🔍 Fetching bookings for:", {
        restaurantId,
        effectiveDates,
        mode: dateViewMode,
      });

      // Always get ALL pending bookings first (regardless of dates)
      const { data: pendingBookings, error: pendingError } = await supabase
        .from("bookings")
        .select(
          `
          id,
          booking_time,
          party_size,
          status,
          special_requests,
          preferred_section,
          occasion,
          dietary_notes,
          guest_name,
          guest_email,
          guest_phone,
          created_at,
          user_id,
          applied_offer_id,
          confirmation_code,
          table_preferences,
          is_event_booking,
          event_occurrence_id,
          turn_time_minutes,
          assigned_table,
          special_offers!bookings_applied_offer_id_fkey (
            id,
            title,
            description,
            discount_percentage
          ),
          profiles!bookings_user_id_fkey (
            id,
            full_name,
            phone_number,
            email,
            user_rating
          ),
          event_occurrences!bookings_event_occurrence_id_fkey (
            id,
            occurrence_date,
            start_time,
            end_time,
            status,
            max_capacity,
            current_bookings,
            event:restaurant_events!event_occurrences_event_id_fkey (
              id,
              title,
              description,
              event_type,
              image_url
            )
          ),
          tables:booking_tables(
            table:restaurant_tables(*)
          )
        `
        )
        .eq("restaurant_id", restaurantId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (pendingError) {
        console.error("❌ Error fetching pending bookings:", pendingError);
      }

      console.log("⏳ Found pending bookings:", pendingBookings?.length || 0);

      // Then get date-specific bookings
      const dateBookings = [];

      if (dateViewMode === "all") {
        // For "all dates" mode, get all bookings from today onward
        const today = startOfDay(new Date());

        const { data: allBookings, error } = await supabase
          .from("bookings")
          .select(
            `
            id,
            booking_time,
            party_size,
            status,
            special_requests,
            preferred_section,
            occasion,
            dietary_notes,
            guest_name,
            guest_email,
            guest_phone,
            created_at,
            user_id,
            applied_offer_id,
            confirmation_code,
            table_preferences,
            is_event_booking,
            event_occurrence_id,
            turn_time_minutes,
            assigned_table,
            special_offers!bookings_applied_offer_id_fkey (
              id,
              title,
              description,
              discount_percentage
            ),
            profiles!bookings_user_id_fkey (
              id,
              full_name,
              phone_number,
              email,
              user_rating
            ),
            event_occurrences!bookings_event_occurrence_id_fkey (
              id,
              occurrence_date,
              start_time,
              end_time,
              status,
              max_capacity,
              current_bookings,
              event:restaurant_events!event_occurrences_event_id_fkey (
                id,
                title,
                description,
                event_type,
                image_url
              )
            ),
            tables:booking_tables(
              table:restaurant_tables(*)
            )
          `
          )
          .eq("restaurant_id", restaurantId)
          .gte("booking_time", today.toISOString())
          .neq("status", "pending") // Exclude pending since we already got them
          .order("booking_time", { ascending: true }); // Sort by booking time for all dates view

        if (error) {
          console.error(
            "❌ Error fetching all bookings from today onward:",
            error
          );
        } else {
          dateBookings.push(...(allBookings || []));
        }

        console.log("📊 All dates bookings result:", {
          count: dateBookings.length,
          fromDate: today.toISOString(),
        });
      } else if (effectiveDates) {
        // For specific date modes (today, select, week, month)
        for (const date of effectiveDates || []) {
          const startOfSelectedDay = startOfDay(date);
          const endOfSelectedDay = endOfDay(date);

          const { data: dayBookings, error } = await supabase
            .from("bookings")
            .select(
              `
              id,
              booking_time,
              party_size,
              status,
              special_requests,
              preferred_section,
              occasion,
              dietary_notes,
              guest_name,
              guest_email,
              guest_phone,
              created_at,
              user_id,
              applied_offer_id,
              confirmation_code,
              table_preferences,
              is_event_booking,
              event_occurrence_id,
              turn_time_minutes,
              assigned_table,
              special_offers!bookings_applied_offer_id_fkey (
                id,
                title,
                description,
                discount_percentage
              ),
              profiles!bookings_user_id_fkey (
                id,
                full_name,
                phone_number,
                email,
                user_rating
              ),
              event_occurrences!bookings_event_occurrence_id_fkey (
                id,
                occurrence_date,
                start_time,
                end_time,
                status,
                max_capacity,
                current_bookings,
                event:restaurant_events!event_occurrences_event_id_fkey (
                  id,
                  title,
                  description,
                  event_type,
                  image_url
                )
              ),
              tables:booking_tables(
                table:restaurant_tables(*)
              )
            `
            )
            .eq("restaurant_id", restaurantId)
            .gte("booking_time", startOfSelectedDay.toISOString())
            .lte("booking_time", endOfSelectedDay.toISOString())
            .neq("status", "pending") // Exclude pending since we already got them
            .order("created_at", { ascending: false });

          if (error) {
            console.error(
              "❌ Error fetching date-specific bookings for",
              date,
              ":",
              error
            );
          } else {
            dateBookings.push(...(dayBookings || []));
          }
        }

        console.log("📊 Date-specific bookings result:", {
          count: dateBookings.length,
          dates: effectiveDates.length,
          mode: dateViewMode,
        });
      }

      // Combine pending bookings with date-specific bookings
      const allBookings = [...(pendingBookings || []), ...dateBookings];

      // Remove duplicates (in case a pending booking is also in the date range)
      const uniqueBookings = allBookings.filter(
        (booking, index, self) =>
          index === self.findIndex((b) => b.id === booking.id)
      );

      // Transform tables structure for ManualBookingForm compatibility
      // Convert booking_tables array to simple tables array
      uniqueBookings.forEach((booking: any) => {
        if (booking.tables && Array.isArray(booking.tables)) {
          booking.tables = booking.tables.map((bt: any) => bt.table).filter(Boolean);
        }
      });

      // Sort: pending first, then by creation date (newest first)
      uniqueBookings.sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (a.status !== "pending" && b.status === "pending") return 1;
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });

      console.log("📋 Final bookings list:", {
        total: uniqueBookings.length,
        pending: uniqueBookings.filter((b) => b.status === "pending").length,
        confirmed: uniqueBookings.filter((b) => b.status === "confirmed")
          .length,
        declined: uniqueBookings.filter(
          (b) => b.status === "declined_by_restaurant"
        ).length,
      });

      return uniqueBookings;
    },
    enabled: !!restaurantId,
    refetchInterval: adaptiveConfig.refetchInterval,
    staleTime: adaptiveConfig.staleTime,
    gcTime: adaptiveConfig.gcTime,
  });

  // Real-time subscription for immediate updates
  useEffect(() => {
    if (!restaurantId) return;

    console.log("🔗 Setting up real-time subscription for basic dashboard");

    const channel = supabase
      .channel(`basic-dashboard-bookings:${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bookings",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        async (payload) => {
          console.log(
            "📥 New booking INSERT received in basic dashboard:",
            payload
          );
          const newBooking = payload.new;
          if (!newBooking) return;

          // Trigger notification for new booking
          const guestName = await resolveGuestFirstName(newBooking);

          addNotification({
            type: "booking",
            title: "New Booking Request",
            message: `New booking from ${guestName} for ${newBooking.party_size} guests`,
            data: newBooking,
          });

          // Fetch the complete booking data with profiles
          try {
            const { data: completeBooking, error } = await supabase
              .from("bookings")
              .select(
                `
                id,
                booking_time,
                party_size,
                status,
                special_requests,
                preferred_section,
                occasion,
                dietary_notes,
                guest_name,
                guest_email,
                guest_phone,
                created_at,
                user_id,
                table_preferences,
                confirmation_code,
                assigned_table,
                profiles!bookings_user_id_fkey (
                  id,
                  full_name,
                  phone_number,
                  email,
                  user_rating
                )
              `
              )
              .eq("id", newBooking.id)
              .single();

            if (error) {
              console.error("Error fetching complete booking data:", error);
              return;
            }

            // Update query cache with complete data
            queryClient.setQueryData(
              ["basic-bookings", restaurantId, dateViewMode, selectedDates],
              (oldData: any[] | undefined) => {
                if (!oldData) return [completeBooking];

                // Check if booking already exists (avoid duplicates)
                const exists = oldData.some((b) => b.id === completeBooking.id);
                if (exists) return oldData;

                // Add new booking at the beginning and sort
                const updated = [completeBooking, ...oldData];
                return updated.sort((a, b) => {
                  if (a.status === "pending" && b.status !== "pending")
                    return -1;
                  if (a.status !== "pending" && b.status === "pending")
                    return 1;
                  return (
                    new Date(b.created_at).getTime() -
                    new Date(a.created_at).getTime()
                  );
                });
              }
            );
          } catch (error) {
            console.error("Error processing new booking:", error);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bookings",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        async (payload) => {
          console.log(
            "📝 Booking UPDATE received in basic dashboard:",
            payload
          );
          const updatedBooking = payload.new;
          const previousBooking = payload.old;
          if (!updatedBooking) return;

          // Trigger notification for status changes
          if (
            previousBooking &&
            previousBooking.status !== updatedBooking.status
          ) {
            const guestName = await resolveGuestFirstName(updatedBooking);

            const statusMap: Record<
              string,
              { title: string; message: string; variant?: "success" | "error" }
            > = {
              confirmed: {
                title: "Booking Confirmed",
                message: `Booking for ${guestName} confirmed`,
                variant: "success",
              },
              declined_by_restaurant: {
                title: "Booking Declined",
                message: `Booking for ${guestName} declined`,
                variant: "error",
              },
              cancelled_by_user: {
                title: "Booking Cancelled",
                message: `Booking for ${guestName} cancelled by customer`,
                variant: "error",
              },
              cancelled_by_restaurant: {
                title: "Booking Cancelled",
                message: `Booking for ${guestName} cancelled by restaurant`,
                variant: "error",
              },
              arrived: {
                title: "Guest Arrived",
                message: `${guestName} has checked in`,
              },
              seated: {
                title: "Guest Seated",
                message: `${guestName} has been seated`,
              },
              completed: {
                title: "Booking Completed",
                message: `${guestName}'s booking completed`,
              },
              no_show: {
                title: "No-show",
                message: `${guestName} marked as no-show`,
              },
            };

            const statusInfo = statusMap[updatedBooking.status as string];
            if (statusInfo) {
              addNotification({
                type: "booking",
                title: statusInfo.title,
                message: statusInfo.message,
                data: updatedBooking,
                variant: statusInfo.variant,
              });
            }
          }

          // Fetch the complete booking data with profiles
          try {
            const { data: completeBooking, error } = await supabase
              .from("bookings")
              .select(
                `
                id,
                booking_time,
                party_size,
                status,
                special_requests,
                preferred_section,
                occasion,
                dietary_notes,
                guest_name,
                guest_email,
                guest_phone,
                created_at,
                user_id,
                table_preferences,
                confirmation_code,
                assigned_table,
                profiles!bookings_user_id_fkey (
                  id,
                  full_name,
                  phone_number,
                  email,
                  user_rating
                )
              `
              )
              .eq("id", updatedBooking.id)
              .single();

            if (error) {
              console.error(
                "Error fetching complete booking data for update:",
                error
              );
              return;
            }

            // Update query cache with complete data
            queryClient.setQueryData(
              ["basic-bookings", restaurantId, dateViewMode, selectedDates],
              (oldData: any[] | undefined) => {
                if (!oldData) return [completeBooking];

                return oldData
                  .map((booking) =>
                    booking.id === completeBooking.id
                      ? completeBooking
                      : booking
                  )
                  .sort((a, b) => {
                    if (a.status === "pending" && b.status !== "pending")
                      return -1;
                    if (a.status !== "pending" && b.status === "pending")
                      return 1;
                    return (
                      new Date(b.created_at).getTime() -
                      new Date(a.created_at).getTime()
                    );
                  });
              }
            );
          } catch (error) {
            console.error("Error processing booking update:", error);
          }
        }
      )
      .subscribe();

    // Register channel for health monitoring
    registerChannel(channel, `basic-dashboard-bookings:${restaurantId}`);

    return () => {
      console.log("🔌 Cleaning up basic dashboard subscription");
      unregisterChannel(`basic-dashboard-bookings:${restaurantId}`);
      supabase.removeChannel(channel);
    };
  }, [
    restaurantId,
    selectedDate,
    selectedDates,
    dateViewMode,
    queryClient,
    supabase,
    registerChannel,
    unregisterChannel,
  ]);

  // Analytics query - for selected date(s)
  const { data: analytics } = useQuery({
    queryKey: ["basic-analytics", restaurantId, dateViewMode, selectedDates],
    queryFn: async () => {
      if (!restaurantId) return null;

      const effectiveDates = getEffectiveDates();

      console.log("📈 Fetching analytics for:", {
        restaurantId,
        effectiveDates,
        mode: dateViewMode,
      });

      // Get analytics data
      const allAnalyticsData = [];

      if (dateViewMode === "all") {
        // For "all dates" mode, get all bookings from today onward
        const today = startOfDay(new Date());

        const { data, error } = await supabase
          .from("bookings")
          .select("status, created_at, booking_time")
          .eq("restaurant_id", restaurantId)
          .gte("booking_time", today.toISOString());

        if (error) {
          console.error("❌ Error fetching analytics for all dates:", error);
        } else {
          allAnalyticsData.push(...(data || []));
        }
      } else if (effectiveDates) {
        // For specific date modes (today, select, week, month)
        for (const date of effectiveDates) {
          const { data, error } = await supabase
            .from("bookings")
            .select("status, created_at, booking_time")
            .eq("restaurant_id", restaurantId)
            .gte("booking_time", startOfDay(date).toISOString())
            .lte("booking_time", endOfDay(date).toISOString());

          if (error) {
            console.error("❌ Error fetching analytics for", date, ":", error);
          } else {
            allAnalyticsData.push(...(data || []));
          }
        }
      }

      // Also get all pending bookings for the analytics (they don't have specific dates)
      const { data: pendingData, error: pendingError } = await supabase
        .from("bookings")
        .select("status, created_at, booking_time")
        .eq("restaurant_id", restaurantId)
        .eq("status", "pending");

      if (!pendingError && pendingData) {
        allAnalyticsData.push(...pendingData);
      }

      const total = allAnalyticsData.length;
      const pending = allAnalyticsData.filter(
        (b) => b.status === "pending"
      ).length;
      const cancelled = allAnalyticsData.filter(
        (b) => b.status === "cancelled_by_user"
      ).length;
      const confirmed = allAnalyticsData.filter(
        (b) => b.status === "confirmed"
      ).length;
      const declined = allAnalyticsData.filter(
        (b) => b.status === "declined_by_restaurant"
      ).length;
      const completed = allAnalyticsData.filter(
        (b) => b.status === "completed"
      ).length;
      const noShow = allAnalyticsData.filter(
        (b) => b.status === "no_show"
      ).length;
      const cancelledByRestaurant = allAnalyticsData.filter(
        (b) => b.status === "cancelled_by_restaurant"
      ).length;
      // Note: is_event_booking field doesn't exist in database yet
      // Set to 0 until the field is added via migration
      const eventBookings = 0;
      const regularBookings = total;

      console.log("📊 Analytics data:", {
        total,
        pending,
        cancelled,
        confirmed,
        declined,
        completed,
        noShow,
        cancelledByRestaurant,
        dateCount: (effectiveDates || []).length,
      });

      return {
        total,
        pending,
        cancelled,
        confirmed,
        declined,
        completed,
        noShow,
        cancelledByRestaurant,
        eventBookings,
        regularBookings,
        acceptanceRate:
          confirmed + declined > 0
            ? Math.round((confirmed / (confirmed + declined)) * 100)
            : 0,
        rejectionRate:
          confirmed + declined > 0
            ? Math.round((declined / (confirmed + declined)) * 100)
            : 0,
      };
    },
    enabled: !!restaurantId,
    refetchInterval: adaptiveConfig.refetchInterval,
    staleTime: adaptiveConfig.staleTime,
    gcTime: adaptiveConfig.gcTime,
  });

  // Update booking status using Basic tier API
  const updateBookingMutation = useMutation({
    mutationFn: async ({
      bookingId,
      status,
      note,
    }: {
      bookingId: string;
      status: string;
      note?: string;
    }) => {
      console.log("🔄 Updating booking:", { bookingId, status, note });

      const response = await fetch("/api/basic-booking-update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bookingId, status, note }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update booking");
      }

      return response.json();
    },
    onSuccess: (data, { status }) => {
      console.log("✅ Booking updated successfully:", data);
      toast.success(
        `Booking ${
          status === "confirmed" ? "accepted" : formatStatus(status)
        } successfully`
      );
      queryClient.invalidateQueries({ queryKey: ["basic-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["basic-analytics"] });
    },
    onError: (error: any) => {
      console.error("❌ Error updating booking:", error);
      toast.error(`Failed to update booking: ${error.message}`);
    },
  });

  // Filter bookings
  const filteredBookings = bookings.filter((booking) => {
    // Handle profiles field which might be an object or array
    const customer = Array.isArray(booking.profiles)
      ? booking.profiles[0]
      : booking.profiles;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      searchQuery === "" ||
      customer?.full_name?.toLowerCase().includes(query) ||
      customer?.phone_number?.includes(searchQuery) ||
      booking.guest_name?.toLowerCase().includes(query) ||
      booking.guest_email?.toLowerCase().includes(query) ||
      booking.confirmation_code?.toLowerCase().includes(query);

    const matchesStatus =
      statusFilter === "all" || booking.status === statusFilter;

    // Filter by booking type (regular or event)
    const matchesType = 
      bookingTypeFilter === "all" ||
      (bookingTypeFilter === "event" && booking.is_event_booking === true) ||
      (bookingTypeFilter === "regular" && booking.is_event_booking !== true);

    return matchesSearch && matchesStatus && matchesType;
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "pending":
        return "outline";
      case "cancelled_by_user":
      case "cancelled_by_restaurant":
      case "no_show":
        return "destructive";
      case "confirmed":
        return "default";
      case "declined_by_restaurant":
        return "destructive";
      case "completed":
        return "default";
      default:
        return "secondary";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <AlertCircle className="h-4 w-4" />;
      case "cancelled_by_user":
      case "cancelled_by_restaurant":
        return <XCircle className="h-4 w-4 text-gray-500" />;
      case "confirmed":
        return <CheckCircle className="h-4 w-4" />;
      case "declined_by_restaurant":
        return <XCircle className="h-4 w-4" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "no_show":
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const formatStatus = (status: string) => {
    switch (status) {
      case "pending":
        return "Pending";
      case "cancelled_by_user":
        return "Cancelled by Customer";
      case "cancelled_by_restaurant":
        return "Cancelled by Restaurant";
      case "confirmed":
        return "Accepted";
      case "declined_by_restaurant":
        return "Declined";
      case "completed":
        return "Completed";
      case "no_show":
        return "No Show";
      default:
        return status;
    }
  };
  // Global ticking timestamp to compute elapsed times without per-item hooks
  const [nowTs, setNowTs] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const formatElapsed = (isoDate?: string, nowMillis?: number) => {
    if (!isoDate) return "";
    const start = new Date(isoDate).getTime();
    const reference = nowMillis ?? Date.now();
    const diffMs = Math.max(0, reference - start);
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  const handleAccept = (booking: any) => {
    updateBookingMutation.mutate({
      bookingId: booking.id,
      status: "confirmed",
    });
  };

  const handleDecline = (booking: any) => {
    setActionDialog({
      isOpen: true,
      action: "decline",
      bookingId: booking.id,
      booking: booking,
    });
  };

  const handleCancelBooking = (booking: any) => {
    setActionDialog({
      isOpen: true,
      action: "cancel",
      bookingId: booking.id,
      booking: booking,
    });
  };

  const handleActionConfirm = (note: string) => {
    if (!actionDialog.bookingId) return;

    const status =
      actionDialog.action === "decline"
        ? "declined_by_restaurant"
        : "cancelled_by_restaurant";

    updateBookingMutation.mutate({
      bookingId: actionDialog.bookingId,
      status,
      note,
    });

    setActionDialog({
      isOpen: false,
      action: "decline",
      bookingId: null,
      booking: null,
    });
  };

  const handleActionCancel = () => {
    setActionDialog({
      isOpen: false,
      action: "decline",
      bookingId: null,
      booking: null,
    });
  };

  const handleStatusChange = (booking: any, newStatus: string) => {
    updateBookingMutation.mutate({
      bookingId: booking.id,
      status: newStatus,
    });
  };

  // Handler functions for CollapsedBookingView
  const onSelectBooking = (booking: any) => {
    // For now, just log - could be expanded to open a detailed modal
    console.log("Selected booking:", booking);
  };

  const onUpdateStatus = (bookingId: string, status: string) => {
    updateBookingMutation.mutate({
      bookingId,
      status,
    });
  };

  const handleTableChange = (bookingId: string, value: string) => {
    setTableInputs(prev => ({
      ...prev,
      [bookingId]: value
    }));
  };

  const handleApplyTable = async (bookingId: string) => {
    const tableNumber = tableInputs[bookingId]?.trim();
    if (!tableNumber) return;

    setIsUpdatingTable(prev => ({ ...prev, [bookingId]: true }));
    
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ assigned_table: tableNumber })
        .eq('id', bookingId);

      if (error) throw error;

      // Update local state
      setTableInputs(prev => {
        const newInputs = { ...prev };
        delete newInputs[bookingId];
        return newInputs;
      });
      setEditingTable(prev => ({ ...prev, [bookingId]: false }));

      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      
      toast.success('Table assigned successfully');
    } catch (error) {
      console.error('Error assigning table:', error);
      toast.error('Failed to assign table');
    } finally {
      setIsUpdatingTable(prev => ({ ...prev, [bookingId]: false }));
    }
  };

  const handleCancelEdit = (bookingId: string) => {
    setTableInputs(prev => {
      const newInputs = { ...prev };
      delete newInputs[bookingId];
      return newInputs;
    });
    setEditingTable(prev => ({ ...prev, [bookingId]: false }));
  };

  const handleTableClick = (bookingId: string, currentTable: string) => {
    setEditingTable(prev => ({ ...prev, [bookingId]: true }));
    setTableInputs(prev => ({ ...prev, [bookingId]: currentTable }));
  };

  const getAssignedTable = (booking: any) => {
    if (tableInputs[booking.id]) {
      return tableInputs[booking.id];
    }
    if (booking.assigned_table !== null &&
        booking.assigned_table !== undefined &&
        booking.assigned_table.trim() !== '') {
      return booking.assigned_table;
    }
    return null;
  };

  // Rating display component
  const CustomerRating = ({ rating }: { rating?: number }) => {
    if (!rating || rating === 5.0) return null;

    return (
      <div className="flex items-center gap-1 text-xs">
        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
        <span
          className={cn(
            "font-medium",
            rating < 3
              ? "text-red-600"
              : rating < 4
              ? "text-yellow-600"
              : "text-gray-600"
          )}
        >
          {rating.toFixed(1)}
        </span>
      </div>
    );
  };

  // Event Badge component
  const EventBadge = ({ booking }: { booking: any }) => {
    if (!booking.is_event_booking || !booking.event_occurrences) return null;

    const occurrence = Array.isArray(booking.event_occurrences) 
      ? booking.event_occurrences[0] 
      : booking.event_occurrences;
    
    const event = occurrence?.event;
    if (!event) return null;

    return (
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200">
          <PartyPopper className="h-3 w-3 mr-1" />
          Event Booking
        </Badge>
        {event.event_type && (
          <Badge variant="outline" className="text-xs capitalize">
            {event.event_type.replace('_', ' ')}
          </Badge>
        )}
      </div>
    );
  };

  // Event Details component
  const EventDetails = ({ booking }: { booking: any }) => {
    if (!booking.is_event_booking || !booking.event_occurrences) return null;

    const occurrence = Array.isArray(booking.event_occurrences) 
      ? booking.event_occurrences[0] 
      : booking.event_occurrences;
    
    const event = occurrence?.event;
    if (!event) return null;

    return (
      <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
        <div className="flex items-start gap-3">
          {event.image_url && (
            <img 
              src={event.image_url} 
              alt={event.title}
              className="w-12 h-12 rounded-lg object-cover"
            />
          )}
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm text-purple-900 dark:text-purple-100 truncate">
              {event.title}
            </h4>
            {event.description && (
              <p className="text-xs text-purple-700 dark:text-purple-300 mt-1 line-clamp-2">
                {event.description}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2 text-xs text-purple-600 dark:text-purple-400">
              <div className="flex items-center gap-1">
                <CalendarIcon className="h-3 w-3" />
                {format(new Date(occurrence.occurrence_date), 'MMM d, yyyy')}
              </div>
              {occurrence.start_time && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {occurrence.start_time}
                  {occurrence.end_time && ` - ${occurrence.end_time}`}
                </div>
              )}
              {occurrence.max_capacity && (
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {occurrence.current_bookings} / {occurrence.max_capacity}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Show loading while context is loading or no restaurant selected
  if (contextLoading || !restaurantId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Restaurant Dashboard</h1>
          <div className="space-y-1">
            <p className="text-muted-foreground">
              {activeTab === "bookings"
                ? (() => {
                    const pendingCount = bookings.filter(
                      (b) => b.status === "pending"
                    ).length;
                    if (pendingCount === 0)
                      return "All caught up! No pending requests.";
                    if (pendingCount === 1)
                      return "1 request needs your attention";
                    return `${pendingCount} requests need your attention`;
                  })()
                : "Manage your waitlist entries"}
            </p>
            {activeTab === "bookings" && (
              <p className="text-sm text-muted-foreground">
                {dateViewMode === "today"
                  ? `Viewing today (${format(new Date(), "MMMM d, yyyy")})`
                  : dateViewMode === "select"
                  ? `Viewing ${selectedDates.length} selected dates`
                  : dateViewMode === "week"
                  ? `Viewing this week (${format(
                      new Date(),
                      "MMM d"
                    )} - ${format(
                      new Date(new Date().getTime() + 6 * 24 * 60 * 60 * 1000),
                      "MMM d"
                    )})`
                  : dateViewMode === "month"
                  ? `Viewing this month (${format(new Date(), "MMMM yyyy")})`
                  : `Viewing all bookings from ${format(
                      new Date(),
                      "MMMM d, yyyy"
                    )} onward`}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ConnectionStatusIndicator
            healthStatus={healthStatus}
            onForceReconnect={forceReconnect}
            compact={true}
            isAggressivePolling={isAggressivePolling}
            unhealthyDurationMinutes={unhealthyDurationMinutes}
          />
          <Button
            variant="default"
            size="sm"
            onClick={() => setManualBookingDialogOpen(true)}
            className="bg-green-600 hover:bg-green-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Booking
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw
              className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Push Notification Permission */}
      <PushNotificationPermission />

      {/* Analytics Cards */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card
            className={cn(
              "transition-all duration-300",
              analytics.pending > 0 && "ring-2 ring-orange-200 bg-orange-50/30"
            )}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p
                    className={cn(
                      "text-2xl font-bold text-orange-600",
                      analytics.pending > 0 && "animate-pulse"
                    )}
                  >
                    {analytics.pending}
                  </p>
                </div>
                <AlertCircle
                  className={cn(
                    "h-8 w-8 text-orange-600",
                    analytics.pending > 0 && "animate-pulse"
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Accepted</p>
                  <p className="text-2xl font-bold text-green-600">
                    {analytics.confirmed}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Declined</p>
                  <p className="text-2xl font-bold text-red-600">
                    {analytics.declined}
                  </p>
                </div>
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {analytics.completed}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-purple-50 dark:bg-purple-950/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600 dark:text-purple-400">Events</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {analytics.eventBookings}
                  </p>
                </div>
                <PartyPopper className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Regular</p>
                  <p className="text-2xl font-bold text-gray-600">
                    {analytics.regularBookings}
                  </p>
                </div>
                <CalendarIcon className="h-8 w-8 text-gray-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(value) =>
          setActiveTab(value as "bookings" | "waitlist")
        }
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="bookings" className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            Booking Requests
            {(() => {
              const pendingCount = bookings.filter(
                (b) => b.status === "pending"
              ).length;
              if (pendingCount > 0) {
                return (
                  <Badge className="ml-1 h-4 px-1 text-xs">
                    {pendingCount}
                  </Badge>
                );
              }
              return null;
            })()}
          </TabsTrigger>
          <TabsTrigger value="waitlist" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Waitlist
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bookings" className="space-y-6">
          {/* Search Bar - Full Width */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer name, phone, email, or confirmation code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filters and View Toggle */}
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            {/* Filter Buttons */}
            <div className="flex flex-wrap gap-3 items-center">
              {/* Select Range Button with This Week/This Month inside */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={dateViewMode === "select" || dateViewMode === "week" || dateViewMode === "month" ? "default" : "outline"}
                    size="sm"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    Select Range
                    {(dateViewMode === "select" && selectedDates.length > 0) && (
                      <Badge variant="secondary" className="ml-2 h-5">
                        {selectedDates.length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="p-3 space-y-3">
                    <DateRangePicker
                      selectedDates={selectedDates}
                      onDatesChange={(dates) => {
                        setSelectedDates(dates);
                        if (dates.length > 0) {
                          setDateViewMode("select");
                        }
                      }}
                      placeholder="Select date range"
                      className="w-[280px]"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant={dateViewMode === "week" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setDateViewMode("week")}
                        className="flex-1"
                      >
                        This Week
                      </Button>
                      <Button
                        variant={dateViewMode === "month" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setDateViewMode("month")}
                        className="flex-1"
                      >
                        This Month
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Today Button */}
              <Button
                variant={dateViewMode === "today" ? "default" : "outline"}
                size="sm"
                onClick={() => setDateViewMode("today")}
              >
                Today
              </Button>

              {/* All Dates Button */}
              <Button
                variant={dateViewMode === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setDateViewMode("all")}
              >
                All Dates
              </Button>

              {/* Status Filter - No Label */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Accepted</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled_by_user">
                    Cancelled by Customer
                  </SelectItem>
                  <SelectItem value="cancelled_by_restaurant">
                    Cancelled by Restaurant
                  </SelectItem>
                  <SelectItem value="declined_by_restaurant">
                    Declined
                  </SelectItem>
                  <SelectItem value="no_show">No Show</SelectItem>
                </SelectContent>
              </Select>

              {/* Booking Type Filter - No Label */}
              <Select value={bookingTypeFilter} onValueChange={setBookingTypeFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Bookings</SelectItem>
                  <SelectItem value="regular">Regular Only</SelectItem>
                  <SelectItem value="event">
                    <div className="flex items-center gap-2">
                      <PartyPopper className="h-4 w-4" />
                      Events Only
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* View Toggle Buttons */}
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === "card" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("card")}
                className="rounded-r-none border-r"
              >
                Card View
              </Button>
              <Button
                variant={viewMode === "collapsed" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("collapsed")}
                className="rounded-l-none"
              >
                Collapsed View
              </Button>
            </div>
          </div>

          {/* Bookings List */}
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Loading bookings...</span>
                </div>
              </div>
            ) : filteredBookings.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CalendarIcon className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    No bookings found
                  </h3>
                  <p className="text-muted-foreground text-center">
                    {searchQuery || statusFilter !== "all" || bookingTypeFilter !== "all"
                      ? "Try adjusting your search or filters"
                      : dateViewMode === "today"
                      ? `No booking requests for today`
                      : dateViewMode === "select"
                      ? `No booking requests for the selected ${selectedDates.length} dates`
                      : dateViewMode === "week"
                      ? `No booking requests for this week`
                      : dateViewMode === "month"
                      ? `No booking requests for this month`
                      : `No booking requests from ${format(
                          new Date(),
                          "MMMM d, yyyy"
                        )} onward`}
                  </p>
                </CardContent>
              </Card>
            ) : viewMode === "collapsed" ? (
              <CollapsedBookingView
                bookings={filteredBookings}
                isLoading={isLoading}
                onSelectBooking={onSelectBooking}
                onUpdateStatus={onUpdateStatus}
                onCancelBooking={handleCancelBooking}
                restaurantId={restaurantId}
                onRefresh={refetch}
              />
            ) : (
              filteredBookings.map((booking) => (
                <Card
                  key={booking.id}
                  className={cn(
                    "hover:shadow-md transition-all duration-200 active:scale-[0.98]",
                    "min-h-[100px]",
                    booking.status === "pending" &&
                      "border-orange-200 bg-orange-50/30 ring-1 ring-orange-200"
                  )}
                >
                  <CardContent className="p-4">
                    {/* Event Badge - Show if it's an event booking */}
                    <EventBadge booking={booking} />

                    {/* Header with customer name and status */}
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge
                            variant={getStatusBadgeVariant(booking.status)}
                            className="gap-1 px-3 py-1 text-sm tablet:text-base font-semibold"
                          >
                            {getStatusIcon(booking.status)}
                            {formatStatus(booking.status)}
                          </Badge>
                          {booking.status === "pending" && (
                            <Badge
                              variant="secondary"
                              className="text-xs tablet:text-sm px-2 py-1 animate-pulse"
                            >
                              {`Elapsed: ${formatElapsed(
                                booking.created_at,
                                nowTs
                              )}`}
                            </Badge>
                          )}
                        </div>

                        {(() => {
                          const customer = Array.isArray(booking.profiles)
                            ? booking.profiles[0]
                            : booking.profiles;
                          const guestName =
                            booking.guest_name || customer?.full_name;
                          const guestEmail =
                            booking.guest_email || customer?.email;
                          return (
                            <>
                              <div className="flex items-center justify-between mb-2">
                                <h3 className="font-bold text-xl tablet:text-2xl text-foreground truncate">
                                  {guestName || "Unknown Customer"}
                                  <CustomerRating
                                    rating={customer?.user_rating}
                                  />
                                </h3>
                                {booking.confirmation_code && (
                                  <span className="font-mono font-semibold text-gray-700 text-sm tablet:text-base">
                                    #{booking.confirmation_code}
                                  </span>
                                )}
                              </div>

                              {/* Phone and Email - stacked vertically */}
                              <div className="text-sm text-muted-foreground space-y-1">
                                {(booking.guest_phone || customer?.phone_number) && (
                                  <div className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    <span className="font-medium">
                                      {booking.guest_phone || customer?.phone_number}
                                    </span>
                                  </div>
                                )}
                                {guestEmail && (
                                  <div className="flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    <span className="font-medium">
                                      {guestEmail}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      {/* Special Offer - Top Right */}
                      {(() => {
                        const hasAppliedOfferId = !!booking.applied_offer_id;
                        const hasSpecialOfferData =
                          booking.special_offers &&
                          (Array.isArray(booking.special_offers)
                            ? booking.special_offers.length > 0
                            : booking.special_offers.title);

                        const hasSpecialOffer =
                          hasAppliedOfferId || hasSpecialOfferData;

                        return hasSpecialOffer ? (
                          <>
                            {/* Mobile: Simple tag with popover */}
                            <div className="tablet:hidden flex-shrink-0">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Badge
                                    variant="secondary"
                                    className="bg-blue-100 text-blue-800 border-blue-200 cursor-pointer hover:bg-blue-200 transition-colors"
                                  >
                                    <Gift className="h-3 w-3 mr-1" />
                                    Offer
                                  </Badge>
                                </PopoverTrigger>
                                <PopoverContent
                                  className="w-80 p-4"
                                  align="end"
                                >
                                  <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                      <Gift className="h-4 w-4 text-blue-600" />
                                      <span className="font-bold text-blue-800">
                                        Special Offer
                                      </span>
                                    </div>
                                    <div className="text-sm text-foreground">
                                      {hasSpecialOfferData
                                        ? (Array.isArray(booking.special_offers)
                                            ? booking.special_offers[0]
                                            : booking.special_offers
                                          ).title
                                        : "Special Offer Applied"}
                                    </div>
                                    {hasSpecialOfferData &&
                                      (Array.isArray(booking.special_offers)
                                        ? booking.special_offers[0]
                                        : booking.special_offers
                                      ).description && (
                                        <div className="text-xs text-muted-foreground">
                                          {
                                            (Array.isArray(
                                              booking.special_offers
                                            )
                                              ? booking.special_offers[0]
                                              : booking.special_offers
                                            ).description
                                          }
                                        </div>
                                      )}
                                    {hasSpecialOfferData &&
                                      (Array.isArray(booking.special_offers)
                                        ? booking.special_offers[0]
                                        : booking.special_offers
                                      ).discount_percentage && (
                                        <Badge
                                          variant="secondary"
                                          className="text-xs bg-blue-100 text-blue-800"
                                        >
                                          {
                                            (Array.isArray(
                                              booking.special_offers
                                            )
                                              ? booking.special_offers[0]
                                              : booking.special_offers
                                            ).discount_percentage
                                          }
                                          % OFF
                                        </Badge>
                                      )}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>

                            {/* Tablet+: Full box */}
                            <div className="hidden tablet:block bg-blue-50 border border-blue-200 rounded-md p-3 flex-shrink-0">
                              <div className="text-xs text-blue-600 font-medium mb-1">
                                Special Offer
                              </div>
                              <div className="flex items-center gap-2">
                                <Gift className="h-4 w-4 text-blue-600" />
                                <span className="font-bold text-sm text-blue-800">
                                  {hasSpecialOfferData
                                    ? (Array.isArray(booking.special_offers)
                                        ? booking.special_offers[0]
                                        : booking.special_offers
                                      ).title
                                    : "Special Offer Applied"}
                                </span>
                              </div>
                              {hasSpecialOfferData &&
                                (Array.isArray(booking.special_offers)
                                  ? booking.special_offers[0]
                                  : booking.special_offers
                                ).discount_percentage && (
                                  <Badge
                                    variant="secondary"
                                    className="mt-1 text-xs bg-blue-100 text-blue-800"
                                  >
                                    {
                                      (Array.isArray(booking.special_offers)
                                        ? booking.special_offers[0]
                                        : booking.special_offers
                                      ).discount_percentage
                                    }
                                    % OFF
                                  </Badge>
                                )}
                            </div>
                          </>
                        ) : null;
                      })()}

                      {/* Action Buttons - Hidden on mobile, shown on tablet+ */}
                      <div className="hidden tablet:flex flex-col gap-2 flex-shrink-0">
                        {booking.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleAccept(booking)}
                              disabled={updateBookingMutation.isPending}
                              className="h-8 tablet:h-10 px-4 bg-green-600 hover:bg-green-700 text-sm tablet:text-base min-w-[90px]"
                            >
                              <CheckCircle className="h-4 w-4 tablet:h-5 tablet:w-5 mr-2" />
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDecline(booking)}
                              disabled={updateBookingMutation.isPending}
                              className="h-8 tablet:h-10 px-4 text-sm tablet:text-base min-w-[90px]"
                            >
                              <XCircle className="h-4 w-4 tablet:h-5 tablet:w-5 mr-2" />
                              Decline
                            </Button>
                          </>
                        )}

                        {booking.status === "confirmed" && (
                          <>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={updateBookingMutation.isPending}
                                  className="h-8 tablet:h-10 px-4 text-sm tablet:text-base min-w-[90px] ml-auto"
                                >
                                  <MoreHorizontal className="h-4 w-4 tablet:h-5 tablet:w-5 mr-2" />
                                  Manage Booking
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleStatusChange(booking, "no_show")
                                  }
                                  className="text-red-600"
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Mark No Show
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleCancelBooking(booking)}
                                  className="text-red-600"
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Cancel Booking
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    const ok = confirm(
                                      "You should only mark 'Cancelled by Customer' if the customer called the restaurant and cancelled (inside cancellation window)."
                                    )
                                    if (!ok) return
                                    handleStatusChange(booking, "cancelled_by_user")
                                  }}
                                  className="text-red-600"
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Cancelled by Customer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Key booking details - separate boxes */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 tablet:gap-4">
                      {/* Date Box */}
                      <div className="bg-muted/50 rounded-md p-3 border">
                        <div className="flex items-center gap-2 mb-2">
                          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground font-medium">
                            Date
                          </span>
                        </div>
                        <div className="font-bold text-lg tablet:text-xl text-foreground">
                          {format(
                            parseISO(booking.booking_time),
                            "MMM d, yyyy"
                          )}
                        </div>
                      </div>

                      {/* Time Box */}
                      <div className="bg-muted/50 rounded-md p-3 border">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground font-medium">
                            Time
                          </span>
                        </div>
                        <div className="font-bold text-lg tablet:text-xl text-foreground">
                          {format(parseISO(booking.booking_time), "h:mm a")}
                        </div>
                      </div>

                      {/* Guests Box */}
                      <div className="bg-muted/50 rounded-md p-3 border">
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground font-medium">
                            Guests
                          </span>
                        </div>
                        <div className="font-bold text-lg tablet:text-xl text-foreground">
                          {booking.party_size}
                        </div>
                      </div>

                      {/* Section & Assigned Table Box */}
                      <div className="bg-muted/50 rounded-md p-3 border">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-muted-foreground font-medium">
                            Section & Table
                          </span>
                        </div>
                        <div className="space-y-2">
                          <div>
                            {booking.preferred_section ? (
                              <div className="font-bold text-base tablet:text-lg text-foreground">
                                {booking.preferred_section}
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground">
                                No preference
                              </div>
                            )}
                          </div>
                          <div>
                            {booking.status === 'confirmed' && editingTable[booking.id] ? (
                              <div className="relative w-36">
                                <Input
                                  placeholder="Table #"
                                  value={tableInputs[booking.id] || ""}
                                  onChange={(e) => handleTableChange(booking.id, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleApplyTable(booking.id);
                                    if (e.key === "Escape") handleCancelEdit(booking.id);
                                  }}
                                  autoFocus
                                  className="
                                    h-8 w-full text-xs pr-16
                                    rounded-md
                                    transition-[box-shadow,background-color,border-color]
                                    border-blue-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500
                                  "
                                />

                                {/* End adornment inside input */}
                                <div className="absolute inset-y-0 right-1 flex items-center">
                                  <div className="flex items-center -space-x-4">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      disabled={isUpdatingTable[booking.id]}
                                      onClick={() => handleApplyTable(booking.id)}
                                      className="
                                        h-6 w-6 rounded-md
                                        hover:bg-muted/70
                                        focus-visible:ring-1 focus-visible:ring-blue-500
                                        transition
                                      "
                                      aria-label="Apply"
                                      title="Apply"
                                    >
                                      {isUpdatingTable[booking.id]
                                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        : <Check className="h-3.5 w-3.5" />}
                                    </Button>

                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleCancelEdit(booking.id)}
                                      className="
                                        h-6 w-6 rounded-md p-0
                                        hover:bg-muted/70
                                        focus-visible:ring-1 focus-visible:ring-blue-500
                                        transition
                                      "
                                      aria-label="Cancel"
                                      title="Cancel"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ) : booking.status === 'confirmed' ? (
                              <div
                                className="flex items-center gap-2 cursor-pointer group"
                                onClick={() => {
                                  const currentTable = getAssignedTable(booking);
                                  if (currentTable) {
                                    handleTableClick(booking.id, currentTable);
                                  } else {
                                    setEditingTable((prev) => ({ ...prev, [booking.id]: true }));
                                    setTableInputs((prev) => ({ ...prev, [booking.id]: "" }));
                                  }
                                }}
                              >
                                <span className="font-medium text-sm group-hover:text-blue-600 transition-colors">
                                  {getAssignedTable(booking) ? `Table ${getAssignedTable(booking)}` : "Assign table"}
                                </span>
                                <span className="text-xs text-muted-foreground group-hover:text-blue-600 transition-colors">✏️</span>
                              </div>
                            ) : (
                              <span className="font-medium text-sm text-muted-foreground">
                                {getAssignedTable(booking) ? `Table ${getAssignedTable(booking)}` : "No table"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Occasion and Table Preferences - Same line */}
                    {(booking.occasion || (booking.table_preferences && 
                         Array.isArray(booking.table_preferences) && 
                         booking.table_preferences.length > 0)) && (
                      <div className="mt-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Occasion - Only show if exists */}
                          {booking.occasion && (
                            <div className="p-2 bg-muted/30 rounded-md border">
                              <div className="flex items-center gap-2">
                                <Gift className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="text-xs tablet:text-sm text-muted-foreground font-medium">
                                  Occasion:
                                </span>
                                <Badge variant="secondary" className="text-xs px-2 py-1 bg-blue-100 text-blue-800">
                                  {booking.occasion.charAt(0).toUpperCase() + booking.occasion.slice(1)}
                                </Badge>
                              </div>
                            </div>
                          )}

                          {/* Table Preferences */}
                          {booking.table_preferences && 
                           Array.isArray(booking.table_preferences) && 
                           booking.table_preferences.length > 0 && (
                            <div className="p-2 bg-muted/30 rounded-md border">
                              <div className="flex items-center gap-2">
                                <Gift className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="text-xs tablet:text-sm text-muted-foreground font-medium">
                                  Table Preferences:
                                </span>
                                <Badge variant="secondary" className="text-xs px-2 py-1 bg-green-100 text-green-800">
                                  {booking.table_preferences.join(", ")}
                                </Badge>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Event Details - Show if it's an event booking */}
                    <EventDetails booking={booking} />

                    {/* Special requests and dietary notes - compact */}
                    {(booking.special_requests ||
                      booking.dietary_notes?.length > 0) && (
                      <div className="mt-3">
                        {booking.special_requests && (
                          <div className="p-2 bg-muted/30 rounded-md border">
                            <div className="flex items-start gap-2">
                              <MessageSquare className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                              <p className="text-xs tablet:text-sm text-foreground leading-relaxed line-clamp-2">
                                <span className="text-xs tablet:text-sm text-muted-foreground font-medium">
                                  Special Request:
                                </span>{" "}
                                {booking.special_requests}
                              </p>
                            </div>
                          </div>
                        )}

                        {booking.dietary_notes &&
                          booking.dietary_notes.length > 0 && (
                            <div className="mt-2">
                              <div className="flex flex-wrap gap-1">
                                {booking.dietary_notes.map(
                                  (note: string, index: number) => (
                                    <Badge
                                      key={index}
                                      variant="outline"
                                      className="text-xs px-2 py-0.5"
                                    >
                                      {note}
                                    </Badge>
                                  )
                                )}
                              </div>
                            </div>
                          )}
                      </div>
                    )}

                    {/* Mobile Action Buttons - Bottom of card */}
                    <div className="tablet:hidden mt-4 pt-3 border-t">
                      {booking.status === "pending" && (
                        <div className="flex gap-3">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDecline(booking)}
                            disabled={updateBookingMutation.isPending}
                            className="flex-1 h-10"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Decline
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleAccept(booking)}
                            disabled={updateBookingMutation.isPending}
                            className="flex-1 h-10 bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Accept
                          </Button>
                        </div>
                      )}

                      {booking.status === "confirmed" && (
                        <div className="flex gap-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={updateBookingMutation.isPending}
                                className="h-10 px-4 ml-auto"
                              >
                                <MoreHorizontal className="h-4 w-4 mr-2" />
                                Manage Booking
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  handleStatusChange(booking, "no_show")
                                }
                                className="text-red-600"
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Mark No Show
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleCancelBooking(booking)}
                                className="text-red-600"
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Cancel Booking
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  const ok = confirm(
                                    "You should only mark 'Cancelled by Customer' if the customer called the restaurant and cancelled (inside cancellation window)."
                                  )
                                  if (!ok) return
                                  handleStatusChange(booking, "cancelled_by_user")
                                }}
                                className="text-red-600"
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Cancelled by Customer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="waitlist" className="space-y-6">
          <WaitlistManager
            restaurantId={restaurantId}
            currentTime={new Date()}
          />
        </TabsContent>
      </Tabs>

      {/* Booking Action Dialog */}
      <BookingActionDialog
        open={actionDialog.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleActionCancel();
          }
        }}
        onConfirm={handleActionConfirm}
        onCancel={handleActionCancel}
        action={actionDialog.action}
        guestName={
          actionDialog.booking
            ? actionDialog.booking.guest_name ||
              actionDialog.booking.profiles?.full_name
            : undefined
        }
        bookingTime={
          actionDialog.booking
            ? format(
                parseISO(actionDialog.booking.booking_time),
                "MMM d, yyyy 'at' h:mm a"
              )
            : undefined
        }
        partySize={actionDialog.booking?.party_size}
        isLoading={updateBookingMutation.isPending}
      />

      {/* Manual Booking Dialog */}
      <ManualBookingDialog
        open={manualBookingDialogOpen}
        onOpenChange={setManualBookingDialogOpen}
        restaurantId={restaurantId || ""}
        currentBookings={bookings}
      />
    </div>
  );
}

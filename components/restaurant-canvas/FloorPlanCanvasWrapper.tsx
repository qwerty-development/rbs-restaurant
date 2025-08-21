// components/restaurant-canvas/FloorPlanCanvasWrapper.tsx
"use client";

import React, { useMemo, useCallback } from "react";
import { RestaurantCanvas } from "./RestaurantCanvas";
import { convertLegacyTableToCanvas, convertCanvasTableToLegacy } from "@/lib/restaurant-canvas/coordinate-utils";
import { RESTAURANT_CANVAS_CONFIG } from "@/lib/restaurant-canvas/canvas-config";
import type { 
  FloorPlan, 
  RestaurantTable as CanvasTable,
  LegacyTableData,
  LegacyBookingData 
} from "@/lib/restaurant-canvas/types";

interface FloorPlanCanvasWrapperProps {
  // Your existing props from UnifiedFloorPlan
  tables: any[];
  bookings: any[];
  currentTime: Date;
  restaurantId: string;
  userId: string;
  onTableClick?: (table: any, statusInfo: any) => void;
  onStatusUpdate?: (bookingId: string, newStatus: string) => void;
  onTableSwitch?: (bookingId: string, newTableIds: string[]) => void;
  onCheckIn?: (bookingId: string, tableIds: string[]) => void;
  onTableUpdate?: (tableId: string, position: { x: number; y: number }) => void;
  searchQuery?: string;
  readOnly?: boolean;
}

export const FloorPlanCanvasWrapper: React.FC<FloorPlanCanvasWrapperProps> = ({
  tables,
  bookings,
  currentTime,
  restaurantId,
  userId,
  onTableClick,
  onStatusUpdate,
  onTableSwitch,
  onCheckIn,
  onTableUpdate,
  searchQuery,
  readOnly = false,
}) => {
  // ============================================================================
  // DATA CONVERSION
  // ============================================================================

  // Convert your existing table data to canvas format
  const canvasFloorPlan = useMemo((): FloorPlan => {
    const canvasTables = tables.map((table) => {
      // Map your existing table structure to legacy format first
      const legacyTable: LegacyTableData = {
        id: table.id,
        restaurant_id: table.restaurant_id || restaurantId,
        table_number: table.table_number,
        table_type: table.table_type,
        capacity: table.max_capacity,
        x_position: table.x_position,
        y_position: table.y_position,
        shape: table.shape || "rectangle",
        width: table.width || 60, // Default width if not provided
        height: table.height || 60, // Default height if not provided
        is_active: table.is_active,
        features: table.features,
        min_capacity: table.min_capacity,
        max_capacity: table.max_capacity,
        is_combinable: table.is_combinable,
        combinable_with: table.combinable_with || [],
        priority_score: table.priority_score || 0,
        created_at: table.created_at,
      };

      // Convert to canvas format
      const canvasTable = convertLegacyTableToCanvas(legacyTable);

      // Add booking information
      const tableBookings = bookings.filter(booking => 
        booking.tables?.some((t: any) => t.id === table.id)
      );

      const reservations = tableBookings.map(booking => ({
        id: booking.id,
        tableId: table.id,
        timeSlot: booking.booking_time,
        duration: booking.turn_time_minutes || 120,
        customerName: booking.user?.full_name || booking.guest_name || "Unknown",
        customerEmail: booking.guest_email || "",
        customerPhone: booking.guest_phone || "",
        partySize: booking.party_size,
        status: booking.status === "confirmed" ? "confirmed" as const : 
                booking.status === "pending" ? "pending" as const :
                booking.status === "cancelled_by_user" || booking.status === "cancelled_by_restaurant" ? "cancelled" as const :
                booking.status === "completed" ? "completed" as const : "pending" as const,
        specialRequests: booking.special_requests || "",
        created: booking.created_at,
        lastModified: booking.updated_at,
        
        // Legacy booking fields
        booking_time: booking.booking_time,
        user_id: booking.user_id,
        restaurant_id: booking.restaurant_id,
        occasion: booking.occasion,
        confirmation_code: booking.confirmation_code,
        guest_name: booking.guest_name,
        guest_email: booking.guest_email,
        guest_phone: booking.guest_phone,
      }));

      // Determine current status based on bookings
      let currentStatus: "available" | "occupied" | "reserved" | "out-of-order" = "available";
      
      if (!table.is_active) {
        currentStatus = "out-of-order";
      } else {
        const activeBooking = tableBookings.find(booking => 
          ["arrived", "seated", "ordered", "appetizers", "main_course", "dessert", "payment"].includes(booking.status)
        );
        const confirmedBooking = tableBookings.find(booking => booking.status === "confirmed");
        
        if (activeBooking) {
          currentStatus = "occupied";
        } else if (confirmedBooking) {
          currentStatus = "reserved";
        }
      }

      return {
        ...canvasTable,
        status: currentStatus,
        reservations,
      };
    });

    return {
      id: `floor-plan-${restaurantId}`,
      name: "Main Floor Plan",
      description: "Restaurant floor plan",
      restaurantId,
      canvasConfig: RESTAURANT_CANVAS_CONFIG,
      objects: canvasTables,
      metadata: {
        version: "1.0.0",
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        createdBy: userId,
      },
    };
  }, [tables, bookings, restaurantId, userId]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleFloorPlanUpdate = useCallback((updatedFloorPlan: FloorPlan) => {
    // Convert canvas changes back to your existing format
    const updatedTables = updatedFloorPlan.objects
      .filter(obj => obj.type === 'table')
      .map(obj => {
        const canvasTable = obj as CanvasTable;
        const legacyData = convertCanvasTableToLegacy(canvasTable);
        
        // Call your existing table update handler
        if (onTableUpdate && legacyData.x_position !== undefined && legacyData.y_position !== undefined) {
          onTableUpdate(canvasTable.id, {
            x: legacyData.x_position,
            y: legacyData.y_position,
          });
        }
        
        return legacyData;
      });

    // You could emit a custom event here or call additional handlers
    console.log("Floor plan updated:", updatedTables);
  }, [onTableUpdate]);

  const handleCanvasTableClick = useCallback((table: CanvasTable, statusInfo: any) => {
    // Convert back to your existing table format for the callback
    const originalTable = tables.find(t => t.id === table.id);
    if (originalTable && onTableClick) {
      onTableClick(originalTable, statusInfo);
    }
  }, [tables, onTableClick]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <RestaurantCanvas
      floorPlan={canvasFloorPlan}
      onFloorPlanUpdate={handleFloorPlanUpdate}
      readOnly={readOnly}
      showBookingStatus={true}
      currentTimeSlot={currentTime.toISOString().slice(0, 16)}
      restaurantId={restaurantId}
      userId={userId}
      onTableClick={handleCanvasTableClick}
      onStatusUpdate={onStatusUpdate}
      onTableSwitch={onTableSwitch}
      onCheckIn={onCheckIn}
      searchQuery={searchQuery}
      className="floor-plan-canvas-wrapper"
    />
  );
};

export default FloorPlanCanvasWrapper;

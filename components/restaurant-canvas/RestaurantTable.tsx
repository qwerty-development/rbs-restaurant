// components/restaurant-canvas/RestaurantTable.tsx
"use client";

import React, { useState, useRef, useCallback, useMemo } from "react";
import { RESTAURANT_CANVAS_CONFIG, TABLE_TYPE_CONFIG, STATUS_CONFIG } from "@/lib/restaurant-canvas/canvas-config";
import { gridToPixel } from "@/lib/restaurant-canvas/coordinate-utils";
import type { RestaurantTableProps, GridCoordinate } from "@/lib/restaurant-canvas/types";

export const RestaurantTable: React.FC<RestaurantTableProps> = ({
  table,
  isSelected,
  zoom,
  showBookingStatus,
  currentTimeSlot,
  readOnly,
  onSelect,
  onMove,
  onDoubleClick,
  bookings = [],
  customersData = {},
}) => {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<GridCoordinate>({ gridX: 0, gridY: 0 });
  const [showTooltip, setShowTooltip] = useState(false);

  const tableRef = useRef<HTMLDivElement>(null);
  const dragTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================================================
  // POSITION AND SIZE CALCULATIONS
  // ============================================================================

  const pixelPosition = useMemo(() => {
    const basePosition = gridToPixel(table.position.gridX, table.position.gridY);
    const dragOffsetPixels = {
      x: dragOffset.gridX * RESTAURANT_CANVAS_CONFIG.GRID.cellSize,
      y: dragOffset.gridY * RESTAURANT_CANVAS_CONFIG.GRID.cellSize,
    };

    return {
      x: basePosition.x + dragOffsetPixels.x,
      y: basePosition.y + dragOffsetPixels.y,
    };
  }, [table.position, dragOffset]);

  const tableSize = useMemo(() => ({
    width: table.size.width * RESTAURANT_CANVAS_CONFIG.GRID.cellSize,
    height: table.size.height * RESTAURANT_CANVAS_CONFIG.GRID.cellSize,
  }), [table.size]);

  // ============================================================================
  // BOOKING STATUS LOGIC
  // ============================================================================

  const currentBookingStatus = useMemo(() => {
    if (!currentTimeSlot || !showBookingStatus) return table.status;

    // Find booking for current time slot
    const currentReservation = table.reservations.find(
      (res) => res.timeSlot === currentTimeSlot && res.status === "confirmed"
    );

    return currentReservation ? "reserved" : table.status;
  }, [table.reservations, table.status, currentTimeSlot, showBookingStatus]);

  const currentReservation = useMemo(() => {
    if (!currentTimeSlot || !showBookingStatus) return null;

    return table.reservations.find(
      (res) => res.timeSlot === currentTimeSlot && res.status === "confirmed"
    );
  }, [table.reservations, currentTimeSlot, showBookingStatus]);

  const upcomingReservations = useMemo(() => {
    if (!currentTimeSlot) return [];

    const currentTime = new Date(currentTimeSlot).getTime();
    return table.reservations
      .filter((res) => {
        const resTime = new Date(res.timeSlot).getTime();
        return res.status === "confirmed" && resTime > currentTime;
      })
      .sort((a, b) => new Date(a.timeSlot).getTime() - new Date(b.timeSlot).getTime())
      .slice(0, 2); // Show next 2 reservations
  }, [table.reservations, currentTimeSlot]);

  // ============================================================================
  // DRAG HANDLING
  // ============================================================================

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (readOnly) return;

    e.stopPropagation();

    // Handle selection
    onSelect(table.id);

    // Handle double click
    if (e.detail === 2) {
      onDoubleClick?.(table.id);
      return;
    }

    // Start drag operation
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setDragOffset({ gridX: 0, gridY: 0 });

    // Add global mouse event listeners
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragStart) return;

      const deltaX = moveEvent.clientX - dragStart.x;
      const deltaY = moveEvent.clientY - dragStart.y;

      // Convert pixel movement to grid movement
      const gridDeltaX = Math.round(deltaX / (RESTAURANT_CANVAS_CONFIG.GRID.cellSize * zoom));
      const gridDeltaY = Math.round(deltaY / (RESTAURANT_CANVAS_CONFIG.GRID.cellSize * zoom));

      setDragOffset({ gridX: gridDeltaX, gridY: gridDeltaY });
    };

    const handleMouseUp = () => {
      if (isDragging && (dragOffset.gridX !== 0 || dragOffset.gridY !== 0)) {
        // Apply the movement
        onMove(dragOffset);
      }

      // Clean up
      setIsDragging(false);
      setDragStart(null);
      setDragOffset({ gridX: 0, gridY: 0 });

      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [readOnly, onSelect, onDoubleClick, table.id, isDragging, dragStart, dragOffset, onMove, zoom]);

  // ============================================================================
  // STYLING
  // ============================================================================

  const tableStyle: React.CSSProperties = useMemo(() => {
    const statusConfig = STATUS_CONFIG[currentBookingStatus as keyof typeof STATUS_CONFIG];
    const typeConfig = TABLE_TYPE_CONFIG[table.subType];

    return {
      position: "absolute",
      left: `${pixelPosition.x}px`,
      top: `${pixelPosition.y}px`,
      width: `${tableSize.width}px`,
      height: `${tableSize.height}px`,
      transform: `translate(-50%, -50%) rotate(${table.rotation}deg)`,
      zIndex: table.zIndex + (isDragging ? 1000 : 0) + (isSelected ? 100 : 0),
      cursor: readOnly ? "default" : isDragging ? "grabbing" : "grab",
      transition: isDragging ? "none" : "all 0.2s ease",
      opacity: isDragging ? 0.8 : 1,
    };
  }, [pixelPosition, tableSize, table.rotation, table.zIndex, isDragging, isSelected, readOnly, currentBookingStatus, table.subType]);

  const shapeStyle: React.CSSProperties = useMemo(() => {
    const statusConfig = STATUS_CONFIG[currentBookingStatus as keyof typeof STATUS_CONFIG];
    const typeConfig = TABLE_TYPE_CONFIG[table.subType];

    return {
      width: "100%",
      height: "100%",
      backgroundColor: statusConfig?.color || "#6b7280",
      border: isSelected ? "3px solid #3b82f6" : "2px solid #374151",
      borderRadius: table.shape === "circle" ? "50%" : table.shape === "square" ? "8px" : "12px",
      position: "relative",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: isSelected
        ? "0 0 20px rgba(59, 130, 246, 0.5)"
        : isDragging
        ? "0 8px 25px rgba(0, 0, 0, 0.3)"
        : "0 2px 8px rgba(0, 0, 0, 0.1)",
    };
  }, [currentBookingStatus, table.subType, table.shape, isSelected, isDragging]);

  // ============================================================================
  // CHAIR POSITIONS
  // ============================================================================

  const chairElements = useMemo(() => {
    return Array.from({ length: table.seats }, (_, index) => {
      let chairPosition = { x: 0, y: 0 };

      if (table.shape === "circle" || table.shape === "square") {
        // Arrange chairs in a circle
        const angle = (360 / table.seats) * index;
        const radius = Math.max(tableSize.width, tableSize.height) / 2 + 15;
        chairPosition.x = Math.cos((angle * Math.PI) / 180) * radius;
        chairPosition.y = Math.sin((angle * Math.PI) / 180) * radius;
      } else {
        // Arrange chairs around rectangle perimeter
        const perimeter = 2 * (table.size.width + table.size.height);
        const spacing = perimeter / table.seats;
        const position = spacing * index;

        if (position < table.size.width) {
          // Top edge
          chairPosition.x = (position - table.size.width / 2) * RESTAURANT_CANVAS_CONFIG.GRID.cellSize;
          chairPosition.y = -tableSize.height / 2 - 15;
        } else if (position < table.size.width + table.size.height) {
          // Right edge
          chairPosition.x = tableSize.width / 2 + 15;
          chairPosition.y = ((position - table.size.width) - table.size.height / 2) * RESTAURANT_CANVAS_CONFIG.GRID.cellSize;
        } else if (position < 2 * table.size.width + table.size.height) {
          // Bottom edge
          chairPosition.x = ((2 * table.size.width + table.size.height - position) - table.size.width / 2) * RESTAURANT_CANVAS_CONFIG.GRID.cellSize;
          chairPosition.y = tableSize.height / 2 + 15;
        } else {
          // Left edge
          chairPosition.x = -tableSize.width / 2 - 15;
          chairPosition.y = ((2 * table.size.width + 2 * table.size.height - position) - table.size.height / 2) * RESTAURANT_CANVAS_CONFIG.GRID.cellSize;
        }
      }

      return (
        <div
          key={`chair-${index}`}
          className="chair-indicator"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: "16px",
            height: "16px",
            backgroundColor: "#8b4513",
            borderRadius: "50%",
            transform: `translate(-50%, -50%) translate(${chairPosition.x}px, ${chairPosition.y}px)`,
            border: "1px solid #654321",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.2)",
          }}
        />
      );
    });
  }, [table.seats, table.shape, tableSize, table.size]);

  // ============================================================================
  // TOOLTIP CONTENT
  // ============================================================================

  const tooltipContent = useMemo(() => {
    if (!showTooltip) return null;

    return (
      <div
        className="absolute z-50 bg-gray-900 text-white p-3 rounded-lg shadow-lg text-sm max-w-xs"
        style={{
          bottom: "calc(100% + 10px)",
          left: "50%",
          transform: "translateX(-50%)",
          pointerEvents: "none",
        }}
      >
        <div className="font-semibold mb-1">Table {table.table_number}</div>
        <div className="text-gray-300 mb-2">
          {table.seats} seats • {table.subType} • {table.shape}
        </div>
        
        {currentReservation && (
          <div className="border-t border-gray-600 pt-2 mb-2">
            <div className="font-medium text-yellow-300">Current Reservation:</div>
            <div>{currentReservation.customerName}</div>
            <div className="text-xs text-gray-400">
              {currentReservation.partySize} guests • {new Date(currentReservation.timeSlot).toLocaleTimeString()}
            </div>
          </div>
        )}
        
        {upcomingReservations.length > 0 && (
          <div className="border-t border-gray-600 pt-2">
            <div className="font-medium text-blue-300 mb-1">Upcoming:</div>
            {upcomingReservations.map((res) => (
              <div key={res.id} className="text-xs text-gray-400 mb-1">
                {res.customerName} • {new Date(res.timeSlot).toLocaleTimeString()}
              </div>
            ))}
          </div>
        )}
        
        {table.features && table.features.length > 0 && (
          <div className="border-t border-gray-600 pt-2">
            <div className="text-xs text-gray-400">
              Features: {table.features.join(", ")}
            </div>
          </div>
        )}
      </div>
    );
  }, [showTooltip, table, currentReservation, upcomingReservations]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div
      ref={tableRef}
      className={`restaurant-table ${table.subType} ${currentBookingStatus} ${isSelected ? "selected" : ""}`}
      style={tableStyle}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      data-testid={table.id}
      data-table-number={table.table_number}
      data-table-type={table.subType}
      data-status={currentBookingStatus}
    >
      {/* Table Shape */}
      <div className="table-shape" style={shapeStyle}>
        {/* Table Label */}
        <div className="table-label text-center">
          <div className="table-number text-sm font-bold text-white drop-shadow-sm">
            {table.table_number}
          </div>
          <div className="seat-count text-xs text-white opacity-90">
            {table.seats} seats
          </div>
        </div>

        {/* Status Indicator */}
        <div
          className="status-indicator"
          style={{
            position: "absolute",
            top: "4px",
            right: "4px",
            width: "12px",
            height: "12px",
            borderRadius: "50%",
            backgroundColor: "rgba(255, 255, 255, 0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "8px",
          }}
        >
          {STATUS_CONFIG[currentBookingStatus as keyof typeof STATUS_CONFIG]?.icon || "?"}
        </div>

        {/* VIP Indicator */}
        {currentReservation && customersData[currentReservation.customerName]?.vipStatus && (
          <div
            className="vip-indicator"
            style={{
              position: "absolute",
              top: "4px",
              left: "4px",
              backgroundColor: "#ffd700",
              color: "#000",
              borderRadius: "50%",
              width: "16px",
              height: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "10px",
              fontWeight: "bold",
            }}
          >
            ⭐
          </div>
        )}

        {/* Selection Handles */}
        {isSelected && !readOnly && (
          <div className="selection-handles">
            {[
              { position: "top-left", style: { top: "-6px", left: "-6px" } },
              { position: "top-right", style: { top: "-6px", right: "-6px" } },
              { position: "bottom-left", style: { bottom: "-6px", left: "-6px" } },
              { position: "bottom-right", style: { bottom: "-6px", right: "-6px" } },
            ].map(({ position, style }) => (
              <div
                key={position}
                className={`handle ${position}`}
                style={{
                  position: "absolute",
                  width: "12px",
                  height: "12px",
                  backgroundColor: "#3b82f6",
                  border: "2px solid white",
                  borderRadius: "50%",
                  cursor: "pointer",
                  ...style,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Chair Positions */}
      <div className="chair-positions">
        {chairElements}
      </div>

      {/* Tooltip */}
      {tooltipContent}
    </div>
  );
};

export default RestaurantTable;

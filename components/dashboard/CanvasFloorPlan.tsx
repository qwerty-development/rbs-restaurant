// components/dashboard/CanvasFloorPlan.tsx
"use client";

import React from "react";
import { FloorPlanCanvasWrapper } from "@/components/restaurant-canvas/FloorPlanCanvasWrapper";
import "@/components/restaurant-canvas/restaurant-canvas.css";

// This component provides the same interface as UnifiedFloorPlan
// but uses the new canvas system underneath
interface CanvasFloorPlanProps {
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
}

export const CanvasFloorPlan: React.FC<CanvasFloorPlanProps> = (props) => {
  return (
    <div className="canvas-floor-plan-container" style={{ width: '100%', height: '100%' }}>
      <FloorPlanCanvasWrapper {...props} />
    </div>
  );
};

export default CanvasFloorPlan;

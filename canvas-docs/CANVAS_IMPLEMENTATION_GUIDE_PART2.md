# 🎯 CANVAS IMPLEMENTATION GUIDE - PART 2

## Table Components & Restaurant Objects

This is a continuation of the main Canvas Implementation Guide. This section focuses on creating restaurant-specific table and chair components with full drag & drop functionality.

---

## 🍽️ PART IV: RESTAURANT-SPECIFIC COMPONENTS

### 10. TABLE & CHAIR COMPONENTS

#### 10.1 RestaurantTable Component

**RestaurantTable.tsx - Main Table Component:**

```typescript
import React, { useState, useRef, useCallback } from "react";
import { RESTAURANT_CANVAS_CONFIG } from "../constants/canvas-config";
import type {
  RestaurantTable as TableType,
  GridCoordinate,
} from "../types/restaurant-canvas.types";

interface RestaurantTableProps {
  table: TableType;
  isSelected: boolean;
  zoom: number;
  showBookingStatus: boolean;
  currentTimeSlot?: string;
  readOnly: boolean;
  onSelect: (id: string) => void;
  onMove: (delta: GridCoordinate) => void;
  onDoubleClick?: (id: string) => void;
}

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
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [dragOffset, setDragOffset] = useState<GridCoordinate>({
    gridX: 0,
    gridY: 0,
  });

  const tableRef = useRef<HTMLDivElement>(null);

  // Calculate pixel position from grid coordinates
  const pixelPosition = {
    x:
      RESTAURANT_CANVAS_CONFIG.GRID.centerX +
      table.position.gridX * RESTAURANT_CANVAS_CONFIG.GRID.cellSize,
    y:
      RESTAURANT_CANVAS_CONFIG.GRID.centerY +
      table.position.gridY * RESTAURANT_CANVAS_CONFIG.GRID.cellSize,
  };

  // Get current booking status for the time slot
  const getCurrentBookingStatus = useCallback(() => {
    if (!currentTimeSlot || !showBookingStatus) return table.status;

    const currentReservation = table.reservations.find(
      (res) => res.timeSlot === currentTimeSlot && res.status === "confirmed"
    );

    return currentReservation ? "reserved" : table.status;
  }, [table.reservations, table.status, currentTimeSlot, showBookingStatus]);

  // Handle mouse events for dragging
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (readOnly) return;

      e.stopPropagation();

      // Select the table
      onSelect(table.id);

      if (e.detail === 2) {
        // Double click
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
        const gridDeltaX = Math.round(
          deltaX / (RESTAURANT_CANVAS_CONFIG.GRID.cellSize * zoom)
        );
        const gridDeltaY = Math.round(
          deltaY / (RESTAURANT_CANVAS_CONFIG.GRID.cellSize * zoom)
        );

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
    },
    [
      readOnly,
      onSelect,
      onDoubleClick,
      table.id,
      isDragging,
      dragStart,
      dragOffset,
      onMove,
      zoom,
    ]
  );

  // Table size calculations
  const tableSize = {
    width: table.size.width * RESTAURANT_CANVAS_CONFIG.GRID.cellSize,
    height: table.size.height * RESTAURANT_CANVAS_CONFIG.GRID.cellSize,
  };

  // Current status for styling
  const currentStatus = getCurrentBookingStatus();

  // Style calculations
  const tableStyle: React.CSSProperties = {
    position: "absolute",
    left: `${
      pixelPosition.x +
      dragOffset.gridX * RESTAURANT_CANVAS_CONFIG.GRID.cellSize
    }px`,
    top: `${
      pixelPosition.y +
      dragOffset.gridY * RESTAURANT_CANVAS_CONFIG.GRID.cellSize
    }px`,
    width: `${tableSize.width}px`,
    height: `${tableSize.height}px`,
    transform: `translate(-50%, -50%) rotate(${table.rotation}deg)`,
    zIndex: table.zIndex + (isDragging ? 1000 : 0),
    cursor: readOnly ? "default" : isDragging ? "grabbing" : "grab",
    transition: isDragging ? "none" : "all 0.2s ease",
    opacity: isDragging ? 0.8 : 1,
  };

  // Status color mapping
  const statusColors = {
    available: "#28a745",
    occupied: "#dc3545",
    reserved: "#ffc107",
    "out-of-order": "#6c757d",
  };

  return (
    <div
      ref={tableRef}
      className={`restaurant-table ${table.subType} ${currentStatus} ${
        isSelected ? "selected" : ""
      }`}
      style={tableStyle}
      onMouseDown={handleMouseDown}
      data-table-id={table.id}
    >
      {/* Table Shape */}
      <div
        className="table-shape"
        style={{
          width: "100%",
          height: "100%",
          backgroundColor:
            statusColors[currentStatus as keyof typeof statusColors],
          border: isSelected ? "3px solid #007bff" : "2px solid #333",
          borderRadius: table.subType === "round" ? "50%" : "8px",
          position: "relative",
          boxShadow: isSelected
            ? "0 0 15px rgba(0,123,255,0.5)"
            : "0 2px 8px rgba(0,0,0,0.1)",
        }}
      >
        {/* Table Number/Label */}
        <div className="table-label">
          <span className="table-number">
            {table.id.replace("table_", "T")}
          </span>
          <span className="seat-count">{table.seats} seats</span>
        </div>

        {/* Reservation Info (if applicable) */}
        {showBookingStatus && currentTimeSlot && (
          <div className="booking-info">
            {table.reservations
              .filter(
                (res) =>
                  res.timeSlot === currentTimeSlot && res.status === "confirmed"
              )
              .map((reservation) => (
                <div key={reservation.id} className="reservation-badge">
                  <span className="customer-name">
                    {reservation.customerName}
                  </span>
                  <span className="party-size">
                    {reservation.partySize} guests
                  </span>
                </div>
              ))}
          </div>
        )}

        {/* Status Indicator */}
        <div className={`status-indicator ${currentStatus}`}>
          <div className="status-dot"></div>
        </div>

        {/* Selection Handles (when selected) */}
        {isSelected && !readOnly && (
          <div className="selection-handles">
            <div className="handle top-left"></div>
            <div className="handle top-right"></div>
            <div className="handle bottom-left"></div>
            <div className="handle bottom-right"></div>
          </div>
        )}
      </div>

      {/* Chair Positions (visual indicators) */}
      <div className="chair-positions">
        {Array.from({ length: table.seats }, (_, index) => {
          const angle = (360 / table.seats) * index;
          const radius = Math.max(tableSize.width, tableSize.height) / 2 + 20;
          const x = Math.cos((angle * Math.PI) / 180) * radius;
          const y = Math.sin((angle * Math.PI) / 180) * radius;

          return (
            <div
              key={`chair-${index}`}
              className="chair-indicator"
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: "20px",
                height: "20px",
                backgroundColor: "#8b4513",
                borderRadius: "50%",
                transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
                border: "1px solid #654321",
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
```

#### 10.2 Table Factory System

**table-factory.ts - Table Creation Utilities:**

```typescript
import { v4 as uuidv4 } from "uuid";
import type {
  RestaurantTable,
  GridCoordinate,
} from "../types/restaurant-canvas.types";

export interface TableCreationOptions {
  subType: "round" | "square" | "rectangular" | "bar";
  position: GridCoordinate;
  seats: number;
  rotation?: number;
  customId?: string;
}

export class TableFactory {
  static createTable(options: TableCreationOptions): RestaurantTable {
    const tableId = options.customId || `table_${uuidv4()}`;

    // Default sizes based on table type
    const defaultSizes = {
      round: { width: 3, height: 3 },
      square: { width: 2, height: 2 },
      rectangular: { width: 4, height: 2 },
      bar: { width: 6, height: 1 },
    };

    const size = defaultSizes[options.subType];

    // Seat validation
    const maxSeats = this.calculateMaxSeats(options.subType, size);
    const seats = Math.min(options.seats, maxSeats);

    return {
      id: tableId,
      type: "table",
      subType: options.subType,
      position: options.position,
      size,
      rotation: options.rotation || 0,
      zIndex: 10,
      seats,
      maxSeats,
      status: "available",
      reservations: [],
      chairs: this.generateChairs(tableId, seats),
      metadata: {
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        createdBy: "system", // This should be the actual user ID
      },
    };
  }

  static calculateMaxSeats(
    subType: string,
    size: { width: number; height: number }
  ): number {
    switch (subType) {
      case "round":
        const circumference = Math.PI * Math.max(size.width, size.height);
        return Math.floor(circumference / 1.5); // 1.5 grid units per seat
      case "square":
        return (size.width + size.height) * 2 - 4; // Perimeter minus corners
      case "rectangular":
        return (size.width + size.height) * 2 - 4;
      case "bar":
        return size.width * 2; // Seats on both long sides
      default:
        return 4;
    }
  }

  static generateChairs(tableId: string, seatCount: number) {
    return Array.from({ length: seatCount }, (_, index) => ({
      id: `chair_${tableId}_${index}`,
      type: "chair" as const,
      tableId,
      position: { gridX: 0, gridY: 0 }, // Will be calculated relative to table
      size: { width: 1, height: 1 },
      rotation: 0,
      zIndex: 5,
      occupied: false,
      metadata: {
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        createdBy: "system",
      },
    }));
  }

  static createTableFromTemplate(
    template: string,
    position: GridCoordinate
  ): RestaurantTable {
    const templates = {
      small_round: { subType: "round", seats: 2 },
      medium_round: { subType: "round", seats: 4 },
      large_round: { subType: "round", seats: 6 },
      small_square: { subType: "square", seats: 2 },
      medium_square: { subType: "square", seats: 4 },
      rectangular_4: { subType: "rectangular", seats: 4 },
      rectangular_6: { subType: "rectangular", seats: 6 },
      bar_table: { subType: "bar", seats: 8 },
    };

    const config = templates[template as keyof typeof templates];
    if (!config) {
      throw new Error(`Unknown table template: ${template}`);
    }

    return this.createTable({
      subType: config.subType as any,
      position,
      seats: config.seats,
    });
  }

  static validateTablePlacement(
    table: RestaurantTable,
    existingTables: RestaurantTable[]
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for overlaps
    for (const existing of existingTables) {
      if (existing.id === table.id) continue;

      if (this.tablesOverlap(table, existing)) {
        errors.push(`Table overlaps with ${existing.id}`);
      }
    }

    // Check minimum distances
    for (const existing of existingTables) {
      if (existing.id === table.id) continue;

      const distance = this.calculateTableDistance(table, existing);
      if (distance < 2) {
        // Minimum 2 grid units between tables
        errors.push(
          `Table too close to ${existing.id} (minimum 2 units required)`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private static tablesOverlap(
    table1: RestaurantTable,
    table2: RestaurantTable
  ): boolean {
    const t1 = {
      left: table1.position.gridX - table1.size.width / 2,
      right: table1.position.gridX + table1.size.width / 2,
      top: table1.position.gridY - table1.size.height / 2,
      bottom: table1.position.gridY + table1.size.height / 2,
    };

    const t2 = {
      left: table2.position.gridX - table2.size.width / 2,
      right: table2.position.gridX + table2.size.width / 2,
      top: table2.position.gridY - table2.size.height / 2,
      bottom: table2.position.gridY + table2.size.height / 2,
    };

    return !(
      t1.right < t2.left ||
      t1.left > t2.right ||
      t1.bottom < t2.top ||
      t1.top > t2.bottom
    );
  }

  private static calculateTableDistance(
    table1: RestaurantTable,
    table2: RestaurantTable
  ): number {
    const dx = table1.position.gridX - table2.position.gridX;
    const dy = table1.position.gridY - table2.position.gridY;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
```

#### 10.3 Table Management Toolbar

**ObjectToolbar.tsx - Table Manipulation Tools:**

```typescript
import React, { useState } from "react";
import type { RestaurantTable } from "../types/restaurant-canvas.types";

interface ObjectToolbarProps {
  selectedObjects: string[];
  onDelete: () => void;
  onDuplicate: () => void;
  onDeselectAll: () => void;
  onRotate?: (degrees: number) => void;
  onResize?: (scale: number) => void;
  onChangeSeats?: (seats: number) => void;
}

export const ObjectToolbar: React.FC<ObjectToolbarProps> = ({
  selectedObjects,
  onDelete,
  onDuplicate,
  onDeselectAll,
  onRotate,
  onResize,
  onChangeSeats,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const selectedCount = selectedObjects.length;

  if (selectedCount === 0) return null;

  return (
    <div className="object-toolbar">
      <div className="toolbar-header">
        <span className="selection-count">
          {selectedCount} table{selectedCount > 1 ? "s" : ""} selected
        </span>
        <button
          className="expand-button"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? "▼" : "▲"}
        </button>
        <button
          className="deselect-button"
          onClick={onDeselectAll}
          title="Deselect All"
        >
          ✕
        </button>
      </div>

      {isExpanded && (
        <div className="toolbar-content">
          {/* Basic Actions */}
          <div className="action-group">
            <button
              className="toolbar-button delete"
              onClick={onDelete}
              title="Delete Selected"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <polyline points="3,6 5,6 21,6" />
                <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
              Delete
            </button>

            <button
              className="toolbar-button duplicate"
              onClick={onDuplicate}
              title="Duplicate Selected"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5,15H4a2,2 0 0,1-2-2V4a2,2 0 0,1,2-2H13a2,2 0 0,1,2,2v1" />
              </svg>
              Duplicate
            </button>
          </div>

          {/* Rotation Controls */}
          {onRotate && (
            <div className="action-group">
              <label>Rotate:</label>
              <button
                className="toolbar-button rotate"
                onClick={() => onRotate(-45)}
                title="Rotate Left 45°"
              >
                ↶ 45°
              </button>
              <button
                className="toolbar-button rotate"
                onClick={() => onRotate(45)}
                title="Rotate Right 45°"
              >
                ↷ 45°
              </button>
              <button
                className="toolbar-button rotate"
                onClick={() => onRotate(-90)}
                title="Rotate Left 90°"
              >
                ↶ 90°
              </button>
              <button
                className="toolbar-button rotate"
                onClick={() => onRotate(90)}
                title="Rotate Right 90°"
              >
                ↷ 90°
              </button>
            </div>
          )}

          {/* Seat Count Controls (single table only) */}
          {selectedCount === 1 && onChangeSeats && (
            <div className="action-group">
              <label>Seats:</label>
              {[2, 4, 6, 8].map((seatCount) => (
                <button
                  key={seatCount}
                  className="toolbar-button seats"
                  onClick={() => onChangeSeats(seatCount)}
                  title={`Set ${seatCount} seats`}
                >
                  {seatCount}
                </button>
              ))}
            </div>
          )}

          {/* Quick Actions */}
          <div className="action-group">
            <button className="toolbar-button align" title="Align Horizontal">
              ═══
            </button>
            <button className="toolbar-button align" title="Align Vertical">
              ║
            </button>
            <button
              className="toolbar-button distribute"
              title="Distribute Evenly"
            >
              ⫸⫷
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
```

### 11. DRAG & DROP FUNCTIONALITY

#### 11.1 Advanced Drag System

**useDragDrop.ts - Advanced Drag & Drop Hook:**

```typescript
import { useState, useCallback, useRef } from "react";
import type {
  GridCoordinate,
  RestaurantObject,
} from "../types/restaurant-canvas.types";
import { RESTAURANT_CANVAS_CONFIG } from "../constants/canvas-config";

interface DragState {
  isDragging: boolean;
  draggedObjects: string[];
  startPosition: { x: number; y: number } | null;
  currentOffset: GridCoordinate;
  ghostPosition: GridCoordinate | null;
}

interface UseDragDropOptions {
  onMove: (objectIds: string[], delta: GridCoordinate) => void;
  onSelect: (objectIds: string[], multiSelect?: boolean) => void;
  validateMove?: (
    objectIds: string[],
    newPositions: GridCoordinate[]
  ) => boolean;
  snapToGrid?: boolean;
  zoom: number;
}

export const useDragDrop = (options: UseDragDropOptions) => {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedObjects: [],
    startPosition: null,
    currentOffset: { gridX: 0, gridY: 0 },
    ghostPosition: null,
  });

  const mouseDownTimeRef = useRef<number>(0);
  const hasDraggedRef = useRef(false);

  const startDrag = useCallback(
    (
      objectId: string,
      mousePosition: { x: number; y: number },
      isMultiSelect: boolean = false
    ) => {
      mouseDownTimeRef.current = Date.now();
      hasDraggedRef.current = false;

      // Select the object if not already selected
      options.onSelect([objectId], isMultiSelect);

      setDragState({
        isDragging: true,
        draggedObjects: [objectId], // This would be expanded for multi-selection
        startPosition: mousePosition,
        currentOffset: { gridX: 0, gridY: 0 },
        ghostPosition: null,
      });
    },
    [options]
  );

  const updateDrag = useCallback(
    (mousePosition: { x: number; y: number }) => {
      if (!dragState.isDragging || !dragState.startPosition) return;

      const deltaX = mousePosition.x - dragState.startPosition.x;
      const deltaY = mousePosition.y - dragState.startPosition.y;

      // Convert pixel movement to grid movement
      const gridDeltaX =
        deltaX / (RESTAURANT_CANVAS_CONFIG.GRID.cellSize * options.zoom);
      const gridDeltaY =
        deltaY / (RESTAURANT_CANVAS_CONFIG.GRID.cellSize * options.zoom);

      let finalGridX = gridDeltaX;
      let finalGridY = gridDeltaY;

      // Snap to grid if enabled
      if (options.snapToGrid !== false) {
        finalGridX = Math.round(gridDeltaX);
        finalGridY = Math.round(gridDeltaY);
      }

      // Check if we've actually moved
      const hasMoved = Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5;
      if (hasMoved) {
        hasDraggedRef.current = true;
      }

      setDragState((prev) => ({
        ...prev,
        currentOffset: { gridX: finalGridX, gridY: finalGridY },
        ghostPosition: { gridX: finalGridX, gridY: finalGridY },
      }));
    },
    [
      dragState.isDragging,
      dragState.startPosition,
      options.zoom,
      options.snapToGrid,
    ]
  );

  const endDrag = useCallback(() => {
    if (!dragState.isDragging) return;

    const wasDragged = hasDraggedRef.current;
    const dragDuration = Date.now() - mouseDownTimeRef.current;

    // Only apply movement if the object was actually dragged
    if (wasDragged && dragDuration > 100) {
      // Minimum drag duration
      const { currentOffset, draggedObjects } = dragState;

      // Validate the move if validator is provided
      if (options.validateMove) {
        // Calculate new positions for validation
        const newPositions = draggedObjects.map(() => currentOffset);

        if (!options.validateMove(draggedObjects, newPositions)) {
          // Invalid move - don't apply
          setDragState({
            isDragging: false,
            draggedObjects: [],
            startPosition: null,
            currentOffset: { gridX: 0, gridY: 0 },
            ghostPosition: null,
          });
          return;
        }
      }

      // Apply the movement
      if (currentOffset.gridX !== 0 || currentOffset.gridY !== 0) {
        options.onMove(draggedObjects, currentOffset);
      }
    }

    // Reset drag state
    setDragState({
      isDragging: false,
      draggedObjects: [],
      startPosition: null,
      currentOffset: { gridX: 0, gridY: 0 },
      ghostPosition: null,
    });

    mouseDownTimeRef.current = 0;
    hasDraggedRef.current = false;
  }, [dragState, options]);

  const cancelDrag = useCallback(() => {
    setDragState({
      isDragging: false,
      draggedObjects: [],
      startPosition: null,
      currentOffset: { gridX: 0, gridY: 0 },
      ghostPosition: null,
    });
    hasDraggedRef.current = false;
  }, []);

  return {
    dragState,
    startDrag,
    updateDrag,
    endDrag,
    cancelDrag,
    isDragging: dragState.isDragging,
    draggedObjects: dragState.draggedObjects,
    ghostPosition: dragState.ghostPosition,
  };
};
```

#### 11.2 Selection Manager Component

**SelectionManager.tsx - Multi-Select & Visual Feedback:**

```typescript
import React from "react";
import type { SelectionBox } from "../types/restaurant-canvas.types";

interface SelectionManagerProps {
  selectionBox: SelectionBox | null;
  selectedObjects: string[];
}

export const SelectionManager: React.FC<SelectionManagerProps> = ({
  selectionBox,
  selectedObjects,
}) => {
  return (
    <div className="selection-manager">
      {/* Selection Box (rubber band selection) */}
      {selectionBox && (
        <div
          className="selection-box"
          style={{
            position: "absolute",
            left: `${Math.min(selectionBox.start.x, selectionBox.end.x)}px`,
            top: `${Math.min(selectionBox.start.y, selectionBox.end.y)}px`,
            width: `${Math.abs(selectionBox.end.x - selectionBox.start.x)}px`,
            height: `${Math.abs(selectionBox.end.y - selectionBox.start.y)}px`,
            border: "2px dashed #007bff",
            backgroundColor: "rgba(0, 123, 255, 0.1)",
            pointerEvents: "none",
            zIndex: 1000,
          }}
        />
      )}

      {/* Selection Count Display */}
      {selectedObjects.length > 1 && (
        <div className="selection-count-badge">
          {selectedObjects.length} objects selected
        </div>
      )}
    </div>
  );
};
```

This documentation is getting comprehensive! I'm covering all the essential components systematically. Should I continue with:

- **Booking Integration System** (real-time status updates)
- **Database Integration Patterns** (save/load operations)
- **CSS Styling Guide** (complete visual styling)
- **Performance Optimization** (for large floor plans)
- **Mobile Touch Handling** (advanced touch gestures)
- **Testing Strategies** (unit tests and integration tests)

Let me know which sections you'd like me to focus on next!

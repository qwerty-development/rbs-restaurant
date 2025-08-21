# 🎯 ULTIMATE CANVAS IMPLEMENTATION GUIDE

## Complete Documentation for Restaurant Floor Plan Management System

> **MISSION**: Transform a traditional restaurant booking management system into an intuitive, canvas-based floor plan editor with drag-and-drop table management, real-time zoom controls, and professional restaurant layout capabilities.

---

## 📋 TABLE OF CONTENTS

### **PART I: SYSTEM ARCHITECTURE & ANALYSIS**

1. [Canvas System Overview](#1-canvas-system-overview)
2. [Core Technical Concepts](#2-core-technical-concepts)
3. [Restaurant-Specific Adaptations](#3-restaurant-specific-adaptations)
4. [Integration Strategy](#4-integration-strategy)

### **PART II: IMPLEMENTATION ROADMAP**

5. [Pre-Implementation Analysis](#5-pre-implementation-analysis)
6. [File Structure & Dependencies](#6-file-structure--dependencies)
7. [Core Component Architecture](#7-core-component-architecture)
8. [State Management Strategy](#8-state-management-strategy)

### **PART III: STEP-BY-STEP IMPLEMENTATION**

9. [Canvas Foundation Setup](#9-canvas-foundation-setup)
10. [Grid System Implementation](#10-grid-system-implementation)
11. [Zoom & Pan Controls](#11-zoom--pan-controls)
12. [Table & Chair Components](#12-table--chair-components)

### **PART IV: RESTAURANT-SPECIFIC FEATURES**

13. [Drag & Drop Functionality](#13-drag--drop-functionality)
14. [Booking Status Integration](#14-booking-status-integration)
15. [Database Integration](#15-database-integration)
16. [Real-time Updates](#16-real-time-updates)

### **PART V: ADVANCED FEATURES**

17. [Multi-Floor Support](#17-multi-floor-support)
18. [Table Management Tools](#18-table-management-tools)
19. [Export & Import Layouts](#19-export--import-layouts)
20. [Mobile Optimization](#20-mobile-optimization)

### **PART VI: TESTING & DEPLOYMENT**

21. [Testing Strategy](#21-testing-strategy)
22. [Performance Optimization](#22-performance-optimization)
23. [Troubleshooting Guide](#23-troubleshooting-guide)
24. [Deployment Checklist](#24-deployment-checklist)

---

## 🎯 PART I: SYSTEM ARCHITECTURE & ANALYSIS

### 1. CANVAS SYSTEM OVERVIEW

#### 1.1 Current Canvas Architecture Analysis

**Core Components Hierarchy:**

```
InfiniteCanvas (Main Container)
├── Canvas Div (Transform Container)
│   ├── Grid Pattern (Visual Reference)
│   ├── Grid Lines (Debug/Development)
│   ├── Coordinate Labels (Debug)
│   └── Addition Components (QwertyLogo, DancingCat, BitcoinPrice)
├── Instruction Overlay (User Guidance)
├── Zoom Controls (Mobile)
└── Debug Panel (Development)
```

**Key Technical Specifications:**

- **Canvas Size**: 10,000px × 10,000px virtual space
- **Grid System**: 400px cells with center at (5000, 5000)
- **Zoom Range**: 0.2x to 2.0x (20% to 200%)
- **Transform Method**: CSS translate() + scale()
- **Event Handling**: Mouse, Touch, Keyboard supported

#### 1.2 Restaurant System Requirements

**Essential Adaptations Needed:**

1. **Replace Static Components** → Dynamic Table/Chair Objects
2. **Add Object Manipulation** → Drag, Resize, Rotate functionality
3. **Implement Persistence** → Database save/load capabilities
4. **Real-time Status** → Live booking status updates
5. **Multi-User Support** → Concurrent editing capabilities

**Restaurant-Specific Features:**

- **Table Types**: Round, Square, Rectangular, Bar tables
- **Chair Management**: Individual chair positioning
- **Capacity Display**: Visual seat count indicators
- **Status Colors**: Available, Occupied, Reserved states
- **Time-based Views**: Different layouts per time slot

### 2. CORE TECHNICAL CONCEPTS

#### 2.1 Coordinate System Deep Dive

**Grid-to-Pixel Conversion Formula:**

```javascript
// Current System
const gridToPixel = (gridX: number, gridY: number) => {
  return {
    x: GRID.centerX + gridX * GRID.cellSize, // 5000 + (gridX * 400)
    y: GRID.centerY + gridY * GRID.cellSize, // 5000 + (gridY * 400)
  };
};

// Restaurant Adaptation
const restaurantGridToPixel = (
  gridX: number,
  gridY: number,
  floorPlan: FloorPlan
) => {
  return {
    x: floorPlan.centerX + gridX * floorPlan.cellSize,
    y: floorPlan.centerY + gridY * floorPlan.cellSize,
  };
};
```

**Pixel-to-Grid Conversion (New for Restaurant):**

```javascript
const pixelToGrid = (pixelX: number, pixelY: number, floorPlan: FloorPlan) => {
  return {
    gridX: Math.round((pixelX - floorPlan.centerX) / floorPlan.cellSize),
    gridY: Math.round((pixelY - floorPlan.centerY) / floorPlan.cellSize),
  };
};
```

#### 2.2 Transform Mathematics

**Current Transform System:**

```css
transform: `translate(${position.x}px, ${position.y}px) scale(${zoomLevel}) `;
```

**Enhanced Restaurant Transform:**

```javascript
const buildTransform = (position, zoom, rotation = 0) => {
  return `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`;
};
```

#### 2.3 Event Handling Architecture

**Current Event Flow:**

```
User Input → Event Listener → State Update → Re-render → Visual Update
```

**Restaurant Event Flow:**

```
User Input → Event Validation → Object Selection → Action Processing → Database Update → State Sync → Visual Update
```

### 3. RESTAURANT-SPECIFIC ADAPTATIONS

#### 3.1 Data Structure Evolution

**Current Addition Structure:**

```javascript
const ADDITIONS = [
  { component: QwertyLogo, gridX: 0, gridY: 0, label: "QWERTY Logo" },
];
```

**Restaurant Table Structure:**

```javascript
const RESTAURANT_OBJECTS = [
  {
    id: "table_001",
    type: "table",
    subType: "round", // round, square, rectangular, bar
    gridX: 2,
    gridY: 3,
    rotation: 0,
    seats: 4,
    status: "available", // available, occupied, reserved
    reservations: [
      {
        timeSlot: "19:00",
        customerName: "John Doe",
        partySize: 2,
        status: "confirmed",
      },
    ],
    metadata: {
      created: "2024-01-15T10:30:00Z",
      lastModified: "2024-01-15T14:20:00Z",
      createdBy: "manager_001",
    },
  },
];
```

#### 3.2 Component Evolution

**Current Component Pattern:**

```jsx
export default function QwertyLogo() {
  return (
    <div className="p-6 border-2 border-qwerty-dark-blue rounded-xl shadow-lg">
      {/* Static content */}
    </div>
  );
}
```

**Restaurant Component Pattern:**

```jsx
export default function RestaurantTable({
  table,
  isSelected,
  onSelect,
  onMove,
  onResize,
  zoom,
}) {
  return (
    <div
      className={`restaurant-table ${table.subType} ${table.status} ${
        isSelected ? "selected" : ""
      }`}
      style={{
        transform: `rotate(${table.rotation}deg)`,
        "--seat-count": table.seats,
      }}
      onClick={() => onSelect(table.id)}
      onMouseDown={(e) => onMove(e, table.id)}
    >
      {/* Dynamic content based on table properties */}
    </div>
  );
}
```

### 4. INTEGRATION STRATEGY

#### 4.1 Phased Implementation Approach

**Phase 1: Foundation (Week 1)**

- Replace canvas content with basic table components
- Implement basic drag functionality
- Add table selection capabilities

**Phase 2: Core Features (Week 2)**

- Add zoom and pan controls
- Implement grid snapping
- Create table management toolbar

**Phase 3: Restaurant Features (Week 3)**

- Add booking status integration
- Implement real-time updates
- Create table properties panel

**Phase 4: Advanced Features (Week 4)**

- Multi-floor support
- Export/import capabilities
- Mobile optimization

#### 4.2 Backward Compatibility Strategy

**Legacy System Integration:**

```javascript
// Wrapper component to maintain existing API
const LegacyFloorPlanWrapper = ({ legacyData }) => {
  const canvasData = convertLegacyToCanvas(legacyData);
  return <RestaurantCanvas data={canvasData} />;
};

const convertLegacyToCanvas = (legacyData) => {
  return legacyData.tables.map((table) => ({
    // Convert legacy table format to canvas format
  }));
};
```

---

## 🛠️ PART II: IMPLEMENTATION ROADMAP

### 5. PRE-IMPLEMENTATION ANALYSIS

#### 5.1 Current System Audit Checklist

**Before starting implementation, the AI agent must analyze:**

```markdown
□ Current database schema for tables/reservations
□ Existing UI components and styling system
□ State management approach (Redux, Context, etc.)
□ API endpoints for table management
□ Authentication and authorization system
□ Real-time update mechanism (WebSocket, polling)
□ Mobile responsiveness requirements
□ Browser compatibility requirements
□ Performance constraints and requirements
□ Existing testing framework
```

#### 5.2 Dependency Analysis

**Required Dependencies to Add:**

```json
{
  "dependencies": {
    "react": "^18.x.x",
    "react-dom": "^18.x.x",
    "@types/react": "^18.x.x",
    "@types/react-dom": "^18.x.x"
  },
  "recommended": {
    "react-dnd": "^16.x.x", // Advanced drag & drop
    "react-dnd-html5-backend": "^16.x.x",
    "uuid": "^9.x.x", // Unique IDs for tables
    "lodash": "^4.x.x", // Utility functions
    "date-fns": "^2.x.x" // Date manipulation
  },
  "optional": {
    "fabric": "^5.x.x", // Advanced canvas manipulation
    "konva": "^9.x.x", // 2D canvas library alternative
    "react-konva": "^18.x.x"
  }
}
```

#### 5.3 File Structure Planning

**Recommended Project Structure:**

```
src/
├── components/
│   ├── restaurant-canvas/
│   │   ├── RestaurantCanvas.tsx          // Main canvas component
│   │   ├── CanvasControls.tsx            // Zoom, pan controls
│   │   ├── GridSystem.tsx                // Grid rendering logic
│   │   ├── SelectionManager.tsx          // Object selection logic
│   │   └── hooks/
│   │       ├── useCanvasTransform.ts     // Transform state management
│   │       ├── useObjectSelection.ts     // Selection logic
│   │       ├── useDragDrop.ts            // Drag & drop logic
│   │       └── useCanvasEvents.ts        // Event handling
│   ├── restaurant-objects/
│   │   ├── RestaurantTable.tsx           // Table component
│   │   ├── RestaurantChair.tsx           // Chair component
│   │   ├── TableProperties.tsx           // Table edit panel
│   │   └── ObjectToolbar.tsx             // Object manipulation tools
│   ├── floor-plan/
│   │   ├── FloorPlanManager.tsx          // Floor plan CRUD
│   │   ├── FloorPlanSelector.tsx         // Multi-floor switching
│   │   └── FloorPlanExporter.tsx         // Export/import functionality
│   └── booking-integration/
│       ├── BookingStatusOverlay.tsx      // Real-time booking status
│       ├── ReservationPanel.tsx          // Reservation management
│       └── TimeSlotManager.tsx           // Time-based views
├── hooks/
│   ├── restaurant-canvas/
│   │   ├── useRestaurantCanvas.ts        // Main canvas hook
│   │   ├── useTableManagement.ts         // Table CRUD operations
│   │   ├── useBookingIntegration.ts      // Booking system integration
│   │   └── useFloorPlanPersistence.ts    // Save/load functionality
├── types/
│   ├── restaurant-canvas.types.ts        // Canvas-specific types
│   ├── table.types.ts                    // Table and chair types
│   ├── booking.types.ts                  // Booking-related types
│   └── floor-plan.types.ts               // Floor plan types
├── utils/
│   ├── canvas/
│   │   ├── coordinate-conversion.ts      // Grid/pixel conversions
│   │   ├── transform-calculations.ts     // Transform math
│   │   ├── collision-detection.ts        // Object collision logic
│   │   └── snap-to-grid.ts               // Grid snapping utilities
│   ├── restaurant/
│   │   ├── table-factory.ts              // Table creation utilities
│   │   ├── layout-validator.ts           // Layout validation
│   │   └── capacity-calculator.ts        // Seating calculations
├── constants/
│   ├── canvas-config.ts                  // Canvas configuration
│   ├── table-types.ts                    // Table type definitions
│   └── restaurant-defaults.ts            // Default values
└── styles/
    ├── restaurant-canvas.css             // Canvas-specific styles
    ├── restaurant-objects.css            // Table/chair styles
    └── responsive-canvas.css             // Mobile adaptations
```

### 6. FILE STRUCTURE & DEPENDENCIES

#### 6.1 Core Configuration Files

**Canvas Configuration (`constants/canvas-config.ts`):**

```typescript
export const RESTAURANT_CANVAS_CONFIG = {
  // Grid system
  GRID: {
    cellSize: 40, // Smaller cells for restaurant precision
    centerX: 2000, // Smaller canvas for restaurant space
    centerY: 2000,
    showGridLines: true,
    showCoordinates: false, // Hide in production
    snapToGrid: true, // Enable snap-to-grid by default
  },

  // Zoom configuration
  ZOOM: {
    min: 0.1, // Allow more zoom out for overview
    max: 3.0, // Allow more zoom in for detail
    step: 0.1,
    default: 1.0,
    wheelSensitivity: 0.01,
  },

  // Canvas dimensions
  CANVAS: {
    width: 4000, // Smaller virtual canvas
    height: 4000,
    backgroundColor: "#f8f9fa",
  },

  // Table defaults
  TABLE_DEFAULTS: {
    minSize: { width: 2, height: 2 }, // Grid units
    maxSize: { width: 8, height: 8 },
    defaultSeats: 4,
    colors: {
      available: "#28a745",
      occupied: "#dc3545",
      reserved: "#ffc107",
      selected: "#007bff",
    },
  },

  // Animation settings
  ANIMATIONS: {
    dragDuration: 200,
    selectionDuration: 150,
    zoomDuration: 300,
  },
};
```

**Type Definitions (`types/restaurant-canvas.types.ts`):**

```typescript
// Core canvas types
export interface CanvasPosition {
  x: number;
  y: number;
}

export interface GridCoordinate {
  gridX: number;
  gridY: number;
}

export interface CanvasTransform {
  position: CanvasPosition;
  zoom: number;
  rotation?: number;
}

// Restaurant object types
export interface RestaurantObject {
  id: string;
  type: "table" | "chair" | "decoration" | "wall" | "door";
  position: GridCoordinate;
  size: { width: number; height: number };
  rotation: number;
  zIndex: number;
  metadata: {
    created: string;
    lastModified: string;
    createdBy: string;
  };
}

export interface RestaurantTable extends RestaurantObject {
  type: "table";
  subType: "round" | "square" | "rectangular" | "bar";
  seats: number;
  maxSeats: number;
  status: TableStatus;
  reservations: Reservation[];
  chairs: RestaurantChair[];
}

export interface RestaurantChair extends RestaurantObject {
  type: "chair";
  tableId: string;
  occupied: boolean;
  customerInfo?: CustomerInfo;
}

export type TableStatus =
  | "available"
  | "occupied"
  | "reserved"
  | "out-of-order";

// Booking integration types
export interface Reservation {
  id: string;
  tableId: string;
  timeSlot: string;
  duration: number; // minutes
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  partySize: number;
  status: "confirmed" | "pending" | "cancelled" | "completed";
  specialRequests?: string;
  created: string;
  lastModified: string;
}

// Floor plan types
export interface FloorPlan {
  id: string;
  name: string;
  description: string;
  canvasConfig: typeof RESTAURANT_CANVAS_CONFIG;
  objects: RestaurantObject[];
  metadata: {
    version: string;
    created: string;
    lastModified: string;
    createdBy: string;
  };
}

// Canvas state management
export interface CanvasState {
  transform: CanvasTransform;
  selectedObjects: string[];
  isDragging: boolean;
  isSelecting: boolean;
  dragStartPos: CanvasPosition | null;
  selectionBox: SelectionBox | null;
  clipboard: RestaurantObject[];
  history: CanvasHistoryEntry[];
  historyIndex: number;
}

export interface SelectionBox {
  start: CanvasPosition;
  end: CanvasPosition;
}

export interface CanvasHistoryEntry {
  id: string;
  action: string;
  timestamp: string;
  beforeState: Partial<CanvasState>;
  afterState: Partial<CanvasState>;
}
```

### 7. CORE COMPONENT ARCHITECTURE

#### 7.1 Main Canvas Component Structure

**RestaurantCanvas.tsx - Main Component:**

```typescript
import React, { useRef, useState, useEffect, useCallback } from "react";
import { RESTAURANT_CANVAS_CONFIG } from "../constants/canvas-config";
import { useRestaurantCanvas } from "../hooks/useRestaurantCanvas";
import { useCanvasEvents } from "../hooks/useCanvasEvents";
import { GridSystem } from "./GridSystem";
import { CanvasControls } from "./CanvasControls";
import { SelectionManager } from "./SelectionManager";
import { RestaurantTable } from "../restaurant-objects/RestaurantTable";
import { ObjectToolbar } from "../restaurant-objects/ObjectToolbar";
import type { FloorPlan, CanvasState } from "../types/restaurant-canvas.types";

interface RestaurantCanvasProps {
  floorPlan: FloorPlan;
  onFloorPlanUpdate: (floorPlan: FloorPlan) => void;
  readOnly?: boolean;
  showBookingStatus?: boolean;
  currentTimeSlot?: string;
  className?: string;
}

export const RestaurantCanvas: React.FC<RestaurantCanvasProps> = ({
  floorPlan,
  onFloorPlanUpdate,
  readOnly = false,
  showBookingStatus = true,
  currentTimeSlot,
  className = "",
}) => {
  // Refs
  const canvasRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Canvas state management
  const {
    canvasState,
    updateTransform,
    selectObjects,
    deselectAll,
    moveObjects,
    deleteObjects,
    duplicateObjects,
    undoAction,
    redoAction,
  } = useRestaurantCanvas(floorPlan, onFloorPlanUpdate);

  // Event handling
  const {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    handleKeyDown,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = useCanvasEvents({
    canvasRef,
    canvasState,
    updateTransform,
    selectObjects,
    moveObjects,
    readOnly,
  });

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);

    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Canvas transform style
  const canvasStyle: React.CSSProperties = {
    width: `${RESTAURANT_CANVAS_CONFIG.CANVAS.width}px`,
    height: `${RESTAURANT_CANVAS_CONFIG.CANVAS.height}px`,
    transform: `translate(${canvasState.transform.position.x}px, ${canvasState.transform.position.y}px) scale(${canvasState.transform.zoom})`,
    backgroundColor: RESTAURANT_CANVAS_CONFIG.CANVAS.backgroundColor,
    cursor: canvasState.isDragging ? "grabbing" : "grab",
  };

  // Render restaurant objects
  const renderRestaurantObjects = useCallback(() => {
    return floorPlan.objects.map((object) => {
      switch (object.type) {
        case "table":
          return (
            <RestaurantTable
              key={object.id}
              table={object as RestaurantTable}
              isSelected={canvasState.selectedObjects.includes(object.id)}
              zoom={canvasState.transform.zoom}
              showBookingStatus={showBookingStatus}
              currentTimeSlot={currentTimeSlot}
              readOnly={readOnly}
              onSelect={(id) => selectObjects([id])}
              onMove={(delta) => moveObjects([object.id], delta)}
            />
          );
        // Add other object types as needed
        default:
          return null;
      }
    });
  }, [
    floorPlan.objects,
    canvasState,
    showBookingStatus,
    currentTimeSlot,
    readOnly,
  ]);

  return (
    <div
      ref={containerRef}
      className={`restaurant-canvas-container ${className}`}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Main Canvas */}
      <div
        ref={canvasRef}
        className="restaurant-canvas"
        style={canvasStyle}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {/* Grid System */}
        <GridSystem
          config={floorPlan.canvasConfig.GRID}
          zoom={canvasState.transform.zoom}
        />

        {/* Restaurant Objects */}
        {renderRestaurantObjects()}

        {/* Selection Manager */}
        <SelectionManager
          selectionBox={canvasState.selectionBox}
          selectedObjects={canvasState.selectedObjects}
        />
      </div>

      {/* Canvas Controls */}
      <CanvasControls
        canvasState={canvasState}
        onZoomIn={() =>
          updateTransform({
            zoom: Math.min(
              canvasState.transform.zoom + 0.1,
              RESTAURANT_CANVAS_CONFIG.ZOOM.max
            ),
          })
        }
        onZoomOut={() =>
          updateTransform({
            zoom: Math.max(
              canvasState.transform.zoom - 0.1,
              RESTAURANT_CANVAS_CONFIG.ZOOM.min
            ),
          })
        }
        onResetZoom={() =>
          updateTransform({ zoom: RESTAURANT_CANVAS_CONFIG.ZOOM.default })
        }
        onCenter={() => updateTransform({ position: { x: 0, y: 0 } })}
        onUndo={undoAction}
        onRedo={redoAction}
        showMobileControls={isMobile}
        readOnly={readOnly}
      />

      {/* Object Toolbar */}
      {!readOnly && canvasState.selectedObjects.length > 0 && (
        <ObjectToolbar
          selectedObjects={canvasState.selectedObjects}
          onDelete={() => deleteObjects(canvasState.selectedObjects)}
          onDuplicate={() => duplicateObjects(canvasState.selectedObjects)}
          onDeselectAll={deselectAll}
        />
      )}
    </div>
  );
};

export default RestaurantCanvas;
```

This is just the beginning! I'm creating the foundation with the main canvas component. Should I continue with the next sections? I can build out:

1. **Custom Hooks Implementation** (useRestaurantCanvas, useCanvasEvents, etc.)
2. **Table and Chair Components** with drag & drop
3. **Grid System and Transform Logic**
4. **Booking Integration Components**
5. **Database Integration Patterns**
6. **Complete Code Examples**

Would you like me to continue with specific sections, or should I complete the entire documentation systematically?

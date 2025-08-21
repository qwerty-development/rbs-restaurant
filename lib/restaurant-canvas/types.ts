// lib/restaurant-canvas/types.ts

// ============================================================================
// CORE CANVAS TYPES
// ============================================================================

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

// ============================================================================
// RESTAURANT OBJECT TYPES (Compatible with existing schema)
// ============================================================================

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

// Extended table interface matching your existing restaurant_tables schema
export interface RestaurantTable extends RestaurantObject {
  type: "table";
  subType: "booth" | "window" | "patio" | "standard" | "bar" | "private";
  seats: number;
  minSeats: number;
  maxSeats: number;
  status: TableStatus;
  reservations: Reservation[];
  chairs: RestaurantChair[];
  
  // Additional properties from your existing schema
  table_number: string;
  min_capacity: number;
  max_capacity: number;
  is_active: boolean;
  features: string[] | null;
  is_combinable: boolean;
  combinable_with: string[];
  priority_score: number;
  shape: "rectangle" | "circle" | "square";
  
  // Canvas-specific properties
  pixelPosition?: CanvasPosition; // Computed from grid position
}

export interface RestaurantChair extends RestaurantObject {
  type: "chair";
  tableId: string;
  occupied: boolean;
  customerInfo?: CustomerInfo;
}

// Status type matching your existing booking system
export type TableStatus = 
  | "available" 
  | "occupied" 
  | "reserved" 
  | "out-of-order";

// ============================================================================
// BOOKING INTEGRATION TYPES (Compatible with existing bookings table)
// ============================================================================

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
  
  // From your existing booking schema
  booking_time: string;
  user_id: string | null;
  restaurant_id: string;
  occasion: string | null;
  confirmation_code: string;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
}

export interface CustomerInfo {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  preferences?: string[];
  vipStatus?: boolean;
}

// ============================================================================
// FLOOR PLAN TYPES
// ============================================================================

export interface FloorPlan {
  id: string;
  name: string;
  description: string;
  restaurantId: string;
  canvasConfig: typeof import('./canvas-config').RESTAURANT_CANVAS_CONFIG;
  objects: RestaurantObject[];
  metadata: {
    version: string;
    created: string;
    lastModified: string;
    createdBy: string;
  };
}

// ============================================================================
// CANVAS STATE MANAGEMENT
// ============================================================================

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
  viewportBounds: ViewportBounds;
}

export interface SelectionBox {
  start: CanvasPosition;
  end: CanvasPosition;
}

export interface ViewportBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface CanvasHistoryEntry {
  id: string;
  action: string;
  timestamp: string;
  beforeState: Partial<CanvasState>;
  afterState: Partial<CanvasState>;
  description: string;
}

// ============================================================================
// EVENT HANDLING TYPES
// ============================================================================

export interface DragState {
  isDragging: boolean;
  draggedObjects: string[];
  startPosition: CanvasPosition | null;
  currentOffset: GridCoordinate;
  ghostPosition: GridCoordinate | null;
}

export interface TouchGestureState {
  isGesturing: boolean;
  initialDistance: number;
  initialZoom: number;
  touches: TouchPoint[];
}

export interface TouchPoint {
  id: number;
  x: number;
  y: number;
}

// ============================================================================
// COMPONENT PROPS INTERFACES
// ============================================================================

export interface RestaurantCanvasProps {
  floorPlan: FloorPlan;
  onFloorPlanUpdate: (floorPlan: FloorPlan) => void;
  readOnly?: boolean;
  showBookingStatus?: boolean;
  currentTimeSlot?: string;
  className?: string;
  
  // Integration with your existing system
  restaurantId: string;
  userId: string;
  onTableClick?: (table: RestaurantTable, statusInfo: any) => void;
  onStatusUpdate?: (bookingId: string, newStatus: string) => void;
  onTableSwitch?: (bookingId: string, newTableIds: string[]) => void;
  onCheckIn?: (bookingId: string, tableIds: string[]) => void;
  searchQuery?: string;
}

export interface RestaurantTableProps {
  table: RestaurantTable;
  isSelected: boolean;
  zoom: number;
  showBookingStatus: boolean;
  currentTimeSlot?: string;
  readOnly: boolean;
  onSelect: (id: string) => void;
  onMove: (delta: GridCoordinate) => void;
  onDoubleClick?: (id: string) => void;
  
  // Your existing integrations
  bookings?: any[];
  customersData?: Record<string, any>;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface TableCreationOptions {
  subType: RestaurantTable['subType'];
  position: GridCoordinate;
  seats: number;
  rotation?: number;
  customId?: string;
  table_number?: string;
}

export interface TableValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface CoordinateConversion {
  gridToPixel: (gridX: number, gridY: number) => CanvasPosition;
  pixelToGrid: (pixelX: number, pixelY: number) => GridCoordinate;
}

// ============================================================================
// API INTEGRATION TYPES
// ============================================================================

export interface BookingIntegrationState {
  currentTimeSlot: string;
  reservations: Reservation[];
  tableStatuses: Record<string, TableStatus>;
  isLoading: boolean;
  lastUpdate: string;
}

export interface PersistenceState {
  isSaving: boolean;
  isLoading: boolean;
  lastSaved: string | null;
  hasUnsavedChanges: boolean;
  saveError: string | null;
}

// ============================================================================
// LEGACY COMPATIBILITY TYPES
// ============================================================================

// Type for converting your existing table data to canvas format
export interface LegacyTableData {
  id: string;
  restaurant_id: string;
  table_number: string;
  table_type: "booth" | "window" | "patio" | "standard" | "bar" | "private";
  capacity: number;
  x_position: number;
  y_position: number;
  shape: "rectangle" | "circle" | "square";
  width: number;
  height: number;
  is_active: boolean;
  features: string[] | null;
  min_capacity: number;
  max_capacity: number;
  is_combinable: boolean;
  combinable_with: string[];
  priority_score: number;
  created_at: string;
}

// Type for converting existing booking data
export interface LegacyBookingData {
  id: string;
  user_id: string | null;
  restaurant_id: string;
  booking_time: string;
  party_size: number;
  status: string;
  special_requests: string | null;
  occasion: string | null;
  confirmation_code: string;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  tables?: Array<{
    id: string;
    table_number: string;
  }>;
  user?: {
    full_name: string;
    phone_number: string;
  } | null;
}

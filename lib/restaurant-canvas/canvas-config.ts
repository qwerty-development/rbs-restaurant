// lib/restaurant-canvas/canvas-config.ts
export const RESTAURANT_CANVAS_CONFIG = {
  // Grid system - adapted to your existing coordinate system
  GRID: {
    cellSize: 20, // Smaller cells for restaurant precision (20px per grid unit)
    centerX: 2000, // Canvas center - can be adjusted based on your floor plan size
    centerY: 2000,
    showGridLines: true,
    showCoordinates: false, // Hide in production
    snapToGrid: true, // Enable snap-to-grid by default
  },

  // Zoom configuration - optimized for restaurant tablet use
  ZOOM: {
    min: 0.2, // Allow zoom out for full floor overview
    max: 3.0, // Allow detailed zoom for precise positioning
    step: 0.1,
    default: 1.0,
    wheelSensitivity: 0.01,
  },

  // Canvas dimensions - suitable for restaurant floor plans
  CANVAS: {
    width: 4000, // 4000px virtual canvas
    height: 4000,
    backgroundColor: "#f8f9fa",
  },

  // Table defaults - aligned with your existing table types
  TABLE_DEFAULTS: {
    minSize: { width: 2, height: 2 }, // Minimum 2x2 grid units
    maxSize: { width: 8, height: 8 }, // Maximum 8x8 grid units
    defaultSeats: 4,
    colors: {
      available: "#28a745",
      occupied: "#dc3545", 
      reserved: "#ffc107",
      'out-of-order': "#6c757d",
      selected: "#007bff",
    },
  },

  // Animation settings for smooth interactions
  ANIMATIONS: {
    dragDuration: 200,
    selectionDuration: 150,
    zoomDuration: 300,
  },

  // Performance settings
  PERFORMANCE: {
    virtualizeThreshold: 50, // Start virtualizing with 50+ tables
    renderBatchSize: 10, // Render 10 tables per frame
    maxHistorySize: 50, // Keep last 50 actions for undo/redo
  },
};

// Table type configuration matching your existing schema
export const TABLE_TYPE_CONFIG = {
  booth: { 
    label: "Booth", 
    color: "#4f46e5", 
    defaultSeats: 4,
    defaultSize: { width: 4, height: 2 }
  },
  window: { 
    label: "Window", 
    color: "#059669", 
    defaultSeats: 2,
    defaultSize: { width: 3, height: 3 }
  },
  patio: { 
    label: "Patio", 
    color: "#dc2626", 
    defaultSeats: 6,
    defaultSize: { width: 4, height: 4 }
  },
  standard: { 
    label: "Standard", 
    color: "#6b7280", 
    defaultSeats: 4,
    defaultSize: { width: 3, height: 3 }
  },
  bar: { 
    label: "Bar", 
    color: "#7c3aed", 
    defaultSeats: 8,
    defaultSize: { width: 6, height: 1 }
  },
  private: { 
    label: "Private", 
    color: "#be185d", 
    defaultSeats: 6,
    defaultSize: { width: 4, height: 4 }
  },
};

// Shape configuration
export const SHAPE_CONFIG = {
  rectangle: { label: "Rectangle", defaultRatio: 1.5 },
  circle: { label: "Circle", defaultRatio: 1.0 },
  square: { label: "Square", defaultRatio: 1.0 },
};

// Status configuration matching your booking system
export const STATUS_CONFIG = {
  available: {
    label: "Available",
    color: "#28a745",
    icon: "✅",
    priority: 1
  },
  occupied: {
    label: "Occupied", 
    color: "#dc3545",
    icon: "👥",
    priority: 4
  },
  reserved: {
    label: "Reserved",
    color: "#ffc107", 
    icon: "🏷️",
    priority: 3
  },
  'out-of-order': {
    label: "Out of Order",
    color: "#6c757d",
    icon: "🚫", 
    priority: 2
  }
};

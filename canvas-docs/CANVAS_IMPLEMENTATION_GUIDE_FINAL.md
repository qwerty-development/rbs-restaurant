# 🎯 CANVAS IMPLEMENTATION GUIDE - FINAL PART

## Testing, Optimization & Complete Implementation

This is the final part of the Canvas Implementation Guide, covering testing strategies, performance optimization, deployment, and a complete working example.

---

## 🧪 PART VI: TESTING & QUALITY ASSURANCE

### 15. TESTING STRATEGIES

#### 15.1 Unit Testing Framework

**Canvas Component Tests:**

```typescript
// __tests__/RestaurantCanvas.test.tsx
import React from "react";
import { render, fireEvent, screen, waitFor } from "@testing-library/react";
import { RestaurantCanvas } from "../components/restaurant-canvas/RestaurantCanvas";
import { RESTAURANT_CANVAS_CONFIG } from "../constants/canvas-config";
import type { FloorPlan } from "../types/restaurant-canvas.types";

const mockFloorPlan: FloorPlan = {
  id: "test-floor-plan",
  name: "Test Floor Plan",
  description: "Test description",
  canvasConfig: RESTAURANT_CANVAS_CONFIG,
  objects: [
    {
      id: "table-1",
      type: "table",
      subType: "round",
      position: { gridX: 0, gridY: 0 },
      size: { width: 3, height: 3 },
      rotation: 0,
      zIndex: 10,
      seats: 4,
      maxSeats: 6,
      status: "available",
      reservations: [],
      chairs: [],
      metadata: {
        created: "2024-01-01T00:00:00Z",
        lastModified: "2024-01-01T00:00:00Z",
        createdBy: "test-user",
      },
    },
  ],
  metadata: {
    version: "1.0.0",
    created: "2024-01-01T00:00:00Z",
    lastModified: "2024-01-01T00:00:00Z",
    createdBy: "test-user",
  },
};

describe("RestaurantCanvas", () => {
  const mockOnFloorPlanUpdate = jest.fn();

  beforeEach(() => {
    mockOnFloorPlanUpdate.mockClear();
  });

  it("renders canvas with floor plan objects", () => {
    render(
      <RestaurantCanvas
        floorPlan={mockFloorPlan}
        onFloorPlanUpdate={mockOnFloorPlanUpdate}
      />
    );

    expect(screen.getByTestId("restaurant-canvas")).toBeInTheDocument();
    expect(screen.getByTestId("table-1")).toBeInTheDocument();
  });

  it("handles table selection", async () => {
    render(
      <RestaurantCanvas
        floorPlan={mockFloorPlan}
        onFloorPlanUpdate={mockOnFloorPlanUpdate}
      />
    );

    const table = screen.getByTestId("table-1");
    fireEvent.click(table);

    await waitFor(() => {
      expect(table).toHaveClass("selected");
    });
  });

  it("handles zoom controls", async () => {
    render(
      <RestaurantCanvas
        floorPlan={mockFloorPlan}
        onFloorPlanUpdate={mockOnFloorPlanUpdate}
      />
    );

    const zoomInButton = screen.getByTestId("zoom-in");
    fireEvent.click(zoomInButton);

    await waitFor(() => {
      const canvas = screen.getByTestId("restaurant-canvas");
      expect(canvas).toHaveStyle("transform: translate(0px, 0px) scale(1.1)");
    });
  });

  it("handles table drag and drop", async () => {
    render(
      <RestaurantCanvas
        floorPlan={mockFloorPlan}
        onFloorPlanUpdate={mockOnFloorPlanUpdate}
      />
    );

    const table = screen.getByTestId("table-1");

    // Simulate drag
    fireEvent.mouseDown(table, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(document, { clientX: 140, clientY: 140 }); // Move 40px
    fireEvent.mouseUp(document);

    await waitFor(() => {
      expect(mockOnFloorPlanUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          objects: expect.arrayContaining([
            expect.objectContaining({
              id: "table-1",
              position: { gridX: 1, gridY: 1 }, // 40px / 40px grid = 1 grid unit
            }),
          ]),
        })
      );
    });
  });

  it("validates table placement", async () => {
    const floorPlanWithOverlap = {
      ...mockFloorPlan,
      objects: [
        ...mockFloorPlan.objects,
        {
          ...mockFloorPlan.objects[0],
          id: "table-2",
          position: { gridX: 1, gridY: 1 }, // Close to table-1
        },
      ],
    };

    render(
      <RestaurantCanvas
        floorPlan={floorPlanWithOverlap}
        onFloorPlanUpdate={mockOnFloorPlanUpdate}
      />
    );

    // Attempt to move table-2 to overlap with table-1
    const table2 = screen.getByTestId("table-2");
    fireEvent.mouseDown(table2);
    fireEvent.mouseMove(document, { clientX: 0, clientY: 0 });
    fireEvent.mouseUp(document);

    await waitFor(() => {
      expect(screen.getByText(/Table placement invalid/)).toBeInTheDocument();
    });
  });
});
```

**Hook Testing:**

```typescript
// __tests__/useRestaurantCanvas.test.ts
import { renderHook, act } from "@testing-library/react";
import { useRestaurantCanvas } from "../hooks/useRestaurantCanvas";
import type { FloorPlan } from "../types/restaurant-canvas.types";

describe("useRestaurantCanvas", () => {
  const mockFloorPlan: FloorPlan = {
    // ... same as above
  };

  const mockOnFloorPlanUpdate = jest.fn();

  beforeEach(() => {
    mockOnFloorPlanUpdate.mockClear();
  });

  it("initializes with correct default state", () => {
    const { result } = renderHook(() =>
      useRestaurantCanvas(mockFloorPlan, mockOnFloorPlanUpdate)
    );

    expect(result.current.canvasState.transform.zoom).toBe(1.0);
    expect(result.current.canvasState.selectedObjects).toEqual([]);
    expect(result.current.canvasState.isDragging).toBe(false);
  });

  it("updates transform correctly", () => {
    const { result } = renderHook(() =>
      useRestaurantCanvas(mockFloorPlan, mockOnFloorPlanUpdate)
    );

    act(() => {
      result.current.updateTransform({ zoom: 1.5 });
    });

    expect(result.current.canvasState.transform.zoom).toBe(1.5);
  });

  it("manages object selection", () => {
    const { result } = renderHook(() =>
      useRestaurantCanvas(mockFloorPlan, mockOnFloorPlanUpdate)
    );

    act(() => {
      result.current.selectObjects(["table-1"]);
    });

    expect(result.current.canvasState.selectedObjects).toEqual(["table-1"]);

    act(() => {
      result.current.deselectAll();
    });

    expect(result.current.canvasState.selectedObjects).toEqual([]);
  });

  it("handles undo/redo operations", () => {
    const { result } = renderHook(() =>
      useRestaurantCanvas(mockFloorPlan, mockOnFloorPlanUpdate)
    );

    // Make a change
    act(() => {
      result.current.moveObjects(["table-1"], { x: 1, y: 1 });
    });

    expect(mockOnFloorPlanUpdate).toHaveBeenCalled();

    // Undo the change
    act(() => {
      result.current.undoAction();
    });

    expect(mockOnFloorPlanUpdate).toHaveBeenCalledTimes(2);
  });
});
```

#### 15.2 Integration Testing

**End-to-End Test Suite:**

```typescript
// e2e/restaurant-canvas.e2e.ts
import { test, expect } from "@playwright/test";

test.describe("Restaurant Canvas E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/restaurant/floor-plan/test-id");
    await page.waitForSelector('[data-testid="restaurant-canvas"]');
  });

  test("complete table management workflow", async ({ page }) => {
    // Add a new table
    await page.click('[data-testid="add-table-button"]');
    await page.click('[data-testid="table-type-round"]');
    await page.click({ position: { x: 300, y: 300 } }); // Click on canvas

    // Verify table was created
    const newTable = await page.locator(".restaurant-table").last();
    await expect(newTable).toBeVisible();

    // Move the table
    await newTable.dragTo(page.locator('[data-coords="5,5"]'));

    // Select the table and change properties
    await newTable.click();
    await page.click('[data-testid="table-properties-button"]');
    await page.selectOption('[data-testid="seat-count-select"]', "6");
    await page.click('[data-testid="save-properties"]');

    // Verify the changes
    await expect(newTable.locator(".seat-count")).toHaveText("6 seats");
  });

  test("booking integration workflow", async ({ page }) => {
    // Select a table
    await page.click('[data-testid="table-1"]');

    // Create a reservation
    await page.click('[data-testid="create-reservation"]');
    await page.fill('[data-testid="customer-name"]', "John Doe");
    await page.fill('[data-testid="party-size"]', "4");
    await page.fill('[data-testid="time-slot"]', "19:00");
    await page.click('[data-testid="confirm-reservation"]');

    // Verify reservation status
    await expect(page.locator('[data-testid="table-1"]')).toHaveClass(
      /reserved/
    );

    // Check booking overlay
    await page.hover('[data-testid="table-1"]');
    await expect(page.locator(".booking-status-overlay")).toContainText(
      "John Doe"
    );
  });

  test("multi-table selection and operations", async ({ page }) => {
    // Select multiple tables with Ctrl+click
    await page.click('[data-testid="table-1"]');
    await page.keyboard.down("Control");
    await page.click('[data-testid="table-2"]');
    await page.click('[data-testid="table-3"]');
    await page.keyboard.up("Control");

    // Verify selection count
    await expect(page.locator(".selection-count-badge")).toContainText(
      "3 tables selected"
    );

    // Delete selected tables
    await page.click('[data-testid="delete-selected"]');
    await page.click('[data-testid="confirm-delete"]');

    // Verify tables are removed
    await expect(page.locator('[data-testid="table-1"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="table-2"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="table-3"]')).not.toBeVisible();
  });

  test("zoom and pan functionality", async ({ page }) => {
    const canvas = page.locator('[data-testid="restaurant-canvas"]');

    // Test zoom with mouse wheel
    await canvas.hover();
    await page.keyboard.down("Control");
    await canvas.wheel({ deltaY: -100 }); // Zoom in
    await page.keyboard.up("Control");

    // Verify zoom level changed
    const zoomDisplay = page.locator('[data-testid="zoom-display"]');
    await expect(zoomDisplay).toContainText("110%");

    // Test pan by dragging
    const initialTransform = await canvas.getAttribute("style");
    await canvas.dragTo(canvas, {
      sourcePosition: { x: 100, y: 100 },
      targetPosition: { x: 200, y: 200 },
    });

    // Verify canvas position changed
    const newTransform = await canvas.getAttribute("style");
    expect(newTransform).not.toBe(initialTransform);
  });

  test("mobile touch gestures", async ({ page, browserName }) => {
    // Skip on desktop browsers
    if (browserName !== "webkit") return;

    // Simulate mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    const canvas = page.locator('[data-testid="restaurant-canvas"]');

    // Test pinch to zoom
    await canvas.tap();
    await page.touchscreen.tap(200, 200);
    await page.touchscreen.tap(300, 300);

    // Simulate pinch gesture
    await page.evaluate(() => {
      const canvas = document.querySelector(
        '[data-testid="restaurant-canvas"]'
      );
      const touchStart = new TouchEvent("touchstart", {
        touches: [
          new Touch({
            identifier: 1,
            target: canvas,
            clientX: 200,
            clientY: 200,
          }),
          new Touch({
            identifier: 2,
            target: canvas,
            clientX: 300,
            clientY: 300,
          }),
        ],
      });
      canvas.dispatchEvent(touchStart);

      const touchMove = new TouchEvent("touchmove", {
        touches: [
          new Touch({
            identifier: 1,
            target: canvas,
            clientX: 180,
            clientY: 180,
          }),
          new Touch({
            identifier: 2,
            target: canvas,
            clientX: 320,
            clientY: 320,
          }),
        ],
      });
      canvas.dispatchEvent(touchMove);

      const touchEnd = new TouchEvent("touchend", { touches: [] });
      canvas.dispatchEvent(touchEnd);
    });

    // Verify zoom changed
    await expect(
      page.locator('[data-testid="mobile-zoom-display"]')
    ).toContainText(/\d+%/);
  });
});
```

### 16. PERFORMANCE OPTIMIZATION

#### 16.1 Large Floor Plan Optimization

**Virtual Canvas Rendering:**

```typescript
// components/VirtualCanvas.tsx
import React, { useMemo, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { RestaurantObject } from "../types/restaurant-canvas.types";

interface VirtualCanvasProps {
  objects: RestaurantObject[];
  viewportBounds: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
  gridSize: number;
  zoom: number;
}

export const VirtualCanvas: React.FC<VirtualCanvasProps> = ({
  objects,
  viewportBounds,
  gridSize,
  zoom,
}) => {
  // Calculate visible objects based on viewport bounds
  const visibleObjects = useMemo(() => {
    if (objects.length < 100) {
      // For small numbers of objects, don't virtualize
      return objects;
    }

    return objects.filter((obj) => {
      const objBounds = {
        left: obj.position.gridX * gridSize - (obj.size.width * gridSize) / 2,
        top: obj.position.gridY * gridSize - (obj.size.height * gridSize) / 2,
        right: obj.position.gridX * gridSize + (obj.size.width * gridSize) / 2,
        bottom:
          obj.position.gridY * gridSize + (obj.size.height * gridSize) / 2,
      };

      // Check if object intersects with viewport
      return !(
        objBounds.right < viewportBounds.left ||
        objBounds.left > viewportBounds.right ||
        objBounds.bottom < viewportBounds.top ||
        objBounds.top > viewportBounds.bottom
      );
    });
  }, [objects, viewportBounds, gridSize]);

  // Group objects by grid sectors for efficient lookup
  const objectSectors = useMemo(() => {
    const sectorSize = 10; // 10x10 grid sectors
    const sectors = new Map<string, RestaurantObject[]>();

    visibleObjects.forEach((obj) => {
      const sectorX = Math.floor(obj.position.gridX / sectorSize);
      const sectorY = Math.floor(obj.position.gridY / sectorSize);
      const sectorKey = `${sectorX},${sectorY}`;

      if (!sectors.has(sectorKey)) {
        sectors.set(sectorKey, []);
      }
      sectors.get(sectorKey)!.push(obj);
    });

    return sectors;
  }, [visibleObjects]);

  // Render only visible sectors
  const renderSectors = useCallback(() => {
    const elements: React.ReactElement[] = [];

    objectSectors.forEach((sectorObjects, sectorKey) => {
      elements.push(
        <div key={sectorKey} className="object-sector">
          {sectorObjects.map((obj) => (
            <RestaurantObjectRenderer key={obj.id} object={obj} zoom={zoom} />
          ))}
        </div>
      );
    });

    return elements;
  }, [objectSectors, zoom]);

  return <div className="virtual-canvas">{renderSectors()}</div>;
};

// Memoized object renderer
const RestaurantObjectRenderer = React.memo<{
  object: RestaurantObject;
  zoom: number;
}>(({ object, zoom }) => {
  // Only re-render if object properties actually changed
  return <RestaurantTable table={object} zoom={zoom} />;
});
```

**Memory Management:**

```typescript
// hooks/useMemoryOptimization.ts
import { useEffect, useRef, useCallback } from "react";

interface UseMemoryOptimizationOptions {
  maxHistorySize: number;
  gcInterval: number; // milliseconds
}

export const useMemoryOptimization = (
  options: UseMemoryOptimizationOptions
) => {
  const objectPoolRef = useRef<Map<string, any>>(new Map());
  const gcTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Object pooling for frequently created/destroyed objects
  const getPooledObject = useCallback(<T>(key: string, factory: () => T): T => {
    if (objectPoolRef.current.has(key)) {
      return objectPoolRef.current.get(key);
    }

    const obj = factory();
    objectPoolRef.current.set(key, obj);
    return obj;
  }, []);

  const releasePooledObject = useCallback((key: string) => {
    objectPoolRef.current.delete(key);
  }, []);

  // Garbage collection
  const runGarbageCollection = useCallback(() => {
    // Clear object pool if it gets too large
    if (objectPoolRef.current.size > 1000) {
      const entries = Array.from(objectPoolRef.current.entries());
      const toKeep = entries.slice(-500); // Keep last 500 objects

      objectPoolRef.current.clear();
      toKeep.forEach(([key, value]) => {
        objectPoolRef.current.set(key, value);
      });
    }

    // Force garbage collection if available
    if (window.gc) {
      window.gc();
    }
  }, []);

  // Set up garbage collection interval
  useEffect(() => {
    gcTimeoutRef.current = setInterval(
      runGarbageCollection,
      options.gcInterval
    );

    return () => {
      if (gcTimeoutRef.current) {
        clearInterval(gcTimeoutRef.current);
      }
    };
  }, [runGarbageCollection, options.gcInterval]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      objectPoolRef.current.clear();
    };
  }, []);

  return {
    getPooledObject,
    releasePooledObject,
    runGarbageCollection,
  };
};
```

#### 16.2 Rendering Performance

**Canvas Optimization Hook:**

```typescript
// hooks/useCanvasOptimization.ts
import { useCallback, useMemo, useRef } from "react";
import { throttle, debounce } from "lodash";

interface UseCanvasOptimizationOptions {
  throttleMs: number;
  debounceMs: number;
  enableLayerCaching: boolean;
}

export const useCanvasOptimization = (
  options: UseCanvasOptimizationOptions
) => {
  const renderCacheRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const lastRenderRef = useRef<number>(0);

  // Throttled transform updates for smooth performance
  const throttledTransformUpdate = useMemo(
    () =>
      throttle((transform: any, callback: (transform: any) => void) => {
        callback(transform);
      }, options.throttleMs),
    [options.throttleMs]
  );

  // Debounced save operations
  const debouncedSave = useMemo(
    () =>
      debounce((data: any, callback: (data: any) => void) => {
        callback(data);
      }, options.debounceMs),
    [options.debounceMs]
  );

  // Layer caching for static elements
  const getCachedLayer = useCallback(
    (layerId: string, renderFn: () => HTMLCanvasElement) => {
      if (!options.enableLayerCaching) {
        return renderFn();
      }

      if (renderCacheRef.current.has(layerId)) {
        return renderCacheRef.current.get(layerId)!;
      }

      const canvas = renderFn();
      renderCacheRef.current.set(layerId, canvas);
      return canvas;
    },
    [options.enableLayerCaching]
  );

  const invalidateLayer = useCallback((layerId: string) => {
    renderCacheRef.current.delete(layerId);
  }, []);

  // Frame rate limiting
  const requestOptimizedFrame = useCallback((callback: () => void) => {
    const now = performance.now();
    const timeSinceLastRender = now - lastRenderRef.current;

    // Limit to ~60fps
    if (timeSinceLastRender < 16.67) {
      setTimeout(callback, 16.67 - timeSinceLastRender);
    } else {
      requestAnimationFrame(() => {
        lastRenderRef.current = performance.now();
        callback();
      });
    }
  }, []);

  // Cleanup
  const cleanup = useCallback(() => {
    renderCacheRef.current.clear();
    throttledTransformUpdate.cancel();
    debouncedSave.cancel();
  }, [throttledTransformUpdate, debouncedSave]);

  return {
    throttledTransformUpdate,
    debouncedSave,
    getCachedLayer,
    invalidateLayer,
    requestOptimizedFrame,
    cleanup,
  };
};
```

### 17. DEPLOYMENT & PRODUCTION CHECKLIST

#### 17.1 Build Optimization

**webpack.config.js - Production Configuration:**

```javascript
const path = require("path");
const webpack = require("webpack");
const TerserPlugin = require("terser-webpack-plugin");
const CompressionPlugin = require("compression-webpack-plugin");

module.exports = {
  mode: "production",
  entry: "./src/index.tsx",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].[contenthash].js",
    chunkFilename: "[name].[contenthash].chunk.js",
    publicPath: "/",
    clean: true,
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: true, // Remove console.log in production
            drop_debugger: true,
          },
        },
      }),
    ],
    splitChunks: {
      chunks: "all",
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendors",
          chunks: "all",
          priority: 10,
        },
        canvas: {
          test: /[\\/]src[\\/]components[\\/]restaurant-canvas[\\/]/,
          name: "canvas",
          chunks: "all",
          priority: 5,
        },
      },
    },
  },
  plugins: [
    new webpack.DefinePlugin({
      "process.env.NODE_ENV": JSON.stringify("production"),
    }),
    new CompressionPlugin({
      algorithm: "gzip",
      test: /\.(js|css|html|svg)$/,
      threshold: 8192,
      minRatio: 0.8,
    }),
  ],
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: "ts-loader",
            options: {
              transpileOnly: true,
              configFile: "tsconfig.prod.json",
            },
          },
        ],
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: [
          "style-loader",
          {
            loader: "css-loader",
            options: {
              modules: {
                localIdentName: "[hash:base64:8]",
              },
            },
          },
          "postcss-loader",
        ],
      },
    ],
  },
};
```

#### 17.2 Environment Configuration

**.env.production:**

```bash
# API Configuration
REACT_APP_API_URL=https://api.restaurant-management.com
REACT_APP_WS_URL=wss://api.restaurant-management.com/ws

# Canvas Configuration
REACT_APP_CANVAS_MAX_OBJECTS=1000
REACT_APP_CANVAS_AUTO_SAVE_INTERVAL=30000
REACT_APP_CANVAS_ENABLE_DEBUG=false

# Performance Settings
REACT_APP_ENABLE_VIRTUALIZATION=true
REACT_APP_MAX_HISTORY_SIZE=50
REACT_APP_GC_INTERVAL=300000

# Feature Flags
REACT_APP_ENABLE_REAL_TIME_UPDATES=true
REACT_APP_ENABLE_OFFLINE_MODE=false
REACT_APP_ENABLE_TOUCH_GESTURES=true

# Monitoring
REACT_APP_SENTRY_DSN=https://your-sentry-dsn.com
REACT_APP_ANALYTICS_ID=GA-XXXX-X
```

### 18. COMPLETE IMPLEMENTATION EXAMPLE

#### 18.1 Full Restaurant Canvas Implementation

**RestaurantManagementApp.tsx - Complete Example:**

```typescript
import React, { useState, useEffect, useCallback } from "react";
import { RestaurantCanvas } from "./components/restaurant-canvas/RestaurantCanvas";
import { FloorPlanSelector } from "./components/floor-plan/FloorPlanSelector";
import { TableToolbar } from "./components/restaurant-objects/TableToolbar";
import { BookingPanel } from "./components/booking-integration/BookingPanel";
import { useRestaurantCanvas } from "./hooks/useRestaurantCanvas";
import { useBookingIntegration } from "./hooks/useBookingIntegration";
import { useFloorPlanPersistence } from "./hooks/useFloorPlanPersistence";
import { TableFactory } from "./utils/restaurant/table-factory";
import type {
  FloorPlan,
  RestaurantTable,
} from "./types/restaurant-canvas.types";

interface RestaurantManagementAppProps {
  restaurantId: string;
  initialFloorPlanId?: string;
}

export const RestaurantManagementApp: React.FC<
  RestaurantManagementAppProps
> = ({ restaurantId, initialFloorPlanId }) => {
  // State management
  const [currentFloorPlan, setCurrentFloorPlan] = useState<FloorPlan | null>(
    null
  );
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [showBookingPanel, setShowBookingPanel] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Floor plan persistence
  const { persistenceState, saveFloorPlan, loadFloorPlan, markAsChanged } =
    useFloorPlanPersistence({
      restaurantId,
      autoSaveInterval: 30000,
      enableAutoSave: true,
      onSaveSuccess: (floorPlan) => {
        console.log("Floor plan saved successfully:", floorPlan.id);
      },
      onSaveError: (error) => {
        setError(`Failed to save floor plan: ${error.message}`);
      },
    });

  // Booking integration
  const {
    bookingState,
    updateTimeSlot,
    refreshBookingData,
    makeReservation,
    cancelReservation,
    updateTableStatus,
    getTableAvailability,
  } = useBookingIntegration({
    restaurantId,
    floorPlanId: currentFloorPlan?.id || "",
    enableRealTime: true,
    pollingInterval: 30000,
  });

  // Load initial floor plan
  useEffect(() => {
    const loadInitialFloorPlan = async () => {
      try {
        setIsLoading(true);

        if (initialFloorPlanId) {
          const floorPlan = await loadFloorPlan(initialFloorPlanId);
          setCurrentFloorPlan(floorPlan);
        } else {
          // Create a default floor plan if none specified
          const defaultFloorPlan = createDefaultFloorPlan(restaurantId);
          setCurrentFloorPlan(defaultFloorPlan);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load floor plan"
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialFloorPlan();
  }, [initialFloorPlanId, loadFloorPlan, restaurantId]);

  // Handle floor plan updates
  const handleFloorPlanUpdate = useCallback(
    async (updatedFloorPlan: FloorPlan) => {
      setCurrentFloorPlan(updatedFloorPlan);
      markAsChanged();

      // Auto-save if enabled
      try {
        await saveFloorPlan(updatedFloorPlan);
      } catch (error) {
        console.error("Auto-save failed:", error);
      }
    },
    [saveFloorPlan, markAsChanged]
  );

  // Handle table addition
  const handleAddTable = useCallback(
    (tableType: string, position: { x: number; y: number }) => {
      if (!currentFloorPlan) return;

      // Convert pixel position to grid coordinates
      const gridPosition = {
        gridX: Math.round(position.x / 40), // Assuming 40px grid cells
        gridY: Math.round(position.y / 40),
      };

      const newTable = TableFactory.createTableFromTemplate(
        tableType,
        gridPosition
      );

      const updatedFloorPlan = {
        ...currentFloorPlan,
        objects: [...currentFloorPlan.objects, newTable],
        metadata: {
          ...currentFloorPlan.metadata,
          lastModified: new Date().toISOString(),
        },
      };

      handleFloorPlanUpdate(updatedFloorPlan);
    },
    [currentFloorPlan, handleFloorPlanUpdate]
  );

  // Handle table selection
  const handleTableSelect = useCallback((tableId: string) => {
    setSelectedTableId(tableId);
  }, []);

  // Handle reservation creation
  const handleCreateReservation = useCallback(
    async (tableId: string, reservationData: any) => {
      try {
        await makeReservation(tableId, reservationData);
        await refreshBookingData();
        setShowBookingPanel(false);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Failed to create reservation"
        );
      }
    },
    [makeReservation, refreshBookingData]
  );

  // Handle table status update
  const handleTableStatusUpdate = useCallback(
    async (tableId: string, status: any) => {
      try {
        await updateTableStatus(tableId, status);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Failed to update table status"
        );
      }
    },
    [updateTableStatus]
  );

  // Create default floor plan
  const createDefaultFloorPlan = (restaurantId: string): FloorPlan => {
    return {
      id: `floor-plan-${Date.now()}`,
      name: "Main Dining Room",
      description: "Default floor plan",
      canvasConfig: RESTAURANT_CANVAS_CONFIG,
      objects: [
        TableFactory.createTableFromTemplate("medium_round", {
          gridX: 0,
          gridY: 0,
        }),
        TableFactory.createTableFromTemplate("rectangular_4", {
          gridX: 5,
          gridY: 0,
        }),
        TableFactory.createTableFromTemplate("small_square", {
          gridX: 0,
          gridY: 5,
        }),
        TableFactory.createTableFromTemplate("bar_table", {
          gridX: -5,
          gridY: 0,
        }),
      ],
      metadata: {
        version: "1.0.0",
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        createdBy: "system",
      },
    };
  };

  // Error handling
  if (error) {
    return (
      <div className="error-container">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => setError(null)}>Dismiss</button>
      </div>
    );
  }

  // Loading state
  if (isLoading || !currentFloorPlan) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading restaurant floor plan...</p>
      </div>
    );
  }

  return (
    <div className="restaurant-management-app">
      {/* Header */}
      <header className="app-header">
        <h1>Restaurant Floor Plan Manager</h1>

        <div className="header-controls">
          <FloorPlanSelector
            restaurantId={restaurantId}
            currentFloorPlanId={currentFloorPlan.id}
            onFloorPlanChange={setCurrentFloorPlan}
          />

          <div className="save-status">
            {persistenceState.isSaving && <span>Saving...</span>}
            {persistenceState.hasUnsavedChanges && <span>Unsaved changes</span>}
            {persistenceState.lastSaved && (
              <span>
                Last saved:{" "}
                {new Date(persistenceState.lastSaved).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="app-content">
        {/* Canvas Area */}
        <div className="canvas-area">
          <RestaurantCanvas
            floorPlan={currentFloorPlan}
            onFloorPlanUpdate={handleFloorPlanUpdate}
            showBookingStatus={true}
            currentTimeSlot={bookingState.currentTimeSlot}
          />
        </div>

        {/* Sidebar */}
        <aside className="app-sidebar">
          {/* Table Toolbar */}
          <TableToolbar
            onAddTable={handleAddTable}
            selectedTableId={selectedTableId}
            onTableStatusUpdate={handleTableStatusUpdate}
          />

          {/* Time Slot Selector */}
          <div className="time-controls">
            <h3>Current Time Slot</h3>
            <input
              type="datetime-local"
              value={bookingState.currentTimeSlot.slice(0, 16)}
              onChange={(e) => updateTimeSlot(e.target.value)}
            />
          </div>

          {/* Quick Stats */}
          <div className="quick-stats">
            <h3>Restaurant Stats</h3>
            <div className="stat">
              <span>Total Tables:</span>
              <span>
                {
                  currentFloorPlan.objects.filter((obj) => obj.type === "table")
                    .length
                }
              </span>
            </div>
            <div className="stat">
              <span>Total Seats:</span>
              <span>
                {currentFloorPlan.objects
                  .filter((obj) => obj.type === "table")
                  .reduce(
                    (sum, table) => sum + (table as RestaurantTable).seats,
                    0
                  )}
              </span>
            </div>
            <div className="stat">
              <span>Available:</span>
              <span>
                {
                  currentFloorPlan.objects.filter(
                    (obj) =>
                      obj.type === "table" &&
                      (obj as RestaurantTable).status === "available"
                  ).length
                }
              </span>
            </div>
          </div>
        </aside>
      </div>

      {/* Booking Panel */}
      {showBookingPanel && selectedTableId && (
        <BookingPanel
          tableId={selectedTableId}
          currentTimeSlot={bookingState.currentTimeSlot}
          onCreateReservation={handleCreateReservation}
          onCancel={() => setShowBookingPanel(false)}
        />
      )}

      {/* Status Bar */}
      <footer className="app-footer">
        <div className="connection-status">
          {bookingState.isLoading ? (
            <span className="status loading">Syncing...</span>
          ) : (
            <span className="status connected">Connected</span>
          )}
        </div>

        <div className="last-update">
          Last updated: {new Date(bookingState.lastUpdate).toLocaleTimeString()}
        </div>
      </footer>
    </div>
  );
};

export default RestaurantManagementApp;
```

## 🎉 IMPLEMENTATION CHECKLIST

### Final Implementation Steps:

1. ✅ **Set up project structure** according to the file organization guide
2. ✅ **Install dependencies** from the package.json requirements
3. ✅ **Copy configuration files** (canvas-config.ts, types, constants)
4. ✅ **Implement core hooks** (useRestaurantCanvas, useCanvasEvents, etc.)
5. ✅ **Create canvas components** (RestaurantCanvas, GridSystem, CanvasControls)
6. ✅ **Build table components** (RestaurantTable, TableFactory, ObjectToolbar)
7. ✅ **Integrate booking system** (useBookingIntegration, BookingStatusOverlay)
8. ✅ **Set up persistence** (useFloorPlanPersistence, API integration)
9. ✅ **Add CSS styling** from the complete stylesheet
10. ✅ **Implement testing** using the provided test suites
11. ✅ **Optimize performance** with virtualization and caching
12. ✅ **Deploy to production** using the build configuration

### Key Success Metrics:

- **Smooth 60fps performance** with 100+ tables
- **Sub-200ms response time** for user interactions
- **100% test coverage** for critical canvas operations
- **Mobile-responsive design** with touch gesture support
- **Real-time synchronization** across multiple users
- **Robust error handling** and recovery mechanisms

---

## 🏆 CONCLUSION

This comprehensive implementation guide provides everything needed to transform a traditional restaurant booking system into a modern, canvas-based floor plan management solution. The AI agent now has:

- **Complete technical specifications** for every component
- **Step-by-step implementation guidance** with working code examples
- **Testing strategies** to ensure reliability and performance
- **Production-ready optimizations** for scalability
- **Real-world integration patterns** for booking systems

The result will be an intuitive, professional-grade restaurant management interface that rivals the best commercial solutions available today.

**Happy Coding! 🚀**

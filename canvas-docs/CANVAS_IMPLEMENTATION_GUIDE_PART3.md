# 🎯 CANVAS IMPLEMENTATION GUIDE - PART 3

## Booking Integration & Database Patterns

This is Part 3 of the Canvas Implementation Guide, focusing on real-time booking integration, database patterns, and advanced restaurant features.

---

## 🍽️ PART V: BOOKING INTEGRATION SYSTEM

### 12. REAL-TIME BOOKING STATUS INTEGRATION

#### 12.1 Booking Status Manager

**useBookingIntegration.ts - Real-time Booking Hook:**

```typescript
import { useState, useEffect, useCallback, useRef } from "react";
import type {
  RestaurantTable,
  Reservation,
  TableStatus,
} from "../types/restaurant-canvas.types";

interface BookingState {
  currentTimeSlot: string;
  reservations: Reservation[];
  tableStatuses: Record<string, TableStatus>;
  isLoading: boolean;
  lastUpdate: string;
}

interface UseBookingIntegrationOptions {
  restaurantId: string;
  floorPlanId: string;
  pollingInterval?: number; // milliseconds
  enableRealTime?: boolean; // WebSocket support
}

interface UseBookingIntegrationReturn {
  bookingState: BookingState;
  updateTimeSlot: (timeSlot: string) => void;
  refreshBookingData: () => Promise<void>;
  makeReservation: (
    tableId: string,
    reservation: Partial<Reservation>
  ) => Promise<void>;
  cancelReservation: (reservationId: string) => Promise<void>;
  updateTableStatus: (tableId: string, status: TableStatus) => Promise<void>;
  getTableAvailability: (tableId: string, timeSlot: string) => boolean;
  getReservationsForTable: (
    tableId: string,
    timeSlot?: string
  ) => Reservation[];
}

export const useBookingIntegration = (
  options: UseBookingIntegrationOptions
): UseBookingIntegrationReturn => {
  const [bookingState, setBookingState] = useState<BookingState>({
    currentTimeSlot: new Date().toISOString().slice(0, 16), // YYYY-MM-DDTHH:MM
    reservations: [],
    tableStatuses: {},
    isLoading: false,
    lastUpdate: new Date().toISOString(),
  });

  const wsRef = useRef<WebSocket | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize real-time connection
  useEffect(() => {
    if (options.enableRealTime) {
      initializeWebSocket();
    } else {
      initializePolling();
    }

    return () => {
      cleanup();
    };
  }, [options.restaurantId, options.floorPlanId]);

  const initializeWebSocket = useCallback(() => {
    const wsUrl = `ws://localhost:8080/booking-updates/${options.restaurantId}/${options.floorPlanId}`;

    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log("WebSocket connection established");
      refreshBookingData();
    };

    wsRef.current.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data);
        handleRealTimeUpdate(update);
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    wsRef.current.onclose = () => {
      console.log("WebSocket connection closed, attempting to reconnect...");
      setTimeout(initializeWebSocket, 5000); // Reconnect after 5 seconds
    };

    wsRef.current.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }, [options.restaurantId, options.floorPlanId]);

  const initializePolling = useCallback(() => {
    const interval = options.pollingInterval || 30000; // Default 30 seconds

    pollingIntervalRef.current = setInterval(() => {
      refreshBookingData();
    }, interval);

    // Initial load
    refreshBookingData();
  }, [options.pollingInterval]);

  const cleanup = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const handleRealTimeUpdate = useCallback((update: any) => {
    switch (update.type) {
      case "RESERVATION_CREATED":
      case "RESERVATION_UPDATED":
      case "RESERVATION_CANCELLED":
        setBookingState((prev) => ({
          ...prev,
          reservations: updateReservationInList(
            prev.reservations,
            update.reservation
          ),
          lastUpdate: new Date().toISOString(),
        }));
        break;

      case "TABLE_STATUS_CHANGED":
        setBookingState((prev) => ({
          ...prev,
          tableStatuses: {
            ...prev.tableStatuses,
            [update.tableId]: update.status,
          },
          lastUpdate: new Date().toISOString(),
        }));
        break;

      case "BULK_UPDATE":
        setBookingState((prev) => ({
          ...prev,
          reservations: update.reservations || prev.reservations,
          tableStatuses: update.tableStatuses || prev.tableStatuses,
          lastUpdate: new Date().toISOString(),
        }));
        break;
    }
  }, []);

  const updateReservationInList = (
    reservations: Reservation[],
    updatedReservation: Reservation
  ): Reservation[] => {
    const index = reservations.findIndex((r) => r.id === updatedReservation.id);

    if (index >= 0) {
      // Update existing reservation
      const newReservations = [...reservations];
      newReservations[index] = updatedReservation;
      return newReservations;
    } else {
      // Add new reservation
      return [...reservations, updatedReservation];
    }
  };

  const refreshBookingData = useCallback(async () => {
    setBookingState((prev) => ({ ...prev, isLoading: true }));

    try {
      const response = await fetch(
        `/api/restaurants/${options.restaurantId}/floor-plans/${options.floorPlanId}/bookings`
      );
      const data = await response.json();

      setBookingState((prev) => ({
        ...prev,
        reservations: data.reservations || [],
        tableStatuses: data.tableStatuses || {},
        isLoading: false,
        lastUpdate: new Date().toISOString(),
      }));
    } catch (error) {
      console.error("Error fetching booking data:", error);
      setBookingState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [options.restaurantId, options.floorPlanId]);

  const updateTimeSlot = useCallback((timeSlot: string) => {
    setBookingState((prev) => ({ ...prev, currentTimeSlot: timeSlot }));
  }, []);

  const makeReservation = useCallback(
    async (tableId: string, reservationData: Partial<Reservation>) => {
      try {
        const response = await fetch(
          `/api/restaurants/${options.restaurantId}/reservations`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...reservationData,
              tableId,
              floorPlanId: options.floorPlanId,
            }),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to create reservation");
        }

        const newReservation = await response.json();

        setBookingState((prev) => ({
          ...prev,
          reservations: [...prev.reservations, newReservation],
          lastUpdate: new Date().toISOString(),
        }));
      } catch (error) {
        console.error("Error creating reservation:", error);
        throw error;
      }
    },
    [options.restaurantId, options.floorPlanId]
  );

  const cancelReservation = useCallback(async (reservationId: string) => {
    try {
      const response = await fetch(`/api/reservations/${reservationId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to cancel reservation");
      }

      setBookingState((prev) => ({
        ...prev,
        reservations: prev.reservations.filter((r) => r.id !== reservationId),
        lastUpdate: new Date().toISOString(),
      }));
    } catch (error) {
      console.error("Error cancelling reservation:", error);
      throw error;
    }
  }, []);

  const updateTableStatus = useCallback(
    async (tableId: string, status: TableStatus) => {
      try {
        const response = await fetch(
          `/api/restaurants/${options.restaurantId}/tables/${tableId}/status`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to update table status");
        }

        setBookingState((prev) => ({
          ...prev,
          tableStatuses: {
            ...prev.tableStatuses,
            [tableId]: status,
          },
          lastUpdate: new Date().toISOString(),
        }));
      } catch (error) {
        console.error("Error updating table status:", error);
        throw error;
      }
    },
    [options.restaurantId]
  );

  const getTableAvailability = useCallback(
    (tableId: string, timeSlot: string): boolean => {
      // Check table status
      const tableStatus = bookingState.tableStatuses[tableId];
      if (tableStatus === "out-of-order") {
        return false;
      }

      // Check for existing reservations
      const existingReservation = bookingState.reservations.find(
        (r) =>
          r.tableId === tableId &&
          r.timeSlot === timeSlot &&
          r.status === "confirmed"
      );

      return !existingReservation;
    },
    [bookingState.tableStatuses, bookingState.reservations]
  );

  const getReservationsForTable = useCallback(
    (tableId: string, timeSlot?: string): Reservation[] => {
      return bookingState.reservations.filter((r) => {
        if (r.tableId !== tableId) return false;
        if (timeSlot && r.timeSlot !== timeSlot) return false;
        return r.status === "confirmed";
      });
    },
    [bookingState.reservations]
  );

  return {
    bookingState,
    updateTimeSlot,
    refreshBookingData,
    makeReservation,
    cancelReservation,
    updateTableStatus,
    getTableAvailability,
    getReservationsForTable,
  };
};
```

#### 12.2 Booking Status Overlay Component

**BookingStatusOverlay.tsx - Visual Status Indicators:**

```typescript
import React, { useMemo } from "react";
import type {
  RestaurantTable,
  Reservation,
} from "../types/restaurant-canvas.types";

interface BookingStatusOverlayProps {
  table: RestaurantTable;
  currentTimeSlot: string;
  reservations: Reservation[];
  onReservationClick?: (reservation: Reservation) => void;
  showDetails?: boolean;
}

export const BookingStatusOverlay: React.FC<BookingStatusOverlayProps> = ({
  table,
  currentTimeSlot,
  reservations,
  onReservationClick,
  showDetails = true,
}) => {
  const currentReservation = useMemo(() => {
    return reservations.find(
      (r) =>
        r.tableId === table.id &&
        r.timeSlot === currentTimeSlot &&
        r.status === "confirmed"
    );
  }, [reservations, table.id, currentTimeSlot]);

  const upcomingReservations = useMemo(() => {
    const currentTime = new Date(currentTimeSlot).getTime();
    return reservations
      .filter((r) => r.tableId === table.id && r.status === "confirmed")
      .filter((r) => new Date(r.timeSlot).getTime() > currentTime)
      .sort(
        (a, b) =>
          new Date(a.timeSlot).getTime() - new Date(b.timeSlot).getTime()
      )
      .slice(0, 3); // Show next 3 reservations
  }, [reservations, table.id, currentTimeSlot]);

  const getStatusIndicator = () => {
    if (table.status === "out-of-order") {
      return (
        <div className="status-indicator out-of-order">
          <span className="status-icon">🚫</span>
          <span className="status-text">Out of Order</span>
        </div>
      );
    }

    if (currentReservation) {
      return (
        <div
          className="status-indicator reserved"
          onClick={() => onReservationClick?.(currentReservation)}
          style={{ cursor: onReservationClick ? "pointer" : "default" }}
        >
          <span className="status-icon">🏷️</span>
          <span className="status-text">Reserved</span>
          {showDetails && (
            <div className="reservation-details">
              <div className="customer-name">
                {currentReservation.customerName}
              </div>
              <div className="party-size">
                {currentReservation.partySize} guests
              </div>
              <div className="time">
                {formatTime(currentReservation.timeSlot)}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (table.status === "occupied") {
      return (
        <div className="status-indicator occupied">
          <span className="status-icon">👥</span>
          <span className="status-text">Occupied</span>
        </div>
      );
    }

    return (
      <div className="status-indicator available">
        <span className="status-icon">✅</span>
        <span className="status-text">Available</span>
      </div>
    );
  };

  const formatTime = (timeSlot: string): string => {
    return new Date(timeSlot).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="booking-status-overlay">
      {/* Main Status */}
      {getStatusIndicator()}

      {/* Upcoming Reservations */}
      {showDetails && upcomingReservations.length > 0 && (
        <div className="upcoming-reservations">
          <div className="upcoming-header">Next:</div>
          {upcomingReservations.map((reservation) => (
            <div
              key={reservation.id}
              className="upcoming-reservation"
              onClick={() => onReservationClick?.(reservation)}
            >
              <span className="time">{formatTime(reservation.timeSlot)}</span>
              <span className="customer">{reservation.customerName}</span>
              <span className="party">({reservation.partySize})</span>
            </div>
          ))}
        </div>
      )}

      {/* Capacity Indicator */}
      <div className="capacity-indicator">
        <span className="seats-available">{table.seats}</span>
        <span className="seats-icon">💺</span>
      </div>
    </div>
  );
};
```

### 13. DATABASE INTEGRATION PATTERNS

#### 13.1 Floor Plan Persistence Service

**useFloorPlanPersistence.ts - Save/Load Operations:**

```typescript
import { useState, useCallback, useRef } from "react";
import type {
  FloorPlan,
  RestaurantObject,
} from "../types/restaurant-canvas.types";

interface PersistenceState {
  isSaving: boolean;
  isLoading: boolean;
  lastSaved: string | null;
  hasUnsavedChanges: boolean;
  saveError: string | null;
}

interface UseFloorPlanPersistenceOptions {
  restaurantId: string;
  autoSaveInterval?: number; // milliseconds
  enableAutoSave?: boolean;
  onSaveSuccess?: (floorPlan: FloorPlan) => void;
  onSaveError?: (error: Error) => void;
}

interface UseFloorPlanPersistenceReturn {
  persistenceState: PersistenceState;
  saveFloorPlan: (floorPlan: FloorPlan) => Promise<void>;
  loadFloorPlan: (floorPlanId: string) => Promise<FloorPlan>;
  deleteFloorPlan: (floorPlanId: string) => Promise<void>;
  duplicateFloorPlan: (
    floorPlanId: string,
    newName: string
  ) => Promise<FloorPlan>;
  exportFloorPlan: (
    floorPlanId: string,
    format: "json" | "pdf" | "image"
  ) => Promise<Blob>;
  importFloorPlan: (file: File) => Promise<FloorPlan>;
  markAsChanged: () => void;
  markAsSaved: () => void;
}

export const useFloorPlanPersistence = (
  options: UseFloorPlanPersistenceOptions
): UseFloorPlanPersistenceReturn => {
  const [persistenceState, setPersistenceState] = useState<PersistenceState>({
    isSaving: false,
    isLoading: false,
    lastSaved: null,
    hasUnsavedChanges: false,
    saveError: null,
  });

  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentFloorPlanRef = useRef<FloorPlan | null>(null);

  const saveFloorPlan = useCallback(
    async (floorPlan: FloorPlan): Promise<void> => {
      setPersistenceState((prev) => ({
        ...prev,
        isSaving: true,
        saveError: null,
      }));

      try {
        // Optimistic update
        currentFloorPlanRef.current = floorPlan;

        const response = await fetch(
          `/api/restaurants/${options.restaurantId}/floor-plans/${floorPlan.id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ...floorPlan,
              metadata: {
                ...floorPlan.metadata,
                lastModified: new Date().toISOString(),
              },
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to save floor plan: ${response.statusText}`);
        }

        const savedFloorPlan = await response.json();

        setPersistenceState((prev) => ({
          ...prev,
          isSaving: false,
          lastSaved: new Date().toISOString(),
          hasUnsavedChanges: false,
          saveError: null,
        }));

        options.onSaveSuccess?.(savedFloorPlan);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";

        setPersistenceState((prev) => ({
          ...prev,
          isSaving: false,
          saveError: errorMessage,
        }));

        options.onSaveError?.(error as Error);
        throw error;
      }
    },
    [options]
  );

  const loadFloorPlan = useCallback(
    async (floorPlanId: string): Promise<FloorPlan> => {
      setPersistenceState((prev) => ({
        ...prev,
        isLoading: true,
        saveError: null,
      }));

      try {
        const response = await fetch(
          `/api/restaurants/${options.restaurantId}/floor-plans/${floorPlanId}`
        );

        if (!response.ok) {
          throw new Error(`Failed to load floor plan: ${response.statusText}`);
        }

        const floorPlan = await response.json();
        currentFloorPlanRef.current = floorPlan;

        setPersistenceState((prev) => ({
          ...prev,
          isLoading: false,
          hasUnsavedChanges: false,
          lastSaved: floorPlan.metadata.lastModified,
        }));

        return floorPlan;
      } catch (error) {
        setPersistenceState((prev) => ({
          ...prev,
          isLoading: false,
          saveError:
            error instanceof Error ? error.message : "Unknown error occurred",
        }));

        throw error;
      }
    },
    [options.restaurantId]
  );

  const deleteFloorPlan = useCallback(
    async (floorPlanId: string): Promise<void> => {
      const response = await fetch(
        `/api/restaurants/${options.restaurantId}/floor-plans/${floorPlanId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete floor plan: ${response.statusText}`);
      }
    },
    [options.restaurantId]
  );

  const duplicateFloorPlan = useCallback(
    async (floorPlanId: string, newName: string): Promise<FloorPlan> => {
      const response = await fetch(
        `/api/restaurants/${options.restaurantId}/floor-plans/${floorPlanId}/duplicate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to duplicate floor plan: ${response.statusText}`
        );
      }

      return response.json();
    },
    [options.restaurantId]
  );

  const exportFloorPlan = useCallback(
    async (
      floorPlanId: string,
      format: "json" | "pdf" | "image"
    ): Promise<Blob> => {
      const response = await fetch(
        `/api/restaurants/${options.restaurantId}/floor-plans/${floorPlanId}/export?format=${format}`
      );

      if (!response.ok) {
        throw new Error(`Failed to export floor plan: ${response.statusText}`);
      }

      return response.blob();
    },
    [options.restaurantId]
  );

  const importFloorPlan = useCallback(
    async (file: File): Promise<FloorPlan> => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `/api/restaurants/${options.restaurantId}/floor-plans/import`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to import floor plan: ${response.statusText}`);
      }

      return response.json();
    },
    [options.restaurantId]
  );

  const markAsChanged = useCallback(() => {
    setPersistenceState((prev) => ({ ...prev, hasUnsavedChanges: true }));

    // Schedule auto-save if enabled
    if (options.enableAutoSave && currentFloorPlanRef.current) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      autoSaveTimeoutRef.current = setTimeout(() => {
        if (currentFloorPlanRef.current) {
          saveFloorPlan(currentFloorPlanRef.current);
        }
      }, options.autoSaveInterval || 30000); // Default 30 seconds
    }
  }, [options.enableAutoSave, options.autoSaveInterval, saveFloorPlan]);

  const markAsSaved = useCallback(() => {
    setPersistenceState((prev) => ({
      ...prev,
      hasUnsavedChanges: false,
      lastSaved: new Date().toISOString(),
    }));
  }, []);

  return {
    persistenceState,
    saveFloorPlan,
    loadFloorPlan,
    deleteFloorPlan,
    duplicateFloorPlan,
    exportFloorPlan,
    importFloorPlan,
    markAsChanged,
    markAsSaved,
  };
};
```

#### 13.2 API Integration Layer

**api-service.ts - Restaurant API Client:**

```typescript
class RestaurantApiService {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setAuthToken(token: string) {
    this.authToken = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const config: RequestInit = {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
        ...options.headers,
      },
    };

    const response = await fetch(url, config);

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Floor Plan Operations
  async getFloorPlans(restaurantId: string): Promise<FloorPlan[]> {
    return this.request(`/restaurants/${restaurantId}/floor-plans`);
  }

  async getFloorPlan(
    restaurantId: string,
    floorPlanId: string
  ): Promise<FloorPlan> {
    return this.request(
      `/restaurants/${restaurantId}/floor-plans/${floorPlanId}`
    );
  }

  async createFloorPlan(
    restaurantId: string,
    floorPlan: Partial<FloorPlan>
  ): Promise<FloorPlan> {
    return this.request(`/restaurants/${restaurantId}/floor-plans`, {
      method: "POST",
      body: JSON.stringify(floorPlan),
    });
  }

  async updateFloorPlan(
    restaurantId: string,
    floorPlanId: string,
    updates: Partial<FloorPlan>
  ): Promise<FloorPlan> {
    return this.request(
      `/restaurants/${restaurantId}/floor-plans/${floorPlanId}`,
      {
        method: "PUT",
        body: JSON.stringify(updates),
      }
    );
  }

  async deleteFloorPlan(
    restaurantId: string,
    floorPlanId: string
  ): Promise<void> {
    return this.request(
      `/restaurants/${restaurantId}/floor-plans/${floorPlanId}`,
      {
        method: "DELETE",
      }
    );
  }

  // Table Operations
  async getTables(
    restaurantId: string,
    floorPlanId: string
  ): Promise<RestaurantTable[]> {
    return this.request(
      `/restaurants/${restaurantId}/floor-plans/${floorPlanId}/tables`
    );
  }

  async createTable(
    restaurantId: string,
    floorPlanId: string,
    table: Partial<RestaurantTable>
  ): Promise<RestaurantTable> {
    return this.request(
      `/restaurants/${restaurantId}/floor-plans/${floorPlanId}/tables`,
      {
        method: "POST",
        body: JSON.stringify(table),
      }
    );
  }

  async updateTable(
    restaurantId: string,
    tableId: string,
    updates: Partial<RestaurantTable>
  ): Promise<RestaurantTable> {
    return this.request(`/restaurants/${restaurantId}/tables/${tableId}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  }

  async deleteTable(restaurantId: string, tableId: string): Promise<void> {
    return this.request(`/restaurants/${restaurantId}/tables/${tableId}`, {
      method: "DELETE",
    });
  }

  // Reservation Operations
  async getReservations(
    restaurantId: string,
    date?: string
  ): Promise<Reservation[]> {
    const query = date ? `?date=${date}` : "";
    return this.request(`/restaurants/${restaurantId}/reservations${query}`);
  }

  async createReservation(
    restaurantId: string,
    reservation: Partial<Reservation>
  ): Promise<Reservation> {
    return this.request(`/restaurants/${restaurantId}/reservations`, {
      method: "POST",
      body: JSON.stringify(reservation),
    });
  }

  async updateReservation(
    reservationId: string,
    updates: Partial<Reservation>
  ): Promise<Reservation> {
    return this.request(`/reservations/${reservationId}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  }

  async cancelReservation(reservationId: string): Promise<void> {
    return this.request(`/reservations/${reservationId}`, {
      method: "DELETE",
    });
  }

  // Real-time Updates
  createWebSocketConnection(
    restaurantId: string,
    floorPlanId: string
  ): WebSocket {
    const wsUrl = `${this.baseUrl.replace(
      "http",
      "ws"
    )}/restaurants/${restaurantId}/floor-plans/${floorPlanId}/updates`;
    return new WebSocket(wsUrl);
  }

  // Batch Operations
  async batchUpdateTables(
    restaurantId: string,
    updates: Array<{ id: string; updates: Partial<RestaurantTable> }>
  ): Promise<RestaurantTable[]> {
    return this.request(`/restaurants/${restaurantId}/tables/batch`, {
      method: "PUT",
      body: JSON.stringify({ updates }),
    });
  }

  async bulkCreateTables(
    restaurantId: string,
    floorPlanId: string,
    tables: Partial<RestaurantTable>[]
  ): Promise<RestaurantTable[]> {
    return this.request(
      `/restaurants/${restaurantId}/floor-plans/${floorPlanId}/tables/bulk`,
      {
        method: "POST",
        body: JSON.stringify({ tables }),
      }
    );
  }
}

// Export singleton instance
export const apiService = new RestaurantApiService(
  process.env.REACT_APP_API_URL || "/api"
);
```

### 14. COMPLETE CSS STYLING SYSTEM

#### 14.1 Restaurant Canvas Styles

**restaurant-canvas.css - Complete Styling:**

```css
/* Restaurant Canvas Container */
.restaurant-canvas-container {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: #f8f9fa;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

/* Main Canvas */
.restaurant-canvas {
  position: absolute;
  top: 0;
  left: 0;
  background: #ffffff;
  border: 1px solid #e9ecef;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.restaurant-canvas:focus {
  outline: none;
}

/* Grid System */
.grid-system {
  pointer-events: none;
  z-index: 1;
}

.grid-coordinates {
  position: absolute;
  background: rgba(255, 255, 255, 0.9);
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
  color: #6c757d;
  border: 1px solid #dee2e6;
}

/* Restaurant Table Styles */
.restaurant-table {
  position: absolute;
  user-select: none;
  transition: all 0.2s ease-in-out;
  z-index: 10;
}

.restaurant-table:hover {
  z-index: 15;
}

.restaurant-table.selected {
  z-index: 20;
}

.restaurant-table .table-shape {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease-in-out;
  cursor: grab;
}

.restaurant-table .table-shape:active {
  cursor: grabbing;
}

/* Table Types */
.restaurant-table.round .table-shape {
  border-radius: 50%;
}

.restaurant-table.square .table-shape {
  border-radius: 8px;
}

.restaurant-table.rectangular .table-shape {
  border-radius: 12px;
}

.restaurant-table.bar .table-shape {
  border-radius: 20px;
}

/* Table Status Colors */
.restaurant-table.available .table-shape {
  background: linear-gradient(135deg, #28a745, #20c997);
  border-color: #1e7e34;
}

.restaurant-table.occupied .table-shape {
  background: linear-gradient(135deg, #dc3545, #e74c3c);
  border-color: #bd2130;
}

.restaurant-table.reserved .table-shape {
  background: linear-gradient(135deg, #ffc107, #f39c12);
  border-color: #d39e00;
}

.restaurant-table.out-of-order .table-shape {
  background: linear-gradient(135deg, #6c757d, #495057);
  border-color: #495057;
}

/* Table Label */
.table-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: white;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  z-index: 2;
}

.table-number {
  font-size: 16px;
  line-height: 1;
}

.seat-count {
  font-size: 12px;
  opacity: 0.9;
  margin-top: 2px;
}

/* Selection Handles */
.selection-handles {
  position: absolute;
  top: -3px;
  left: -3px;
  right: -3px;
  bottom: -3px;
  pointer-events: none;
}

.selection-handles .handle {
  position: absolute;
  width: 8px;
  height: 8px;
  background: #007bff;
  border: 2px solid white;
  border-radius: 50%;
  cursor: pointer;
  pointer-events: all;
}

.selection-handles .handle.top-left {
  top: -4px;
  left: -4px;
  cursor: nw-resize;
}

.selection-handles .handle.top-right {
  top: -4px;
  right: -4px;
  cursor: ne-resize;
}

.selection-handles .handle.bottom-left {
  bottom: -4px;
  left: -4px;
  cursor: sw-resize;
}

.selection-handles .handle.bottom-right {
  bottom: -4px;
  right: -4px;
  cursor: se-resize;
}

/* Chair Indicators */
.chair-positions {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.chair-indicator {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}

/* Booking Status Overlay */
.booking-status-overlay {
  position: absolute;
  top: -40px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  white-space: nowrap;
  z-index: 100;
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s ease;
}

.restaurant-table:hover .booking-status-overlay {
  opacity: 1;
  visibility: visible;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.status-icon {
  font-size: 14px;
}

.reservation-details {
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  text-align: center;
}

.customer-name {
  font-weight: 600;
  margin-bottom: 2px;
}

.upcoming-reservations {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.upcoming-header {
  font-weight: 600;
  margin-bottom: 4px;
  font-size: 11px;
  opacity: 0.8;
}

.upcoming-reservation {
  display: flex;
  gap: 4px;
  margin-bottom: 2px;
  font-size: 11px;
}

/* Canvas Controls */
.canvas-controls {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 1000;
}

.desktop-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.control-group {
  display: flex;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.control-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  border: none;
  background: white;
  cursor: pointer;
  transition: background-color 0.2s ease;
  color: #495057;
}

.control-button:hover {
  background: #f8f9fa;
}

.control-button:active {
  background: #e9ecef;
}

.control-button.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.zoom-display {
  padding: 12px 16px;
  background: #f8f9fa;
  border: none;
  font-weight: 600;
  color: #495057;
  cursor: pointer;
  min-width: 70px;
}

/* Mobile Controls */
.mobile-controls {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  padding: 12px;
}

.mobile-control-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.mobile-control-row:last-child {
  margin-bottom: 0;
}

.mobile-control-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: none;
  background: #007bff;
  color: white;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 16px;
  font-weight: 600;
}

.mobile-control-button:hover {
  background: #0056b3;
  transform: translateY(-1px);
}

.mobile-control-button.disabled {
  background: #6c757d;
  cursor: not-allowed;
  transform: none;
}

.mobile-zoom-display {
  background: #f8f9fa;
  padding: 12px 16px;
  border-radius: 8px;
  font-weight: 600;
  color: #495057;
  min-width: 60px;
  text-align: center;
}

/* Object Toolbar */
.object-toolbar {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  min-width: 300px;
}

.toolbar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e9ecef;
  background: #f8f9fa;
  border-radius: 12px 12px 0 0;
}

.selection-count {
  font-weight: 600;
  color: #495057;
}

.expand-button,
.deselect-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  color: #6c757d;
}

.expand-button:hover,
.deselect-button:hover {
  background: rgba(0, 0, 0, 0.05);
}

.toolbar-content {
  padding: 16px;
}

.action-group {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.action-group:last-child {
  margin-bottom: 0;
}

.action-group label {
  font-weight: 600;
  color: #495057;
  margin-right: 8px;
  min-width: 60px;
}

.toolbar-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid #dee2e6;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 12px;
  color: #495057;
}

.toolbar-button:hover {
  background: #f8f9fa;
  border-color: #adb5bd;
}

.toolbar-button.delete {
  color: #dc3545;
  border-color: #dc3545;
}

.toolbar-button.delete:hover {
  background: #dc3545;
  color: white;
}

.toolbar-button.duplicate {
  color: #28a745;
  border-color: #28a745;
}

.toolbar-button.duplicate:hover {
  background: #28a745;
  color: white;
}

/* Selection Box */
.selection-box {
  border: 2px dashed #007bff;
  background: rgba(0, 123, 255, 0.1);
  pointer-events: none;
}

.selection-count-badge {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: #007bff;
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  z-index: 1000;
}

/* Responsive Design */
@media (max-width: 768px) {
  .desktop-controls {
    display: none;
  }

  .canvas-controls {
    position: static;
  }

  .object-toolbar {
    bottom: 100px;
    min-width: calc(100vw - 40px);
  }

  .toolbar-content {
    max-height: 200px;
    overflow-y: auto;
  }

  .action-group {
    flex-wrap: wrap;
  }
}

/* Loading States */
.restaurant-canvas-container.loading {
  pointer-events: none;
}

.restaurant-canvas-container.loading::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

/* Animations */
@keyframes tableSelect {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
}

.restaurant-table.just-selected {
  animation: tableSelect 0.3s ease-out;
}

@keyframes tableDrop {
  0% {
    transform: scale(1.1);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
}

.restaurant-table.just-dropped {
  animation: tableDrop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

Perfect! This documentation is getting incredibly comprehensive. I've covered:

✅ **Complete Canvas System Architecture**
✅ **Restaurant-Specific Components**
✅ **Advanced Drag & Drop System**
✅ **Real-time Booking Integration**
✅ **Database Persistence Patterns**
✅ **Complete CSS Styling System**

Should I continue with the final sections covering:

15. **Testing & Debugging Strategies** (Unit tests, integration tests, debugging tools)
16. **Performance Optimization** (Large floor plans, memory management)
17. **Mobile Touch Handling** (Advanced gestures, accessibility)
18. **Deployment & Production Checklist** (Build optimization, monitoring)
19. **Troubleshooting Guide** (Common issues and solutions)
20. **Complete Implementation Example** (Full working example)

Let me know which final sections you'd like me to complete to make this the ultimate implementation guide!

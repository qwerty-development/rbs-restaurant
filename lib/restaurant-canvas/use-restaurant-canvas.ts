// lib/restaurant-canvas/use-restaurant-canvas.ts
"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { RESTAURANT_CANVAS_CONFIG } from './canvas-config';
import { gridToPixel, convertLegacyTableToCanvas, convertCanvasTableToLegacy } from './coordinate-utils';
import type { 
  CanvasState, 
  CanvasTransform, 
  FloorPlan, 
  RestaurantTable, 
  GridCoordinate,
  CanvasHistoryEntry,
  ViewportBounds,
  LegacyTableData
} from './types';

interface UseRestaurantCanvasOptions {
  floorPlan: FloorPlan;
  onFloorPlanUpdate: (floorPlan: FloorPlan) => void;
  readOnly?: boolean;
}

interface UseRestaurantCanvasReturn {
  canvasState: CanvasState;
  updateTransform: (transform: Partial<CanvasTransform>) => void;
  selectObjects: (objectIds: string[], addToSelection?: boolean) => void;
  deselectAll: () => void;
  moveObjects: (objectIds: string[], delta: GridCoordinate) => void;
  deleteObjects: (objectIds: string[]) => void;
  duplicateObjects: (objectIds: string[]) => void;
  undoAction: () => void;
  redoAction: () => void;
  fitToView: () => void;
  resetView: () => void;
  addTable: (tableData: Partial<RestaurantTable>, position: GridCoordinate) => void;
  updateTable: (tableId: string, updates: Partial<RestaurantTable>) => void;
  setViewportBounds: (bounds: ViewportBounds) => void;
}

export const useRestaurantCanvas = ({
  floorPlan,
  onFloorPlanUpdate,
  readOnly = false
}: UseRestaurantCanvasOptions): UseRestaurantCanvasReturn => {
  
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  
  const [canvasState, setCanvasState] = useState<CanvasState>({
    transform: {
      position: { x: 0, y: 0 },
      zoom: RESTAURANT_CANVAS_CONFIG.ZOOM.default,
      rotation: 0,
    },
    selectedObjects: [],
    isDragging: false,
    isSelecting: false,
    dragStartPos: null,
    selectionBox: null,
    clipboard: [],
    history: [],
    historyIndex: -1,
    viewportBounds: { left: 0, top: 0, right: 0, bottom: 0 },
  });

  const historyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================================================
  // HISTORY MANAGEMENT
  // ============================================================================

  const addToHistory = useCallback((action: string, description: string) => {
    if (readOnly) return;

    // Clear any pending history addition
    if (historyTimeoutRef.current) {
      clearTimeout(historyTimeoutRef.current);
    }

    // Debounce history additions to avoid too many entries during dragging
    historyTimeoutRef.current = setTimeout(() => {
      setCanvasState(prev => {
        const historyEntry: CanvasHistoryEntry = {
          id: `history_${Date.now()}`,
          action,
          timestamp: new Date().toISOString(),
          beforeState: {
            selectedObjects: prev.selectedObjects,
            transform: prev.transform,
          },
          afterState: {
            selectedObjects: prev.selectedObjects,
            transform: prev.transform,
          },
          description,
        };

        // Trim history if it gets too long
        const newHistory = [...prev.history.slice(0, prev.historyIndex + 1), historyEntry];
        const trimmedHistory = newHistory.slice(-RESTAURANT_CANVAS_CONFIG.PERFORMANCE.maxHistorySize);

        return {
          ...prev,
          history: trimmedHistory,
          historyIndex: trimmedHistory.length - 1,
        };
      });
    }, 500); // 500ms debounce
  }, [readOnly]);

  // ============================================================================
  // TRANSFORM MANAGEMENT
  // ============================================================================

  const updateTransform = useCallback((newTransform: Partial<CanvasTransform>) => {
    setCanvasState(prev => ({
      ...prev,
      transform: {
        ...prev.transform,
        ...newTransform,
      },
    }));
  }, []);

  const fitToView = useCallback(() => {
    const tables = floorPlan.objects.filter(obj => obj.type === 'table') as RestaurantTable[];
    if (tables.length === 0) return;

    // Calculate bounds of all tables
    let minGridX = Infinity, maxGridX = -Infinity;
    let minGridY = Infinity, maxGridY = -Infinity;

    tables.forEach(table => {
      const halfWidth = table.size.width / 2;
      const halfHeight = table.size.height / 2;
      
      minGridX = Math.min(minGridX, table.position.gridX - halfWidth);
      maxGridX = Math.max(maxGridX, table.position.gridX + halfWidth);
      minGridY = Math.min(minGridY, table.position.gridY - halfHeight);
      maxGridY = Math.max(maxGridY, table.position.gridY + halfHeight);
    });

    const contentWidth = (maxGridX - minGridX) * RESTAURANT_CANVAS_CONFIG.GRID.cellSize;
    const contentHeight = (maxGridY - minGridY) * RESTAURANT_CANVAS_CONFIG.GRID.cellSize;

    // Assume a reasonable viewport size (will be updated by actual viewport)
    const viewportWidth = 1200;
    const viewportHeight = 800;

    const paddingFactor = 0.8;
    const zoomX = (viewportWidth * paddingFactor) / contentWidth;
    const zoomY = (viewportHeight * paddingFactor) / contentHeight;
    const zoom = Math.max(0.1, Math.min(zoomX, zoomY, RESTAURANT_CANVAS_CONFIG.ZOOM.max));

    // Center the content
    const centerGridX = (minGridX + maxGridX) / 2;
    const centerGridY = (minGridY + maxGridY) / 2;
    const centerPixel = gridToPixel(centerGridX, centerGridY);

    updateTransform({
      position: {
        x: -centerPixel.x + RESTAURANT_CANVAS_CONFIG.GRID.centerX,
        y: -centerPixel.y + RESTAURANT_CANVAS_CONFIG.GRID.centerY,
      },
      zoom,
    });

    addToHistory('fit-to-view', 'Fit all tables to view');
  }, [floorPlan.objects, updateTransform, addToHistory]);

  const resetView = useCallback(() => {
    updateTransform({
      position: { x: 0, y: 0 },
      zoom: RESTAURANT_CANVAS_CONFIG.ZOOM.default,
      rotation: 0,
    });
    addToHistory('reset-view', 'Reset view to default');
  }, [updateTransform, addToHistory]);

  // ============================================================================
  // SELECTION MANAGEMENT
  // ============================================================================

  const selectObjects = useCallback((objectIds: string[], addToSelection: boolean = false) => {
    setCanvasState(prev => ({
      ...prev,
      selectedObjects: addToSelection 
        ? [...new Set([...prev.selectedObjects, ...objectIds])]
        : objectIds,
    }));
  }, []);

  const deselectAll = useCallback(() => {
    setCanvasState(prev => ({
      ...prev,
      selectedObjects: [],
    }));
  }, []);

  // ============================================================================
  // OBJECT MANIPULATION
  // ============================================================================

  const moveObjects = useCallback((objectIds: string[], delta: GridCoordinate) => {
    if (readOnly || objectIds.length === 0) return;

    const updatedObjects = floorPlan.objects.map(obj => {
      if (objectIds.includes(obj.id)) {
        return {
          ...obj,
          position: {
            gridX: obj.position.gridX + delta.gridX,
            gridY: obj.position.gridY + delta.gridY,
          },
          metadata: {
            ...obj.metadata,
            lastModified: new Date().toISOString(),
          },
        };
      }
      return obj;
    });

    const updatedFloorPlan: FloorPlan = {
      ...floorPlan,
      objects: updatedObjects,
      metadata: {
        ...floorPlan.metadata,
        lastModified: new Date().toISOString(),
      },
    };

    onFloorPlanUpdate(updatedFloorPlan);
    addToHistory('move-objects', `Moved ${objectIds.length} object(s)`);
  }, [floorPlan, onFloorPlanUpdate, readOnly, addToHistory]);

  const deleteObjects = useCallback((objectIds: string[]) => {
    if (readOnly || objectIds.length === 0) return;

    const updatedObjects = floorPlan.objects.filter(obj => !objectIds.includes(obj.id));

    const updatedFloorPlan: FloorPlan = {
      ...floorPlan,
      objects: updatedObjects,
      metadata: {
        ...floorPlan.metadata,
        lastModified: new Date().toISOString(),
      },
    };

    onFloorPlanUpdate(updatedFloorPlan);
    deselectAll();
    addToHistory('delete-objects', `Deleted ${objectIds.length} object(s)`);
  }, [floorPlan, onFloorPlanUpdate, readOnly, deselectAll, addToHistory]);

  const duplicateObjects = useCallback((objectIds: string[]) => {
    if (readOnly || objectIds.length === 0) return;

    const objectsToDuplicate = floorPlan.objects.filter(obj => objectIds.includes(obj.id));
    const duplicatedObjects = objectsToDuplicate.map(obj => ({
      ...obj,
      id: `${obj.id}_copy_${Date.now()}`,
      position: {
        gridX: obj.position.gridX + 2, // Offset by 2 grid units
        gridY: obj.position.gridY + 2,
      },
      metadata: {
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        createdBy: obj.metadata.createdBy,
      },
    }));

    const updatedFloorPlan: FloorPlan = {
      ...floorPlan,
      objects: [...floorPlan.objects, ...duplicatedObjects],
      metadata: {
        ...floorPlan.metadata,
        lastModified: new Date().toISOString(),
      },
    };

    onFloorPlanUpdate(updatedFloorPlan);
    selectObjects(duplicatedObjects.map(obj => obj.id));
    addToHistory('duplicate-objects', `Duplicated ${objectIds.length} object(s)`);
  }, [floorPlan, onFloorPlanUpdate, readOnly, selectObjects, addToHistory]);

  const addTable = useCallback((tableData: Partial<RestaurantTable>, position: GridCoordinate) => {
    if (readOnly) return;

    const newTable: RestaurantTable = {
      id: `table_${Date.now()}`,
      type: 'table',
      subType: tableData.subType || 'standard',
      position,
      size: tableData.size || { width: 3, height: 3 },
      rotation: tableData.rotation || 0,
      zIndex: 10,
      seats: tableData.seats || 4,
      minSeats: tableData.minSeats || 2,
      maxSeats: tableData.maxSeats || 8,
      status: 'available',
      reservations: [],
      chairs: [],
      table_number: tableData.table_number || `T${Date.now()}`,
      min_capacity: tableData.min_capacity || 2,
      max_capacity: tableData.max_capacity || 8,
      is_active: true,
      features: tableData.features || [],
      is_combinable: tableData.is_combinable !== false,
      combinable_with: tableData.combinable_with || [],
      priority_score: tableData.priority_score || 0,
      shape: tableData.shape || 'rectangle',
      metadata: {
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        createdBy: 'canvas-user',
      },
    };

    const updatedFloorPlan: FloorPlan = {
      ...floorPlan,
      objects: [...floorPlan.objects, newTable],
      metadata: {
        ...floorPlan.metadata,
        lastModified: new Date().toISOString(),
      },
    };

    onFloorPlanUpdate(updatedFloorPlan);
    selectObjects([newTable.id]);
    addToHistory('add-table', `Added new ${newTable.subType} table`);
  }, [floorPlan, onFloorPlanUpdate, readOnly, selectObjects, addToHistory]);

  const updateTable = useCallback((tableId: string, updates: Partial<RestaurantTable>) => {
    if (readOnly) return;

    const updatedObjects = floorPlan.objects.map(obj => {
      if (obj.id === tableId && obj.type === 'table') {
        return {
          ...obj,
          ...updates,
          metadata: {
            ...obj.metadata,
            lastModified: new Date().toISOString(),
          },
        } as RestaurantTable;
      }
      return obj;
    });

    const updatedFloorPlan: FloorPlan = {
      ...floorPlan,
      objects: updatedObjects,
      metadata: {
        ...floorPlan.metadata,
        lastModified: new Date().toISOString(),
      },
    };

    onFloorPlanUpdate(updatedFloorPlan);
    addToHistory('update-table', `Updated table ${tableId}`);
  }, [floorPlan, onFloorPlanUpdate, readOnly, addToHistory]);

  // ============================================================================
  // UNDO/REDO FUNCTIONALITY
  // ============================================================================

  const undoAction = useCallback(() => {
    if (canvasState.historyIndex <= 0) return;

    setCanvasState(prev => ({
      ...prev,
      historyIndex: prev.historyIndex - 1,
      selectedObjects: prev.history[prev.historyIndex - 1]?.beforeState.selectedObjects || [],
      transform: prev.history[prev.historyIndex - 1]?.beforeState.transform || prev.transform,
    }));
  }, [canvasState.historyIndex]);

  const redoAction = useCallback(() => {
    if (canvasState.historyIndex >= canvasState.history.length - 1) return;

    setCanvasState(prev => ({
      ...prev,
      historyIndex: prev.historyIndex + 1,
      selectedObjects: prev.history[prev.historyIndex + 1]?.afterState.selectedObjects || [],
      transform: prev.history[prev.historyIndex + 1]?.afterState.transform || prev.transform,
    }));
  }, [canvasState.historyIndex, canvasState.history.length]);

  // ============================================================================
  // VIEWPORT MANAGEMENT
  // ============================================================================

  const setViewportBounds = useCallback((bounds: ViewportBounds) => {
    setCanvasState(prev => ({
      ...prev,
      viewportBounds: bounds,
    }));
  }, []);

  // ============================================================================
  // CLEANUP
  // ============================================================================

  useEffect(() => {
    return () => {
      if (historyTimeoutRef.current) {
        clearTimeout(historyTimeoutRef.current);
      }
    };
  }, []);

  // ============================================================================
  // RETURN INTERFACE
  // ============================================================================

  return {
    canvasState,
    updateTransform,
    selectObjects,
    deselectAll,
    moveObjects,
    deleteObjects,
    duplicateObjects,
    undoAction,
    redoAction,
    fitToView,
    resetView,
    addTable,
    updateTable,
    setViewportBounds,
  };
};

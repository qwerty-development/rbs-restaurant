// components/restaurant-canvas/RestaurantCanvas.tsx
"use client";

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { RESTAURANT_CANVAS_CONFIG } from "@/lib/restaurant-canvas/canvas-config";
import { useRestaurantCanvas } from "@/lib/restaurant-canvas/use-restaurant-canvas";
import { useCanvasEvents } from "@/lib/restaurant-canvas/use-canvas-events";
import {
  convertLegacyTableToCanvas,
  gridToPixel,
} from "@/lib/restaurant-canvas/coordinate-utils";
import { GridSystem } from "./GridSystem";
import { CanvasControls } from "./CanvasControls";
import { SelectionManager } from "./SelectionManager";
import { RestaurantTable } from "./RestaurantTable";
import type {
  RestaurantCanvasProps,
  FloorPlan,
  RestaurantTable as RestaurantTableType,
  LegacyTableData,
} from "@/lib/restaurant-canvas/types";

export const RestaurantCanvas: React.FC<RestaurantCanvasProps> = ({
  floorPlan,
  onFloorPlanUpdate,
  readOnly = false,
  showBookingStatus = true,
  currentTimeSlot,
  className = "",
  restaurantId,
  userId,
  onTableClick,
  onStatusUpdate,
  onTableSwitch,
  onCheckIn,
  searchQuery = "",
}) => {
  // ============================================================================
  // REFS AND STATE
  // ============================================================================

  const canvasRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // ============================================================================
  // CANVAS STATE MANAGEMENT
  // ============================================================================

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
    fitToView,
    resetView,
    addTable,
    updateTable,
    setViewportBounds,
  } = useRestaurantCanvas({
    floorPlan,
    onFloorPlanUpdate,
    readOnly,
  });

  // ============================================================================
  // EVENT HANDLING
  // ============================================================================

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
    canvasRef: canvasRef as React.RefObject<HTMLDivElement>,
    canvasState,
    updateTransform,
    selectObjects,
    moveObjects,
    setViewportBounds,
    readOnly,
  });

  // ============================================================================
  // MOBILE DETECTION
  // ============================================================================

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // ============================================================================
  // CANVAS STYLING
  // ============================================================================

  const canvasStyle: React.CSSProperties = useMemo(
    () => ({
      width: `${RESTAURANT_CANVAS_CONFIG.CANVAS.width}px`,
      height: `${RESTAURANT_CANVAS_CONFIG.CANVAS.height}px`,
      transform: `translate(${canvasState.transform.position.x}px, ${canvasState.transform.position.y}px) scale(${canvasState.transform.zoom})`,
      backgroundColor: RESTAURANT_CANVAS_CONFIG.CANVAS.backgroundColor,
      cursor: canvasState.isDragging ? "grabbing" : "grab",
      transformOrigin: "center center",
      transition: canvasState.isDragging ? "none" : "transform 0.2s ease-out",
    }),
    [canvasState.transform, canvasState.isDragging]
  );

  // ============================================================================
  // TABLE RENDERING
  // ============================================================================

  const renderTables = useCallback(() => {
    const tables = floorPlan.objects.filter(
      (obj) => obj.type === "table"
    ) as RestaurantTableType[];

    // Filter tables based on search query if provided
    const filteredTables = searchQuery
      ? tables.filter(
          (table) =>
            table.table_number
              .toLowerCase()
              .includes(searchQuery.toLowerCase()) ||
            table.subType.toLowerCase().includes(searchQuery.toLowerCase()) ||
            table.id.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : tables;

    return filteredTables.map((table) => (
      <RestaurantTable
        key={table.id}
        table={table}
        isSelected={canvasState.selectedObjects.includes(table.id)}
        zoom={canvasState.transform.zoom}
        showBookingStatus={showBookingStatus}
        currentTimeSlot={currentTimeSlot}
        readOnly={readOnly}
        onSelect={(id) => {
          selectObjects([id]);
          onTableClick?.(table, { current: table });
        }}
        onMove={(delta) => moveObjects([table.id], delta)}
        onDoubleClick={(id) => {
          // Handle double click - could open table properties
          console.log("Double clicked table:", id);
        }}
      />
    ));
  }, [
    floorPlan.objects,
    searchQuery,
    canvasState.selectedObjects,
    canvasState.transform.zoom,
    showBookingStatus,
    currentTimeSlot,
    readOnly,
    selectObjects,
    moveObjects,
    onTableClick,
  ]);

  // ============================================================================
  // ZOOM CONTROL HANDLERS
  // ============================================================================

  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(
      canvasState.transform.zoom + RESTAURANT_CANVAS_CONFIG.ZOOM.step,
      RESTAURANT_CANVAS_CONFIG.ZOOM.max
    );
    updateTransform({ zoom: newZoom });
  }, [canvasState.transform.zoom, updateTransform]);

  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(
      canvasState.transform.zoom - RESTAURANT_CANVAS_CONFIG.ZOOM.step,
      RESTAURANT_CANVAS_CONFIG.ZOOM.min
    );
    updateTransform({ zoom: newZoom });
  }, [canvasState.transform.zoom, updateTransform]);

  const handleResetZoom = useCallback(() => {
    updateTransform({ zoom: RESTAURANT_CANVAS_CONFIG.ZOOM.default });
  }, [updateTransform]);

  const handleCenterView = useCallback(() => {
    updateTransform({ position: { x: 0, y: 0 } });
  }, [updateTransform]);

  // ============================================================================
  // KEYBOARD SHORTCUTS
  // ============================================================================

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Only handle if canvas is focused or no input is focused
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA" ||
        (activeElement as HTMLElement)?.contentEditable === "true";

      if (isInputFocused) return;

      switch (e.key) {
        case "Delete":
        case "Backspace":
          if (canvasState.selectedObjects.length > 0) {
            deleteObjects(canvasState.selectedObjects);
            e.preventDefault();
          }
          break;

        case "z":
          if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
            undoAction();
            e.preventDefault();
          }
          break;

        case "y":
          if (e.ctrlKey || e.metaKey) {
            redoAction();
            e.preventDefault();
          }
          break;

        case "z":
          if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
            redoAction();
            e.preventDefault();
          }
          break;

        case "d":
          if (
            (e.ctrlKey || e.metaKey) &&
            canvasState.selectedObjects.length > 0
          ) {
            duplicateObjects(canvasState.selectedObjects);
            e.preventDefault();
          }
          break;

        case "f":
          if (e.ctrlKey || e.metaKey) {
            fitToView();
            e.preventDefault();
          }
          break;
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [
    canvasState.selectedObjects,
    deleteObjects,
    duplicateObjects,
    undoAction,
    redoAction,
    fitToView,
  ]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div
      ref={containerRef}
      className={`restaurant-canvas-container ${className}`}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        backgroundColor: "#f0f0f0",
        borderRadius: "8px",
        border: "1px solid #e0e0e0",
      }}
    >
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" />
            <span className="text-sm text-gray-600">Loading floor plan...</span>
          </div>
        </div>
      )}

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
        data-testid="restaurant-canvas"
      >
        {/* Grid System */}
        <GridSystem
          config={RESTAURANT_CANVAS_CONFIG.GRID}
          zoom={canvasState.transform.zoom}
          viewportBounds={canvasState.viewportBounds}
        />

        {/* Restaurant Tables */}
        {renderTables()}

        {/* Selection Manager */}
        <SelectionManager
          selectionBox={canvasState.selectionBox}
          selectedObjects={canvasState.selectedObjects}
        />
      </div>

      {/* Canvas Controls */}
      <CanvasControls
        canvasState={canvasState}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
        onCenter={handleCenterView}
        onFitToView={fitToView}
        onUndo={undoAction}
        onRedo={redoAction}
        showMobileControls={isMobile}
        readOnly={readOnly}
        canUndo={canvasState.historyIndex > 0}
        canRedo={canvasState.historyIndex < canvasState.history.length - 1}
      />

      {/* Selection Info */}
      {canvasState.selectedObjects.length > 0 && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium z-30">
          {canvasState.selectedObjects.length} table
          {canvasState.selectedObjects.length === 1 ? "" : "s"} selected
        </div>
      )}

      {/* Search Highlight Info */}
      {searchQuery && (
        <div className="absolute top-4 left-4 bg-yellow-500 text-white px-3 py-1 rounded-full text-sm font-medium z-30">
          Search: "{searchQuery}"
        </div>
      )}

      {/* Performance Debug Info (Development Only) */}
      {process.env.NODE_ENV === "development" && (
        <div className="absolute bottom-4 left-4 bg-black bg-opacity-75 text-white p-2 rounded text-xs font-mono z-30">
          <div>Zoom: {(canvasState.transform.zoom * 100).toFixed(0)}%</div>
          <div>
            Tables:{" "}
            {floorPlan.objects.filter((obj) => obj.type === "table").length}
          </div>
          <div>Selected: {canvasState.selectedObjects.length}</div>
          <div>History: {canvasState.history.length}</div>
        </div>
      )}
    </div>
  );
};

export default RestaurantCanvas;

// components/restaurant-canvas/GridSystem.tsx
"use client";

import React, { useMemo } from "react";

interface GridSystemProps {
  config: {
    cellSize: number;
    centerX: number;
    centerY: number;
    showGridLines: boolean;
    showCoordinates: boolean;
  };
  zoom: number;
  viewportBounds: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
}

export const GridSystem: React.FC<GridSystemProps> = ({
  config,
  zoom,
  viewportBounds,
}) => {
  const { cellSize, centerX, centerY, showGridLines, showCoordinates } = config;

  // ============================================================================
  // GRID LINE CALCULATIONS
  // ============================================================================

  const gridElements = useMemo(() => {
    if (!showGridLines && !showCoordinates) return [];

    const elements: React.ReactElement[] = [];

    // Calculate visible grid range based on viewport
    const startGridX = Math.floor((viewportBounds.left - centerX) / cellSize) - 1;
    const endGridX = Math.ceil((viewportBounds.right - centerX) / cellSize) + 1;
    const startGridY = Math.floor((viewportBounds.top - centerY) / cellSize) - 1;
    const endGridY = Math.ceil((viewportBounds.bottom - centerY) / cellSize) + 1;

    // Only show grid when zoomed in enough to see details
    const showDetailedGrid = zoom > 0.5;
    const showMajorGrid = zoom > 0.2;

    if (showGridLines && showMajorGrid) {
      // Vertical lines
      for (let gridX = startGridX; gridX <= endGridX; gridX++) {
        const x = centerX + gridX * cellSize;
        const isMajorLine = gridX % 5 === 0; // Every 5th line is major
        
        // Only show minor lines when zoomed in enough
        if (!isMajorLine && !showDetailedGrid) continue;

        elements.push(
          <line
            key={`v-${gridX}`}
            x1={x}
            y1={viewportBounds.top}
            x2={x}
            y2={viewportBounds.bottom}
            stroke={isMajorLine ? "#d1d5db" : "#f3f4f6"}
            strokeWidth={isMajorLine ? 1 : 0.5}
            opacity={isMajorLine ? 0.6 : 0.3}
          />
        );
      }

      // Horizontal lines
      for (let gridY = startGridY; gridY <= endGridY; gridY++) {
        const y = centerY + gridY * cellSize;
        const isMajorLine = gridY % 5 === 0; // Every 5th line is major

        // Only show minor lines when zoomed in enough
        if (!isMajorLine && !showDetailedGrid) continue;

        elements.push(
          <line
            key={`h-${gridY}`}
            x1={viewportBounds.left}
            y1={y}
            x2={viewportBounds.right}
            y2={y}
            stroke={isMajorLine ? "#d1d5db" : "#f3f4f6"}
            strokeWidth={isMajorLine ? 1 : 0.5}
            opacity={isMajorLine ? 0.6 : 0.3}
          />
        );
      }
    }

    // Add coordinate labels (only when zoomed in significantly)
    if (showCoordinates && zoom > 1.0) {
      const labelStep = Math.max(1, Math.round(5 / zoom)); // Adjust label density based on zoom
      
      for (let gridX = startGridX; gridX <= endGridX; gridX += labelStep) {
        for (let gridY = startGridY; gridY <= endGridY; gridY += labelStep) {
          // Skip (0,0) to avoid clutter
          if (gridX === 0 && gridY === 0) continue;

          const x = centerX + gridX * cellSize;
          const y = centerY + gridY * cellSize;

          elements.push(
            <text
              key={`coord-${gridX}-${gridY}`}
              x={x + 2}
              y={y - 2}
              fontSize={Math.max(8, 10 / zoom)}
              fill="#9ca3af"
              fontFamily="monospace"
              pointerEvents="none"
            >
              {gridX},{gridY}
            </text>
          );
        }
      }
    }

    return elements;
  }, [
    config,
    zoom,
    viewportBounds,
    showGridLines,
    showCoordinates,
    cellSize,
    centerX,
    centerY,
  ]);

  // ============================================================================
  // CENTER MARKER
  // ============================================================================

  const centerMarker = useMemo(() => {
    if (zoom < 0.3) return null;

    return (
      <g key="center-marker">
        {/* Center crosshair */}
        <line
          x1={centerX - 10}
          y1={centerY}
          x2={centerX + 10}
          y2={centerY}
          stroke="#ef4444"
          strokeWidth={2}
          opacity={0.7}
        />
        <line
          x1={centerX}
          y1={centerY - 10}
          x2={centerX}
          y2={centerY + 10}
          stroke="#ef4444"
          strokeWidth={2}
          opacity={0.7}
        />
        
        {/* Center dot */}
        <circle
          cx={centerX}
          cy={centerY}
          r={3}
          fill="#ef4444"
          opacity={0.8}
        />
        
        {/* Center label */}
        {zoom > 0.8 && (
          <text
            x={centerX + 15}
            y={centerY - 10}
            fontSize={12}
            fill="#ef4444"
            fontWeight="bold"
            pointerEvents="none"
          >
            (0,0)
          </text>
        )}
      </g>
    );
  }, [centerX, centerY, zoom]);

  // ============================================================================
  // VIEWPORT BOUNDS INDICATOR (Development Mode)
  // ============================================================================

  const viewportIndicator = useMemo(() => {
    if (process.env.NODE_ENV !== 'development' || zoom < 0.1) return null;

    return (
      <rect
        key="viewport-bounds"
        x={viewportBounds.left}
        y={viewportBounds.top}
        width={viewportBounds.right - viewportBounds.left}
        height={viewportBounds.bottom - viewportBounds.top}
        fill="none"
        stroke="#3b82f6"
        strokeWidth={2}
        strokeDasharray="10,5"
        opacity={0.5}
        pointerEvents="none"
      />
    );
  }, [viewportBounds, zoom]);

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!showGridLines && !showCoordinates && process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 1,
      }}
      className="grid-system"
    >
      {/* Grid lines and coordinates */}
      <g className="grid-lines">
        {gridElements}
      </g>

      {/* Center marker */}
      {centerMarker}

      {/* Development viewport indicator */}
      {viewportIndicator}

      {/* Zoom level indicator (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <text
          x={viewportBounds.right - 100}
          y={viewportBounds.top + 20}
          fontSize={12}
          fill="#666"
          fontFamily="monospace"
          pointerEvents="none"
        >
          Zoom: {(zoom * 100).toFixed(0)}%
        </text>
      )}
    </svg>
  );
};

export default GridSystem;

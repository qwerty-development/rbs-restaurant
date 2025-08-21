// components/restaurant-canvas/SelectionManager.tsx
"use client";

import React from "react";
import type { SelectionBox } from "@/lib/restaurant-canvas/types";

interface SelectionManagerProps {
  selectionBox: SelectionBox | null;
  selectedObjects: string[];
}

export const SelectionManager: React.FC<SelectionManagerProps> = ({
  selectionBox,
  selectedObjects,
}) => {
  // ============================================================================
  // SELECTION BOX RENDERING
  // ============================================================================

  const renderSelectionBox = () => {
    if (!selectionBox) return null;

    const left = Math.min(selectionBox.start.x, selectionBox.end.x);
    const top = Math.min(selectionBox.start.y, selectionBox.end.y);
    const width = Math.abs(selectionBox.end.x - selectionBox.start.x);
    const height = Math.abs(selectionBox.end.y - selectionBox.start.y);

    return (
      <div
        className="selection-box"
        style={{
          position: "absolute",
          left: `${left}px`,
          top: `${top}px`,
          width: `${width}px`,
          height: `${height}px`,
          border: "2px dashed #3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          pointerEvents: "none",
          zIndex: 1000,
        }}
      />
    );
  };

  // ============================================================================
  // SELECTION COUNT BADGE
  // ============================================================================

  const renderSelectionBadge = () => {
    if (selectedObjects.length <= 1) return null;

    return (
      <div
        className="selection-count-badge"
        style={{
          position: "fixed",
          top: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: "#3b82f6",
          color: "white",
          padding: "8px 16px",
          borderRadius: "20px",
          fontSize: "14px",
          fontWeight: "600",
          zIndex: 1000,
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        }}
      >
        {selectedObjects.length} tables selected
      </div>
    );
  };

  // ============================================================================
  // SELECTION INDICATOR OVERLAY
  // ============================================================================

  const renderSelectionOverlay = () => {
    if (selectedObjects.length === 0) return null;

    return (
      <div
        className="selection-overlay"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: "none",
          zIndex: 15,
        }}
      >
        {/* Selection glow effect */}
        <div
          className="selection-glow"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            boxShadow: "inset 0 0 0 2px rgba(59, 130, 246, 0.5)",
            borderRadius: "4px",
            animation: "selectionPulse 2s ease-in-out infinite",
          }}
        />
      </div>
    );
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="selection-manager">
      {/* Selection Box (rubber band selection) */}
      {renderSelectionBox()}

      {/* Selection Count Badge */}
      {renderSelectionBadge()}

      {/* Selection Overlay Effects */}
      {renderSelectionOverlay()}

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes selectionPulse {
          0%, 100% {
            box-shadow: inset 0 0 0 2px rgba(59, 130, 246, 0.5);
          }
          50% {
            box-shadow: inset 0 0 0 2px rgba(59, 130, 246, 0.8);
          }
        }

        .selection-box {
          animation: selectionBoxFade 0.2s ease-out;
        }

        @keyframes selectionBoxFade {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .selection-count-badge {
          animation: badgeSlideDown 0.3s ease-out;
        }

        @keyframes badgeSlideDown {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default SelectionManager;

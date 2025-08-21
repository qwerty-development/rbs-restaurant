// components/restaurant-canvas/CanvasControls.tsx
"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Home, 
  Undo2, 
  Redo2,
  Focus,
  RotateCcw,
} from "lucide-react";
import type { CanvasState } from "@/lib/restaurant-canvas/types";

interface CanvasControlsProps {
  canvasState: CanvasState;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onCenter: () => void;
  onFitToView: () => void;
  onUndo: () => void;
  onRedo: () => void;
  showMobileControls: boolean;
  readOnly: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

export const CanvasControls: React.FC<CanvasControlsProps> = ({
  canvasState,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onCenter,
  onFitToView,
  onUndo,
  onRedo,
  showMobileControls,
  readOnly,
  canUndo,
  canRedo,
}) => {
  const zoomPercentage = Math.round(canvasState.transform.zoom * 100);

  // ============================================================================
  // DESKTOP CONTROLS
  // ============================================================================

  const DesktopControls = () => (
    <div className="absolute top-4 right-4 z-40 flex flex-col gap-3">
      {/* Zoom Controls */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
        <Button
          variant="ghost"
          size="sm"
          onClick={onZoomIn}
          className="w-10 h-10 p-0 rounded-none border-b border-gray-200"
          title="Zoom In (Ctrl +)"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onResetZoom}
          className="w-10 h-8 p-0 rounded-none border-b border-gray-200 text-xs font-mono"
          title="Reset Zoom (Ctrl 0)"
        >
          {zoomPercentage}%
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onZoomOut}
          className="w-10 h-10 p-0 rounded-none"
          title="Zoom Out (Ctrl -)"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
      </div>

      {/* View Controls */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
        <Button
          variant="ghost"
          size="sm"
          onClick={onFitToView}
          className="w-10 h-10 p-0 rounded-none border-b border-gray-200"
          title="Fit to View (Ctrl F)"
        >
          <Maximize2 className="w-4 h-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onCenter}
          className="w-10 h-10 p-0 rounded-none"
          title="Center View"
        >
          <Home className="w-4 h-4" />
        </Button>
      </div>

      {/* Edit Controls */}
      {!readOnly && (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={onUndo}
            disabled={!canUndo}
            className="w-10 h-10 p-0 rounded-none border-b border-gray-200"
            title="Undo (Ctrl Z)"
          >
            <Undo2 className="w-4 h-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onRedo}
            disabled={!canRedo}
            className="w-10 h-10 p-0 rounded-none"
            title="Redo (Ctrl Y)"
          >
            <Redo2 className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );

  // ============================================================================
  // MOBILE CONTROLS
  // ============================================================================

  const MobileControls = () => (
    <div className="absolute bottom-4 right-4 z-40">
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-3">
        {/* Zoom Row */}
        <div className="flex items-center gap-2 mb-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onZoomOut}
            className="w-10 h-10 p-0"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          
          <div className="flex-1 min-w-16 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={onResetZoom}
              className="text-xs font-mono px-2 py-1 h-auto"
              title="Reset Zoom"
            >
              {zoomPercentage}%
            </Button>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={onZoomIn}
            className="w-10 h-10 p-0"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>

        {/* Action Row */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onFitToView}
            className="w-10 h-10 p-0"
            title="Fit to View"
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={onCenter}
            className="w-10 h-10 p-0"
            title="Center"
          >
            <Home className="w-4 h-4" />
          </Button>

          {!readOnly && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onUndo}
                disabled={!canUndo}
                className="w-10 h-10 p-0"
                title="Undo"
              >
                <Undo2 className="w-4 h-4" />
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={onRedo}
                disabled={!canRedo}
                className="w-10 h-10 p-0"
                title="Redo"
              >
                <Redo2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  // ============================================================================
  // KEYBOARD SHORTCUTS HELP (Desktop Only)
  // ============================================================================

  const KeyboardShortcuts = () => {
    if (showMobileControls) return null;

    return (
      <div className="absolute bottom-4 left-4 z-40">
        <div className="bg-black bg-opacity-75 text-white p-3 rounded-lg text-xs max-w-sm">
          <div className="font-semibold mb-2">Keyboard Shortcuts:</div>
          <div className="space-y-1">
            <div><kbd className="bg-gray-700 px-1 rounded">Ctrl +</kbd> Zoom In</div>
            <div><kbd className="bg-gray-700 px-1 rounded">Ctrl -</kbd> Zoom Out</div>
            <div><kbd className="bg-gray-700 px-1 rounded">Ctrl 0</kbd> Reset Zoom</div>
            <div><kbd className="bg-gray-700 px-1 rounded">Ctrl F</kbd> Fit to View</div>
            {!readOnly && (
              <>
                <div><kbd className="bg-gray-700 px-1 rounded">Ctrl Z</kbd> Undo</div>
                <div><kbd className="bg-gray-700 px-1 rounded">Ctrl Y</kbd> Redo</div>
                <div><kbd className="bg-gray-700 px-1 rounded">Del</kbd> Delete Selected</div>
                <div><kbd className="bg-gray-700 px-1 rounded">Ctrl D</kbd> Duplicate</div>
              </>
            )}
            <div><kbd className="bg-gray-700 px-1 rounded">Esc</kbd> Deselect All</div>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // STATUS INDICATORS
  // ============================================================================

  const StatusIndicators = () => (
    <div className="absolute top-4 left-4 z-40">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3">
        <div className="text-xs text-gray-600 space-y-1">
          <div className="flex justify-between items-center">
            <span>Zoom:</span>
            <span className="font-mono font-semibold">{zoomPercentage}%</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span>Position:</span>
            <span className="font-mono text-xs">
              {Math.round(canvasState.transform.position.x)}, {Math.round(canvasState.transform.position.y)}
            </span>
          </div>
          
          {canvasState.selectedObjects.length > 0 && (
            <div className="flex justify-between items-center">
              <span>Selected:</span>
              <span className="font-semibold">{canvasState.selectedObjects.length}</span>
            </div>
          )}
          
          {readOnly && (
            <div className="text-amber-600 font-semibold text-center mt-2">
              READ ONLY
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <>
      {/* Main Controls */}
      {showMobileControls ? <MobileControls /> : <DesktopControls />}
      
      {/* Status Indicators */}
      {process.env.NODE_ENV === 'development' && <StatusIndicators />}
      
      {/* Keyboard Shortcuts Help */}
      {process.env.NODE_ENV === 'development' && <KeyboardShortcuts />}
    </>
  );
};

export default CanvasControls;

// lib/restaurant-canvas/use-canvas-events.ts
"use client";

import { useCallback, useRef, useEffect } from 'react';
import { RESTAURANT_CANVAS_CONFIG } from './canvas-config';
import { pixelToGrid } from './coordinate-utils';
import type { 
  CanvasState, 
  CanvasPosition, 
  GridCoordinate,
  TouchGestureState 
} from './types';

interface UseCanvasEventsOptions {
  canvasRef: React.RefObject<HTMLDivElement>;
  canvasState: CanvasState;
  updateTransform: (transform: Partial<{ position: CanvasPosition; zoom: number }>) => void;
  selectObjects: (objectIds: string[], addToSelection?: boolean) => void;
  moveObjects: (objectIds: string[], delta: GridCoordinate) => void;
  setViewportBounds: (bounds: { left: number; top: number; right: number; bottom: number }) => void;
  readOnly?: boolean;
}

interface UseCanvasEventsReturn {
  handleMouseDown: (e: React.MouseEvent) => void;
  handleMouseMove: (e: React.MouseEvent) => void;
  handleMouseUp: (e: React.MouseEvent) => void;
  handleWheel: (e: React.WheelEvent) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  handleTouchStart: (e: React.TouchEvent) => void;
  handleTouchMove: (e: React.TouchEvent) => void;
  handleTouchEnd: (e: React.TouchEvent) => void;
}

export const useCanvasEvents = ({
  canvasRef,
  canvasState,
  updateTransform,
  selectObjects,
  moveObjects,
  setViewportBounds,
  readOnly = false,
}: UseCanvasEventsOptions): UseCanvasEventsReturn => {

  // ============================================================================
  // STATE REFS (for event handlers)
  // ============================================================================

  const isPanningRef = useRef(false);
  const lastPanPositionRef = useRef<CanvasPosition | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<CanvasPosition | null>(null);
  const touchStateRef = useRef<TouchGestureState>({
    isGesturing: false,
    initialDistance: 0,
    initialZoom: 1,
    touches: [],
  });

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const getMousePosition = useCallback((e: MouseEvent | React.MouseEvent): CanvasPosition => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, [canvasRef]);

  const getTouchPosition = useCallback((touch: Touch): CanvasPosition => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
  }, [canvasRef]);

  const calculateTouchDistance = useCallback((touch1: CanvasPosition, touch2: CanvasPosition): number => {
    const dx = touch2.x - touch1.x;
    const dy = touch2.y - touch1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // ============================================================================
  // VIEWPORT MANAGEMENT
  // ============================================================================

  const updateViewportBounds = useCallback(() => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const { transform } = canvasState;
    
    // Calculate viewport bounds in canvas coordinates
    const scaledWidth = rect.width / transform.zoom;
    const scaledHeight = rect.height / transform.zoom;
    
    const centerX = -transform.position.x / transform.zoom;
    const centerY = -transform.position.y / transform.zoom;
    
    setViewportBounds({
      left: centerX - scaledWidth / 2,
      top: centerY - scaledHeight / 2,
      right: centerX + scaledWidth / 2,
      bottom: centerY + scaledHeight / 2,
    });
  }, [canvasRef, canvasState, setViewportBounds]);

  // Update viewport bounds when transform changes
  useEffect(() => {
    updateViewportBounds();
  }, [updateViewportBounds]);

  // ============================================================================
  // MOUSE EVENT HANDLERS
  // ============================================================================

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (readOnly) return;

    const mousePos = getMousePosition(e);
    
    // Check if clicking on empty canvas (start panning or selection)
    if (e.target === canvasRef.current) {
      if (e.ctrlKey || e.metaKey) {
        // Start selection box
        // This will be implemented when we add selection box functionality
      } else {
        // Start panning
        isPanningRef.current = true;
        lastPanPositionRef.current = mousePos;
        if (canvasRef.current) {
          canvasRef.current.style.cursor = 'grabbing';
        }
      }
    }

    // Clear selection if clicking empty space (without ctrl)
    if (e.target === canvasRef.current && !e.ctrlKey && !e.metaKey) {
      selectObjects([]);
    }
  }, [readOnly, getMousePosition, canvasRef, selectObjects]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (readOnly) return;

    const mousePos = getMousePosition(e);

    // Handle panning
    if (isPanningRef.current && lastPanPositionRef.current) {
      const deltaX = mousePos.x - lastPanPositionRef.current.x;
      const deltaY = mousePos.y - lastPanPositionRef.current.y;

      updateTransform({
        position: {
          x: canvasState.transform.position.x + deltaX,
          y: canvasState.transform.position.y + deltaY,
        },
      });

      lastPanPositionRef.current = mousePos;
    }
  }, [readOnly, getMousePosition, canvasState.transform.position, updateTransform]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    // Stop panning
    if (isPanningRef.current) {
      isPanningRef.current = false;
      lastPanPositionRef.current = null;
      if (canvasRef.current) {
        canvasRef.current.style.cursor = 'grab';
      }
    }

    // Stop dragging
    isDraggingRef.current = false;
    dragStartRef.current = null;
  }, [canvasRef]);

  // ============================================================================
  // WHEEL EVENT HANDLER (Zoom)
  // ============================================================================

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (readOnly) return;

    e.preventDefault();

    const mousePos = getMousePosition(e);
    const { transform } = canvasState;
    
    // Calculate zoom delta
    const zoomDelta = -e.deltaY * RESTAURANT_CANVAS_CONFIG.ZOOM.wheelSensitivity;
    const newZoom = Math.max(
      RESTAURANT_CANVAS_CONFIG.ZOOM.min,
      Math.min(
        RESTAURANT_CANVAS_CONFIG.ZOOM.max,
        transform.zoom + zoomDelta
      )
    );

    if (newZoom === transform.zoom) return;

    // Zoom towards mouse position
    const zoomFactor = newZoom / transform.zoom;
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    const canvasCenterX = canvasRect.width / 2;
    const canvasCenterY = canvasRect.height / 2;

    const offsetX = mousePos.x - canvasCenterX;
    const offsetY = mousePos.y - canvasCenterY;

    const newPosition = {
      x: transform.position.x - offsetX * (zoomFactor - 1),
      y: transform.position.y - offsetY * (zoomFactor - 1),
    };

    updateTransform({
      position: newPosition,
      zoom: newZoom,
    });
  }, [readOnly, getMousePosition, canvasState.transform, canvasRef, updateTransform]);

  // ============================================================================
  // KEYBOARD EVENT HANDLER
  // ============================================================================

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (readOnly) return;

    // Handle keyboard shortcuts
    switch (e.key) {
      case 'Delete':
      case 'Backspace':
        if (canvasState.selectedObjects.length > 0) {
          // Delete selected objects (will be implemented by parent component)
          e.preventDefault();
        }
        break;
      
      case 'Escape':
        selectObjects([]);
        e.preventDefault();
        break;

      case 'a':
        if (e.ctrlKey || e.metaKey) {
          // Select all (will be implemented)
          e.preventDefault();
        }
        break;

      case '=':
      case '+':
        if (e.ctrlKey || e.metaKey) {
          // Zoom in
          const newZoom = Math.min(
            RESTAURANT_CANVAS_CONFIG.ZOOM.max,
            canvasState.transform.zoom + RESTAURANT_CANVAS_CONFIG.ZOOM.step
          );
          updateTransform({ zoom: newZoom });
          e.preventDefault();
        }
        break;

      case '-':
        if (e.ctrlKey || e.metaKey) {
          // Zoom out
          const newZoom = Math.max(
            RESTAURANT_CANVAS_CONFIG.ZOOM.min,
            canvasState.transform.zoom - RESTAURANT_CANVAS_CONFIG.ZOOM.step
          );
          updateTransform({ zoom: newZoom });
          e.preventDefault();
        }
        break;

      case '0':
        if (e.ctrlKey || e.metaKey) {
          // Reset zoom
          updateTransform({ 
            zoom: RESTAURANT_CANVAS_CONFIG.ZOOM.default,
            position: { x: 0, y: 0 }
          });
          e.preventDefault();
        }
        break;
    }
  }, [readOnly, canvasState.selectedObjects.length, canvasState.transform, selectObjects, updateTransform]);

  // ============================================================================
  // TOUCH EVENT HANDLERS (Mobile Support)
  // ============================================================================

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (readOnly) return;

    const touches = Array.from(e.touches).map((touch, index) => ({
      id: index,
      ...getTouchPosition(touch),
    }));

    touchStateRef.current.touches = touches;

    if (touches.length === 1) {
      // Single touch - start panning
      isPanningRef.current = true;
      lastPanPositionRef.current = touches[0];
    } else if (touches.length === 2) {
      // Two touches - start pinch zoom
      touchStateRef.current.isGesturing = true;
      touchStateRef.current.initialDistance = calculateTouchDistance(touches[0], touches[1]);
      touchStateRef.current.initialZoom = canvasState.transform.zoom;
      isPanningRef.current = false; // Stop panning
    }
  }, [readOnly, getTouchPosition, calculateTouchDistance, canvasState.transform.zoom]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (readOnly) return;

    e.preventDefault(); // Prevent scrolling

    const touches = Array.from(e.touches).map((touch, index) => ({
      id: index,
      ...getTouchPosition(touch),
    }));

    if (touches.length === 1 && isPanningRef.current && lastPanPositionRef.current) {
      // Single touch panning
      const deltaX = touches[0].x - lastPanPositionRef.current.x;
      const deltaY = touches[0].y - lastPanPositionRef.current.y;

      updateTransform({
        position: {
          x: canvasState.transform.position.x + deltaX,
          y: canvasState.transform.position.y + deltaY,
        },
      });

      lastPanPositionRef.current = touches[0];
    } else if (touches.length === 2 && touchStateRef.current.isGesturing) {
      // Two touch pinch zoom
      const currentDistance = calculateTouchDistance(touches[0], touches[1]);
      const zoomFactor = currentDistance / touchStateRef.current.initialDistance;
      const newZoom = Math.max(
        RESTAURANT_CANVAS_CONFIG.ZOOM.min,
        Math.min(
          RESTAURANT_CANVAS_CONFIG.ZOOM.max,
          touchStateRef.current.initialZoom * zoomFactor
        )
      );

      // Calculate center point between fingers
      const centerX = (touches[0].x + touches[1].x) / 2;
      const centerY = (touches[0].y + touches[1].y) / 2;

      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (!canvasRect) return;

      const canvasCenterX = canvasRect.width / 2;
      const canvasCenterY = canvasRect.height / 2;

      const offsetX = centerX - canvasCenterX;
      const offsetY = centerY - canvasCenterY;

      const zoomChange = newZoom / canvasState.transform.zoom;

      updateTransform({
        position: {
          x: canvasState.transform.position.x - offsetX * (zoomChange - 1),
          y: canvasState.transform.position.y - offsetY * (zoomChange - 1),
        },
        zoom: newZoom,
      });
    }
  }, [
    readOnly, 
    getTouchPosition, 
    calculateTouchDistance, 
    canvasState.transform, 
    canvasRef, 
    updateTransform
  ]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const touches = Array.from(e.touches);

    if (touches.length === 0) {
      // All touches ended
      isPanningRef.current = false;
      lastPanPositionRef.current = null;
      touchStateRef.current.isGesturing = false;
      touchStateRef.current.touches = [];
    } else if (touches.length === 1) {
      // Switch from gesture to panning
      touchStateRef.current.isGesturing = false;
      isPanningRef.current = true;
      lastPanPositionRef.current = getTouchPosition(touches[0]);
      touchStateRef.current.touches = [{ id: 0, ...getTouchPosition(touches[0]) }];
    }
  }, [getTouchPosition]);

  // ============================================================================
  // GLOBAL EVENT LISTENERS
  // ============================================================================

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      isPanningRef.current = false;
      lastPanPositionRef.current = null;
      isDraggingRef.current = false;
      dragStartRef.current = null;
      
      if (canvasRef.current) {
        canvasRef.current.style.cursor = 'grab';
      }
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isPanningRef.current && lastPanPositionRef.current && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const mousePos = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };

        const deltaX = mousePos.x - lastPanPositionRef.current.x;
        const deltaY = mousePos.y - lastPanPositionRef.current.y;

        updateTransform({
          position: {
            x: canvasState.transform.position.x + deltaX,
            y: canvasState.transform.position.y + deltaY,
          },
        });

        lastPanPositionRef.current = mousePos;
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('mousemove', handleGlobalMouseMove);

    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, [canvasRef, canvasState.transform.position, updateTransform]);

  // ============================================================================
  // RETURN INTERFACE
  // ============================================================================

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    handleKeyDown,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
};

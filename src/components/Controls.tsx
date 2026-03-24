import { useCallback } from 'react'
import * as THREE from 'three'
import { useSlicerStore } from '../store'

const ORIENTATION_PRESETS = [
  { label: 'Top (Axial)', normal: [0, 1, 0] as [number, number, number], description: 'Horizontal slice - moves up/down' },
  { label: 'Front (Coronal)', normal: [0, 0, 1] as [number, number, number], description: 'Vertical slice - moves front/back' },
  { label: 'Side (Sagittal)', normal: [1, 0, 0] as [number, number, number], description: 'Vertical slice - moves left/right' },
]

// Get orientation label from normal vector
const getOrientationLabel = (normal: THREE.Vector3): string => {
  if (Math.abs(normal.y) > 0.9) return 'Top'
  if (Math.abs(normal.z) > 0.9) return 'Front'
  if (Math.abs(normal.x) > 0.9) return 'Side'
  return 'Custom'
}

export function Controls() {
  const planes = useSlicerStore((s) => s.planes)
  const modelBoundingBox = useSlicerStore((s) => s.modelBoundingBox)
  const addPlane = useSlicerStore((s) => s.addPlane)
  const removePlane = useSlicerStore((s) => s.removePlane)
  const updatePlane = useSlicerStore((s) => s.updatePlane)
  const togglePlane = useSlicerStore((s) => s.togglePlane)
  const clearPlanes = useSlicerStore((s) => s.clearPlanes)

  const handleAddPlane = useCallback(
    (normal: [number, number, number]) => {
      // Get center from bounding box, or default to (0,0,0)
      let center = new THREE.Vector3(0, 0, 0)
      if (modelBoundingBox) {
        modelBoundingBox.getCenter(center)
      }
      addPlane({
        position: center,
        normal: new THREE.Vector3(...normal),
        enabled: true,
        color: '#ff6b6b',
      })
    },
    [addPlane, modelBoundingBox]
  )

  const handlePositionChange = useCallback(
    (id: string, axis: 'x' | 'y' | 'z', value: number) => {
      const plane = planes.find((p) => p.id === id)
      if (plane) {
        const newPos = new THREE.Vector3(
          axis === 'x' ? value : plane.position.x,
          axis === 'y' ? value : plane.position.y,
          axis === 'z' ? value : plane.position.z
        )
        updatePlane(id, { position: newPos })
      }
    },
    [planes, updatePlane]
  )

  const handleRotationChange = useCallback(
    (id: string, axis: 'x' | 'y', value: number) => {
      const plane = planes.find((p) => p.id === id)
      if (plane) {
        if (axis === 'x') {
          updatePlane(id, { rotationX: value })
        } else {
          updatePlane(id, { rotationY: value })
        }
      }
    },
    [planes, updatePlane]
  )

  const getAxisForNormal = (normal: THREE.Vector3): 'x' | 'y' | 'z' => {
    // The plane moves along the axis of its normal
    // Top (Axial) has normal [0, 1, 0] -> moves along Y
    // Front (Coronal) has normal [0, 0, 1] -> moves along Z
    // Side (Sagittal) has normal [1, 0, 0] -> moves along X
    if (Math.abs(normal.y) > 0.9) return 'y'  // Top
    if (Math.abs(normal.z) > 0.9) return 'z'  // Front
    return 'x'  // Side
  }

  // Calculate slider range based on bounding box
  const getSliderRange = (axis: 'x' | 'y' | 'z'): { min: number; max: number; step: number } => {
    if (modelBoundingBox) {
      const size = new THREE.Vector3()
      const center = new THREE.Vector3()
      modelBoundingBox.getSize(size)
      modelBoundingBox.getCenter(center)

      const halfSize = size[axis] / 2
      // Range from center-halfSize to center+halfSize
      const step = Math.max(0.01, halfSize / 50)
      return {
        min: center[axis] - halfSize,
        max: center[axis] + halfSize,
        step
      }
    }
    // Default range if no model loaded
    return { min: -2, max: 2, step: 0.05 }
  }

  return (
    <div className="flex flex-col gap-4 p-4 bg-white rounded-lg">
      <div className="flex flex-col gap-2">
        <h3 className="font-semibold text-gray-800">Cutting Planes</h3>

        <div className="flex flex-wrap gap-2">
          {ORIENTATION_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => handleAddPlane(preset.normal)}
              className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              + {preset.label}
            </button>
          ))}
        </div>

        {planes.length > 0 && (
          <button
            onClick={clearPlanes}
            className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
          >
            Clear All Planes
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {planes.map((plane) => {
          const axis = getAxisForNormal(plane.normal)
          const range = getSliderRange(axis)
          const positionValue = plane.position[axis]

          return (
            <div
              key={plane.id}
              className="flex flex-col gap-2 p-3 bg-gray-50 rounded border-l-4"
              style={{ borderLeftColor: plane.color }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full border-2 border-white shadow"
                    style={{ backgroundColor: plane.color }}
                  />
                  <span className="text-sm font-medium">
                    {getOrientationLabel(plane.normal)} Plane
                  </span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => togglePlane(plane.id)}
                    className={`px-2 py-1 text-xs rounded font-medium ${
                      plane.enabled
                        ? 'bg-green-100 text-green-700 border border-green-300'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {plane.enabled ? 'ON' : 'OFF'}
                  </button>
                  <button
                    onClick={() => removePlane(plane.id)}
                    className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                  >
                    Remove
                  </button>
                </div>
              </div>

              {/* Position slider */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-8">{axis.toUpperCase()}:</span>
                <input
                  type="range"
                  min={range.min}
                  max={range.max}
                  step={range.step}
                  value={positionValue}
                  onChange={(e) => handlePositionChange(plane.id, axis, parseFloat(e.target.value))}
                  className="flex-1 cursor-pointer"
                />
                <span className="text-xs text-gray-600 w-12 text-right font-mono">
                  {positionValue.toFixed(2)}
                </span>
              </div>

              {/* Tilt sliders */}
              <div className="flex flex-col gap-1 mt-1 pt-2 border-t border-gray-200">
                <span className="text-xs text-gray-500 font-medium">Tilt</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-8">X:</span>
                  <input
                    type="range"
                    min={-45}
                    max={45}
                    step={1}
                    value={plane.rotationX || 0}
                    onChange={(e) => handleRotationChange(plane.id, 'x', parseFloat(e.target.value))}
                    className="flex-1 cursor-pointer"
                  />
                  <span className="text-xs text-gray-600 w-10 text-right font-mono">
                    {plane.rotationX || 0}°
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-8">Y:</span>
                  <input
                    type="range"
                    min={-45}
                    max={45}
                    step={1}
                    value={plane.rotationY || 0}
                    onChange={(e) => handleRotationChange(plane.id, 'y', parseFloat(e.target.value))}
                    className="flex-1 cursor-pointer"
                  />
                  <span className="text-xs text-gray-600 w-10 text-right font-mono">
                    {plane.rotationY || 0}°
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
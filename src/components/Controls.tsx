import { useCallback } from 'react'
import * as THREE from 'three'
import { useSlicerStore } from '../store'

const ORIENTATION_PRESETS = [
  { label: 'XY (Top)', normal: [0, 0, 1] as [number, number, number], description: 'Slices horizontally' },
  { label: 'XZ (Front)', normal: [1, 0, 0] as [number, number, number], description: 'Slices from front' },
  { label: 'YZ (Side)', normal: [0, 1, 0] as [number, number, number], description: 'Slices from side' },
]

// Get orientation label from normal vector
const getOrientationLabel = (normal: THREE.Vector3): string => {
  if (Math.abs(normal.z) > 0.9) return 'XY'
  if (Math.abs(normal.x) > 0.9) return 'XZ'
  if (Math.abs(normal.y) > 0.9) return 'YZ'
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

  const getDefaultPosition = useCallback(() => {
    if (modelBoundingBox) {
      const center = new THREE.Vector3()
      modelBoundingBox.getCenter(center)
      return center
    }
    return new THREE.Vector3(0, 0, 0)
  }, [modelBoundingBox])

  const handleAddPlane = useCallback(
    (normal: [number, number, number]) => {
      addPlane({
        position: getDefaultPosition(),
        normal: new THREE.Vector3(...normal),
        enabled: true,
        color: '#ff6b6b',
      })
    },
    [addPlane, getDefaultPosition]
  )

  const handlePositionChange = useCallback(
    (id: string, axis: 'x' | 'y' | 'z', value: number) => {
      const plane = planes.find((p) => p.id === id)
      if (plane) {
        const newPos = plane.position.clone()
        newPos[axis] = value
        updatePlane(id, { position: newPos })
      }
    },
    [planes, updatePlane]
  )

  const getAxisForNormal = (normal: THREE.Vector3): 'x' | 'y' | 'z' => {
    if (Math.abs(normal.z) > 0.9) return 'z'
    if (Math.abs(normal.y) > 0.9) return 'y'
    return 'x'
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
          const range = modelBoundingBox
            ? (() => {
                const size = new THREE.Vector3()
                modelBoundingBox.getSize(size)
                return { min: -size[axis] / 2, max: size[axis] / 2 }
              })()
            : { min: -5, max: 5 }

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
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {getOrientationLabel(plane.normal)} Plane
                    </span>
                    <span className="text-xs text-gray-400">
                      Arrow shows cut direction
                    </span>
                  </div>
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

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-12">
                  {axis.toUpperCase()} pos:
                </span>
                <input
                  type="range"
                  min={range.min}
                  max={range.max}
                  step={0.1}
                  value={plane.position[axis]}
                  onChange={(e) =>
                    handlePositionChange(plane.id, axis, parseFloat(e.target.value))
                  }
                  className="flex-1"
                />
                <span className="text-xs text-gray-600 w-10 text-right font-mono">
                  {plane.position[axis].toFixed(1)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

import { useCallback } from 'react'
import * as THREE from 'three'
import { useSlicerStore } from '../store'

interface CrossSectionViewProps {
  planeId: string
  width?: number
  height?: number
}

export function CrossSectionView({ planeId, width = 200, height = 200 }: CrossSectionViewProps) {
  const plane = useSlicerStore((s) => s.planes.find((p) => p.id === planeId))
  const modelUrl = useSlicerStore((s) => s.modelUrl)
  const modelBoundingBox = useSlicerStore((s) => s.modelBoundingBox)

  const canvasRef = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas || !plane || !plane.enabled) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = '#1a1a2e'
      ctx.fillRect(0, 0, width, height)

      if (!modelBoundingBox || !modelUrl) {
        ctx.fillStyle = '#666'
        ctx.font = '12px system-ui'
        ctx.textAlign = 'center'
        ctx.fillText('No model loaded', width / 2, height / 2)
        return
      }

      const center = new THREE.Vector3()
      modelBoundingBox.getCenter(center)
      const size = new THREE.Vector3()
      modelBoundingBox.getSize(size)
      const maxDim = Math.max(size.x, size.y, size.z)

      const scale = (Math.min(width, height) * 0.8) / maxDim
      const offsetX = width / 2 - center.x * scale
      const offsetY = height / 2 - center.y * scale

      ctx.strokeStyle = plane.color
      ctx.lineWidth = 2

      const normals: Record<string, [number, number, number]> = {
        xy: [0, 0, 1],
        xz: [0, 1, 0],
        yz: [1, 0, 0],
      }

      const n = plane.normal
      let planeType = 'xy'
      for (const [key, val] of Object.entries(normals)) {
        const nArr = [n.x, n.y, n.z]
        if (
          Math.abs(nArr[0] - val[0]) < 0.01 &&
          Math.abs(nArr[1] - val[1]) < 0.01 &&
          Math.abs(nArr[2] - val[2]) < 0.01
        ) {
          planeType = key
          break
        }
      }

      ctx.beginPath()
      if (planeType === 'xy') {
        ctx.rect(
          offsetX + (center.x - size.x / 2) * scale,
          offsetY + (center.y - size.y / 2) * scale,
          size.x * scale,
          size.y * scale
        )
      } else if (planeType === 'xz') {
        ctx.rect(
          offsetX + (center.x - size.x / 2) * scale,
          offsetY + (center.z - size.z / 2) * scale,
          size.x * scale,
          size.z * scale
        )
      } else {
        ctx.rect(
          offsetX + (center.y - size.y / 2) * scale,
          offsetY + (center.z - size.z / 2) * scale,
          size.y * scale,
          size.z * scale
        )
      }
      ctx.stroke()

      ctx.fillStyle = plane.color
      ctx.font = '10px system-ui'
      ctx.textAlign = 'center'
      ctx.fillText(`${planeType.toUpperCase()} Slice`, width / 2, 15)
    },
    [plane, width, height, modelBoundingBox, modelUrl]
  )

  if (!plane) return null

  return (
    <div className="flex flex-col items-center gap-1">
      <canvas ref={canvasRef} width={width} height={height} className="rounded border border-gray-600" />
      <span className="text-xs text-gray-400">{plane.color}</span>
    </div>
  )
}

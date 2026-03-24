import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Bounds } from '@react-three/drei'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useSlicerStore } from '../store'
import type { CuttingPlane } from '../store'

// Store original materials to restore when planes change
const originalMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>()

function ClippedModel({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  const planes = useSlicerStore((s) => s.planes)
  const setModelBoundingBox = useSlicerStore((s) => s.setModelBoundingBox)
  const groupRef = useRef<THREE.Group>(null)
  const [boundingBoxSet, setBoundingBoxSet] = useState(false)

  const clippingPlanes = useMemo(() => {
    return planes.filter((p) => p.enabled).map((p) => {
      const plane = new THREE.Plane(p.normal, 0)
      plane.constant = -p.position.dot(p.normal)
      return plane
    })
  }, [planes])

  // Update bounding box once after model loads
  useEffect(() => {
    if (groupRef.current && !boundingBoxSet) {
      // Small delay to let Bounds component finish
      const timeout = setTimeout(() => {
        if (groupRef.current) {
          const box = new THREE.Box3().setFromObject(groupRef.current)
          if (box.min.x !== Infinity && box.max.x !== -Infinity) {
            setModelBoundingBox(box)
            setBoundingBoxSet(true)
          }
        }
      }, 500)
      return () => clearTimeout(timeout)
    }
  }, [setModelBoundingBox, boundingBoxSet])

  useEffect(() => {
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Store original material if not already stored
        if (!originalMaterials.has(child)) {
          originalMaterials.set(child, child.material)
        }

        // Clone material to add clipping planes without modifying original
        const originalMaterial = originalMaterials.get(child)!
        if (Array.isArray(originalMaterial)) {
          child.material = originalMaterial.map((mat) => {
            const cloned = mat.clone()
            cloned.clippingPlanes = clippingPlanes
            cloned.clipShadows = true
            cloned.side = THREE.DoubleSide
            cloned.needsUpdate = true
            return cloned
          })
        } else {
          const cloned = originalMaterial.clone()
          cloned.clippingPlanes = clippingPlanes
          cloned.clipShadows = true
          cloned.side = THREE.DoubleSide
          cloned.needsUpdate = true
          child.material = cloned
        }
      }
    })
  }, [scene, clippingPlanes])

  return (
    <Bounds fit observe margin={1.2}>
      <group ref={groupRef}>
        <primitive object={scene} />
      </group>
    </Bounds>
  )
}

function PlaneHelper({ plane }: { plane: CuttingPlane }) {
  const position = plane.position
  const normal = plane.normal
  const modelBoundingBox = useSlicerStore((s) => s.modelBoundingBox)

  // Calculate grid dimensions based on model bounding box
  // Use the actual dimensions needed for each plane orientation
  const { gridWidth, gridHeight } = useMemo(() => {
    if (modelBoundingBox) {
      const size = new THREE.Vector3()
      modelBoundingBox.getSize(size)

      // Ensure minimum size
      const minSize = 0.5

      // Top (Axial): normal [0, 1, 0] - plane parallel to XZ, needs X and Z
      // Front (Coronal): normal [0, 0, 1] - plane parallel to XY, needs X and Y
      // Side (Sagittal): normal [1, 0, 0] - plane parallel to YZ, needs Y and Z
      if (Math.abs(normal.y) > 0.9) {
        // Top/Axial - horizontal plane, needs X and Z
        return { gridWidth: Math.max(size.x, minSize), gridHeight: Math.max(size.z, minSize) }
      } else if (Math.abs(normal.z) > 0.9) {
        // Front/Coronal - vertical plane facing front, needs X and Y
        return { gridWidth: Math.max(size.x, minSize), gridHeight: Math.max(size.y, minSize) }
      } else {
        // Side/Sagittal - vertical plane facing side, needs Y and Z
        return { gridWidth: Math.max(size.y, minSize), gridHeight: Math.max(size.z, minSize) }
      }
    }
    // Default size when no model loaded
    return { gridWidth: 3, gridHeight: 3 }
  }, [modelBoundingBox, normal])

  const rotation = useMemo(() => {
    const axis = new THREE.Vector3(0, 1, 0)
    const quat = new THREE.Quaternion().setFromUnitVectors(axis, normal)
    return new THREE.Euler().setFromQuaternion(quat)
  }, [normal])

  // Create grid lines using lines
  const gridLines = useMemo(() => {
    const lines: { start: THREE.Vector3; end: THREE.Vector3 }[] = []
    const divisions = 8
    const halfW = gridWidth / 2
    const halfH = gridHeight / 2

    // Horizontal lines (across width)
    for (let i = 0; i <= divisions; i++) {
      const pos = -halfH + (i * gridHeight) / divisions
      lines.push({
        start: new THREE.Vector3(-halfW, 0, pos),
        end: new THREE.Vector3(halfW, 0, pos),
      })
    }
    // Vertical lines (across height)
    for (let i = 0; i <= divisions; i++) {
      const pos = -halfW + (i * gridWidth) / divisions
      lines.push({
        start: new THREE.Vector3(pos, 0, -halfH),
        end: new THREE.Vector3(pos, 0, halfH),
      })
    }
    return lines
  }, [gridWidth, gridHeight])

  if (!plane.enabled) return null

  const halfW = gridWidth / 2
  const halfH = gridHeight / 2

  return (
    <group position={[position.x, position.y, position.z]} rotation={rotation}>
      {/* Main semi-transparent surface */}
      <mesh>
        <planeGeometry args={[gridWidth, gridHeight]} />
        <meshBasicMaterial
          color={plane.color}
          transparent
          opacity={0.06}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Grid lines */}
      {gridLines.map((line, i) => (
        <line key={i}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[new Float32Array([line.start.x, line.start.y, line.start.z, line.end.x, line.end.y, line.end.z]), 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial color={plane.color} transparent opacity={0.4} />
        </line>
      ))}

      {/* Edge outline */}
      <lineLoop>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([
              -halfW, 0, -halfH,
              halfW, 0, -halfH,
              halfW, 0, halfH,
              -halfW, 0, halfH,
            ]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color={plane.color} linewidth={2} />
      </lineLoop>
    </group>
  )
}

function CuttingPlanesVisual() {
  const planes = useSlicerStore((s) => s.planes)

  return (
    <>
      {planes.map((plane) => (
        <PlaneHelper key={plane.id} plane={plane} />
      ))}
    </>
  )
}

function SceneSetup() {
  const { gl } = useThree()
  useEffect(() => {
    gl.localClippingEnabled = true
  }, [gl])
  return null
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <directionalLight position={[-5, -5, -5]} intensity={0.3} />
    </>
  )
}

export function Viewport3D() {
  const modelUrl = useSlicerStore((s) => s.modelUrl)

  return (
    <div className="w-full h-full bg-gray-900 rounded-lg overflow-hidden">
      <Canvas
        camera={{ position: [3, 3, 3], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
      >
        <SceneSetup />
        <color attach="background" args={['#1a1a2e']} />
        <Lights />
        {modelUrl && <ClippedModel url={modelUrl} />}
        <CuttingPlanesVisual />
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  )
}
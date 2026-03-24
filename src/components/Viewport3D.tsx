import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, Bounds } from '@react-three/drei'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useSlicerStore } from '../store'
import type { CuttingPlane } from '../store'

// Store original materials to restore when planes change
const originalMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>()

// Calculate rotated normal from base normal and rotation angles
function getRotatedNormal(baseNormal: THREE.Vector3, rotationX: number, rotationY: number): THREE.Vector3 {
  // Start with base normal
  const normal = baseNormal.clone()

  // Create rotation quaternions
  // For a plane facing up (normal = [0,1,0]):
  // - rotationX tilts it forward/back (around X axis)
  // - rotationY tilts it left/right (around Z axis for horizontal plane)

  // Find perpendicular axes for the plane
  let tangent1 = new THREE.Vector3()
  let tangent2 = new THREE.Vector3()

  if (Math.abs(baseNormal.y) > 0.9) {
    // Top plane (Y-up): X and Z are the plane's local axes
    tangent1.set(1, 0, 0)  // X axis - for tiltX
    tangent2.set(0, 0, 1)  // Z axis - for tiltY
  } else if (Math.abs(baseNormal.z) > 0.9) {
    // Front plane (Z-facing): X and Y are the plane's local axes
    tangent1.set(1, 0, 0)  // X axis - for tiltY (rotate around Y actually)
    tangent2.set(0, 1, 0)  // Y axis - for tiltX
  } else {
    // Side plane (X-facing): Y and Z are the plane's local axes
    tangent1.set(0, 1, 0)  // Y axis - for tiltY
    tangent2.set(0, 0, 1)  // Z axis - for tiltX
  }

  // Apply rotations in degrees
  const quatX = new THREE.Quaternion().setFromAxisAngle(tangent1, THREE.MathUtils.degToRad(rotationX))
  const quatY = new THREE.Quaternion().setFromAxisAngle(tangent2, THREE.MathUtils.degToRad(rotationY))

  // Apply rotations to normal
  normal.applyQuaternion(quatX)
  normal.applyQuaternion(quatY)
  normal.normalize()

  return normal
}

function ClippedModel({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  const planes = useSlicerStore((s) => s.planes)
  const setModelBoundingBox = useSlicerStore((s) => s.setModelBoundingBox)
  const groupRef = useRef<THREE.Group>(null)
  const lastBoundingBox = useRef<THREE.Box3 | null>(null)

  const clippingPlanes = useMemo(() => {
    return planes.filter((p) => p.enabled).map((p) => {
      // Calculate rotated normal
      const rotatedNormal = getRotatedNormal(p.normal, p.rotationX || 0, p.rotationY || 0)
      const plane = new THREE.Plane(rotatedNormal, 0)
      plane.constant = -p.position.dot(rotatedNormal)
      return plane
    })
  }, [planes])

  // Update bounding box continuously but only when it changes
  useFrame(() => {
    if (groupRef.current) {
      const box = new THREE.Box3().setFromObject(groupRef.current)
      if (box.min.x !== Infinity && box.max.x !== -Infinity) {
        // Only update if bounding box actually changed
        if (!lastBoundingBox.current ||
            !lastBoundingBox.current.equals(box)) {
          setModelBoundingBox(box.clone())
          lastBoundingBox.current = box.clone()
        }
      }
    }
  })

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
  const baseNormal = plane.normal
  const rotationX = plane.rotationX || 0
  const rotationY = plane.rotationY || 0
  const modelBoundingBox = useSlicerStore((s) => s.modelBoundingBox)

  // Calculate grid dimensions based on model bounding box
  // Each plane orientation needs different dimensions
  const { gridWidth, gridHeight } = useMemo(() => {
    if (modelBoundingBox) {
      const size = new THREE.Vector3()
      modelBoundingBox.getSize(size)
      const minSize = 0.5

      // Top (Y normal): plane is parallel to XZ, needs X and Z
      // Front (Z normal): plane is parallel to XY, needs X and Y
      // Side (X normal): plane is parallel to YZ, needs Y and Z
      if (Math.abs(baseNormal.y) > 0.9) {
        // Top plane - needs X and Z
        return {
          gridWidth: Math.max(size.x, minSize),
          gridHeight: Math.max(size.z, minSize)
        }
      } else if (Math.abs(baseNormal.z) > 0.9) {
        // Front plane - needs X and Y
        return {
          gridWidth: Math.max(size.x, minSize),
          gridHeight: Math.max(size.y, minSize)
        }
      } else {
        // Side plane - needs Y and Z
        return {
          gridWidth: Math.max(size.y, minSize),
          gridHeight: Math.max(size.z, minSize)
        }
      }
    }
    return { gridWidth: 3, gridHeight: 3 }
  }, [modelBoundingBox, baseNormal])

  // Calculate plane rotation for visualization
  const rotation = useMemo(() => {
    // Start with base rotation (to align plane with base normal)
    const baseQuat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0), // Default plane normal (Y-up)
      baseNormal
    )

    // Apply tilt rotations
    const tiltX = THREE.MathUtils.degToRad(rotationX)
    const tiltY = THREE.MathUtils.degToRad(rotationY)

    // Create Euler for tilt (applied in local plane coordinates)
    const tiltEuler = new THREE.Euler(tiltX, 0, tiltY)
    const tiltQuat = new THREE.Quaternion().setFromEuler(tiltEuler)

    // Combine rotations
    const finalQuat = baseQuat.clone().multiply(tiltQuat)
    return new THREE.Euler().setFromQuaternion(finalQuat)
  }, [baseNormal, rotationX, rotationY])

  // Create grid lines
  const gridLines = useMemo(() => {
    const lines: { start: THREE.Vector3; end: THREE.Vector3 }[] = []
    const divisions = 8
    const halfW = gridWidth / 2
    const halfH = gridHeight / 2

    for (let i = 0; i <= divisions; i++) {
      const pos = -halfH + (i * gridHeight) / divisions
      lines.push({
        start: new THREE.Vector3(-halfW, 0, pos),
        end: new THREE.Vector3(halfW, 0, pos),
      })
    }
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
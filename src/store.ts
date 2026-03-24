import { create } from 'zustand'
import * as THREE from 'three'

export interface CuttingPlane {
  id: string
  position: THREE.Vector3
  normal: THREE.Vector3
  enabled: boolean
  color: string
}

interface SlicerState {
  // Model
  modelUrl: string | null
  modelBoundingBox: THREE.Box3 | null

  // Planes
  planes: CuttingPlane[]

  // Actions
  setModelUrl: (url: string | null) => void
  setModelBoundingBox: (box: THREE.Box3 | null) => void
  addPlane: (plane: Omit<CuttingPlane, 'id'>) => void
  removePlane: (id: string) => void
  updatePlane: (id: string, updates: Partial<CuttingPlane>) => void
  togglePlane: (id: string) => void
  clearPlanes: () => void
}

const PLANE_COLORS = [
  '#ff6b6b',
  '#4ecdc4',
  '#45b7d1',
  '#96ceb4',
  '#ffeaa7',
  '#dfe6e9',
]

let planeIdCounter = 0

export const useSlicerStore = create<SlicerState>((set, get) => ({
  modelUrl: null,
  modelBoundingBox: null,
  planes: [],

  setModelUrl: (url) => set({ modelUrl: url }),

  setModelBoundingBox: (box) => set({ modelBoundingBox: box }),

  addPlane: (plane) => {
    const id = `plane-${++planeIdCounter}`
    const color = PLANE_COLORS[get().planes.length % PLANE_COLORS.length]
    set((state) => ({
      planes: [...state.planes, { ...plane, id, color }],
    }))
  },

  removePlane: (id) =>
    set((state) => ({
      planes: state.planes.filter((p) => p.id !== id),
    })),

  updatePlane: (id, updates) =>
    set((state) => ({
      planes: state.planes.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    })),

  togglePlane: (id) =>
    set((state) => ({
      planes: state.planes.map((p) =>
        p.id === id ? { ...p, enabled: !p.enabled } : p
      ),
    })),

  clearPlanes: () => set({ planes: [] }),
}))

import { useSlicerStore } from './store'
import { Viewport3D } from './components/Viewport3D'
import { CrossSectionView } from './components/CrossSectionView'
import { Controls } from './components/Controls'
import { ModelLoader } from './components/ModelLoader'

function App() {
  const planes = useSlicerStore((s) => s.planes)

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-gray-800">3D Model Slicer</h1>
        <p className="text-sm text-gray-500">Upload a GLB model and cut through it with planes</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="h-[500px]">
            <Viewport3D />
          </div>

          <div className="bg-white rounded-lg p-4">
            <h3 className="font-semibold text-gray-700 mb-3">2D Cross-Sections</h3>
            {planes.length === 0 ? (
              <p className="text-sm text-gray-400">Add cutting planes to see 2D slices</p>
            ) : (
              <div className="flex flex-wrap gap-4">
                {planes.map((plane) => (
                  <CrossSectionView key={plane.id} planeId={plane.id} width={180} height={180} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <ModelLoader />
          <Controls />
        </div>
      </div>
    </div>
  )
}

export default App

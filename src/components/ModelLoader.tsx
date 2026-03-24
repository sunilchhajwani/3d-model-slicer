import { useCallback, useState } from 'react'
import { useSlicerStore } from '../store'

export function ModelLoader() {
  const [isDragging, setIsDragging] = useState(false)
  const setModelUrl = useSlicerStore((s) => s.setModelUrl)
  const modelUrl = useSlicerStore((s) => s.modelUrl)

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith('.glb') && !file.name.endsWith('.gltf')) {
        alert('Please upload a .glb or .gltf file')
        return
      }
      const url = URL.createObjectURL(file)
      setModelUrl(url)
    },
    [setModelUrl]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-700">Upload GLB Model</label>
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".glb,.gltf"
          onChange={handleInputChange}
          className="hidden"
        />
        {modelUrl ? (
          <span className="text-green-600">Model loaded! Drop a new file to replace</span>
        ) : (
          <span className="text-gray-500">Drop .glb/.gltf file here or click to browse</span>
        )}
      </div>
    </div>
  )
}

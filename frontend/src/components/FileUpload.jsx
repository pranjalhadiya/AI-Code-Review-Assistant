import { useState, useRef } from 'react'  
import { uploadFile } from '../services/projectService'  

function FileUpload({ onUploadSuccess }) {
 
  const [selectedFile, setSelectedFile] = useState(null)  
  const [isDragging, setIsDragging] = useState(false)      
  const [uploading, setUploading] = useState(false)         
  const [error, setError] = useState('')                      
  const [successMessage, setSuccessMessage] = useState('')    

  const fileInputRef = useRef(null)
  
  const resetMessages = () => {
    setError('')
    setSuccessMessage('')
  }

  const handleFileSelect = (file) => {
    resetMessages()
    setSelectedFile(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()  
    setIsDragging(false)
    const file = e.dataTransfer.files[0]  
    if (file) handleFileSelect(file)
  }

  const handleDragOver = (e) => {
    e.preventDefault()  
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleFileInputChange = (e) => {
    const file = e.target.files[0]  
    if (file) handleFileSelect(file)
  }

  const handleUploadClick = async () => {
    if (!selectedFile) return  

    resetMessages()
    setUploading(true)

    try {
      const project = await uploadFile(selectedFile)
      setSuccessMessage(`"${project.project_name}" uploaded successfully.`)
      setSelectedFile(null)  

      if (onUploadSuccess) {
        onUploadSuccess(project)
       
      }
    } catch (err) {
      const message = err.response?.data?.detail || 'Upload failed. Please try again.'
      setError(message)
    } finally {
      setUploading(false)
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

   return (
    <div className="w-full">
      
      <div
        onClick={() => fileInputRef.current.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-cyan-400 bg-cyan-500/5'
            : 'border-slate-700 hover:border-slate-600 bg-slate-900'
        }`}
        
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".py"
         
          onChange={handleFileInputChange}
          className="hidden"
          
        />

        {selectedFile ? (
          <div>
            <p className="text-slate-200 font-medium">{selectedFile.name}</p>
            <p className="text-slate-500 text-sm mt-1">{formatFileSize(selectedFile.size)}</p>
          </div>
        ) : (
          <div>
            <p className="text-slate-300">Drag and drop a Python file here</p>
            <p className="text-slate-500 text-sm mt-1">or click to browse — .py files only, max 2MB</p>
          </div>
        )}
      </div>

      
      {error && (
        <div className="bg-red-950 border border-red-800 text-red-300 text-sm rounded-lg p-3 mt-4">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="bg-emerald-950 border border-emerald-800 text-emerald-300 text-sm rounded-lg p-3 mt-4">
          {successMessage}
        </div>
      )}

      
      {selectedFile && (
        <button
          onClick={handleUploadClick}
          disabled={uploading}
          className="mt-4 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:cursor-not-allowed text-slate-950 font-semibold rounded-lg px-6 py-2 transition-colors"
         
        >
          {uploading ? 'Uploading...' : 'Upload File'}
        </button>
      )}
    </div>
  )
}

export default FileUpload
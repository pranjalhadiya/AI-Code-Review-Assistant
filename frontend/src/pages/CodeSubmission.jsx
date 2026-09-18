import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'  
import Sidebar from '../components/Sidebar'
import FileUpload from '../components/FileUpload'  

function CodeSubmission() {
  const { user, loading } = useAuth()
  const [uploadedProjects, setUploadedProjects] = useState([])
  
  const handleUploadSuccess = (project) => {
    
    setUploadedProjects((prev) => [project, ...prev])
   
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      <Sidebar userName={user?.name} />

      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold text-slate-100 mb-2">Submit Code</h1>
        <p className="text-slate-400 mb-8">
          Upload a Python file to begin static analysis and AI-powered review.
        </p>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8">
          <FileUpload onUploadSuccess={handleUploadSuccess} />
        </div>

        {uploadedProjects.length > 0 && (
          
          <div>
            <h2 className="text-lg font-semibold text-slate-200 mb-3">Uploaded this session</h2>
            <div className="flex flex-col gap-2">
              {uploadedProjects.map((project) => (
                <div
                  key={project.id}
                  
                  className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 flex justify-between items-center"
                >
                  <span className="text-slate-200 text-sm">{project.project_name}</span>
                  <span className="text-slate-500 text-xs">
                    {new Date(project.created_at).toLocaleString()}
                    
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default CodeSubmission
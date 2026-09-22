import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import Sidebar from '../components/Sidebar'
import FileUpload from '../components/FileUpload'
import { analyzeProject } from '../services/reviewService' 

function CodeSubmission() {
  const { user, loading } = useAuth()
  const [uploadedProjects, setUploadedProjects] = useState([])
  const [reviews, setReviews] = useState({})
 
  const [analyzingId, setAnalyzingId] = useState(null)

  const handleUploadSuccess = (project) => {
    setUploadedProjects((prev) => [project, ...prev])
  }

  const handleAnalyzeClick = async (projectId) => {
    setAnalyzingId(projectId)
    try {
      const review = await analyzeProject(projectId)
      setReviews((prev) => ({ ...prev, [projectId]: review }))
   
    } catch (err) {
      console.error('Analysis failed:', err)
  
      alert('Analysis failed. Check the console for details.')
     
    } finally {
      setAnalyzingId(null)
    }
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
            <div className="flex flex-col gap-4">
              {uploadedProjects.map((project) => (
                <div
                  key={project.id}
                  className="bg-slate-900 border border-slate-800 rounded-lg p-4"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-slate-200 text-sm font-medium">{project.project_name}</span>
                      <span className="text-slate-500 text-xs block mt-1">
                        {new Date(project.created_at).toLocaleString()}
                      </span>
                    </div>

                    <button
                      onClick={() => handleAnalyzeClick(project.id)}
                      disabled={analyzingId === project.id}
                      className="bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:cursor-not-allowed text-slate-950 text-sm font-semibold rounded-lg px-4 py-2 transition-colors"
                    >
                      {analyzingId === project.id ? 'Analyzing...' : 'Analyze'}
                    </button>
                  </div>

                  {reviews[project.id] && (
                   
                    <div className="mt-4 pt-4 border-t border-slate-800">
                      <p className="text-slate-300 text-sm mb-2">
                        <span className="font-semibold text-cyan-400">
                          Score: {reviews[project.id].review_score}/100
                        </span>
                        {' — '}
                        {reviews[project.id].summary}
                      </p>

                      {reviews[project.id].findings.length === 0 ? (
                        <p className="text-slate-500 text-sm">No issues found. Clean code!</p>
                      ) : (
                        <ul className="flex flex-col gap-1 mt-2">
                          {reviews[project.id].findings.map((finding) => (
                            <li
                              key={finding.id}
                              className="text-xs text-slate-400 bg-slate-800/50 rounded px-3 py-2"
                            >
                              <span className="text-slate-300 font-medium">[{finding.severity}]</span>{' '}
                              {finding.issue} — {finding.explanation}
                              {finding.line_number && ` (line ${finding.line_number})`}
                             
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
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
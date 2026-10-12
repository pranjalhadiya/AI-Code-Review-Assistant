import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Sidebar from '../components/Sidebar'
import FileUpload from '../components/FileUpload'
import CodeWriter from '../components/CodeWriter'          // NEW
import { analyzeProject } from '../services/reviewService'
import { submitCode } from '../services/projectService'    // NEW

function CodeSubmission() {
  const { user, loading } = useAuth()
  const [uploadedProjects, setUploadedProjects] = useState([])
  const [analyzingId, setAnalyzingId] = useState(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  const [mode, setMode] = useState('upload')                 // NEW: 'upload' | 'write'
  const [writerOpened, setWriterOpened] = useState(false)    // NEW: becomes true on first visit to Write Code, then stays true
  const [codeSubmitting, setCodeSubmitting] = useState(false) // NEW: a Write Code analysis is running
  const [codeError, setCodeError] = useState('')              // NEW

  const navigate = useNavigate()

  const isBusy = analyzingId !== null || codeSubmitting
  // NEW: "any analysis is running", whichever flow started it.

  useEffect(() => {
    if (!isBusy) return
    setElapsedSeconds(0)
    const timer = setInterval(() => setElapsedSeconds((seconds) => seconds + 1), 1000)
    return () => clearInterval(timer)
  }, [isBusy])
  // CHANGED: was keyed on [analyzingId]. Now one timer serves both flows. Still above the
  // `if (loading) return` below, because hooks can't come after an early return.

  const selectMode = (nextMode) => {
    setMode(nextMode)
    if (nextMode === 'write') setWriterOpened(true)
  }

  const handleUploadSuccess = (project) => {
    setUploadedProjects((prev) => [project, ...prev])
  }

  const handleAnalyzeClick = async (projectId) => {
    setAnalyzingId(projectId)
    try {
      const review = await analyzeProject(projectId)
      navigate(`/review/${review.id}`)
    } catch (err) {
      console.error('Analysis failed:', err)
      const message = err.response?.data?.detail || 'Analysis failed. Please try again.'
      alert(message)
    } finally {
      setAnalyzingId(null)
    }
  }

  // NEW: Write Code flow = save the code as a project, then run the same analysis as an upload.
  const handleWriteCodeAnalyze = async (code, language) => {
    setCodeError('')
    setCodeSubmitting(true)
    let project = null
    try {
      project = await submitCode(code, language)
      const review = await analyzeProject(project.id)
      navigate(`/review/${review.id}`)
    } catch (err) {
      console.error('Write Code analysis failed:', err)
      const detail = err.response?.data?.detail
      const message = typeof detail === 'string' ? detail : 'Analysis failed. Please try again.'
      // FastAPI validation errors (422) send `detail` as an array, which would render as
      // "[object Object]", so only a string is shown as-is.
      if (project) {
        // The code WAS saved; only the analysis failed. List it so the user can retry with
        // the normal Analyze button instead of creating a duplicate project.
        handleUploadSuccess(project)
        setCodeError(`${message} Your code was saved. You can retry from the list below.`)
      } else {
        setCodeError(message)
      }
    } finally {
      setCodeSubmitting(false)
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
          Upload a file or write code (Python, C, or Java) to begin static analysis and AI-powered review.
        </p>
        {/* CHANGED: the old text said "Upload a Python file", which has been out of date since C and Java support. */}

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8">
          {/* NEW: mode toggle */}
          <div className="flex gap-2 mb-4">
            <ModeButton label="Upload File" active={mode === 'upload'} onClick={() => selectMode('upload')} />
            <ModeButton label="Write Code" active={mode === 'write'} onClick={() => selectMode('write')} />
          </div>

          <div className={mode === 'upload' ? '' : 'hidden'}>
            <FileUpload onUploadSuccess={handleUploadSuccess} />
            {/* UNCHANGED component. Only wrapped so it can be hidden without being unmounted. */}
          </div>

          {writerOpened && (
            <div className={mode === 'write' ? '' : 'hidden'}>
              <CodeWriter
                onAnalyze={handleWriteCodeAnalyze}
                busy={isBusy}
                busyLabel={codeSubmitting ? `Analyzing... ${elapsedSeconds}s` : 'Analysis in progress...'}
                error={codeError}
              />
              {codeSubmitting && (
                <p className="text-slate-500 text-xs mt-3">
                  Running static analysis and AI review. This can take up to a minute. Please keep this page open.
                </p>
              )}
            </div>
          )}
        </div>

        {uploadedProjects.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-slate-200 mb-3">Uploaded this session</h2>
            <div className="flex flex-col gap-2">
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
                      disabled={isBusy}
                      // CHANGED: was `analyzingId !== null`. Also disabled while a Write Code
                      // analysis runs, so two analyses can't overlap and burn the Groq quota.
                      className="bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:cursor-not-allowed text-slate-950 text-sm font-semibold rounded-lg px-4 py-2 transition-colors"
                    >
                      {analyzingId === project.id ? `Analyzing... ${elapsedSeconds}s` : 'Analyze'}
                    </button>
                  </div>

                  {analyzingId === project.id && (
                    <p className="text-slate-500 text-xs mt-3">
                      Running static analysis and AI review. This can take up to a minute. Please keep this page open.
                    </p>
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

// NEW: same visual language as the filter buttons on the Review page.
function ModeButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
        active
          ? 'bg-cyan-500 text-slate-950'
          : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
      }`}
    >
      {label}
    </button>
  )
}

export default CodeSubmission
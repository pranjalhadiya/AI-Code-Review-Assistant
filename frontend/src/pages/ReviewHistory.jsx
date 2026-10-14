import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Sidebar from '../components/Sidebar'
import { listReviews, deleteReview } from '../services/reviewService'  

const LANGUAGE_LABELS = { python: 'Python', c: 'C', java: 'Java' }

const LANGUAGE_OPTIONS = [
  { value: '', label: 'All languages' },
  { value: 'python', label: 'Python' },
  { value: 'c', label: 'C' },
  { value: 'java', label: 'Java' },
]
const SCORE_OPTIONS = [
  { value: '', label: 'All scores' },
  { value: 'good', label: 'Good', hint: '80 and above' },
  { value: 'needs_improvement', label: 'Needs Improvement', hint: '50 to 79' },
  { value: 'poor', label: 'Poor', hint: 'below 50' },
]
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'score_desc', label: 'Score: high to low' },
  { value: 'score_asc', label: 'Score: low to high' },
  { value: 'name', label: 'Name: A to Z' },
]

const SEARCH_DEBOUNCE_MS = 300

function getScoreColor(score) {
  if (score === null || score === undefined) return 'text-slate-500'
  if (score >= 80) return 'text-emerald-400'
  if (score >= 50) return 'text-amber-400'
  return 'text-red-400'
}

function ReviewHistory() {
  const { user, loading: authLoading } = useAuth()

  const [reviews, setReviews] = useState([])
  const [hasLoaded, setHasLoaded] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')

  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [language, setLanguage] = useState('')
  const [score, setScore] = useState('')
  const [sort, setSort] = useState('newest')

  const [refreshKey, setRefreshKey] = useState(0)        
  const [confirmingId, setConfirmingId] = useState(null) 
  const [deletingId, setDeletingId] = useState(null)     
  const [deleteError, setDeleteError] = useState('')     

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    let cancelled = false

    const fetchReviews = async () => {
      setFetching(true)
      try {
        const data = await listReviews({ search: debouncedSearch, language, score, sort })
        if (cancelled) return
        setReviews(data)
        setError('')
      } catch (err) {
        if (cancelled) return
        const detail = err.response?.data?.detail
        setError(typeof detail === 'string' ? detail : 'Could not load your review history.')
      } finally {
        if (!cancelled) {
          setFetching(false)
          setHasLoaded(true)
        }
      }
    }

    fetchReviews()
    return () => { cancelled = true }
  }, [debouncedSearch, language, score, sort, refreshKey])

  useEffect(() => {
    setConfirmingId(null)
  }, [debouncedSearch, language, score, sort])

  const filtersActive = debouncedSearch !== '' || language !== '' || score !== ''
  const controlsDirty = searchInput.trim() !== '' || language !== '' || score !== ''
  const showControls = !hasLoaded || Boolean(error) || filtersActive || controlsDirty || reviews.length > 0

  const clearFilters = () => {
    setSearchInput('')
    setDebouncedSearch('')
    setLanguage('')
    setScore('')
  }

  // ---------- DELETE ----------
  const removeRow = (id) => {
    setReviews((prev) => prev.filter((item) => item.id !== id))  
    setConfirmingId(null)
    setRefreshKey((n) => n + 1)                                  
  }

  const handleAskDelete = (id) => {
    if (deletingId !== null) return
    setDeleteError('')
    setConfirmingId(id)   
  }

  const handleCancelDelete = () => {
    if (deletingId !== null) return
    setConfirmingId(null)
  }

  const handleConfirmDelete = async (id) => {
    if (deletingId !== null) return
    setDeleteError('')
    setDeletingId(id)
    try {
      await deleteReview(id)
      removeRow(id)
    } catch (err) {
      if (err.response?.status === 404) {
        removeRow(id)
      } else {
        const detail = err.response?.data?.detail
        if (typeof detail === 'string') {
          setDeleteError(`Could not delete the review: ${detail}`)
        } else if (err.response) {
          setDeleteError('Could not delete the review. Please try again.')
        } else {
          setDeleteError('Could not reach the server. The review may not have been deleted. Reload the page to check.')
        }
      }
    } finally {
      setDeletingId(null)
    }
  }

  if (authLoading) {
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
        <h1 className="text-2xl font-bold text-slate-100 mb-2">Review History</h1>
        <p className="text-slate-400 mb-8">Every review you've run. Open one to see its full results.</p>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          {showControls && (
            <div className="mb-5 flex flex-col gap-3">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                maxLength={100}
                placeholder="Search by project name..."
                aria-label="Search reviews by project name"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />

              <div className="flex flex-wrap items-center gap-2">
                {LANGUAGE_OPTIONS.map((option) => (
                  <FilterButton
                    key={option.value || 'all-languages'}
                    label={option.label}
                    active={language === option.value}
                    onClick={() => setLanguage(option.value)}
                  />
                ))}

                <span className="text-slate-700">|</span>

                {SCORE_OPTIONS.map((option) => (
                  <FilterButton
                    key={option.value || 'all-scores'}
                    label={option.label}
                    title={option.hint}
                    active={score === option.value}
                    onClick={() => setScore(option.value)}
                  />
                ))}

                <div className="flex items-center gap-3 ml-auto">
                  {controlsDirty && (
                    <button onClick={clearFilters} className="text-cyan-400 text-xs hover:underline">
                      Clear filters
                    </button>
                  )}
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    aria-label="Sort reviews"
                    className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {deleteError && (
            <div role="alert" className="bg-red-950 border border-red-800 text-red-300 text-sm rounded-lg p-3 mb-4 flex items-start justify-between gap-3">
              <span>{deleteError}</span>
              <button onClick={() => setDeleteError('')} className="shrink-0 text-xs underline text-red-300 hover:text-red-100">
                Dismiss
              </button>
            </div>
          )}

          {!hasLoaded ? (
            <p className="text-slate-500 text-sm">Loading reviews...</p>
          ) : error ? (
            <p className="text-red-400 text-sm">{error}</p>
          ) : reviews.length === 0 ? (
            filtersActive ? (
              <div className="text-center py-8">
                <p className="text-slate-400 text-sm mb-3">No reviews match your search or filters.</p>
                <button onClick={clearFilters} className="text-cyan-400 hover:underline text-sm">
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-slate-400 text-sm mb-3">You haven't run any reviews yet.</p>
                <Link to="/submit" className="text-cyan-400 hover:underline text-sm">Submit code for review</Link>
              </div>
            )
          ) : (
            <>
              <h2 className="text-sm font-semibold text-slate-300 mb-4" aria-live="polite">
                {reviews.length} {filtersActive ? 'matching ' : ''}{reviews.length === 1 ? 'review' : 'reviews'}
              </h2>
              <div className={`flex flex-col gap-2 transition-opacity ${fetching ? 'opacity-60' : ''}`}>
                {reviews.map((item) => (
                  <HistoryRow
                    key={item.id}
                    item={item}
                    isConfirming={confirmingId === item.id}
                    isDeleting={deletingId === item.id}
                    deleteDisabled={deletingId !== null}
                    onAskDelete={() => handleAskDelete(item.id)}
                    onCancelDelete={handleCancelDelete}
                    onConfirmDelete={() => handleConfirmDelete(item.id)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

function FilterButton({ label, active, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
        active
          ? 'bg-cyan-500 text-slate-950'
          : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
      }`}
    >
      {label}
    </button>
  )
}

function HistoryRow({ item, isConfirming, isDeleting, deleteDisabled, onAskDelete, onCancelDelete, onConfirmDelete }) {
  const languageLabel = LANGUAGE_LABELS[item.language] || 'Unknown'

  return (
    <div className="bg-slate-800/50 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors">
      <div className="flex items-center gap-2">
        <Link
          to={`/review/${item.id}`}
          tabIndex={isDeleting ? -1 : undefined}
          className={`flex-1 min-w-0 flex flex-wrap items-center gap-x-6 gap-y-2 p-4 ${isDeleting ? 'pointer-events-none opacity-60' : ''}`}

        >
          <div className="flex-1 min-w-[160px]">
            <div className="flex items-center gap-2">
              <span className="text-slate-100 text-sm font-medium truncate">{item.project_name}</span>
              <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-700/60 text-slate-300">
                {languageLabel}
              </span>
            </div>
            <span className="text-slate-500 text-xs block mt-1">{new Date(item.created_at).toLocaleString()}</span>
          </div>

          <div className="flex gap-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
              <span className="text-slate-300">{item.high_count} High</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              <span className="text-slate-300">{item.medium_count} Medium</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              <span className="text-slate-300">{item.low_count} Low</span>
            </span>
          </div>

          <div className="text-right w-16 shrink-0">
            <div className={`text-xl font-bold ${getScoreColor(item.review_score)}`}>
              {item.review_score ?? 'N/A'}
            </div>
            <div className="text-slate-600 text-[10px]">score</div>
          </div>
        </Link>

        {!isConfirming && (
          <button
            onClick={onAskDelete}
            disabled={deleteDisabled}
            aria-label={`Delete review of ${item.project_name}`}
            className="mr-3 shrink-0 px-2.5 py-1 rounded-md text-xs font-medium text-slate-400 border border-slate-700 hover:text-red-400 hover:border-red-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Delete
          </button>
        )}
      </div>

      {isConfirming && (
        <div
          role="group"
          aria-label={`Confirm deleting review of ${item.project_name}`}
          onKeyDown={(e) => { if (e.key === 'Escape') onCancelDelete() }}
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-800"
        >
          <p className="text-slate-400 text-xs">
            Permanently delete this review? This can't be undone. If it's the project's last review,
            the uploaded code is removed too.
          </p>
          <div className="flex gap-2 shrink-0">
            <button
              autoFocus
              onClick={onCancelDelete}
              disabled={isDeleting}
              className="px-3 py-1 rounded-md text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirmDelete}
              disabled={isDeleting}
              className="px-3 py-1 rounded-md text-xs font-semibold bg-red-500 text-white hover:bg-red-400 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
            >
              {isDeleting ? 'Deleting...' : 'Delete review'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ReviewHistory
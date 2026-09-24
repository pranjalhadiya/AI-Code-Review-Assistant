import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'  
import { useAuth } from '../hooks/useAuth'
import Sidebar from '../components/Sidebar'
import { getReview } from '../services/reviewService' 
import { Bar } from 'react-chartjs-2'

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

function ReviewResults() {
  const { reviewId } = useParams()
  
  const { user, loading: authLoading } = useAuth()
  
  const [review, setReview] = useState(null)
  const [reviewLoading, setReviewLoading] = useState(true)
  const [error, setError] = useState('')

  const [severityFilter, setSeverityFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')

  useEffect(() => {
    const fetchReview = async () => {
      try {
        const data = await getReview(reviewId)
        setReview(data)
      } catch (err) {
        const message = err.response?.data?.detail || 'Failed to load review.'
       
        setError(message)
      } finally {
        setReviewLoading(false)
      }
    }

    fetchReview()
  }, [reviewId])
  
  if (authLoading || reviewLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400">Loading review...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <Link to="/submit" className="text-cyan-400 hover:underline text-sm">
            ← Back to Submit Code
          </Link>
        </div>
      </div>
    )
  }

  const scoreColor = getScoreColor(review.review_score)

  const severityCounts = getSeverityCounts(review.findings)

  const chartData = {
    labels: ['High', 'Medium', 'Low'],
    datasets: [
      {
        label: 'Findings',
        data: [severityCounts.High, severityCounts.Medium, severityCounts.Low],
        backgroundColor: [
          'rgba(248, 113, 113, 0.7)',   
          'rgba(251, 191, 36, 0.7)',     
          'rgba(96, 165, 250, 0.7)',     
        ],
        borderRadius: 4,
     
      },
    ],
  }

  const chartOptions = {
    responsive: true,
   
    plugins: {
      legend: { display: false },
      
    },

    scales: {
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1, color: '#94a3b8' }, 
        grid: { color: '#1e293b' },  
      },
      x: {
        ticks: { color: '#94a3b8' },
        grid: { display: false },  
      },
    },

    }

  const filteredFindings = review.findings.filter((finding) => {
        const matchesSeverity = severityFilter === 'all' || finding.severity === severityFilter
        const matchesCategory = categoryFilter === 'all' || getFindingCategory(finding.issue).key === categoryFilter
        return matchesSeverity && matchesCategory 
  })


  
  return (
    <div className="min-h-screen bg-slate-950 flex">
      <Sidebar userName={user?.name} />

      <main className="flex-1 p-8">
        <Link to="/submit" className="text-slate-500 hover:text-slate-300 text-sm mb-4 inline-block">
          ← Back to Submit Code
        </Link>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 mb-8">
          {/* ---------- HEADER PANEL ---------- */}
          <div className="flex items-center gap-8">
            <div className="text-center">
              <div className={`text-5xl font-bold ${scoreColor}`}>
                {review.review_score ?? 'N/A'}
              </div>
              <div className="text-slate-500 text-sm mt-1">out of 100</div>
            </div>

            <div className="flex-1">
              <h1 className="text-xl font-semibold text-slate-100 mb-2">Review Results</h1>
              <p className="text-slate-400">{review.summary}</p>
              <p className="text-slate-600 text-xs mt-3">
                Analyzed {new Date(review.created_at).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Findings by Severity</h2>
          <div style={{ height: '200px' }}>
            <Bar data={chartData} options={chartOptions} />
          </div>
         </div>
         <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Complexity & Maintainability</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            

            <StatCard
              label="Maintainability"
              value={review.maintainability_index !== null ? review.maintainability_index.toFixed(1) : 'N/A'}
              valueColor={getMaintainabilityColor(review.maintainability_index)}
            />
            <StatCard
              label="Lines of Code"
              value={review.lines_of_code ?? 'N/A'}
              valueColor="text-slate-200"
            />
            <StatCard
              label="Functions"
              value={review.function_count ?? 'N/A'}
              valueColor="text-slate-200"
            />
            <StatCard
              label="Classes"
              value={review.class_count ?? 'N/A'}
              valueColor="text-slate-200"
            />
          </div>
        </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="text-sm font-semibold text-slate-300">
              Findings ({filteredFindings.length} of {review.findings.length})
            </h2>

            <div className="flex flex-wrap gap-2">
              <FilterButton
                label="All Severity"
                active={severityFilter === 'all'}
                onClick={() => setSeverityFilter('all')}
              />
              <FilterButton
                label="High"
                active={severityFilter === 'High'}
                onClick={() => setSeverityFilter('High')}
              />
              <FilterButton
                label="Medium"
                active={severityFilter === 'Medium'}
                onClick={() => setSeverityFilter('Medium')}
              />
              <FilterButton
                label="Low"
                active={severityFilter === 'Low'}
                onClick={() => setSeverityFilter('Low')}
              />

              <span className="text-slate-700">|</span>
             

              <FilterButton
                label="All Types"
                active={categoryFilter === 'all'}
                onClick={() => setCategoryFilter('all')}
              />
              <FilterButton
                label="Quality"
                active={categoryFilter === 'quality'}
                onClick={() => setCategoryFilter('quality')}
              />
              <FilterButton
                label="Security"
                active={categoryFilter === 'security'}
                onClick={() => setCategoryFilter('security')}
              />
              <FilterButton
                label="Complexity"
                active={categoryFilter === 'complexity'}
                onClick={() => setCategoryFilter('complexity')}
              />
            </div>
          </div>

          {filteredFindings.length === 0 ? (
            <p className="text-slate-500 text-sm py-4 text-center">
              {review.findings.length === 0
                ? 'No issues found. Clean code!'
                : 'No findings match the selected filters.'}
              
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {filteredFindings.map((finding) => {
                const category = getFindingCategory(finding.issue)
                return (
                  <li
                    key={finding.id}
                    className="text-xs text-slate-400 bg-slate-800/50 rounded px-3 py-2 flex items-start gap-2"
                  >
                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${category.badgeClass}`}>
                      {category.label}
                    </span>
                    <span>
                      <span className="text-slate-300 font-medium">[{finding.severity}]</span>{' '}
                      {finding.issue} — {finding.explanation}
                      {finding.line_number && ` (line ${finding.line_number})`}
                      {finding.suggestion && (
                        <span className="block text-cyan-400/80 mt-1">💡 {finding.suggestion}</span>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        </div>

      </main>
    </div>
  )
}

function getScoreColor(score) {
  if (score === null || score === undefined) return 'text-slate-500'
  if (score >= 80) return 'text-emerald-400'
  if (score >= 50) return 'text-amber-400'
  return 'text-red-400'
}

function getSeverityCounts(findings) {
    
    const counts = { High: 0, Medium: 0, Low: 0 }

    for (const finding of findings) {
        if (counts[finding.severity] !== undefined) {
        counts[finding.severity] += 1
        }
    }
    return counts
}

function getMaintainabilityColor(mi) {
  if (mi === null || mi === undefined) return 'text-slate-500'
  if (mi >= 20) return 'text-emerald-400'
  if (mi >= 10) return 'text-amber-400'
  return 'text-red-400'
}    

function StatCard({ label, value, valueColor }) {

  return (
    <div className="bg-slate-800/50 border border-slate-800 rounded-lg p-4 text-center">
      <div className={`text-2xl font-bold ${valueColor}`}>{value}</div>
      <div className="text-slate-500 text-xs mt-1">{label}</div>
    </div>
  )
}

function FilterButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
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

function getFindingCategory(issueText) {
 
  if (issueText.startsWith('Security:')) {
    return { key: 'security', label: 'SECURITY', badgeClass: 'bg-red-500/20 text-red-300' }
  }
  if (issueText.startsWith('High complexity:')) {
    return { key: 'complexity', label: 'COMPLEXITY', badgeClass: 'bg-amber-500/20 text-amber-300' }
  }
  return { key: 'quality', label: 'QUALITY', badgeClass: 'bg-cyan-500/20 text-cyan-300' }

}

export default ReviewResults
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Doughnut, Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  ArcElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
} from 'chart.js'
import { useAuth } from '../hooks/useAuth'
import Sidebar from '../components/Sidebar'
import { listReviews } from '../services/reviewService'

// Registering an item twice is harmless, so this can't conflict with ReviewResults' own registration.
ChartJS.register(ArcElement, LineElement, PointElement, CategoryScale, LinearScale, Tooltip)

const SUPPORTED_LANGUAGES = ['python', 'c', 'java']
const LANGUAGE_LABELS = { python: 'Python', c: 'C', java: 'Java' }
const RECENT_COUNT = 5
const TREND_POINTS = 10
const SEVERITY_ROWS = [
  { key: 'High', color: '#f87171' },
  { key: 'Medium', color: '#fbbf24' },
  { key: 'Low', color: '#34d399' },
]

// Same thresholds and colors as the review page, so a score looks the same everywhere.
function getScoreColor(score) {
  if (score === null || score === undefined) return 'text-slate-500'
  if (score >= 80) return 'text-emerald-400'
  if (score >= 50) return 'text-amber-400'
  return 'text-red-400'
}

function computeStats(reviews) {
  const scored = reviews.filter((r) => Number.isFinite(r.review_score))
  const averageScore =
    scored.length > 0
      ? Math.round((scored.reduce((sum, r) => sum + r.review_score, 0) / scored.length) * 10) / 10
      : null

  const severity = {
    High: reviews.reduce((sum, r) => sum + (r.high_count ?? 0), 0),
    Medium: reviews.reduce((sum, r) => sum + (r.medium_count ?? 0), 0),
    Low: reviews.reduce((sum, r) => sum + (r.low_count ?? 0), 0),
  }

  const languages = SUPPORTED_LANGUAGES.filter((lang) => reviews.some((r) => r.language === lang))

  return {
    total: reviews.length,
    scoredCount: scored.length,
    averageScore,
    severity,
    totalIssues: severity.High + severity.Medium + severity.Low,
    languages,
  }
}

function Dashboard() {
  const { user, loading: authLoading } = useAuth()

  const [reviews, setReviews] = useState([])
  const [listLoading, setListLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false  // Ignore a response that arrives after the page was left or retried.

    const load = async () => {
      setListLoading(true)
      setError('')
      try {
        const data = await listReviews()  // GET /review/, the logged-in user's reviews, newest first.
        if (!cancelled) setReviews(data)
      } catch (err) {
        if (cancelled) return
        const detail = err.response?.data?.detail
        setError(typeof detail === 'string' ? detail : 'Could not load your dashboard data.')
      } finally {
        if (!cancelled) setListLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [reloadKey])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400">Loading dashboard...</p>
      </div>
    )
  }

  const stats = computeStats(reviews)
  const recentReviews = reviews.slice(0, RECENT_COUNT)

  // The list is newest-first, so slice keeps the newest N scored reviews and reverse puts them oldest to newest.
  const trendReviews = reviews.filter((r) => Number.isFinite(r.review_score)).slice(0, TREND_POINTS).reverse()

  const severityChartData = {
    labels: SEVERITY_ROWS.map((row) => row.key),
    datasets: [{
      data: SEVERITY_ROWS.map((row) => stats.severity[row.key]),
      backgroundColor: SEVERITY_ROWS.map((row) => row.color),
      borderColor: '#0f172a',  // The panel background, so slices read as separate segments.
      borderWidth: 2,
    }],
  }
  const severityChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: { display: false },  // The custom legend beside the chart carries the counts.
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const value = ctx.parsed
            const pct = stats.totalIssues > 0 ? Math.round((value / stats.totalIssues) * 100) : 0
            return `${ctx.label}: ${value} issue${value === 1 ? '' : 's'} (${pct}%)`
          },
        },
      },
    },
  }

  const trendChartData = {
    labels: trendReviews.map((r) =>
      new Date(r.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    ),
    datasets: [{
      data: trendReviews.map((r) => r.review_score),
      borderColor: '#22d3ee',
      backgroundColor: '#22d3ee',
      pointRadius: 4,
      pointHoverRadius: 6,
      tension: 0.3,
    }],
  }
  const trendChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => trendReviews[items[0].dataIndex]?.project_name ?? '',
          label: (ctx) => `Score: ${ctx.parsed.y}`,
          afterLabel: (ctx) => {
            const r = trendReviews[ctx.dataIndex]
            return r ? new Date(r.created_at).toLocaleString() : ''
          },
        },
      },
    },
    scales: {
      y: { min: 0, max: 100, ticks: { stepSize: 25, color: '#94a3b8' }, grid: { color: '#1e293b' } },
      x: { ticks: { color: '#94a3b8', maxRotation: 0, autoSkip: true, maxTicksLimit: 6 }, grid: { display: false } },
    },
  }

  const averageSubtext =
    stats.scoredCount === 0
      ? 'No scored reviews yet'
      : stats.scoredCount < stats.total
        ? `Based on ${stats.scoredCount} of ${stats.total} reviews`
        : `Across ${stats.total} ${stats.total === 1 ? 'review' : 'reviews'}`

  return (
    <div className="min-h-screen bg-slate-950 flex">
      <Sidebar userName={user?.name} />

      <main className="flex-1 p-8 min-w-0">
        {/* ---------- WELCOME ---------- */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 mb-2">Welcome back, {user?.name}</h1>
            <p className="text-slate-400 max-w-xl">
              Track your code quality over time and get AI-powered insights on every review.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              to="/submit"
              className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm rounded-lg px-4 py-2 transition-colors"
            >
              New Code Review
            </Link>
            <Link
              to="/history"
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-medium rounded-lg px-4 py-2 transition-colors"
            >
              View All Reviews
            </Link>
          </div>
        </div>

        {listLoading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
            <p className="text-slate-500 text-sm">Loading your review data...</p>
          </div>
        ) : error ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
            <p className="text-red-400 text-sm mb-3">{error}</p>
            <button
              onClick={() => setReloadKey((n) => n + 1)}
              className="text-cyan-400 hover:underline text-sm"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            {/* ---------- STATISTICS ---------- */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <DashboardStat
                label="Total Reviews"
                value={stats.total}
                subtext={stats.total === 0 ? 'No reviews yet' : 'Reviews on record'}
              />
              <DashboardStat
                label="Avg. Quality Score"
                value={stats.averageScore ?? '—'}
                valueClass={getScoreColor(stats.averageScore)}
                subtext={averageSubtext}
              />
              <DashboardStat
                label="High-Severity Issues"
                value={stats.severity.High}
                valueClass={
                  stats.total === 0 ? 'text-slate-100' : stats.severity.High > 0 ? 'text-red-400' : 'text-emerald-400'
                }
                subtext={stats.total === 0 ? 'No reviews yet' : 'Across all reviews'}
              />
              <DashboardStat
                label="Languages Reviewed"
                value={stats.languages.length}
                subtext={
                  stats.languages.length > 0
                    ? stats.languages.map((l) => LANGUAGE_LABELS[l]).join(' · ')
                    : 'None yet'
                }
              />
            </div>

            {/* ---------- CHARTS ---------- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="text-sm font-semibold text-slate-300">Issues by Severity</h2>
                <p className="text-slate-500 text-xs mt-1 mb-4">All findings across your reviews.</p>
                {stats.totalIssues === 0 ? (
                  <EmptyChart
                    message={
                      stats.total === 0
                        ? 'Run a review to see your issue distribution.'
                        : 'No issues found in your reviews. Clean code!'
                    }
                  />
                ) : (
                  <div className="flex items-center gap-6">
                    <div style={{ height: '180px', width: '180px' }} className="shrink-0">
                      <Doughnut
                        data={severityChartData}
                        options={severityChartOptions}
                        aria-label="Issues by severity"
                        role="img"
                      />
                    </div>
                    <ul className="flex flex-col gap-2 text-sm">
                      {SEVERITY_ROWS.map((row) => (
                        <li key={row.key} className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: row.color }} />
                          <span className="text-slate-300">{row.key}</span>
                          <span className="text-slate-500 text-xs">
                            {stats.severity[row.key]} ({Math.round((stats.severity[row.key] / stats.totalIssues) * 100)}%)
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="text-sm font-semibold text-slate-300">Quality Score Trend</h2>
                <p className="text-slate-500 text-xs mt-1 mb-4">
                  {trendReviews.length >= 2
                    ? `Your last ${trendReviews.length} scored reviews, oldest to newest.`
                    : 'Overall score of your recent reviews.'}
                </p>
                {trendReviews.length < 2 ? (
                  <EmptyChart message="Run at least two scored reviews to see how your score changes." />
                ) : (
                  <div style={{ height: '180px' }}>
                    <Line data={trendChartData} options={trendChartOptions} aria-label="Quality score trend" role="img" />
                  </div>
                )}
              </div>
            </div>

            {/* ---------- RECENT REVIEWS ---------- */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-300">Recent Reviews</h2>
                {stats.total > 0 && (
                  <Link to="/history" className="text-cyan-400 text-xs hover:underline">
                    View all in Review History
                  </Link>
                )}
              </div>

              {recentReviews.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-slate-400 text-sm mb-3">You haven't run any reviews yet.</p>
                  <Link to="/submit" className="text-cyan-400 hover:underline text-sm">Submit code for review</Link>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {recentReviews.map((item) => (
                    <RecentRow key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function DashboardStat({ label, value, valueClass = 'text-slate-100', subtext }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="text-slate-500 text-xs font-medium uppercase tracking-wide">{label}</div>
      <div className={`text-3xl font-bold mt-2 ${valueClass}`}>{value}</div>
      {subtext && <div className="text-slate-500 text-xs mt-1">{subtext}</div>}
    </div>
  )
}

function EmptyChart({ message }) {
  return (
    <div className="h-[180px] flex items-center justify-center text-center px-4">
      <p className="text-slate-500 text-sm">{message}</p>
    </div>
  )
}

function RecentRow({ item }) {
  return (
    <Link
      to={`/review/${item.id}`}
      className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 bg-slate-800/50 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors"
    >
      <div className="flex-1 min-w-[160px]">
        <div className="flex items-center gap-2">
          <span className="text-slate-100 text-sm font-medium truncate">{item.project_name}</span>
          <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-700/60 text-slate-300">
            {LANGUAGE_LABELS[item.language] || 'Unknown'}
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
        <div className={`text-xl font-bold ${getScoreColor(item.review_score)}`}>{item.review_score ?? 'N/A'}</div>
        <div className="text-slate-600 text-[10px]">score</div>
      </div>
    </Link>
  )
}

export default Dashboard
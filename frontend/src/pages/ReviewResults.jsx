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


const CATEGORY_META = {
  security: { label: 'Security', badgeClass: 'bg-red-500/20 text-red-300', chartColor: 'rgba(248, 113, 113, 0.7)' },
  quality: { label: 'Quality', badgeClass: 'bg-cyan-500/20 text-cyan-300', chartColor: 'rgba(34, 211, 238, 0.7)' },
  complexity: { label: 'Complexity', badgeClass: 'bg-amber-500/20 text-amber-300', chartColor: 'rgba(251, 191, 36, 0.7)' },
  performance: { label: 'Performance', badgeClass: 'bg-orange-500/20 text-orange-300', chartColor: 'rgba(251, 146, 60, 0.7)' },
  best_practice: { label: 'Best Practice', badgeClass: 'bg-sky-500/20 text-sky-300', chartColor: 'rgba(56, 189, 248, 0.7)' },
  code_smell: { label: 'Code Smell', badgeClass: 'bg-fuchsia-500/20 text-fuchsia-300', chartColor: 'rgba(232, 121, 249, 0.7)' },
  naming: { label: 'Naming', badgeClass: 'bg-slate-500/20 text-slate-300', chartColor: 'rgba(148, 163, 184, 0.7)' },
}
const CATEGORY_ORDER = ['security', 'quality', 'performance', 'best_practice', 'code_smell', 'complexity', 'naming']


const SEVERITY_PENALTY = { High: 8, Medium: 4, Low: 1 }



function _legacyCategoryKey(issueText) {

  if (issueText.startsWith('Security:')) return 'security'
  if (issueText.startsWith('High complexity:')) return 'complexity'
  return 'quality'
}

function getCategoryMeta(finding) {
  const key = finding.category || _legacyCategoryKey(finding.issue.replace(/^AI [A-Za-z ]+: /, ''))
  return { key, ...(CATEGORY_META[key] || CATEGORY_META.quality) }
}

function getSourceLabel(finding) {
  const source = finding.source || (finding.issue.startsWith('AI ') ? 'ai' : 'static')

  if (source === 'static+ai') return 'Static Analysis + AI'
  if (source === 'ai') return 'AI'
  return 'Static Analysis'
}

function getDisplayTitle(finding) {
  const source = finding.source || (finding.issue.startsWith('AI ') ? 'ai' : 'static')
  if (source === 'static+ai') return finding.issue 
  if (source === 'ai') return finding.issue.replace(/^AI [A-Za-z ]+: /, '')
  return finding.issue.replace(/^(Security: |High complexity: |C: |Java: )/, '')

}

function getToolLabel(finding) {

  if (finding.issue.startsWith('Security:')) return 'Bandit'
  if (finding.issue.startsWith('High complexity:')) return 'Radon'
  if (finding.issue.startsWith('C:')) return 'Cppcheck'
  if (finding.issue.startsWith('Java:')) return 'PMD'
  return 'Pylint'  
}


function computeCategoryScore(findings, category) {
  const relevantFindings = findings.filter((f) => (f.category || _legacyCategoryKey(f.issue)) === category)
  let score = 100
  for (const finding of relevantFindings) {
    score -= SEVERITY_PENALTY[finding.severity] ?? 4
  }
  return Math.round(Math.max(0, Math.min(score, 100)) * 10) / 10
}

function sourceSucceeded(summaryText, failurePhrase) {
  return !summaryText?.includes(failurePhrase)
}

function computeOverviewScores(review) {
  const summary = review.summary || ''
  const pylintOk = sourceSucceeded(summary, 'code quality scan failed')
  const securityScanOk = sourceSucceeded(summary, 'security scan failed')
  const complexityScanOk = sourceSucceeded(summary, 'complexity scan failed')
  const staticAnalysisOk = sourceSucceeded(summary, 'static analysis scan failed')
  const aiOk = !summary.includes('AI review unavailable')
  const isPython = pylintOk || summary.includes('code quality scan failed')

  const securityComputable = isPython ? (securityScanOk || aiOk) : (staticAnalysisOk || aiOk)
  const qualityComputable = isPython ? (pylintOk || aiOk) : (staticAnalysisOk || aiOk)
  const complexityComputable = isPython && complexityScanOk

  return {
    quality: qualityComputable ? computeCategoryScore(review.findings, 'quality') : null,
    security: securityComputable ? computeCategoryScore(review.findings, 'security') : null,
    complexity: complexityComputable ? computeCategoryScore(review.findings, 'complexity') : null,
    maintainability: review.maintainability_index !== null ? review.maintainability_index : null,
  }
}

function getScoreStatusLabel(score) {
  if (score === null || score === undefined) return null
  if (score >= 80) return 'Good'
  if (score >= 50) return 'Needs Improvement'
  return 'Poor'
}


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
          <Link to="/submit" className="text-cyan-400 hover:underline text-sm">← Back to Submit Code</Link>
        </div>
      </div>
    )
  }

  const scoreColor = getScoreColor(review.review_score)
  const scoreBarColor = getScoreBarColor(review.review_score)
  const scoreStatusLabel = getScoreStatusLabel(review.review_score)
  const overviewScores = computeOverviewScores(review)

  const hasFindings = review.findings.length > 0
  const severityCounts = getSeverityCounts(review.findings)
  const totalSeverityCount = severityCounts.High + severityCounts.Medium + severityCounts.Low

  const severityChartData = {
    labels: ['High', 'Medium', 'Low'],
    datasets: [{
      label: 'Findings',
      data: [severityCounts.High, severityCounts.Medium, severityCounts.Low],
      backgroundColor: ['rgba(248, 113, 113, 0.7)', 'rgba(251, 191, 36, 0.7)', 'rgba(96, 165, 250, 0.7)'],
      borderRadius: 4,
    }],
  }
  const severityChartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => `Severity: ${items[0].label}`,
          label: (context) => {
            const value = context.parsed.y
            const pct = totalSeverityCount > 0 ? Math.round((value / totalSeverityCount) * 100) : 0
            return [`Issues: ${value}`, `${pct}% of all findings`]
          },
        },
      },
    },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1, color: '#94a3b8' }, grid: { color: '#1e293b' } },
      x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
    },
  }

  const categoryCounts = {}
  for (const key of CATEGORY_ORDER) categoryCounts[key] = 0
  for (const finding of review.findings) {
    const key = getCategoryMeta(finding).key
    if (categoryCounts[key] !== undefined) categoryCounts[key] += 1
  }
  const presentCategories = CATEGORY_ORDER.filter((key) => categoryCounts[key] > 0)
  const totalCategoryCount = presentCategories.reduce((sum, key) => sum + categoryCounts[key], 0)
  const severityInsight = getSeverityInsight(severityCounts)  
  const categoryInsight = getCategoryInsight(categoryCounts, presentCategories)  
  const toolCounts = {}
  for (const finding of review.findings) {
    for (const tool of getContributingTools(finding)) {
      toolCounts[tool] = (toolCounts[tool] || 0) + 1
    }
  }
  const summaryText = review.summary || ''
  const isPythonReview = summaryText.includes('code quality') || toolCounts['Pylint'] > 0
  const staticToolFallbackName =
    Object.keys(toolCounts).find((name) => name !== 'AI') || 'Static Analyzer (language-specific)'
  const staticToolRows = isPythonReview
    ? [
        { name: 'Pylint', count: toolCounts['Pylint'] || 0, ok: sourceSucceeded(summaryText, 'code quality scan failed') },
        { name: 'Bandit', count: toolCounts['Bandit'] || 0, ok: sourceSucceeded(summaryText, 'security scan failed') },
        { name: 'Radon', count: toolCounts['Radon'] || 0, ok: sourceSucceeded(summaryText, 'complexity scan failed') },
      ]
    : [
        { name: staticToolFallbackName, count: toolCounts[staticToolFallbackName] || 0, ok: sourceSucceeded(summaryText, 'static analysis scan failed') },
      ]

  const aiRow = {
    count: toolCounts['AI'] || 0,
    ok: review.ai_summary !== null,
    score: review.ai_score,
  }   
  const categoryChartData = {
    labels: presentCategories.map((key) => CATEGORY_META[key].label),
    datasets: [{
      label: 'Findings',
      data: presentCategories.map((key) => categoryCounts[key]),
      backgroundColor: presentCategories.map((key) => CATEGORY_META[key].chartColor),
      borderRadius: 4,
    }],
  }
  const categoryChartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => `Category: ${items[0].label}`,
          label: (context) => {
            const value = context.parsed.y
            const pct = totalCategoryCount > 0 ? Math.round((value / totalCategoryCount) * 100) : 0
            return [`Issues: ${value}`, `${pct}% of all findings`]
          },
        },
      },
    },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1, color: '#94a3b8' }, grid: { color: '#1e293b' } },
      x: { ticks: { color: '#94a3b8', maxRotation: 0, minRotation: 0 }, grid: { display: false } },
    },
  }

  const filteredFindings = review.findings.filter((finding) => {
    const matchesSeverity = severityFilter === 'all' || finding.severity === severityFilter
    const matchesCategory = categoryFilter === 'all' || getCategoryMeta(finding).key === categoryFilter
    return matchesSeverity && matchesCategory
  })

  const categoriesInData = CATEGORY_ORDER.filter((key) =>
  review.findings.some((finding) => getCategoryMeta(finding).key === key)
  )

  return (
    <div className="min-h-screen bg-slate-950 flex">
      <Sidebar userName={user?.name} />

      <main className="flex-1 p-8">
        <Link to="/submit" className="text-slate-500 hover:text-slate-300 text-sm mb-4 inline-block">← Back to Submit Code</Link>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 mb-8">
          <div className="flex items-center gap-8">
            <div className="text-center">
              <div className={`text-5xl font-bold ${scoreColor}`}>{review.review_score ?? 'N/A'}</div>
              <div className="text-slate-500 text-sm mt-1">out of 100</div>
              {scoreStatusLabel && <div className={`text-xs font-semibold mt-2 ${scoreColor}`}>{scoreStatusLabel}</div>}
              {review.review_score !== null && (
                <div className="w-24 h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden mx-auto">
                  <div className={`h-full ${scoreBarColor}`} style={{ width: `${Math.max(0, Math.min(review.review_score, 100))}%` }} />
                </div>
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-semibold text-slate-100 mb-2">Code Review</h1>
              <div className="flex gap-4 text-sm mb-3">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /><span className="text-slate-300">{severityCounts.High} High</span></span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /><span className="text-slate-300">{severityCounts.Medium} Medium</span></span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /><span className="text-slate-300">{severityCounts.Low} Low</span></span>
              </div>
              <p className="text-slate-600 text-xs">Analyzed {new Date(review.created_at).toLocaleString()}</p>
            </div>
          </div>

          {(overviewScores.quality !== null || overviewScores.security !== null || overviewScores.complexity !== null || overviewScores.maintainability !== null) && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800">
              <ScoreStat label="Quality" value={overviewScores.quality} />
              <ScoreStat label="Security" value={overviewScores.security} />
              <ScoreStat label="Complexity" value={overviewScores.complexity} />
              <ScoreStat
                label="Maintainability"
                value={
                  overviewScores.maintainability !== null
                    ? Number(overviewScores.maintainability).toFixed(2)
                    : null
                }
              />
            </div>
          )}

          {review.ai_summary ? (
            <div className="mt-6 pt-6 border-t border-slate-800">
              <h2 className="text-sm font-semibold text-slate-300 mb-2">Review Summary</h2>
              <p className="text-slate-400 text-sm whitespace-pre-wrap break-words">{review.ai_summary}</p>
            </div>
          ) : review.summary?.includes('AI review unavailable') ? (
            <div className="mt-6 pt-6 border-t border-slate-800">
              <p className="text-slate-500 text-sm">AI review was not available for this analysis. Results below come from static analysis only.</p>
            </div>
          ) : null}
        </div>

        {!hasFindings ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center mb-8">
            <p className="text-slate-400 text-sm">No issues found — nothing to visualize. Clean code!</p>
          </div>
        ) : (
          <>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8">
              <h2 className="text-sm font-semibold text-slate-300">Findings by Severity</h2>
              <p className="text-slate-500 text-xs mt-1 mb-1">How many issues were found at each severity level.</p>
              {severityInsight && (
                <p className={`text-xs mb-3 font-medium ${severityInsight.warn ? 'text-red-400' : 'text-slate-500'}`}>
                  {severityInsight.text}
                </p>
              )}
              <div style={{ height: '200px' }}><Bar data={severityChartData} options={severityChartOptions} /></div>
            </div>

            {presentCategories.length > 1 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8">
                <h2 className="text-sm font-semibold text-slate-300">Findings by Type</h2>
                <p className="text-slate-500 text-xs mt-1 mb-1">What kinds of problems were detected.</p>
                {categoryInsight && (
                  <p className="text-xs mb-3 font-medium text-slate-500">{categoryInsight}</p>
                )}
                <div style={{ height: '200px' }}><Bar data={categoryChartData} options={categoryChartOptions} /></div>
              </div>
            )}
          </>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Complexity & Maintainability</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Maintainability" value={review.maintainability_index !== null ? review.maintainability_index.toFixed(1) : 'N/A'} valueColor={getMaintainabilityColor(review.maintainability_index)} />
            <StatCard label="Lines of Code" value={review.lines_of_code ?? 'N/A'} valueColor="text-slate-200" />
            <StatCard label="Functions" value={review.function_count ?? 'N/A'} valueColor="text-slate-200" />
            <StatCard label="Classes" value={review.class_count ?? 'N/A'} valueColor="text-slate-200" />
          </div>
        </div>

        <details className="bg-slate-900 border border-slate-800 rounded-xl p-6 mt-8">
          <summary className="text-sm font-semibold text-slate-300 cursor-pointer select-none">
            Advanced Analysis Details
          </summary>

          <div className="mt-4 space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Static Analysis</h3>
              <div className="flex flex-col gap-1.5">
                {staticToolRows.map((row) => (
                  <div key={row.name} className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">{row.name}</span>
                    <span className={row.ok ? 'text-slate-500' : 'text-red-400'}>
                      {row.ok ? `${row.count} finding${row.count === 1 ? '' : 's'}` : 'Scan failed'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">AI Analysis</h3>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-300">AI Review</span>
                <span className={aiRow.ok ? 'text-slate-500' : 'text-red-400'}>
                  {aiRow.ok
                    ? `${aiRow.count} finding${aiRow.count === 1 ? '' : 's'}${aiRow.score !== null ? ` · Score: ${aiRow.score}/100` : ''}`
                    : 'Unavailable'}
                </span>
              </div>
            </div>
          </div>
        </details>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mt-8">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="text-sm font-semibold text-slate-300">Findings ({filteredFindings.length} of {review.findings.length})</h2>
            <div className="flex flex-wrap gap-2">
              <FilterButton label="All Severity" active={severityFilter === 'all'} onClick={() => setSeverityFilter('all')} />
              <FilterButton label="High" active={severityFilter === 'High'} onClick={() => setSeverityFilter('High')} />
              <FilterButton label="Medium" active={severityFilter === 'Medium'} onClick={() => setSeverityFilter('Medium')} />
              <FilterButton label="Low" active={severityFilter === 'Low'} onClick={() => setSeverityFilter('Low')} />
              <span className="text-slate-700">|</span>
              <FilterButton label="All Types" active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')} />
              {categoriesInData.map((key) => (
                <FilterButton key={key} label={CATEGORY_META[key].label} active={categoryFilter === key} onClick={() => setCategoryFilter(key)} />
              ))}
            </div>
          </div>

          {filteredFindings.length === 0 ? (
            <p className="text-slate-500 text-sm py-4 text-center">
              {review.findings.length === 0 ? 'No issues found. Clean code!' : 'No findings match the selected filters.'}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredFindings.map((finding) => <IssueCard key={finding.id} finding={finding} />)}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function IssueCard({ finding }) {
  const category = getCategoryMeta(finding)
  const title = getDisplayTitle(finding)
  const sourceLabel = getSourceLabel(finding)
  const severityDotColor = { High: 'bg-red-400', Medium: 'bg-amber-400', Low: 'bg-emerald-400' }[finding.severity] || 'bg-slate-500'
  const severityTextColor = { High: 'text-red-400', Medium: 'text-amber-400', Low: 'text-emerald-400' }[finding.severity] || 'text-slate-400'

  const source = finding.source || (finding.issue.startsWith('AI ') ? 'ai' : 'static')
  let technicalDetailsLines = null
  if (finding.technical_details) {
    technicalDetailsLines = finding.technical_details.split('\n')
  } else if (source === 'static') {
    technicalDetailsLines = [`${getToolLabel(finding)}: ${title}`]
  }

  return (
    <div className="bg-slate-800/50 border border-slate-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full ${severityDotColor} inline-block`} />
        <span className={`text-xs font-bold ${severityTextColor}`}>{finding.severity?.toUpperCase()}</span>
        <span className="text-slate-600">•</span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${category.badgeClass}`}>{category.label}</span>
      </div>

      <h3 className="text-slate-100 font-medium text-sm mb-1">{title}</h3>

      {finding.line_number && <p className="text-slate-500 text-xs mb-2">Line {finding.line_number}</p>}

      <p className="text-slate-400 text-sm">{finding.explanation}</p>

      {finding.suggestion && (
        <div className="mt-2">
          <span className="text-cyan-400/90 text-xs font-semibold">How to Fix</span>
          <p className="text-cyan-400/80 text-sm whitespace-pre-wrap">{finding.suggestion}</p>
        </div>
      )}

      <p className="text-slate-600 text-xs mt-3">Detected by: {sourceLabel}</p>

      {technicalDetailsLines && (
        <details className="mt-2 text-xs">
          <summary className="text-slate-500 cursor-pointer hover:text-slate-300 select-none">Technical Details</summary>
          <div className="mt-1.5 pl-3 border-l border-slate-700 text-slate-500 space-y-0.5">
            {technicalDetailsLines.map((line, i) => <div key={i}>{line}</div>)}
          </div>
        </details>
      )}
    </div>
  )
}


function getScoreColor(score) {
  if (score === null || score === undefined) return 'text-slate-500'
  if (score >= 80) return 'text-emerald-400'
  if (score >= 50) return 'text-amber-400'
  return 'text-red-400'
}
function getScoreBarColor(score) {
  if (score === null || score === undefined) return 'bg-slate-700'
  if (score >= 80) return 'bg-emerald-400'
  if (score >= 50) return 'bg-amber-400'
  return 'bg-red-400'
}
function getSeverityCounts(findings) {
  const counts = { High: 0, Medium: 0, Low: 0 }
  for (const finding of findings) {
    if (counts[finding.severity] !== undefined) counts[finding.severity] += 1
  }
  return counts
}
function getMaintainabilityColor(mi) {
  if (mi === null || mi === undefined) return 'text-slate-500'
  if (mi >= 20) return 'text-emerald-400'
  if (mi >= 10) return 'text-amber-400'
  return 'text-red-400'
}
function getSeverityInsight(counts) {
  if (counts.High > 0) {
    return { text: `${counts.High} high-severity issue${counts.High > 1 ? 's' : ''} — review ${counts.High > 1 ? 'these' : 'this'} first.`, warn: true }
  }
  if (counts.Medium > 0) {
    return { text: `No high-severity issues. ${counts.Medium} medium-severity issue${counts.Medium > 1 ? 's' : ''} worth reviewing.`, warn: false }
  }
  if (counts.Low > 0) {
    return { text: 'Only low-severity issues — nothing urgent.', warn: false }
  }
  return null
}
function getCategoryInsight(categoryCounts, presentCategories) {
  if (presentCategories.length === 0) return null
  const topKey = presentCategories.reduce((a, b) => (categoryCounts[b] > categoryCounts[a] ? b : a))
  if (categoryCounts[topKey] === 0) return null
  const topLabel = CATEGORY_META[topKey].label
  const topCount = categoryCounts[topKey]
  if (topKey === 'security') {
    return `Security has the most findings (${topCount}) — worth addressing first.`
  }
  return `Most findings are ${topLabel} (${topCount}).`
}
function getContributingTools(finding) {
  const source = finding.source || (finding.issue.startsWith('AI ') ? 'ai' : 'static')

  if (source === 'ai') return ['AI']

  if (source === 'static+ai') {
    const firstLine = finding.technical_details?.split('\n')[0] || ''
    const toolName = firstLine.split(':')[0].trim() || 'Static Analyzer'
    return [toolName, 'AI']
  }

  return [getToolLabel(finding)] 
}
function StatCard({ label, value, valueColor }) {
  return (
    <div className="bg-slate-800/50 border border-slate-800 rounded-lg p-4 text-center">
      <div className={`text-2xl font-bold ${valueColor}`}>{value}</div>
      <div className="text-slate-500 text-xs mt-1">{label}</div>
    </div>
  )
}
function ScoreStat({ label, value }) {
  const color = value !== null ? getScoreColor(value) : 'text-slate-600'
  return (
    <div className="bg-slate-800/50 border border-slate-800 rounded-lg p-4 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value !== null ? value : '—'}</div>
      <div className="text-slate-500 text-xs mt-1">{label}</div>
    </div>
  )
}
function FilterButton({ label, active, onClick }) {
  return (
    <button onClick={onClick} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${active ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`}>
      {label}
    </button>
  )
}

export default ReviewResults
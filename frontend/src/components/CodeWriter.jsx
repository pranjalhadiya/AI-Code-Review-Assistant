import { useState } from 'react'
import CodeViewer from './CodeViewer'


const LANGUAGE_OPTIONS = [
  { value: 'python', label: 'Python' },
  { value: 'c', label: 'C' },
  { value: 'java', label: 'Java' },
]

const INITIAL_CODE = ''


function CodeWriter({ onAnalyze, busy, busyLabel, error }) {
  const [language, setLanguage] = useState('python')
  const [code, setCode] = useState('')

  const canAnalyze = code.trim() !== '' && !busy
  

  return (
    <div className="w-full">
      <div className="flex items-center gap-3 mb-3">
        <label htmlFor="code-language" className="text-sm text-slate-400">Language</label>
        <select
          id="code-language"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          disabled={busy}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <CodeViewer
        sourceCode={INITIAL_CODE}
        language={language}      // Switching language re-highlights the same text; it doesn't clear it.
        readOnly={false}         // The editable mode added in Step 2
        onChange={setCode}
        height="360px"
      />

      <p className="text-slate-500 text-xs mt-2">
        Paste or type code. It goes through the same analysis as an uploaded file.
      </p>

      {error && (
        <div className="bg-red-950 border border-red-800 text-red-300 text-sm rounded-lg p-3 mt-4">
          {error}
        </div>
      )}

      <button
        onClick={() => onAnalyze(code, language)}
        disabled={!canAnalyze}
        className="mt-4 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:cursor-not-allowed text-slate-950 font-semibold rounded-lg px-6 py-2 transition-colors"
      >
        {busy ? busyLabel : 'Analyze Code'}
      </button>
    </div>
  )
}

export default CodeWriter
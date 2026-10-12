import { useRef, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import './CodeViewer.css'

const MONACO_LANGUAGE_MAP = {
  python: 'python',
  c: 'c',
  java: 'java',
}

const SEVERITY_CLASS = { High: 'high', Medium: 'medium', Low: 'low' }

const NO_MARKERS = []


function CodeViewer({
  sourceCode,
  language,
  lineMarkers = NO_MARKERS,   
  jumpTarget = null,          
  onLineClick,               
  readOnly = true,            
  onChange,                   
  height = '400px',
}) {
  const editorRef = useRef(null)
  const monacoRef = useRef(null)
  const decorationIdsRef = useRef([])
  const flashTimeoutRef = useRef(null)


  const onLineClickRef = useRef(onLineClick)
  const lineMarkersRef = useRef(lineMarkers)
  useEffect(() => {
    onLineClickRef.current = onLineClick
    lineMarkersRef.current = lineMarkers
  }) 

  const monacoLanguage = MONACO_LANGUAGE_MAP[language] || 'plaintext'

  
  const applyMarkers = (markers) => {
    const editor = editorRef.current
    const monacoInstance = monacoRef.current
    if (!editor || !monacoInstance) return

    const newDecorations = markers.map((marker) => {
      const cls = SEVERITY_CLASS[marker.severity] || 'low'
      const tooltipLines = marker.items.map(
        (item) => `**[${item.severity}] ${item.category}** — ${item.title}`
      )
      const tooltip = { value: tooltipLines.join('\n\n') }

      return {
        range: new monacoInstance.Range(marker.line, 1, marker.line, 1),
        options: {
          isWholeLine: true,
          className: `line-tint-${cls}`,
          glyphMarginClassName: `glyph-marker glyph-marker-${cls}`,
          glyphMarginHoverMessage: tooltip,
          hoverMessage: tooltip,
        },
      }
    })

    decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, newDecorations)
  }

  const handleMount = (editor, monacoInstance) => {
    editorRef.current = editor
    monacoRef.current = monacoInstance

    editor.onMouseDown((e) => {
      if (
        e.target.type === monacoInstance.editor.MouseTargetType.GUTTER_GLYPH_MARGIN &&
        e.target.position
      ) {
        onLineClickRef.current?.(e.target.position.lineNumber)
        
      }
    })

    applyMarkers(lineMarkersRef.current)
   
  }

  useEffect(() => {
    applyMarkers(lineMarkers)
  }, [lineMarkers])
 

  useEffect(() => {
    const editor = editorRef.current
    const monacoInstance = monacoRef.current
    if (!editor || !monacoInstance || !jumpTarget) return

    editor.revealLineInCenter(jumpTarget.line)

    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current)

    const flashId = editor.deltaDecorations([], [
      {
        range: new monacoInstance.Range(jumpTarget.line, 1, jumpTarget.line, 1),
        options: { isWholeLine: true, className: 'line-flash' },
      },
    ])

    flashTimeoutRef.current = setTimeout(() => {
      editor.deltaDecorations(flashId, [])
    }, 1500)
  }, [jumpTarget])

  return (
    <div className="rounded-lg overflow-hidden border border-slate-800">
      <Editor
        height={height}
        language={monacoLanguage}
        value={sourceCode}
        theme="vs-dark"
        onMount={handleMount}
        onChange={onChange ? (value) => onChange(value ?? '') : undefined}
        options={{
          readOnly, 
          minimap: { enabled: false },
          fontSize: 13,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          glyphMargin: lineMarkers.length > 0,
        }}
      />
    </div>
  )
}

export default CodeViewer
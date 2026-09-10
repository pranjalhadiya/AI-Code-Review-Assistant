import { useState, useEffect } from 'react'  // useState: lets a component hold and update data. useEffect: lets a component run code in response to certain events (like "when this component first appears on screen").
import api from './services/api'  // Imports our pre-configured Axios instance.

function App() {
  const [status, setStatus] = useState('Checking backend...')  // Creates a piece of state called "status", starting with a placeholder message. setStatus is the function we call to update it.

  useEffect(() => {
    // This function runs once, right after the component first renders (because the dependency array below is empty: []).
    api.get('/health')  // Sends a GET request to http://127.0.0.1:8000/health (baseURL + '/health').
      .then((response) => {
        // .then runs if the request succeeds. 'response.data' is the JSON body FastAPI sent back.
        setStatus(`${response.data.status} — ${response.data.service}`)  // Updates our state with the real backend response, which triggers a re-render.
      })
      .catch((error) => {
        // .catch runs if the request fails (server down, CORS blocked, network error, etc.).
        setStatus('Backend not reachable ❌')
        console.error(error)  // Logs the full error to the browser console for debugging.
      })
  }, [])  // Empty array means "run this effect only once, when the component first mounts" — not on every re-render.

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-bold text-cyan-400">AI Code Review Assistant</h1>
      <p className="text-slate-300">Backend status: {status}</p>
      {/* Displays whatever is currently in the 'status' state — starts as the placeholder, then updates once the API call resolves. */}
    </div>
  )
}

export default App
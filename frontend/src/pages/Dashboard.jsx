import { useAuth } from '../hooks/useAuth'  
import Sidebar from '../components/Sidebar' 

function Dashboard() {
  const { user, loading } = useAuth()
 
  if (loading) {
  
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400">Loading dashboard...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
    
      <Sidebar userName={user?.name} />
     
      <main className="flex-1 p-8">
       
        <h1 className="text-2xl font-bold text-slate-100 mb-2">
          Welcome back, {user?.name}
        </h1>
        <p className="text-slate-400 mb-8">{user?.email}</p>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <p className="text-slate-400">
            Your code review workspace will appear here — file upload, static analysis results,
            and AI-powered review findings, coming in the next few days.
          </p>
        </div>
      </main>
    </div>
  )
}

export default Dashboard
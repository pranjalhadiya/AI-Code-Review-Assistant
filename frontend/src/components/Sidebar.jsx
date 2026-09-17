import { useNavigate } from 'react-router-dom'  
import { logoutUser } from '../services/authService' 

function Sidebar({ userName }) {
 
  const navigate = useNavigate()

  const handleLogout = () => {
    logoutUser()         
    navigate('/login')    
  }

  return (
    <aside className="w-64 min-h-screen bg-slate-900 border-r border-slate-800 flex flex-col p-4">
      
      <div className="mb-8">
        <h2 className="text-lg font-bold text-cyan-400">Code Review AI</h2>
       
        <p className="text-xs text-slate-500 mt-1">Welcome, {userName}</p>
      
      </div>

      <nav className="flex flex-col gap-1 flex-1">
      
        <SidebarLink label="Dashboard" active />
        <SidebarLink label="Submit Code" />
        <SidebarLink label="Review History" />
     
      </nav>

      <button
        onClick={handleLogout}
        className="mt-4 text-sm text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-800 rounded-lg py-2 transition-colors"
      >
        Log Out
      </button>
    </aside>
  )
}

function SidebarLink({ label, active = false }) {
 
  return (
    <div
      className={`px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
        active
          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
      }`}
      
    >
      {label}
    </div>
  )
}

export default Sidebar
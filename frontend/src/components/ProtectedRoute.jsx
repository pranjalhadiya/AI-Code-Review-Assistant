import { Navigate } from 'react-router-dom'  
import { useAuth } from '../hooks/useAuth'  

function ProtectedRoute({ children }) {
  

  const { user, loading } = useAuth()  

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400">Checking authentication...</p>
      </div>
    )
  }

  if (!user) {
   
    return <Navigate to="/login" replace />
    
  }

  return children
 
}

export default ProtectedRoute
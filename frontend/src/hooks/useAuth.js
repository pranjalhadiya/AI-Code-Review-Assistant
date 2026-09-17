import { useState, useEffect } from 'react'  
import { getCurrentUser, logoutUser } from '../services/authService' 

export function useAuth() {
  
  const [user, setUser] = useState(null)          
  const [loading, setLoading] = useState(true)      

  useEffect(() => {
    
    const checkAuth = async () => {
      try {
        const currentUser = await getCurrentUser() 
        setUser(currentUser)                         
      } catch (err) {
        
        logoutUser() 
        setUser(null)  
      } finally {
        setLoading(false)  
      }
    }

    checkAuth()
  }, [])  

  return { user, loading }
  
}
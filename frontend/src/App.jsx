import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'


import Login from './pages/Login'     
import Register from './pages/Register' 
import Dashboard from './pages/Dashboard'
import CodeSubmission from './pages/CodeSubmission' 
import ReviewResults from './pages/ReviewResults'
import ProtectedRoute from './components/ProtectedRoute' 

function App() {
  return (
    <BrowserRouter>
      
      <Routes>

        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route path="/login" element={<Login />} />

        <Route path="/register" element={<Register />} />
        
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/submit"
          element={
            <ProtectedRoute>
              <CodeSubmission />
            </ProtectedRoute>
          }
        />
         <Route
          path="/review/:reviewId"
            element={
            <ProtectedRoute>
              <ReviewResults />
            </ProtectedRoute>
          }
        />
        
      </Routes>
    </BrowserRouter>
  )
}

export default App
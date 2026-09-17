import api from './api'  

export const registerUser = async (name, email, password) => {
  
  const response = await api.post('/auth/register', {
    name, 
    email,      
    password,
  })
  return response.data
 }

export const loginUser = async (email, password) => {
  const response = await api.post('/auth/login', {
    email,
    password,
  })
  
  localStorage.setItem('access_token', response.data.access_token)
  return response.data
}

export const getCurrentUser = async () => {
  const response = await api.get('/auth/me')
  return response.data 
}

export const logoutUser = () => {
  localStorage.removeItem('access_token')
  }
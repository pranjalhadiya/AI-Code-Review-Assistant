import api from './api'  

export const analyzeProject = async (projectId) => {


  const response = await api.post(`/review/${projectId}/analyze`)

  return response.data
  
}

export const getReview = async (reviewId) => {
  const response = await api.get(`/review/${reviewId}`)
  return response.data
}
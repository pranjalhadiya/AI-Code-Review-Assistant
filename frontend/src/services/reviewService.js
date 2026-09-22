import api from './api'  

export const analyzeProject = async (projectId) => {


  const response = await api.post(`/review/${projectId}/analyze`)

  return response.data
  
}
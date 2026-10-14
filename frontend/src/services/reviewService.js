import api from './api'  

export const analyzeProject = async (projectId) => {


  const response = await api.post(`/review/${projectId}/analyze`)

  return response.data
  
}

export const getReview = async (reviewId) => {
  const response = await api.get(`/review/${reviewId}`)
  return response.data
}

export const getReviewSource = async (reviewId) => {
  const response = await api.get(`/review/${reviewId}/source`)
  return response.data
}

export const reanalyzeReview = async (reviewId, sourceCode) => {
  const response = await api.post(`/review/${reviewId}/reanalyze`, { source_code: sourceCode })
  return response.data
}

export const listReviews = async (filters = {}) => {

  const params = {}
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') params[key] = value
  }
  const response = await api.get('/review/', { params })
  return response.data  
}

export const deleteReview = async (reviewId) => {
  await api.delete(`/review/${reviewId}`)
}
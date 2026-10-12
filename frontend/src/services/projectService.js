import api from './api'  

export const uploadFile = async (file) => {
  

  const formData = new FormData()

  formData.append('file', file)

  const response = await api.post('/upload/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  return response.data
}

export const submitCode = async (code, language) => {

  const response = await api.post('/upload/code', { code, language })
  return response.data  
}
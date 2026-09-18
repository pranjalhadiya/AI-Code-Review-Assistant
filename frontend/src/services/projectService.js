import api from './api'  

export const uploadFile = async (file) => {
  

  const formData = new FormData()
  // FormData is a built-in browser API specifically for building multipart/form-data payloads —
  // the format required for file uploads (plain JSON can't carry binary file content).

  formData.append('file', file)
  // Adds our file under the key "file" — this MUST match the parameter name in our backend route:
  // `file: UploadFile = File(...)` in upload.py (Day 4 Step 5). If these names don't match, FastAPI
  // won't be able to find the file in the request and will return a 422.

  const response = await api.post('/upload/', formData, {
    // Note the trailing slash '/upload/' — matches our router's exact path (Day 4 Step 5: prefix="/upload", route path="/").
    headers: {
      'Content-Type': 'multipart/form-data',
      // Explicitly setting this tells Axios (and the browser) how to encode formData.
      // In practice, Axios often sets this automatically when it detects a FormData object,
      // but being explicit here removes any ambiguity and makes the intent clear to anyone reading the code.
    },
  })

  return response.data
  // Matches our ProjectResponse schema (Day 4 Step 2): { id, project_name, upload_type, created_at }
}
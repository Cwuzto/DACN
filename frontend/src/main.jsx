import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './pages/lecturer/lecturer-opendesign.css'
import './pages/admin/admin-opendesign.css'
import './pages/student/student-opendesign.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/cinzel/latin-400.css'
import '@fontsource/cinzel/latin-600.css'
import './index.css'
import App from './App.tsx'
import { applyTheme, watchSystemTheme } from './theme'

applyTheme()
watchSystemTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

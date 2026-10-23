import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// La hoja de MapLibre va antes que la nuestra: si no, sus reglas pisan las del tema en la escala y los créditos.
import 'maplibre-gl/dist/maplibre-gl.css'
import './index.css'
import App from './App.tsx'
import { ProveedorTema } from './tema/ProveedorTema'

// Caché compartida de las respuestas de la API (ver hooks/consultas.ts).
const clienteConsultas = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProveedorTema>
      <QueryClientProvider client={clienteConsultas}>
        <App />
      </QueryClientProvider>
    </ProveedorTema>
  </StrictMode>,
)

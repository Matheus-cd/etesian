import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TimezoneProvider } from './contexts/TimezoneContext'
import App from './app/App'
import './styles/globals.css'
import './i18n'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <TimezoneProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </TimezoneProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)

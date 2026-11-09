import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

console.info('%c[TradingBot] Active Build: 2026-11-09 (Defensive API-Open-Wins Merge Logic Deployed)', 'color: #10b981; font-weight: bold;');

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)

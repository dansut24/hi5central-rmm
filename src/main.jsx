import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './PlatformCurves.css'
import './ContextualSurfaces.css'
import { ProductionRmmBootstrap } from './production/ProductionRmmBootstrap.jsx'

const root = document.getElementById('root')
document.documentElement.dataset.hi5Surface = 'rmm'
document.body.dataset.hi5Surface = 'rmm'
if (root) root.dataset.hi5Surface = 'rmm'

createRoot(root).render(
  <StrictMode>
    <ProductionRmmBootstrap />
  </StrictMode>,
)

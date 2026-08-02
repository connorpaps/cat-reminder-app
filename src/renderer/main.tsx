import React from 'react'
import { createRoot } from 'react-dom/client'
import { PopupApp } from './popup/PopupApp'
import { OverlayApp } from './overlay/OverlayApp'
import './styles.css'

const params = new URLSearchParams(window.location.search)
const isOverlay = params.has('overlay')

if (isOverlay) document.documentElement.classList.add('overlay-document')

const root = document.getElementById('root')
if (!root) throw new Error('Renderer root was not found')

if (isOverlay) {
  createRoot(root).render(<OverlayApp />)
} else {
  createRoot(root).render(<PopupApp />)
}

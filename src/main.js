import { mount } from 'svelte'
import 'bootstrap/dist/css/bootstrap.min.css'
import './app.css'
import App from './App.svelte'

// Import Bootstrap Icons
const iconsLink = document.createElement('link')
iconsLink.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css'
iconsLink.rel = 'stylesheet'
document.head.appendChild(iconsLink)

const app = mount(App, {
  target: document.getElementById('app'),
})

export default app

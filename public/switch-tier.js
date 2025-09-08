// Simple tier switching for testing
// Load in browser console: const script = document.createElement('script'); script.src = '/switch-tier.js'; document.head.appendChild(script);

async function switchToBasic() {
  try {
    // Create a form to submit tier change
    const form = document.createElement('form')
    form.method = 'POST'
    form.style.display = 'none'
    
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = 'tier'
    input.value = 'basic'
    
    form.appendChild(input)
    document.body.appendChild(form)
    
    // Use fetch instead
    const response = await fetch('/api/switch-tier', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tier: 'basic' })
    })
    
    if (response.ok) {
      console.log('✅ Switched to Basic tier!')
      console.log('🔄 Redirecting to Basic dashboard...')
      window.location.href = '/basic-dashboard'
    } else {
      console.error('❌ Failed to switch tier')
    }
    
    document.body.removeChild(form)
  } catch (error) {
    console.error('❌ Error:', error)
    // Fallback: just redirect
    console.log('🔄 Redirecting to Basic dashboard anyway...')
    window.location.href = '/basic-dashboard'
  }
}

async function switchToPro() {
  try {
    const response = await fetch('/api/switch-tier', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tier: 'pro' })
    })
    
    if (response.ok) {
      console.log('✅ Switched to Pro tier!')
      console.log('🔄 Redirecting to Pro dashboard...')
      window.location.href = '/dashboard'
    } else {
      console.error('❌ Failed to switch tier')
    }
  } catch (error) {
    console.error('❌ Error:', error)
    // Fallback: just redirect
    console.log('🔄 Redirecting to Pro dashboard anyway...')
    window.location.href = '/dashboard'
  }
}

// Quick redirects for testing
function goToBasic() {
  window.location.href = '/basic-dashboard'
}

function goToPro() {
  window.location.href = '/dashboard'
}

// Make functions global
window.switchToBasic = switchToBasic
window.switchToPro = switchToPro
window.goToBasic = goToBasic
window.goToPro = goToPro

console.log('🎯 TIER SWITCHING LOADED!')
console.log('💡 Commands:')
console.log('  switchToBasic() - Switch to Basic tier and redirect')
console.log('  switchToPro() - Switch to Pro tier and redirect') 
console.log('  goToBasic() - Just redirect to Basic dashboard')
console.log('  goToPro() - Just redirect to Pro dashboard')

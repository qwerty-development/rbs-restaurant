// Simple tier testing functions
// Load this script in browser console: 
// const script = document.createElement('script'); script.src = '/tier-test.js'; document.head.appendChild(script);

function forceBasicTier() {
  localStorage.setItem('restaurant-tier', 'basic')
  console.log('✅ Forced Basic tier in localStorage')
  console.log('🔄 Refresh the page to see Basic tier interface')
}

function forceProTier() {
  localStorage.setItem('restaurant-tier', 'pro')
  console.log('✅ Forced Pro tier in localStorage')
  console.log('🔄 Refresh the page to see Pro tier interface')
}

function clearTierCache() {
  localStorage.removeItem('restaurant-tier')
  console.log('🗑️ Cleared tier cache')
  console.log('🔄 Refresh to use database tier')
}

function checkTierStatus() {
  const cached = localStorage.getItem('restaurant-tier')
  console.log('📊 Tier Status:', {
    cached,
    isBasic: cached === 'basic',
    isPro: cached === 'pro'
  })
}

// Make functions global
window.forceBasicTier = forceBasicTier
window.forceProTier = forceProTier
window.clearTierCache = clearTierCache
window.checkTierStatus = checkTierStatus

console.log('🎯 TIER TEST FUNCTIONS LOADED!')
console.log('💡 Quick Test Commands:')
console.log('  forceBasicTier() - Force Basic tier temporarily')
console.log('  forceProTier() - Force Pro tier temporarily')
console.log('  clearTierCache() - Clear cache and use database')
console.log('  checkTierStatus() - Check current tier status')
console.log('')
console.log('🔄 Remember to refresh after each command!')

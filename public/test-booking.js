// Test booking creation for Basic tier testing
// Load in browser console: const script = document.createElement('script'); script.src = '/test-booking.js'; document.head.appendChild(script);

async function createTestBooking() {
  try {
    console.log('🧪 Creating test booking...')
    
    const response = await fetch('/api/test-booking', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        party_size: Math.floor(Math.random() * 6) + 2, // 2-8 people
        booking_time: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(), // Random time in next week
        special_requests: Math.random() > 0.5 ? 'No special requests' : 'Window table please'
      })
    })
    
    if (response.ok) {
      const result = await response.json()
      console.log('✅ Test booking created:', result)
      console.log('🔄 Refresh the page to see the new booking request')
    } else {
      console.error('❌ Failed to create test booking:', await response.text())
    }
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

async function createMultipleTestBookings() {
  console.log('🧪 Creating 3 test bookings...')
  for (let i = 0; i < 3; i++) {
    await createTestBooking()
    await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second between bookings
  }
  console.log('✅ Done! Refresh the page to see all test bookings')
}

// Make functions global
window.createTestBooking = createTestBooking
window.createMultipleTestBookings = createMultipleTestBookings

console.log('🧪 TEST BOOKING FUNCTIONS LOADED!')
console.log('💡 Commands:')
console.log('  createTestBooking() - Create one test booking')
console.log('  createMultipleTestBookings() - Create 3 test bookings')
console.log('  Then refresh the page to see them')

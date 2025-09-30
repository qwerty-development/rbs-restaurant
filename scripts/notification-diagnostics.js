/**
 * Notification System Diagnostic Tool
 * 
 * Run in browser console to diagnose notification issues
 * Usage: Copy this entire file and paste in browser console
 */

(async function notificationDiagnostics() {
  console.log('🔍 NOTIFICATION SYSTEM DIAGNOSTICS');
  console.log('='.repeat(50));

  const results = {
    timestamp: new Date().toISOString(),
    browser: navigator.userAgent,
    issues: [],
    warnings: [],
    passed: []
  };

  // 1. Service Worker Check
  console.log('\n1️⃣ Checking Service Worker...');
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations.length > 0) {
      const sw = registrations[0];
      results.passed.push('✅ Service worker registered');
      console.log('✅ Service worker:', sw.scope);
      console.log('   State:', sw.active?.state);
      
      if (sw.active?.state !== 'activated') {
        results.warnings.push('⚠️ Service worker not activated');
      }
    } else {
      results.issues.push('❌ No service worker registered');
      console.error('❌ No service worker found');
    }
  } else {
    results.issues.push('❌ Service worker not supported');
    console.error('❌ Service worker not supported in this browser');
  }

  // 2. Push Manager Check
  console.log('\n2️⃣ Checking Push Manager...');
  if ('PushManager' in window) {
    results.passed.push('✅ Push Manager supported');
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      results.passed.push('✅ Push subscription active');
      console.log('✅ Push subscription active');
      console.log('   Endpoint:', subscription.endpoint.substring(0, 50) + '...');
      console.log('   Expiration:', subscription.expirationTime || 'Never');
      
      // Check if subscription is expired
      if (subscription.expirationTime && subscription.expirationTime < Date.now()) {
        results.issues.push('❌ Push subscription EXPIRED');
        console.error('❌ Push subscription EXPIRED');
      }
    } else {
      results.issues.push('❌ No push subscription found');
      console.error('❌ No push subscription found');
    }
  } else {
    results.issues.push('❌ Push Manager not supported');
    console.error('❌ Push Manager not supported');
  }

  // 3. Notification Permission Check
  console.log('\n3️⃣ Checking Notification Permission...');
  if ('Notification' in window) {
    const permission = Notification.permission;
    console.log('   Permission:', permission);
    
    if (permission === 'granted') {
      results.passed.push('✅ Notification permission granted');
    } else if (permission === 'denied') {
      results.issues.push('❌ Notification permission DENIED');
      console.error('❌ Notification permission DENIED');
    } else {
      results.warnings.push('⚠️ Notification permission not requested');
      console.warn('⚠️ Notification permission not requested');
    }
  } else {
    results.issues.push('❌ Notifications not supported');
  }

  // 4. Wake Lock Check
  console.log('\n4️⃣ Checking Wake Lock...');
  if ('wakeLock' in navigator) {
    results.passed.push('✅ Wake Lock API supported');
    console.log('✅ Wake Lock API supported');
    // Note: Can't check if wake lock is active without accessing the component's state
    console.log('   ℹ️ Check console for "🔒 Wake lock ACQUIRED" messages');
  } else {
    results.warnings.push('⚠️ Wake Lock API not supported');
    console.warn('⚠️ Wake Lock API not supported');
  }

  // 5. Page Lifecycle API Check
  console.log('\n5️⃣ Checking Page Lifecycle API...');
  const hasPageLifecycle = 'onfreeze' in document;
  if (hasPageLifecycle) {
    results.passed.push('✅ Page Lifecycle API supported');
    console.log('✅ Page Lifecycle API supported (freeze/resume events)');
  } else {
    results.warnings.push('⚠️ Page Lifecycle API not supported');
    console.warn('⚠️ Page Lifecycle API not supported');
  }

  // 6. Document Visibility Check
  console.log('\n6️⃣ Checking Document Visibility...');
  console.log('   Hidden:', document.hidden);
  console.log('   Visibility State:', document.visibilityState);
  
  if (document.hidden) {
    results.warnings.push('⚠️ Page currently hidden');
  }

  // 7. Network Status Check
  console.log('\n7️⃣ Checking Network Status...');
  console.log('   Online:', navigator.onLine);
  
  if (!navigator.onLine) {
    results.warnings.push('⚠️ Device is OFFLINE');
    console.warn('⚠️ Device is OFFLINE');
  } else {
    results.passed.push('✅ Device is online');
  }

  // 8. Background Sync Check
  console.log('\n8️⃣ Checking Background Sync...');
  if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
    results.passed.push('✅ Background Sync supported');
    console.log('✅ Background Sync supported');
  } else {
    results.warnings.push('⚠️ Background Sync not supported');
    console.warn('⚠️ Background Sync not supported');
  }

  // 9. Periodic Sync Check
  console.log('\n9️⃣ Checking Periodic Sync...');
  if ('serviceWorker' in navigator && 'periodicSync' in ServiceWorkerRegistration.prototype) {
    results.passed.push('✅ Periodic Sync supported (Chrome only)');
    console.log('✅ Periodic Sync supported');
  } else {
    results.warnings.push('⚠️ Periodic Sync not supported');
    console.warn('⚠️ Periodic Sync not supported (Chrome only feature)');
  }

  // 10. IndexedDB Check (for persistent notifications)
  console.log('\n🔟 Checking IndexedDB...');
  if ('indexedDB' in window) {
    results.passed.push('✅ IndexedDB supported');
    console.log('✅ IndexedDB supported');
    
    try {
      const request = indexedDB.open('PersistentNotifications', 1);
      request.onsuccess = () => {
        console.log('✅ PersistentNotifications DB exists');
        results.passed.push('✅ PersistentNotifications DB exists');
      };
      request.onerror = () => {
        console.warn('⚠️ Could not access PersistentNotifications DB');
        results.warnings.push('⚠️ Could not access PersistentNotifications DB');
      };
    } catch (error) {
      console.error('❌ IndexedDB error:', error);
      results.issues.push('❌ IndexedDB error');
    }
  }

  // Summary
  console.log('\n📊 SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`⚠️ Warnings: ${results.warnings.length}`);
  console.log(`❌ Issues: ${results.issues.length}`);

  if (results.issues.length > 0) {
    console.log('\n❌ CRITICAL ISSUES:');
    results.issues.forEach(issue => console.error(issue));
  }

  if (results.warnings.length > 0) {
    console.log('\n⚠️ WARNINGS:');
    results.warnings.forEach(warning => console.warn(warning));
  }

  // Recommendations
  console.log('\n💡 RECOMMENDATIONS');
  console.log('='.repeat(50));

  if (results.issues.length === 0 && results.warnings.length === 0) {
    console.log('🎉 Everything looks good! Notification system should work.');
  } else {
    if (results.issues.includes('❌ No push subscription found')) {
      console.log('1. Click "Enable Notifications" button in the app');
    }
    if (results.issues.includes('❌ Notification permission DENIED')) {
      console.log('2. Allow notifications in browser settings');
    }
    if (results.issues.includes('❌ No service worker registered')) {
      console.log('3. Refresh the page to register service worker');
    }
  }

  // Test notification
  console.log('\n🧪 QUICK TEST');
  console.log('='.repeat(50));
  console.log('Run this to test if notifications work:');
  console.log(`
if ('serviceWorker' in navigator && Notification.permission === 'granted') {
  navigator.serviceWorker.ready.then(registration => {
    registration.showNotification('Test Notification', {
      body: 'If you see this, notifications are working!',
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      vibrate: [200, 100, 200]
    });
  });
}
  `);

  // Save results
  console.log('\n💾 Results saved to window.notificationDiagnostics');
  window.notificationDiagnostics = results;

  return results;
})();

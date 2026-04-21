/* ============================================
   CHATARRA — Firebase Messaging Service Worker
   Handles background push notifications
   ============================================ */

// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Initialize Firebase in the SW
// Replace with your actual config
firebase.initializeApp({
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  databaseURL: 'https://YOUR_PROJECT-default-rtdb.firebaseio.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received:', payload);

  const notificationTitle = payload.notification?.title || 'Chatarra';
  const notificationOptions = {
    body: payload.notification?.body || 'Nuevo mensaje',
    icon: payload.notification?.icon || './assets/icons/icon-192.png',
    badge: './assets/icons/badge-72.png',
    tag: payload.data?.roomCode || 'chatarra',
    renotify: true,
    data: {
      roomCode: payload.data?.roomCode,
    },
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click — focus or open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const roomCode = event.notification.data?.roomCode;
  const urlToOpen = roomCode
    ? `${self.location.origin}/?room=${roomCode}`
    : self.location.origin;

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Focus existing window if available
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

/* ============================================
   CHATARRA — Notifications Module
   Firebase Cloud Messaging (FCM)
   ============================================ */

const Notifications = (() => {
  let _token = null;
  let _messaging = null;

  /**
   * Initialize FCM. Request permission and get token.
   * @param {string} vapidKey - Your VAPID key from Firebase Console
   * @returns {string|null} FCM token or null if denied
   */
  async function init(vapidKey) {
    try {
      // Check if messaging is supported
      if (!firebase.messaging.isSupported()) {
        console.warn('FCM not supported in this browser');
        return null;
      }

      _messaging = firebase.messaging();

      // Register service worker
      const registration = await navigator.serviceWorker.register(
        './firebase-messaging-sw.js'
      );

      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('Notification permission denied');
        return null;
      }

      // Get token
      _token = await _messaging.getToken({
        vapidKey: vapidKey,
        serviceWorkerRegistration: registration,
      });

      // Listen for foreground messages
      _messaging.onMessage((payload) => {
        _handleForegroundMessage(payload);
      });

      return _token;
    } catch (error) {
      console.error('FCM init error:', error);
      return null;
    }
  }

  /**
   * Handle messages received while app is in foreground.
   */
  function _handleForegroundMessage(payload) {
    const { title, body } = payload.notification || {};
    if (title) {
      UI.showToast(`${title}: ${body}`);
    }
  }

  /**
   * Get the current FCM token.
   */
  function getToken() {
    return _token;
  }

  return {
    init,
    getToken,
  };
})();

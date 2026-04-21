/* ============================================
   CHATARRA — App Entry Point
   Firebase initialization & bootstrap
   ============================================ */

// ─── Firebase Configuration ─────────────
// Replace these values with your own Firebase project config
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  databaseURL: 'https://YOUR_PROJECT-default-rtdb.firebaseio.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// ─── App Bootstrap ──────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1. Initialize anonymous auth
    await Auth.init();
    console.log('Auth initialized. UID:', Auth.getUid());
    console.log('Nickname:', Auth.getNickname());

    // 2. Initialize UI
    UI.init();

    // 3. Try to rejoin last room
    const rejoined = await UI.tryRejoinLastRoom();
    if (rejoined) {
      console.log('Rejoined last room');
    }
  } catch (error) {
    console.error('App initialization failed:', error);
    UI.showToast('Error al iniciar la aplicación');
  }
});

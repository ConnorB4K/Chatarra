/* ============================================
   CHATARRA — App Entry Point
   Firebase initialization & bootstrap
   ============================================ */

// ─── Firebase Configuration ─────────────
// Replace these values with your own Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyBkc6E4cxhKD45DbJjomP8DK1JBzSGIlo8",
  authDomain: "chatarra-f27ad.firebaseapp.com",
  databaseURL: "https://chatarra-f27ad-default-rtdb.firebaseio.com",
  projectId: "chatarra-f27ad",
  storageBucket: "chatarra-f27ad.firebasestorage.app",
  messagingSenderId: "92761505044",
  appId: "1:92761505044:web:8e81812baf20c9e01dd601"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// ─── ImgBB Configuration ────────────────
// Replace with your ImgBB API key (https://api.imgbb.com/)
const IMGBB_API_KEY = 'YOUR_IMGBB_API_KEY';

// ─── App Bootstrap ──────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1. Initialize anonymous auth
    await Auth.init();
    console.log('Auth initialized. UID:', Auth.getUid());
    console.log('Nickname:', Auth.getNickname());

    // 2. Initialize ImgBB media uploads
    Media.init(IMGBB_API_KEY);

    // 3. Load presets (stickers & audio from manifests)
    await Presets.init();

    // 4. Load saved theme
    UI.loadSavedTheme();

    // 5. Initialize UI
    UI.init();

    // 6. Show last room shortcut if available
    UI.tryRejoinLastRoom();
  } catch (error) {
    console.error('App initialization failed:', error);
    UI.showToast('Error al iniciar la aplicación');
  }
});

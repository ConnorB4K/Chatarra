/* ============================================
   CHATARRA — Auth Module
   Anonymous Firebase Auth + localStorage
   ============================================ */

const Auth = (() => {
  let _uid = null;
  let _nickname = null;

  const STORAGE_KEY_NICK = 'chatarra_nickname';
  const STORAGE_KEY_ROOM = 'chatarra_last_room';

  /**
   * Initialize anonymous authentication.
   * Returns a Promise that resolves with the user UID.
   */
  async function init() {
    return new Promise((resolve, reject) => {
      firebase.auth().onAuthStateChanged((user) => {
        if (user) {
          _uid = user.uid;
          _nickname = _loadNickname();
          resolve(_uid);
        }
      });

      firebase.auth().signInAnonymously().catch((error) => {
        console.error('Auth error:', error);
        reject(error);
      });
    });
  }

  /**
   * Get or prompt for a nickname.
   * Nickname is stored in localStorage.
   */
  function _loadNickname() {
    let nick = localStorage.getItem(STORAGE_KEY_NICK);
    if (!nick || nick.trim() === '') {
      nick = _promptNickname();
    }
    return nick;
  }

  /**
   * Show native prompt for nickname.
   */
  function _promptNickname() {
    let nick = null;
    while (!nick || nick.trim() === '' || nick.trim().length < 2) {
      nick = prompt('Elige tu apodo para Chatarra (mín. 2 caracteres):');
      if (nick === null) {
        // User cancelled, assign a default
        nick = 'Anon' + Math.floor(Math.random() * 9999);
      }
    }
    nick = nick.trim().substring(0, 20);
    localStorage.setItem(STORAGE_KEY_NICK, nick);
    return nick;
  }

  /**
   * Get the current UID.
   */
  function getUid() {
    return _uid;
  }

  /**
   * Get the current nickname.
   */
  function getNickname() {
    return _nickname;
  }

  /**
   * Change nickname.
   */
  function setNickname(newNick) {
    if (newNick && newNick.trim().length >= 2) {
      _nickname = newNick.trim().substring(0, 20);
      localStorage.setItem(STORAGE_KEY_NICK, _nickname);
      return true;
    }
    return false;
  }

  /**
   * Save the last visited room code.
   */
  function saveLastRoom(roomCode) {
    localStorage.setItem(STORAGE_KEY_ROOM, roomCode);
  }

  /**
   * Get the last visited room code.
   */
  function getLastRoom() {
    return localStorage.getItem(STORAGE_KEY_ROOM);
  }

  /**
   * Clear last room from storage.
   */
  function clearLastRoom() {
    localStorage.removeItem(STORAGE_KEY_ROOM);
  }

  return {
    init,
    getUid,
    getNickname,
    setNickname,
    saveLastRoom,
    getLastRoom,
    clearLastRoom,
  };
})();

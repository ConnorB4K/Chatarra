/* ============================================
   CHATARRA — Rooms Module
   Create/Join rooms with short codes
   ============================================ */

const Rooms = (() => {
  // Characters excluding ambiguous: O, 0, I, 1, L
  const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const CODE_LENGTH = 6;

  const db = () => firebase.database();

  /**
   * Generate a random room code of 6 chars.
   */
  function _generateCode() {
    let code = '';
    const arr = new Uint32Array(CODE_LENGTH);
    crypto.getRandomValues(arr);
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CHARS[arr[i] % CHARS.length];
    }
    return code;
  }

  /**
   * Create a new room. Returns the room code.
   */
  async function createRoom() {
    const uid = Auth.getUid();
    const nickname = Auth.getNickname();

    // Generate unique code (check for collisions)
    let code;
    let exists = true;
    while (exists) {
      code = _generateCode();
      const snapshot = await db().ref(`rooms/${code}`).once('value');
      exists = snapshot.exists();
    }

    // Write room data
    await db().ref(`rooms/${code}`).set({
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      createdBy: uid,
    });

    // Register creator as member
    await _registerMember(code, uid, nickname);

    return code;
  }

  /**
   * Join an existing room by code.
   * Returns true if room exists, false otherwise.
   */
  async function joinRoom(code) {
    code = code.toUpperCase().trim();
    if (code.length !== CODE_LENGTH) return false;

    const snapshot = await db().ref(`rooms/${code}`).once('value');
    if (!snapshot.exists()) return false;

    const uid = Auth.getUid();
    const nickname = Auth.getNickname();
    await _registerMember(code, uid, nickname);
    return true;
  }

  /**
   * Register a user as a member of a room.
   */
  async function _registerMember(roomCode, uid, nickname) {
    await db().ref(`rooms/${roomCode}/members/${uid}`).update({
      nickname: nickname,
      joinedAt: firebase.database.ServerValue.TIMESTAMP,
    });
  }

  /**
   * Update FCM token for a member in a room.
   */
  async function updateFCMToken(roomCode, uid, token) {
    if (!token) return;
    await db().ref(`rooms/${roomCode}/members/${uid}/fcmToken`).set(token);
  }

  /**
   * Get room members.
   */
  async function getMembers(roomCode) {
    const snapshot = await db().ref(`rooms/${roomCode}/members`).once('value');
    return snapshot.val() || {};
  }

  /**
   * Validate code format.
   */
  function isValidCode(code) {
    if (!code || code.length !== CODE_LENGTH) return false;
    return /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/.test(code.toUpperCase());
  }

  return {
    createRoom,
    joinRoom,
    updateFCMToken,
    getMembers,
    isValidCode,
  };
})();

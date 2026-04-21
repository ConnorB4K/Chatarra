/* ============================================
   CHATARRA — Chat Module
   Real-time messaging with Firebase RTDB
   ============================================ */

const Chat = (() => {
  let _currentRoom = null;
  let _messagesRef = null;
  let _listeners = [];
  let _messages = {}; // { msgId: msgData }
  const EDIT_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

  const db = () => firebase.database();

  /**
   * Join a room and start listening for messages.
   * @param {string} roomCode
   * @param {Object} callbacks - { onMessage, onMessageChanged, onMessageRemoved }
   */
  function listen(roomCode, callbacks) {
    // Clean up previous listeners
    stopListening();

    _currentRoom = roomCode;
    _messagesRef = db().ref(`rooms/${roomCode}/messages`);
    _messages = {};

    // Listen for new/existing messages
    const addedRef = _messagesRef.orderByChild('timestamp');
    addedRef.on('child_added', (snapshot) => {
      const msg = snapshot.val();
      const id = snapshot.key;
      _messages[id] = msg;

      if (callbacks.onMessage) {
        callbacks.onMessage(id, msg);
      }
    });
    _listeners.push({ ref: addedRef, event: 'child_added' });

    // Listen for message edits (hiddenBy, editedAt, content changes)
    addedRef.on('child_changed', (snapshot) => {
      const msg = snapshot.val();
      const id = snapshot.key;
      _messages[id] = msg;

      if (callbacks.onMessageChanged) {
        callbacks.onMessageChanged(id, msg);
      }
    });
    _listeners.push({ ref: addedRef, event: 'child_changed' });
  }

  /**
   * Stop listening to messages.
   */
  function stopListening() {
    if (_messagesRef) {
      _messagesRef.off();
    }
    _listeners = [];
    _messages = {};
    _currentRoom = null;
  }

  /**
   * Send a message.
   * @param {string} roomCode
   * @param {Object} data - { type, content, replyTo? }
   */
  async function sendMessage(roomCode, data) {
    const uid = Auth.getUid();
    const nickname = Auth.getNickname();

    const message = {
      uid: uid,
      nickname: nickname,
      type: data.type, // 'text', 'image', 'sticker', 'audio'
      content: data.content,
      timestamp: firebase.database.ServerValue.TIMESTAMP,
      editedAt: null,
      replyTo: data.replyTo || null,
    };

    const ref = db().ref(`rooms/${roomCode}/messages`).push();
    await ref.set(message);
    return ref.key;
  }

  /**
   * Edit a message (text only, within 30-min window).
   * @param {string} roomCode
   * @param {string} messageId
   * @param {string} newContent
   * @returns {boolean} success
   */
  async function editMessage(roomCode, messageId, newContent) {
    const msg = _messages[messageId];
    if (!msg) return false;

    // Check ownership
    if (msg.uid !== Auth.getUid()) return false;

    // Check type
    if (msg.type !== 'text') return false;

    // Check time window
    const elapsed = Date.now() - msg.timestamp;
    if (elapsed > EDIT_WINDOW_MS) return false;

    await db().ref(`rooms/${roomCode}/messages/${messageId}`).update({
      content: newContent,
      editedAt: firebase.database.ServerValue.TIMESTAMP,
    });

    return true;
  }

  /**
   * Check if a message can be edited.
   */
  function canEdit(messageId) {
    const msg = _messages[messageId];
    if (!msg) return false;
    if (msg.uid !== Auth.getUid()) return false;
    if (msg.type !== 'text') return false;
    const elapsed = Date.now() - msg.timestamp;
    return elapsed <= EDIT_WINDOW_MS;
  }

  /**
   * Clear chat for the current user (asymmetric deletion).
   * Adds the user's UID to hiddenBy on all visible messages.
   */
  async function clearChatForMe(roomCode) {
    const uid = Auth.getUid();
    const snapshot = await db().ref(`rooms/${roomCode}/messages`).once('value');
    const messages = snapshot.val();

    if (!messages) return;

    const updates = {};
    Object.keys(messages).forEach((msgId) => {
      const msg = messages[msgId];
      // Skip if already hidden for this user
      if (msg.hiddenBy && msg.hiddenBy[uid]) return;
      updates[`${msgId}/hiddenBy/${uid}`] = true;
    });

    if (Object.keys(updates).length > 0) {
      await db().ref(`rooms/${roomCode}/messages`).update(updates);
    }
  }

  /**
   * Check if a message is hidden for the current user.
   */
  function isHiddenForMe(msg) {
    const uid = Auth.getUid();
    return msg.hiddenBy && msg.hiddenBy[uid] === true;
  }

  /**
   * Get a cached message by ID.
   */
  function getMessage(messageId) {
    return _messages[messageId] || null;
  }

  /**
   * Get current room code.
   */
  function getCurrentRoom() {
    return _currentRoom;
  }

  return {
    listen,
    stopListening,
    sendMessage,
    editMessage,
    canEdit,
    clearChatForMe,
    isHiddenForMe,
    getMessage,
    getCurrentRoom,
  };
})();

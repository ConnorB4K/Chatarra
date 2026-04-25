/* ============================================
   CHATARRA — Chat Module
   Real-time messaging with Firebase RTDB
   ============================================ */

const Chat = (() => {
  let _currentRoom = null;
  let _messagesRef = null;
  let _listeners = [];
  let _messages = {}; 
  const EDIT_WINDOW_MS = 30 * 60 * 1000;
  
  // Variables para paginación
  let _earliestMessageTimestamp = null;
  let _hasMoreMessages = true;
  const MESSAGES_PER_PAGE = 30;

  const db = () => firebase.database();

  function listen(roomCode, callbacks) {
    stopListening();
    _currentRoom = roomCode;
    _messagesRef = db().ref(`rooms/${roomCode}/messages`);
    _messages = {};
    _earliestMessageTimestamp = null;
    _hasMoreMessages = true;

    let initialLoadDone = false;

    // Solo pedimos los últimos 30 mensajes inicialmente
    const addedRef = _messagesRef.orderByChild('timestamp').limitToLast(MESSAGES_PER_PAGE);

    addedRef.on('child_added', snapshot => {
      const msg = snapshot.val();
      const id = snapshot.key;
      _messages[id] = msg;
      
      // Guardar el timestamp más antiguo para usarlo luego en "Cargar más"
      if (!_earliestMessageTimestamp || msg.timestamp < _earliestMessageTimestamp) {
        _earliestMessageTimestamp = msg.timestamp;
      }

      if (callbacks.onMessage) {
        callbacks.onMessage(id, msg, initialLoadDone);
      }
    });
    _listeners.push({ ref: addedRef, event: 'child_added' });

    addedRef.once('value', (snapshot) => {
      initialLoadDone = true;
      // Si recibimos menos del límite, no hay más mensajes antiguos
      if (snapshot.numChildren() < MESSAGES_PER_PAGE) {
        _hasMoreMessages = false;
      }
      if (callbacks.onReady) callbacks.onReady();
    });

    // Escuchar cambios (editados/eliminados) globalmente para la sala
    const changedRef = _messagesRef.orderByChild('timestamp');
    changedRef.on('child_changed', snapshot => {
      const msg = snapshot.val();
      const id = snapshot.key;
      _messages[id] = msg;
      if (callbacks.onMessageChanged) callbacks.onMessageChanged(id, msg);
    });
    _listeners.push({ ref: changedRef, event: 'child_changed' });
  }

  // Nueva función para paginación (Cargar más)
  async function loadMoreMessages(callbacks) {
    if (!_currentRoom || !_hasMoreMessages || !_earliestMessageTimestamp) return false;

    const snapshot = await db().ref(`rooms/${_currentRoom}/messages`)
      .orderByChild('timestamp')
      .endAt(_earliestMessageTimestamp - 1) // Obtener los anteriores al más antiguo actual
      .limitToLast(MESSAGES_PER_PAGE)
      .once('value');

    const olderMessages = snapshot.val();
    if (!olderMessages) {
      _hasMoreMessages = false;
      return false;
    }

    const keys = Object.keys(olderMessages).sort((a, b) => olderMessages[a].timestamp - olderMessages[b].timestamp);
    
    if (keys.length < MESSAGES_PER_PAGE) {
      _hasMoreMessages = false;
    }

    // Actualizamos el timestamp más antiguo
    _earliestMessageTimestamp = olderMessages[keys[0]].timestamp;

    // Ejecutar el callback por cada mensaje viejo recuperado
    keys.forEach(id => {
      const msg = olderMessages[id];
      _messages[id] = msg;
      if (callbacks.onOldMessage) callbacks.onOldMessage(id, msg);
    });

    return _hasMoreMessages;
  }

  function stopListening() {
    _listeners.forEach(l => l.ref.off(l.event));
    _listeners = [];
    _messages = {};
    _currentRoom = null;
    _earliestMessageTimestamp = null;
    _hasMoreMessages = true;
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

  /**
   * Fetch the last message from a room (for preview).
   * @param {string} roomCode
   * @returns {Object|null}
   */
  async function getLastMessage(roomCode) {
    try {
      const snapshot = await db()
        .ref(`rooms/${roomCode}/messages`)
        .orderByChild('timestamp')
        .limitToLast(1)
        .once('value');
      const messages = snapshot.val();
      if (!messages) return null;
      const keys = Object.keys(messages);
      return messages[keys[0]];
    } catch {
      return null;
    }
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
    getLastMessage,
    loadMoreMessages
  };
})();

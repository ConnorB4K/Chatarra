/* ============================================
   CHATARRA — UI Module
   DOM manipulation, rendering, sound effects
   ============================================ */

const UI = (() => {
  // DOM references (cached after init)
  let $app,
    $lobbyView,
    $chatView,
    $roomCodeInput,
    $chatMessages,
    $chatInput,
    $chatHeaderTitle,
    $chatHeaderCode,
    $replyBar,
    $replyBarSender,
    $replyBarText,
    $stickerPanel,
    $audioPanel,
    $optionsMenu,
    $optionsBackdrop,
    $editModal,
    $editTextarea,
    $imagePreview,
    $toastContainer;

  // State
  let _replyToId = null;
  let _editingMessageId = null;
  let _notificationAudio = null;
  let _activeContextMenu = null;
  let _renderedMessageIds = new Set();

  /**
   * Initialize UI references and event listeners.
   */
  function init() {
    // Cache DOM
    $app = document.getElementById('app');
    $lobbyView = document.getElementById('lobby-view');
    $chatView = document.getElementById('chat-view');
    $roomCodeInput = document.getElementById('room-code-input');
    $chatMessages = document.getElementById('chat-messages');
    $chatInput = document.getElementById('chat-input');
    $chatHeaderTitle = document.getElementById('chat-header-title');
    $chatHeaderCode = document.getElementById('chat-header-code-text');
    $replyBar = document.getElementById('reply-bar');
    $replyBarSender = document.getElementById('reply-bar-sender');
    $replyBarText = document.getElementById('reply-bar-text');
    $stickerPanel = document.getElementById('sticker-panel');
    $audioPanel = document.getElementById('audio-panel');
    $optionsMenu = document.getElementById('options-menu');
    $optionsBackdrop = document.getElementById('options-menu-backdrop');
    $editModal = document.getElementById('edit-modal');
    $editTextarea = document.getElementById('edit-textarea');
    $imagePreview = document.getElementById('image-preview-overlay');
    $toastContainer = document.getElementById('toast-container');

    // Notification sound
    _notificationAudio = new Audio('./assets/sounds/notification.mp3');
    _notificationAudio.volume = 0.5;

    // Set up event listeners
    _setupLobbyEvents();
    _setupChatEvents();
    _setupPresetPanels();
    _setupOptionsMenu();
    _setupEditModal();
    _setupImagePreview();
  }

  // ─── Lobby ──────────────────────────────

  function _setupLobbyEvents() {
    document.getElementById('btn-create-room').addEventListener('click', async () => {
      const btn = document.getElementById('btn-create-room');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>';

      try {
        const code = await Rooms.createRoom();
        Auth.saveLastRoom(code);
        await _enterRoom(code);
      } catch (err) {
        console.error(err);
        showToast('Error al crear la sala');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-plus"></i> Crear Sala';
      }
    });

    document.getElementById('btn-join-room').addEventListener('click', async () => {
      const code = $roomCodeInput.value.trim().toUpperCase();
      if (!Rooms.isValidCode(code)) {
        showToast('Código inválido. Debe tener 6 caracteres.');
        $roomCodeInput.focus();
        return;
      }

      const btn = document.getElementById('btn-join-room');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>';

      try {
        const exists = await Rooms.joinRoom(code);
        if (exists) {
          Auth.saveLastRoom(code);
          await _enterRoom(code);
        } else {
          showToast('Sala no encontrada');
        }
      } catch (err) {
        console.error(err);
        showToast('Error al unirse');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i>';
      }
    });

    // Allow Enter key on room code input
    $roomCodeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('btn-join-room').click();
      }
    });

    // Auto-uppercase room code
    $roomCodeInput.addEventListener('input', () => {
      $roomCodeInput.value = $roomCodeInput.value.toUpperCase().replace(/[^ABCDEFGHJKMNPQRSTUVWXYZ23456789]/g, '');
    });
  }

  // ─── Enter/Leave Room ──────────────────

  async function _enterRoom(roomCode) {
    $lobbyView.classList.add('hidden');
    $chatView.classList.add('active');
    $chatMessages.innerHTML = '';
    _renderedMessageIds.clear();

    $chatHeaderTitle.textContent = 'Sala';
    $chatHeaderCode.textContent = roomCode;

    // Start listening
    Chat.listen(roomCode, {
      onMessage: _onNewMessage,
      onMessageChanged: _onMessageChanged,
    });

    // Init swipe
    Swipe.init($chatMessages, _onSwipeReply);

    // Auto-resize input
    $chatInput.focus();

    // Try to init FCM
    _initNotifications(roomCode);

    // Scroll to bottom
    _scrollToBottom();
  }

  function leaveRoom() {
    Chat.stopListening();
    Swipe.destroy($chatMessages);
    _closeAllPanels();
    _renderedMessageIds.clear();

    $chatView.classList.remove('active');
    $lobbyView.classList.remove('hidden');
    $chatMessages.innerHTML = '';
    $chatInput.value = '';
    _clearReply();
  }

  // ─── Message Rendering ──────────────────

  function _onNewMessage(id, msg) {
    if (_renderedMessageIds.has(id)) return;

    // Skip hidden messages
    if (Chat.isHiddenForMe(msg)) return;

    _renderedMessageIds.add(id);
    const el = _createMessageElement(id, msg);
    $chatMessages.appendChild(el);
    _scrollToBottom();

    // Play sound if it's from someone else
    if (msg.uid !== Auth.getUid()) {
      _playNotificationSound();
    }
  }

  function _onMessageChanged(id, msg) {
    // If now hidden, remove element
    if (Chat.isHiddenForMe(msg)) {
      const el = $chatMessages.querySelector(`[data-message-id="${id}"]`);
      if (el) {
        el.remove();
        _renderedMessageIds.delete(id);
      }
      return;
    }

    // Update existing element
    const existingEl = $chatMessages.querySelector(`[data-message-id="${id}"]`);
    if (existingEl) {
      const newEl = _createMessageElement(id, msg);
      existingEl.replaceWith(newEl);
    }
  }

  function _createMessageElement(id, msg) {
    const isOwn = msg.uid === Auth.getUid();
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${isOwn ? 'own' : 'other'}`;
    wrapper.dataset.messageId = id;

    // Swipe reply icon
    const swipeIcon = document.createElement('div');
    swipeIcon.className = 'swipe-reply-icon';
    swipeIcon.innerHTML = '<i class="fa-solid fa-reply"></i>';
    wrapper.appendChild(swipeIcon);

    // Sender name (only for others)
    if (!isOwn) {
      const sender = document.createElement('div');
      sender.className = 'message-sender';
      sender.textContent = msg.nickname || 'Anónimo';
      wrapper.appendChild(sender);
    }

    // Bubble
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    // Reply preview
    if (msg.replyTo) {
      const replyMsg = Chat.getMessage(msg.replyTo);
      if (replyMsg) {
        const replyPreview = document.createElement('div');
        replyPreview.className = 'message-reply-preview';
        replyPreview.innerHTML = `
          <div class="message-reply-preview-sender">${_escapeHtml(replyMsg.nickname || 'Anónimo')}</div>
          <div class="message-reply-preview-text">${_getPreviewText(replyMsg)}</div>
        `;
        bubble.appendChild(replyPreview);
      }
    }

    // Content based on type
    switch (msg.type) {
      case 'text':
        const textSpan = document.createElement('span');
        textSpan.textContent = msg.content;
        bubble.appendChild(textSpan);
        break;

      case 'image':
        const img = document.createElement('img');
        img.className = 'message-image';
        img.src = msg.content;
        img.alt = 'Imagen';
        img.loading = 'lazy';
        img.addEventListener('click', () => _showImagePreview(msg.content));
        bubble.appendChild(img);
        break;

      case 'sticker':
        bubble.classList.add('sticker-bubble');
        const stickerImg = document.createElement('img');
        stickerImg.className = 'message-sticker';
        stickerImg.src = Presets.getStickerPath(msg.content);
        stickerImg.alt = msg.content;
        const stickerInfo = Presets.findSticker(msg.content);
        if (stickerInfo) stickerImg.alt = stickerInfo.name;
        bubble.appendChild(stickerImg);
        break;

      case 'audio':
        const audioPreset = document.createElement('div');
        audioPreset.className = 'message-audio-preset';
        const audioInfo = Presets.findAudio(msg.content);
        audioPreset.innerHTML = `
          <button class="audio-play-btn" aria-label="Reproducir audio">
            <i class="fa-solid fa-play"></i>
          </button>
          <span class="audio-name">${_escapeHtml(audioInfo ? audioInfo.name : msg.content)}</span>
        `;
        audioPreset.querySelector('.audio-play-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          _playAudioPreset(msg.content);
        });
        bubble.appendChild(audioPreset);
        break;
    }

    // Meta (timestamp + edited)
    if (msg.type !== 'sticker') {
      const meta = document.createElement('div');
      meta.className = 'message-meta';
      if (msg.editedAt) {
        const editedTag = document.createElement('span');
        editedTag.className = 'message-edited-tag';
        editedTag.textContent = 'editado';
        meta.appendChild(editedTag);
      }
      const time = document.createElement('span');
      time.textContent = _formatTime(msg.timestamp);
      meta.appendChild(time);
      bubble.appendChild(meta);
    }

    wrapper.appendChild(bubble);

    // Long press / right click for context menu (only own messages of type text)
    if (isOwn && msg.type === 'text') {
      let longPressTimer;
      wrapper.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        _showContextMenu(wrapper, id, msg);
      });
      wrapper.addEventListener('touchstart', () => {
        longPressTimer = setTimeout(() => _showContextMenu(wrapper, id, msg), 500);
      }, { passive: true });
      wrapper.addEventListener('touchend', () => clearTimeout(longPressTimer), { passive: true });
      wrapper.addEventListener('touchmove', () => clearTimeout(longPressTimer), { passive: true });
    }

    return wrapper;
  }

  // ─── Context Menu ──────────────────────

  function _showContextMenu(wrapperEl, msgId, msg) {
    // Close any existing
    _closeContextMenu();

    if (!Chat.canEdit(msgId)) return;

    const menu = document.createElement('div');
    menu.className = 'message-context-menu';
    menu.innerHTML = `
      <button data-action="edit">
        <i class="fa-solid fa-pen"></i> Editar mensaje
      </button>
    `;

    menu.querySelector('[data-action="edit"]').addEventListener('click', () => {
      _openEditModal(msgId, msg.content);
      _closeContextMenu();
    });

    wrapperEl.style.position = 'relative';
    wrapperEl.appendChild(menu);
    _activeContextMenu = menu;

    // Show with animation
    requestAnimationFrame(() => menu.classList.add('visible'));

    // Close on click outside
    const closeHandler = (e) => {
      if (!menu.contains(e.target)) {
        _closeContextMenu();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);
  }

  function _closeContextMenu() {
    if (_activeContextMenu) {
      _activeContextMenu.remove();
      _activeContextMenu = null;
    }
  }

  // ─── Chat Input Events ────────────────

  function _setupChatEvents() {
    // Send button
    document.getElementById('btn-send').addEventListener('click', _handleSend);

    // Enter to send (Shift+Enter for newline)
    $chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        _handleSend();
      }
    });

    // Auto-resize textarea
    $chatInput.addEventListener('input', () => {
      $chatInput.style.height = 'auto';
      $chatInput.style.height = Math.min($chatInput.scrollHeight, 120) + 'px';
    });

    // Back button
    document.getElementById('btn-back').addEventListener('click', leaveRoom);

    // Image upload
    document.getElementById('btn-attach-image').addEventListener('click', () => {
      document.getElementById('image-file-input').click();
    });

    document.getElementById('image-file-input').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        showToast('Solo se permiten imágenes');
        return;
      }

      showToast('Subiendo imagen...');
      try {
        const url = await Media.uploadImage(Chat.getCurrentRoom(), file);
        await Chat.sendMessage(Chat.getCurrentRoom(), {
          type: 'image',
          content: url,
          replyTo: _replyToId,
        });
        _clearReply();
      } catch (err) {
        console.error(err);
        showToast('Error al subir la imagen');
      }
      e.target.value = '';
    });

    // Sticker button
    document.getElementById('btn-stickers').addEventListener('click', () => {
      _togglePanel($stickerPanel);
      _closePanel($audioPanel);
    });

    // Audio button
    document.getElementById('btn-audio-presets').addEventListener('click', () => {
      _togglePanel($audioPanel);
      _closePanel($stickerPanel);
    });

    // Reply bar close
    document.getElementById('reply-bar-close').addEventListener('click', _clearReply);

    // Copy room code
    document.getElementById('chat-header-code').addEventListener('click', () => {
      const code = $chatHeaderCode.textContent;
      navigator.clipboard.writeText(code).then(() => {
        showToast('Código copiado');
      });
    });
  }

  async function _handleSend() {
    const text = $chatInput.value.trim();
    if (!text) return;

    const room = Chat.getCurrentRoom();
    if (!room) return;

    $chatInput.value = '';
    $chatInput.style.height = 'auto';

    try {
      await Chat.sendMessage(room, {
        type: 'text',
        content: text,
        replyTo: _replyToId,
      });
      _clearReply();
    } catch (err) {
      console.error(err);
      showToast('Error al enviar');
    }
  }

  // ─── Reply ────────────────────────────

  function _onSwipeReply(messageId) {
    const msg = Chat.getMessage(messageId);
    if (!msg) return;

    _replyToId = messageId;
    $replyBarSender.textContent = msg.nickname || 'Anónimo';
    $replyBarText.textContent = _getPreviewText(msg);
    $replyBar.classList.add('active');
    $chatInput.focus();
  }

  function _clearReply() {
    _replyToId = null;
    $replyBar.classList.remove('active');
  }

  function getReplyToId() {
    return _replyToId;
  }

  // ─── Preset Panels ────────────────────

  function _setupPresetPanels() {
    // Render stickers
    const stickerGrid = document.getElementById('sticker-grid');
    Presets.getStickers().forEach((sticker) => {
      const item = document.createElement('div');
      item.className = 'sticker-item';
      item.innerHTML = `<div class="sticker-placeholder">${_escapeHtml(sticker.name)}</div>`;

      // Try loading the actual image
      const img = new Image();
      img.src = Presets.getStickerPath(sticker.file);
      img.alt = sticker.name;
      img.onload = () => {
        item.innerHTML = '';
        item.appendChild(img);
      };

      item.addEventListener('click', async () => {
        const room = Chat.getCurrentRoom();
        if (!room) return;
        await Chat.sendMessage(room, {
          type: 'sticker',
          content: sticker.file,
          replyTo: _replyToId,
        });
        _clearReply();
        _closePanel($stickerPanel);
      });
      stickerGrid.appendChild(item);
    });

    // Render audio presets
    const audioList = document.getElementById('audio-list');
    Presets.getAudioPresets().forEach((audio) => {
      const item = document.createElement('div');
      item.className = 'audio-item';
      item.innerHTML = `
        <div class="audio-item-icon">
          <i class="fa-solid fa-music"></i>
        </div>
        <div class="audio-item-info">
          <div class="audio-item-name">${_escapeHtml(audio.name)}</div>
          <div class="audio-item-hint">Toca para preescuchar</div>
        </div>
        <button class="audio-item-send" aria-label="Enviar audio ${_escapeHtml(audio.name)}">
          <i class="fa-solid fa-paper-plane"></i>
        </button>
      `;

      // Preview on tap
      item.addEventListener('click', (e) => {
        if (!e.target.closest('.audio-item-send')) {
          _playAudioPreset(audio.file);
        }
      });

      // Send button
      item.querySelector('.audio-item-send').addEventListener('click', async (e) => {
        e.stopPropagation();
        const room = Chat.getCurrentRoom();
        if (!room) return;
        await Chat.sendMessage(room, {
          type: 'audio',
          content: audio.file,
          replyTo: _replyToId,
        });
        _clearReply();
        _closePanel($audioPanel);
      });

      audioList.appendChild(item);
    });

    // Close panel buttons
    document.querySelectorAll('.presets-panel-close').forEach((btn) => {
      btn.addEventListener('click', () => {
        _closePanel($stickerPanel);
        _closePanel($audioPanel);
      });
    });
  }

  function _togglePanel(panel) {
    if (panel.classList.contains('open')) {
      _closePanel(panel);
    } else {
      panel.classList.add('open');
    }
  }

  function _closePanel(panel) {
    if (panel) panel.classList.remove('open');
  }

  function _closeAllPanels() {
    _closePanel($stickerPanel);
    _closePanel($audioPanel);
    _closeOptionsMenu();
    _closeContextMenu();
    _closeEditModal();
    _closeImagePreview();
  }

  // ─── Options Menu ─────────────────────

  function _setupOptionsMenu() {
    document.getElementById('btn-options').addEventListener('click', () => {
      $optionsMenu.classList.toggle('visible');
      $optionsBackdrop.classList.toggle('visible');
    });

    $optionsBackdrop.addEventListener('click', _closeOptionsMenu);

    // Clear chat for me
    document.getElementById('btn-clear-chat').addEventListener('click', async () => {
      _closeOptionsMenu();
      if (!confirm('¿Vaciar el chat solo para ti? Los demás seguirán viendo los mensajes.')) return;
      const room = Chat.getCurrentRoom();
      if (!room) return;
      try {
        await Chat.clearChatForMe(room);
        showToast('Chat vaciado para ti');
      } catch (err) {
        console.error(err);
        showToast('Error al vaciar el chat');
      }
    });

    // Copy room code
    document.getElementById('btn-copy-code').addEventListener('click', () => {
      _closeOptionsMenu();
      const code = $chatHeaderCode.textContent;
      navigator.clipboard.writeText(code).then(() => showToast('Código copiado'));
    });

    // Change nickname
    document.getElementById('btn-change-nick').addEventListener('click', () => {
      _closeOptionsMenu();
      const newNick = prompt('Nuevo apodo (mín. 2 caracteres):', Auth.getNickname());
      if (newNick && Auth.setNickname(newNick)) {
        // Update in room members
        const room = Chat.getCurrentRoom();
        if (room) {
          firebase.database().ref(`rooms/${room}/members/${Auth.getUid()}/nickname`).set(newNick.trim().substring(0, 20));
        }
        showToast('Apodo actualizado');
      }
    });
  }

  function _closeOptionsMenu() {
    if ($optionsMenu) $optionsMenu.classList.remove('visible');
    if ($optionsBackdrop) $optionsBackdrop.classList.remove('visible');
  }

  // ─── Edit Modal ────────────────────────

  function _setupEditModal() {
    document.getElementById('btn-edit-cancel').addEventListener('click', _closeEditModal);
    document.getElementById('btn-edit-save').addEventListener('click', async () => {
      const newContent = $editTextarea.value.trim();
      if (!newContent || !_editingMessageId) {
        _closeEditModal();
        return;
      }

      const room = Chat.getCurrentRoom();
      if (!room) return;

      const success = await Chat.editMessage(room, _editingMessageId, newContent);
      if (success) {
        showToast('Mensaje editado');
      } else {
        showToast('No se pudo editar (tiempo expirado o sin permiso)');
      }
      _closeEditModal();
    });

    // Close on backdrop click
    $editModal.addEventListener('click', (e) => {
      if (e.target === $editModal) _closeEditModal();
    });
  }

  function _openEditModal(messageId, currentContent) {
    _editingMessageId = messageId;
    $editTextarea.value = currentContent;
    $editModal.classList.add('visible');
    $editTextarea.focus();
  }

  function _closeEditModal() {
    $editModal.classList.remove('visible');
    _editingMessageId = null;
  }

  // ─── Image Preview ────────────────────

  function _setupImagePreview() {
    $imagePreview.addEventListener('click', _closeImagePreview);
  }

  function _showImagePreview(url) {
    const img = $imagePreview.querySelector('img');
    img.src = url;
    $imagePreview.classList.add('visible');
  }

  function _closeImagePreview() {
    if ($imagePreview) $imagePreview.classList.remove('visible');
  }

  // ─── Sound Effects ────────────────────

  function _playNotificationSound() {
    if (_notificationAudio) {
      _notificationAudio.currentTime = 0;
      _notificationAudio.play().catch(() => {});
    }
  }

  function _playAudioPreset(filename) {
    const audio = new Audio(Presets.getAudioPath(filename));
    audio.play().catch(() => showToast('No se pudo reproducir el audio'));
  }

  // ─── Toast ─────────────────────────────

  function showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    $toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-out');
      toast.addEventListener('animationend', () => toast.remove());
    }, duration);
  }

  // ─── Utilities ────────────────────────

  function _scrollToBottom() {
    requestAnimationFrame(() => {
      if ($chatMessages) {
        $chatMessages.scrollTop = $chatMessages.scrollHeight;
      }
    });
  }

  function _formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const mins = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${mins}`;
  }

  function _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function _getPreviewText(msg) {
    switch (msg.type) {
      case 'text':
        return msg.content.length > 60 ? msg.content.substring(0, 60) + '...' : msg.content;
      case 'image':
        return 'Imagen';
      case 'sticker':
        const s = Presets.findSticker(msg.content);
        return s ? s.name : 'Sticker';
      case 'audio':
        const a = Presets.findAudio(msg.content);
        return a ? a.name : 'Audio';
      default:
        return '';
    }
  }

  // ─── Notifications ────────────────────

  async function _initNotifications(roomCode) {
    try {
      // Use your VAPID key here
      const token = await Notifications.init('YOUR_VAPID_KEY_HERE');
      if (token) {
        await Rooms.updateFCMToken(roomCode, Auth.getUid(), token);
      }
    } catch (err) {
      console.warn('Notifications not available:', err);
    }
  }

  // ─── Auto-rejoin last room ────────────

  async function tryRejoinLastRoom() {
    const lastRoom = Auth.getLastRoom();
    if (lastRoom && Rooms.isValidCode(lastRoom)) {
      const exists = await Rooms.joinRoom(lastRoom);
      if (exists) {
        await _enterRoom(lastRoom);
        return true;
      } else {
        Auth.clearLastRoom();
      }
    }
    return false;
  }

  return {
    init,
    leaveRoom,
    showToast,
    tryRejoinLastRoom,
    getReplyToId,
  };
})();

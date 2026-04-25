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
  let _activeAudio = null;
  let _replyToId = null;
  let _editingMessageId = null;
  let _notificationAudio = null;
  let _activeContextMenu = null;
  let _renderedMessageIds = new Set();
  let _lastRenderedMsg = null;
  let $themeModal = null;
  let _isMuted = localStorage.getItem('chatarra_muted') === 'true';
  let _audioUnlocked = false;
  const _notificationSfx = new Audio('./assets/sounds/notification.wav');
  _notificationSfx.volume = 0.5;
  let _audioCache = {};
  let chatReady = false;

  // ─── Theme Definitions ─────────────────
  const THEMES = [
    { id: 'default',        name: 'Claro',           emoji: '☀️', bg: '#f1f0f6', accent: '#6c14f0', bubble: '#6c14f0' },
    { id: 'oscuro',          name: 'Oscuro',           emoji: '🌙', bg: '#121218', accent: '#8b5cf6', bubble: '#7c3aed' },
    { id: 'whatsapp',        name: 'WhatsApp',         emoji: '💬', bg: '#f0f2f5', accent: '#00a884', bubble: '#d9fdd3' },
    { id: 'whatsapp-dark',   name: 'WhatsApp Oscuro',  emoji: '🌿', bg: '#111b21', accent: '#00a884', bubble: '#005c4b' },
    { id: 'windows11',       name: 'Windows 11',       emoji: '🪟', bg: '#f3f3f3', accent: '#0078d4', bubble: '#0078d4' },
    { id: 'medianoche',      name: 'Medianoche',       emoji: '🌌', bg: '#0d0d1a', accent: '#4c6ef5', bubble: '#4c6ef5' },
    { id: 'rosa',            name: 'Rosa',             emoji: '🌸', bg: '#fff5f7', accent: '#e91e63', bubble: '#e91e63' },
  ];

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
    _notificationAudio = new Audio('./assets/sounds/notification.wav');
    _notificationAudio.volume = 0.15;
    _notificationAudio.preload = 'auto';

    const unlockAudio = () => {
      if (_audioUnlocked) return;
      _audioUnlocked = true;
    };
    document.addEventListener('click', unlockAudio, { once: true });
    document.addEventListener('touchstart', unlockAudio, { once: true });

    // Set up event listeners
    _setupLobbyEvents();
    _setupChatEvents();
    _setupPresetPanels();
    _setupOptionsMenu();
    _setupEditModal();
    _setupImagePreview();
    _setupThemeModal();
    _setupImgBBUpload();
  }

  // ─── Lobby ──────────────────────────────

  function _setupLobbyEvents() {
    // Nickname validation helper
    function _validateNickname() {
      const input = document.getElementById('nickname-input');
      const nick = input.value.trim();
      if (nick.length < 2) {
        input.classList.add('error');
        showToast('El apodo debe tener al menos 2 caracteres');
        input.focus();
        // Remove error class after animation
        setTimeout(() => input.classList.remove('error'), 500);
        return false;
      }
      input.classList.remove('error');
      Auth.setNickname(nick);
      return true;
    }

    document.getElementById('btn-create-room').addEventListener('click', async () => {
      if (!_validateNickname()) return;

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
      if (!_validateNickname()) return;

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

    // Rejoin room shortcut
    document.getElementById('btn-rejoin-room').addEventListener('click', async () => {
      if (!_validateNickname()) return;

      const code = document.getElementById('rejoin-room-code').textContent;
      if (!code) return;

      const btn = document.getElementById('btn-rejoin-room');
      btn.disabled = true;

      try {
        const exists = await Rooms.joinRoom(code);
        if (exists) {
          Auth.saveLastRoom(code);
          await _enterRoom(code);
        } else {
          showToast('Sala ya no existe');
          Auth.clearLastRoom();
          document.getElementById('rejoin-section').style.display = 'none';
        }
      } catch (err) {
        console.error(err);
        showToast('Error al unirse');
      } finally {
        btn.disabled = false;
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
    _lastRenderedMsg = null;

    $chatHeaderTitle.textContent = 'Sala';
    $chatHeaderCode.textContent = roomCode;

    // Start listening
    chatReady = false;
    Chat.listen(roomCode, {
      onMessage: onNewMessage,
      onMessageChanged: onMessageChanged,
      onReady: () => {
        chatReady = true;
        scrollToBottom();
      },
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

  async function leaveRoom() {
    await Notifications.clearRoomTag();
    const lastRoom = Chat.getCurrentRoom();
    Chat.stopListening();
    Swipe.destroy($chatMessages);
    _closeAllPanels();
    _renderedMessageIds.clear();
    _lastRenderedMsg = null;

    $chatView.classList.remove('active');
    $lobbyView.classList.remove('hidden');
    $chatMessages.innerHTML = '';
    $chatInput.value = '';
    _clearReply();

    if (lastRoom) {
      _showRejoinShortcut(lastRoom);
    }
  }

  // ─── Message Rendering ──────────────────

  function onNewMessage(id, msg, isNew) {
    if (renderedMessageIds.has(id)) return;
    if (Chat.isHiddenForMe(msg)) return;

    // Date separator
    const msgDate = new Date(msg.timestamp);
    if (lastRenderedMsg) {
      const lastDate = new Date(lastRenderedMsg.timestamp);
      if (!isSameDay(msgDate, lastDate)) insertDateSeparator(msgDate);
    } else {
      insertDateSeparator(msgDate);
    }

    const isFirstInGroup = !lastRenderedMsg || lastRenderedMsg.uid !== msg.uid;
    renderedMessageIds.add(id);
    const el = createMessageElement(id, msg, isFirstInGroup);
    chatMessages.appendChild(el);
    scrollToBottom();
    lastRenderedMsg = { uid: msg.uid, timestamp: msg.timestamp };

    // Solo para mensajes nuevos (no historial)
    if (isNew) {
      // Sonido de notificación (solo si es de otro usuario)
      if (msg.uid !== Auth.getUid()) {
        _playNotificationSound();
      }

      // Auto-reproducir audio preset para TODOS los presentes
      if (msg.type === 'audio') {
        playAudioPreset(msg.content);
      }

      // Push notification
      if (msg.uid !== Auth.getUid()) {
        sendPushToRoom(Chat.getCurrentRoom(), msg);
      }
    }
  }
  
  async function sendPushToRoom(roomCode, msg) {
      const sender = msg.nickname || 'Anónimo';
      const preview = msg.type === 'text'
          ? msg.content.substring(0, 60)
          : msg.type === 'sticker' ? '🖼️ Sticker'
          : msg.type === 'image'  ? '📷 Imagen'
          : '🔊 Audio';

      try {
          await fetch('https://onesignal.com/api/v1/notifications', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': 'Key os_v2_app_kuhdaq2qofbrnm4jrfvzs67xompf5n43sboedsefyrzewktzgfbrwauobzq24bnf7ue3qqkidilpxsc67z4lzazjbme7fnaut2ufe2a'
              },
              body: JSON.stringify({
                  app_id: '550e3043-5071-4316-b389-896b997bf773',
                  filters: [
                      { field: 'tag', key: 'room', relation: '=', value: roomCode }
                  ],
                  headings: { es: `Chatarra · ${roomCode}` },
                  contents: { es: `${sender}: ${preview}` },
                  url: window.location.href
              })
          });
      } catch (e) {
          // Silencioso — las notificaciones push son opcionales
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

  function _createMessageElement(id, msg, isFirstInGroup = true) {
    const isOwn = msg.uid === Auth.getUid();
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${isOwn ? 'own' : 'other'}${isFirstInGroup ? ' has-tail' : ''}`;
    wrapper.dataset.messageId = id;

    // Swipe reply icon
    const swipeIcon = document.createElement('div');
    swipeIcon.className = 'swipe-reply-icon';
    swipeIcon.innerHTML = '<i class="fa-solid fa-reply"></i>';
    wrapper.appendChild(swipeIcon);

    // Sender name (only for others, first in group)
    if (!isOwn && isFirstInGroup) {
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
        const audioDisplayName = audioInfo
          ? audioInfo.name
          : msg.content.replace(/\.[^.]+$/, '').replace(/[_\-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

        audioPreset.innerHTML = `
          <button class="audio-play-btn" aria-label="Reproducir">
            <i class="fa-solid fa-play"></i>
          </button>
          <span class="audio-name">${_escapeHtml(audioDisplayName)}</span>
        `;

        audioPreset.querySelector('.audio-play-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          const btn = e.currentTarget;

          // Si este audio ya está activo → pausar y resetear
          if (_activeAudio && _activeAudio._filename === msg.content) {
            _activeAudio.pause();
            _activeAudio.currentTime = 0;
            _activeAudio = null;
            btn.innerHTML = '<i class="fa-solid fa-play"></i>';
            return;
          }

          // Detener y resetear cualquier otro audio activo
          if (_activeAudio) {
            _activeAudio.pause();
            _activeAudio.currentTime = 0;
            if (_activeAudio._btn) {
              _activeAudio._btn.innerHTML = '<i class="fa-solid fa-play"></i>';
            }
            _activeAudio = null;
          }

          // Reproducir este audio
          const audio = new Audio(Presets.getAudioPath(msg.content));
          audio._filename = msg.content;
          audio._btn = btn;
          audio.volume = 0.8;
          _activeAudio = audio;

          btn.innerHTML = '<i class="fa-solid fa-pause"></i>';

          audio.addEventListener('ended', () => {
            btn.innerHTML = '<i class="fa-solid fa-play"></i>';
            _activeAudio = null;
          });

          audio.play().catch(() => {});
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
  
  function _formatAudioFilename(filename) {
    return filename
      .replace(/\.[^.]+$/, '')        // quitar extensión
      .replace(/[_\-]+/g, ' ')        // guiones/underscores → espacios
      .replace(/\b\w/g, c => c.toUpperCase()); // capitalizar cada palabra
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
    $chatInput.addEventListener('input', _autoResizeInput);

    function _autoResizeInput() {
        $chatInput.style.height = 'auto';
        $chatInput.style.height = Math.min($chatInput.scrollHeight, 120) + 'px';
    }

    // Back button
    document.getElementById('btn-back').addEventListener('click', leaveRoom);


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

  // ─── ImgBB Image Upload ───────────────

  function _setupImgBBUpload() {
    const clipBtn = document.getElementById('btn-clip');
    const fileInput = document.getElementById('imgbb-file-input');

    clipBtn.addEventListener('click', () => {
      if (!Media.isConfigured()) {
        showToast('ImgBB no está configurado (API key)');
        return;
      }
      fileInput.click();
    });

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Validar por tipo MIME Y por extensión como fallback
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      const validExt = /\.(jpe?g|png|gif|webp)$/i.test(file.name);
      if (!validTypes.includes(file.type) && !validExt) {
        showToast('Solo se permiten imágenes y GIFs');
        return;
      }

      clipBtn.classList.add('uploading');
      showToast('Subiendo imagen...');

      try {
        const url = await Media.uploadImage(file);
        const room = Chat.getCurrentRoom();
        if (room) {
          await Chat.sendMessage(room, {
            type: 'image',
            content: url,
            replyTo: _replyToId,
          });
          _clearReply();
        }
      } catch (err) {
        console.error(err);
        showToast('Error al subir la imagen');
      } finally {
        clipBtn.classList.remove('uploading');
        fileInput.value = '';
      }
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
      const preloaded = new Audio(Presets.getAudioPath(audio.file));
      preloaded.preload = 'auto';
      _audioCache[audio.file] = preloaded;
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

    // Change theme
    document.getElementById('btn-change-theme').addEventListener('click', () => {
      _closeOptionsMenu();
      _openThemeModal();
    });

    // Mute/unmute toggle
    const soundBtn = document.getElementById('btn-toggle-sound');
    _updateSoundBtn(soundBtn);
    soundBtn.addEventListener('click', () => {
      _isMuted = !_isMuted;
      localStorage.setItem('chatarra_muted', _isMuted);
      _updateSoundBtn(soundBtn);
      showToast(_isMuted ? 'Sonido desactivado' : 'Sonido activado');
    });
  }

  const toggleSoundBtn = document.getElementById('btn-toggle-sound');

  function updateSoundBtn() {
      if (isMuted) {
          toggleSoundBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i> Sonido Desactivado';
          toggleSoundBtn.style.color = 'var(--danger)';
      } else {
          toggleSoundBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i> Sonido Activado';
          toggleSoundBtn.style.color = '';
      }
  }

  // Aplicar estado visual al abrir el menú
  document.getElementById('btn-options').addEventListener('click', updateSoundBtn);

  // Toggle al hacer clic
  toggleSoundBtn.addEventListener('click', () => {
      isMuted = !isMuted;
      localStorage.setItem('chatarra-muted', isMuted);
      updateSoundBtn();
      closeOptionsMenu();
      showToast(isMuted ? 'Sonido desactivado' : 'Sonido activado');
  });

  function _updateSoundBtn(btn) {
    if (_isMuted) {
      btn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i> Sonido: Desactivado';
    } else {
      btn.innerHTML = '<i class="fa-solid fa-volume-high"></i> Sonido: Activado';
    }
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
    if (_isMuted) return;
    if (!_audioUnlocked) return;

    _notificationSfx.currentTime = 0;
    _notificationSfx.play().catch(() => {});
  }

  function _playAudioPreset(filename) {
    // Si hay un audio activo, detenerlo siempre
    if (_activeAudio) {
      _activeAudio.pause();
      _activeAudio.currentTime = 0;
      // Restaurar ícono del botón que lo inició
      if (_activeAudio._btn) {
        _activeAudio._btn.innerHTML = '<i class="fa-solid fa-play"></i>';
      }
      const wasMe = _activeAudio._filename === filename;
      _activeAudio = null;
      if (wasMe) return;
    }

    const audio = _audioCache[filename] || new Audio(Presets.getAudioPath(filename));
    audio.currentTime = 0;
    audio._filename = filename;
    audio.volume = 0.8;
    _activeAudio = audio;

    audio.addEventListener('ended', () => {
      if (_activeAudio && _activeAudio._filename === filename) {
        if (_activeAudio._btn) {
          _activeAudio._btn.innerHTML = '<i class="fa-solid fa-play"></i>';
        }
        _activeAudio = null;
      }
    });

    audio.play().catch(() => {});
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
          const uid = Auth.getUid();
          await Notifications.requestPermission();   // pide permiso al usuario
          await Notifications.setUserId(uid);        // vincula el UID de Firebase
          await Notifications.setRoomTag(roomCode);  // etiqueta la sala activa
      } catch (e) {
          console.warn('Notificaciones no disponibles:', e);
      }
  }

  // ─── Rejoin Shortcut ─────────────────

  function _showRejoinShortcut(roomCode) {
    const section = document.getElementById('rejoin-section');
    const codeSpan = document.getElementById('rejoin-room-code');
    const preview = document.getElementById('rejoin-preview');
    if (roomCode) {
      codeSpan.textContent = roomCode;
      section.style.display = 'block';
      preview.textContent = '';
      // Fetch last message for preview
      Chat.getLastMessage(roomCode).then((msg) => {
        if (msg) {
          const text = _getPreviewText(msg);
          const sender = msg.nickname || 'Anónimo';
          preview.textContent = `${sender}: ${text}`;
        } else {
          preview.textContent = 'Sin mensajes aún';
        }
      });
    } else {
      section.style.display = 'none';
    }
  }

  function tryRejoinLastRoom() {
    const lastRoom = Auth.getLastRoom();
    if (lastRoom && Rooms.isValidCode(lastRoom)) {
      _showRejoinShortcut(lastRoom);
    }
    // Pre-fill nickname if saved
    const savedNick = Auth.getNickname();
    if (savedNick) {
      document.getElementById('nickname-input').value = savedNick;
    }
  }

  // ─── Date Helpers ──────────────────────

  function _insertDateSeparator(date) {
    const el = document.createElement('div');
    el.className = 'date-separator';
    el.textContent = _formatDate(date);
    $chatMessages.appendChild(el);
  }

  function _formatDate(date) {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (_isSameDay(date, today)) return 'Hoy';
    if (_isSameDay(date, yesterday)) return 'Ayer';

    const options = { day: 'numeric', month: 'long' };
    if (date.getFullYear() !== today.getFullYear()) {
      options.year = 'numeric';
    }
    return date.toLocaleDateString('es-ES', options);
  }

  function _isSameDay(d1, d2) {
    return d1.getDate() === d2.getDate() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getFullYear() === d2.getFullYear();
  }

  // ─── Theme System ─────────────────────

  function _setupThemeModal() {
    $themeModal = document.getElementById('theme-modal');
    const grid = document.getElementById('theme-grid');

    // Render theme options
    THEMES.forEach((theme) => {
      const option = document.createElement('div');
      option.className = 'theme-option';
      option.dataset.themeId = theme.id;

      option.innerHTML = `
        <div class="theme-swatch">
          <div class="theme-swatch-bg" style="background: ${theme.bg}"></div>
          <div class="theme-swatch-accent" style="background: ${theme.accent}"></div>
          <div class="theme-swatch-bubble" style="background: ${theme.bubble}"></div>
        </div>
        <span>${theme.emoji} ${theme.name}</span>
      `;

      option.addEventListener('click', () => {
        applyTheme(theme.id);
        _updateThemeSelection();
        _closeThemeModal();
      });

      grid.appendChild(option);
    });

    // Close on backdrop click
    $themeModal.addEventListener('click', (e) => {
      if (e.target === $themeModal) _closeThemeModal();
    });

    // Lobby theme button
    document.getElementById('btn-lobby-theme').addEventListener('click', _openThemeModal);

    _updateThemeSelection();
  }

  function _openThemeModal() {
    $themeModal.classList.add('visible');
    _updateThemeSelection();
  }

  function _closeThemeModal() {
    if ($themeModal) $themeModal.classList.remove('visible');
  }

  function _updateThemeSelection() {
    const current = localStorage.getItem('chatarra_theme') || 'default';
    document.querySelectorAll('.theme-option').forEach((opt) => {
      opt.classList.toggle('active', opt.dataset.themeId === current);
    });
  }

  function applyTheme(themeId) {
    if (themeId === 'default') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', themeId);
    }
    localStorage.setItem('chatarra_theme', themeId);
  }

  function loadSavedTheme() {
    const saved = localStorage.getItem('chatarra_theme');
    if (saved && saved !== 'default') {
      document.documentElement.setAttribute('data-theme', saved);
    }
  }

  return {
    init,
    leaveRoom,
    showToast,
    tryRejoinLastRoom,
    getReplyToId,
    applyTheme,
    loadSavedTheme,
    _enterRoom,
  };
})();

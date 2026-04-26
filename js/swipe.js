/* ============================================
   CHATARRA — Swipe Module
   Swipe-to-reply for touch & mouse
   ============================================ */

const Swipe = (() => {
  const THRESHOLD = 80; // px to trigger reply
  const MAX_SWIPE = 100; // max translate
  let _startX = 0;
  let _startY = 0;
  let _currentEl = null;
  let _isDragging = false;
  let _isHorizontal = null; // null = undecided, true = horizontal, false = vertical
  let _onReplyCallback = null;

  /**
   * Initialize swipe detection on a container element.
   * @param {HTMLElement} container - The messages container
   * @param {Function} onReply - Callback(messageId, messageData) when swipe triggers
   */
  function init(container, onReply) {
    _onReplyCallback = onReply;

    // Touch events
    container.addEventListener('touchstart', _onStart, { passive: true });
    container.addEventListener('touchmove', _onMove, { passive: false });
    container.addEventListener('touchend', _onEnd, { passive: true });

    // Mouse events
    container.addEventListener('mousedown', _onStart);
    container.addEventListener('mousemove', _onMove);
    container.addEventListener('mouseup', _onEnd);
    container.addEventListener('mouseleave', _onEnd);
  }

  function _getClientX(e) {
    return e.touches ? e.touches[0].clientX : e.clientX;
  }

  function _getClientY(e) {
    return e.touches ? e.touches[0].clientY : e.clientY;
  }

  function _findMessageWrapper(target) {
    return target.closest('.message-wrapper');
  }

  function _onStart(e) {
    const wrapper = _findMessageWrapper(e.target);
    if (!wrapper) return;

    _startX = _getClientX(e);
    _startY = _getClientY(e);
    _currentEl = wrapper;
    _isDragging = true;
    _isHorizontal = null;
  }

  function _onMove(e) {
    if (!_isDragging || !_currentEl) return;

    const x = _getClientX(e);
    const y = _getClientY(e);
    const deltaX = x - _startX;
    const deltaY = y - _startY;

    // Decide direction on first significant move
    if (_isHorizontal === null) {
      if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
        _isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
      }
      if (!_isHorizontal) return;
    }

    if (!_isHorizontal) return;

    // Allow right swipe for ALL messages
    let effectiveDelta = Math.max(0, Math.min(MAX_SWIPE, deltaX));

    if (effectiveDelta === 0) return;

    // Prevent scrolling
    if (e.cancelable) e.preventDefault();

    // Apply transform
    _currentEl.style.transition = 'none';
    _currentEl.style.transform = `translateX(${effectiveDelta}px)`;

    // Show/hide reply icon
    if (Math.abs(effectiveDelta) >= THRESHOLD) {
      _currentEl.classList.add('swiping');
    } else {
      _currentEl.classList.remove('swiping');
    }
  }

  function _onEnd() {
    if (!_isDragging || !_currentEl) {
      _reset();
      return;
    }

    const wasSwiping = _currentEl.classList.contains('swiping');

    // Animate back
    _currentEl.style.transition = `transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)`;
    _currentEl.style.transform = 'translateX(0)';
    _currentEl.classList.remove('swiping');

    // Trigger reply if threshold was met
    if (wasSwiping && _onReplyCallback) {
      const msgId = _currentEl.dataset.messageId;
      if (msgId) {
        _onReplyCallback(msgId);
      }
    }

    _reset();
  }

  function _reset() {
    _isDragging = false;
    _currentEl = null;
    _isHorizontal = null;
  }

  /**
   * Destroy listeners.
   */
  function destroy(container) {
    container.removeEventListener('touchstart', _onStart);
    container.removeEventListener('touchmove', _onMove);
    container.removeEventListener('touchend', _onEnd);
    container.removeEventListener('mousedown', _onStart);
    container.removeEventListener('mousemove', _onMove);
    container.removeEventListener('mouseup', _onEnd);
    container.removeEventListener('mouseleave', _onEnd);
  }

  return { init, destroy };
})();

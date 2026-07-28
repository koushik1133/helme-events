export class NotificationCenter {
  constructor(containerElement) {
    this.container = containerElement;
    this.notifications = JSON.parse(localStorage.getItem('helme_events_notifications')) || [
      { id: 1, title: 'Booking Confirmed', message: 'Your event setup is confirmed.', icon: '✅', time: new Date().toISOString(), read: false },
      { id: 2, title: 'Payment Reminder', message: '30% advance is due.', icon: '💰', time: new Date().toISOString(), read: false },
      { id: 3, title: 'Proposal Saved', message: 'Your custom proposal was saved.', icon: '💾', time: new Date().toISOString(), read: true },
      { id: 4, title: 'New Vendor Matched', message: 'A catering vendor matched your criteria.', icon: '🍲', time: new Date().toISOString(), read: false },
      { id: 5, title: 'Schedule Update', message: 'Setup start time set to 9 AM.', icon: '⏰', time: new Date().toISOString(), read: true },
    ];
    this.isOpen = false;
    this.setupOutsideClickListener();
  }

  setupOutsideClickListener() {
    document.addEventListener('click', (e) => {
      if (!this.isOpen) return;

      const isInsideNotif = this.container.contains(e.target);
      const notifBtn = document.getElementById('btnNotifications');
      const isClickOnBell = notifBtn && notifBtn.contains(e.target);

      if (!isInsideNotif && !isClickOnBell) {
        this.close();
      }
    });
  }

  getUnreadCount() {
    return this.notifications.filter(n => !n.read).length;
  }

  addNotification(title, message, icon = '🔔') {
    this.notifications.unshift({
      id: Date.now(),
      title,
      message,
      icon,
      time: new Date().toISOString(),
      read: false
    });
    this.save();
    this.updateBadge();
    if (this.isOpen) this.render();
  }

  save() {
    localStorage.setItem('helme_events_notifications', JSON.stringify(this.notifications));
  }

  toggle() {
    this.isOpen = !this.isOpen;
    this.render();
  }
  
  open() {
    this.isOpen = true;
    this.render();
  }

  close() {
    this.isOpen = false;
    this.render();
  }

  updateBadge() {
    const badge = document.getElementById('notifBadge');
    if (badge) {
      const count = this.getUnreadCount();
      badge.textContent = count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
  }

  render() {
    this.updateBadge();

    if (!this.isOpen) {
      this.container.innerHTML = '';
      return;
    }
    
    this.container.innerHTML = `
      <div class="notification-panel">
        <div class="notification-header">
          <div class="notif-title-group">
            <span class="notif-bell-icon">🔔</span>
            <h4>Notifications (${this.getUnreadCount()})</h4>
          </div>
          <div class="notif-actions-group">
            <button class="btn-mark-all" title="Mark all as read">Mark all read</button>
            <button class="btn-clear-all" title="Clear notifications">Clear</button>
            <button class="notif-close-btn" id="closeNotifBtn" title="Close">&times;</button>
          </div>
        </div>
        
        <div class="notification-list">
          ${this.notifications.map(n => `
            <div class="notification-item ${n.read ? 'read' : 'unread'}" data-id="${n.id}">
              <div class="n-icon">${n.icon}</div>
              <div class="n-content">
                <strong class="n-title">${n.title}</strong>
                <p class="n-msg">${n.message}</p>
                <small class="n-time">${new Date(n.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
              </div>
            </div>
          `).join('')}
          ${this.notifications.length === 0 ? '<div class="n-empty">No notifications available</div>' : ''}
        </div>
      </div>
    `;
    this.bindEvents();
  }

  bindEvents() {
    const closeBtn = this.container.querySelector('#closeNotifBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.close();
      });
    }

    const list = this.container.querySelector('.notification-list');
    if (list) {
      list.addEventListener('click', (e) => {
        const item = e.target.closest('.notification-item');
        if (item) {
          const id = parseInt(item.dataset.id, 10);
          const notif = this.notifications.find(n => n.id === id);
          if (notif && !notif.read) {
            notif.read = true;
            this.save();
            this.render();
          }
        }
      });
    }

    const markAll = this.container.querySelector('.btn-mark-all');
    if (markAll) {
      markAll.addEventListener('click', (e) => {
        e.stopPropagation();
        this.notifications.forEach(n => n.read = true);
        this.save();
        this.render();
      });
    }

    const clearAll = this.container.querySelector('.btn-clear-all');
    if (clearAll) {
      clearAll.addEventListener('click', (e) => {
        e.stopPropagation();
        this.notifications = [];
        this.save();
        this.render();
      });
    }
  }
}

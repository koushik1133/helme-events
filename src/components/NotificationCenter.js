export class NotificationCenter {
  constructor(containerElement) {
    this.container = containerElement;
    this.notifications = JSON.parse(localStorage.getItem('helme_events_notifications')) || [
      { id: 1, title: 'Booking Confirmed', message: 'Your event setup is confirmed.', icon: '✅', time: new Date().toISOString(), read: false },
      { id: 2, title: 'Payment Reminder', message: '30% advance is due.', icon: '💰', time: new Date().toISOString(), read: false },
      { id: 3, title: 'Proposal Saved', message: 'Your custom proposal was saved.', icon: '💾', time: new Date().toISOString(), read: true },
      { id: 4, title: 'New Vendor', message: 'A new catering vendor matched.', icon: '🍲', time: new Date().toISOString(), read: false },
      { id: 5, title: 'Schedule Update', message: 'Setup time updated to 9 AM.', icon: '⏰', time: new Date().toISOString(), read: true },
    ];
    this.isOpen = false;
  }

  getUnreadCount() {
    return this.notifications.filter(n => !n.read).length;
  }

  addNotification(title, message, icon) {
    this.notifications.unshift({
      id: Date.now(),
      title,
      message,
      icon,
      time: new Date().toISOString(),
      read: false
    });
    this.save();
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

  render() {
    if (!this.isOpen) {
      this.container.innerHTML = '';
      return;
    }
    
    this.container.innerHTML = `
      <div class="notification-panel" style="position: absolute; right: 20px; top: 60px; width: 300px; background: #fff; border: 1px solid #ccc; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); z-index: 1000;">
        <div class="notification-header" style="display: flex; justify-content: space-between; align-items: center; padding: 15px; border-bottom: 1px solid #eee;">
          <h4 style="margin: 0;">Notifications (${this.getUnreadCount()})</h4>
          <div>
            <button class="btn-mark-all" style="font-size: 12px; margin-right: 5px;">Mark all read</button>
            <button class="btn-clear-all" style="font-size: 12px;">Clear</button>
          </div>
        </div>
        <div class="notification-list" style="max-height: 400px; overflow-y: auto;">
          ${this.notifications.map(n => `
            <div class="notification-item ${n.read ? 'read' : 'unread'}" data-id="${n.id}" style="padding: 15px; border-bottom: 1px solid #eee; display: flex; gap: 10px; cursor: pointer; background: ${n.read ? '#fff' : '#f0f9ff'};">
              <div class="n-icon" style="font-size: 24px;">${n.icon}</div>
              <div class="n-content">
                <strong style="display: block; font-size: 14px;">${n.title}</strong>
                <p style="margin: 5px 0; font-size: 13px; color: #555;">${n.message}</p>
                <small style="color: #888;">${new Date(n.time).toLocaleString()}</small>
              </div>
            </div>
          `).join('')}
          ${this.notifications.length === 0 ? '<p class="n-empty" style="padding: 20px; text-align: center; color: #888;">No notifications</p>' : ''}
        </div>
      </div>
    `;
    this.bindEvents();
  }

  bindEvents() {
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
      markAll.addEventListener('click', () => {
        this.notifications.forEach(n => n.read = true);
        this.save();
        this.render();
      });
    }

    const clearAll = this.container.querySelector('.btn-clear-all');
    if (clearAll) {
      clearAll.addEventListener('click', () => {
        this.notifications = [];
        this.save();
        this.render();
      });
    }
  }
}

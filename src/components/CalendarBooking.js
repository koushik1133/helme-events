export class CalendarBooking {
  constructor(containerElement) {
    this.container = containerElement;
    this.bookings = JSON.parse(localStorage.getItem('helme_events_bookings')) || {};
    this.currentDate = new Date();
    this.selectedDates = [];
  }
  
  render() {
    this.container.innerHTML = `
      <div class="calendar-wrapper" style="padding:20px; font-family:sans-serif;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <h2>📆 Calendar & Event Booking</h2>
          <div>
            <button id="cal-prev" style="padding:5px 10px;">&laquo; Prev</button>
            <span id="cal-month-year" style="font-weight:bold; margin:0 15px; font-size:18px;"></span>
            <button id="cal-next" style="padding:5px 10px;">Next &raquo;</button>
          </div>
        </div>
        
        <div style="display:flex; gap:20px;">
          <div style="flex:2;">
            <div id="calendar-grid" style="display:grid; grid-template-columns:repeat(7, 1fr); gap:5px; text-align:center;">
              <!-- Days will go here -->
            </div>
          </div>
          <div style="flex:1; background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">
            <h3>Book Selected Dates</h3>
            <p style="font-size:12px; color:#64748b;">Select dates on the calendar, then enter event details below.</p>
            <div id="selected-dates-display" style="margin-bottom:10px; font-weight:bold; color:#0f172a;"></div>
            <input type="text" id="event-name" placeholder="Event Name" style="width:100%; padding:8px; margin-bottom:10px; box-sizing:border-box;" />
            <button id="book-dates-btn" style="width:100%; padding:10px; background:#3b82f6; color:white; border:none; border-radius:4px; cursor:pointer;">Book Event</button>
            <div id="booking-warning" style="color:#ef4444; font-size:12px; margin-top:10px; display:none;">⚠️ Conflict: Some dates are already booked!</div>
            
            <hr style="margin:20px 0; border:0; border-top:1px solid #cbd5e1;" />
            
            <h3>Upcoming Bookings</h3>
            <div id="bookings-list" style="font-size:13px;"></div>
          </div>
        </div>
      </div>
    `;
    this.bindEvents();
    this.renderCalendar();
  }
  
  renderCalendar() {
    const monthYearSpan = this.container.querySelector('#cal-month-year');
    const grid = this.container.querySelector('#calendar-grid');
    const bookingsList = this.container.querySelector('#bookings-list');
    
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    
    const monthNames = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
      
    monthYearSpan.textContent = `${monthNames[month]} ${year}`;
    
    // Headers
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let gridHtml = days.map(d => `<div style="font-weight:bold; padding:10px; background:#e2e8f0;">${d}</div>`).join('');
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    for (let i = 0; i < firstDay; i++) {
      gridHtml += `<div></div>`;
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isBooked = this.bookings[dateStr];
      const isSelected = this.selectedDates.includes(dateStr);
      
      let style = `padding:20px 10px; border:1px solid #cbd5e1; cursor:pointer; position:relative; `;
      if (isSelected) style += `background-color:#fef08a; border-color:#eab308; font-weight:bold;`;
      else if (isBooked) style += `background-color:#fff1f2; color:#be123c;`;
      else style += `background-color:#ffffff; hover:background-color:#f8fafc;`;
      
      const dot = isBooked ? `<div style="position:absolute; bottom:5px; left:50%; transform:translateX(-50%); width:6px; height:6px; background-color:#ef4444; border-radius:50%;"></div>` : '';
      
      gridHtml += `<div class="cal-day" data-date="${dateStr}" style="${style}">${day}${dot}</div>`;
    }
    
    grid.innerHTML = gridHtml;
    
    // Update bookings list
    const sortedBookings = Object.keys(this.bookings).sort();
    bookingsList.innerHTML = sortedBookings.length > 0 ? 
      sortedBookings.map(d => `<div style="padding:5px 0; border-bottom:1px solid #eee;"><strong>${d}</strong>: ${this.bookings[d]}</div>`).join('') : 
      '<p style="color:#94a3b8;">No bookings yet.</p>';
      
    this.updateSelectedDisplay();
  }
  
  updateSelectedDisplay() {
    const display = this.container.querySelector('#selected-dates-display');
    if (this.selectedDates.length === 0) {
      display.textContent = 'No dates selected';
    } else {
      display.textContent = `${this.selectedDates.length} date(s) selected`;
    }
  }
  
  bindEvents() {
    this.container.addEventListener('click', e => {
      if (e.target.id === 'cal-prev') {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        this.renderCalendar();
      } else if (e.target.id === 'cal-next') {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        this.renderCalendar();
      } else if (e.target.classList.contains('cal-day')) {
        const dateStr = e.target.dataset.date;
        const idx = this.selectedDates.indexOf(dateStr);
        if (idx === -1) {
          this.selectedDates.push(dateStr);
        } else {
          this.selectedDates.splice(idx, 1);
        }
        this.renderCalendar();
      } else if (e.target.id === 'book-dates-btn') {
        const eventName = this.container.querySelector('#event-name').value.trim();
        const warning = this.container.querySelector('#booking-warning');
        
        if (!eventName || this.selectedDates.length === 0) return;
        
        // Check conflicts
        const hasConflict = this.selectedDates.some(d => this.bookings[d]);
        if (hasConflict) {
          warning.style.display = 'block';
          return;
        }
        warning.style.display = 'none';
        
        // Book
        this.selectedDates.forEach(d => {
          this.bookings[d] = eventName;
        });
        localStorage.setItem('helme_events_bookings', JSON.stringify(this.bookings));
        
        this.selectedDates = [];
        this.container.querySelector('#event-name').value = '';
        this.renderCalendar();
      }
    });
  }
}

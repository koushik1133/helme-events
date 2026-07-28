import { VENUE_ZONES } from '../data/zones.js';
import { VENDORS } from '../data/vendors.js';

export class VendorManager {
  constructor(containerElement) {
    this.container = containerElement;
    this.vendors = typeof VENDORS !== 'undefined' ? VENDORS : [];
    if (this.vendors.length === 0) {
        this.vendors = [
            { id: 'v1', name: 'Elite Catering', category: 'Catering', contact: '555-0100', rating: 4.8, status: 'Active' },
            { id: 'v2', name: 'SoundScape Audio', category: 'AV', contact: '555-0200', rating: 4.5, status: 'Active' }
        ];
    }
    this.assignments = JSON.parse(localStorage.getItem('helme_events_vendor_assignments')) || {};
    this.filterCategory = 'All';
    this.filterStatus = 'All';
  }

  render() {
    this.container.innerHTML = `
      <div class="vendor-wrapper">
        <div class="vendor-header">
          <h2>📊 Vendor Management</h2>
          <div class="vendor-filters">
            <select id="vendor-cat-filter">
              <option value="All">All Categories</option>
              <option value="Catering">Catering</option>
              <option value="AV">AV</option>
              <option value="Decor">Decor</option>
              <option value="Lighting">Lighting</option>
            </select>
            <select id="vendor-status-filter">
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <button id="add-vendor-btn" class="btn-primary">Add New Vendor</button>
          </div>
        </div>
        <div class="vendor-grid">
          <table style="width:100%; text-align:left; border-collapse:collapse;">
            <thead>
              <tr style="border-bottom:1px solid #ccc;">
                <th>Name</th>
                <th>Category</th>
                <th>Contact</th>
                <th>Rating</th>
                <th>Status</th>
                <th>Assigned Zone</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="vendor-tbody">
            </tbody>
          </table>
        </div>
        
        <div id="vendor-modal" class="vendor-modal" style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:white; padding:20px; border:1px solid #ccc; box-shadow:0 4px 10px rgba(0,0,0,0.2); z-index:1000;">
          <div class="vendor-modal-content">
             <h3>Add Vendor</h3>
             <input type="text" id="v-name" placeholder="Name" style="display:block; margin-bottom:10px;" />
             <select id="v-category" style="display:block; margin-bottom:10px;">
                <option>Catering</option>
                <option>AV</option>
                <option>Decor</option>
                <option>Lighting</option>
             </select>
             <input type="text" id="v-contact" placeholder="Contact Info" style="display:block; margin-bottom:10px;" />
             <input type="number" id="v-rating" placeholder="Rating (0-5)" step="0.1" style="display:block; margin-bottom:10px;" />
             <select id="v-status" style="display:block; margin-bottom:10px;"><option>Active</option><option>Inactive</option></select>
             <button id="v-save" class="btn-primary">Save</button>
             <button id="v-cancel">Cancel</button>
          </div>
        </div>
      </div>
    `;
    this.bindEvents();
    this.renderTable();
  }
  
  renderTable() {
    const tbody = this.container.querySelector('#vendor-tbody');
    tbody.innerHTML = '';
    
    let filtered = this.vendors;
    if (this.filterCategory !== 'All') filtered = filtered.filter(v => v.category === this.filterCategory);
    if (this.filterStatus !== 'All') filtered = filtered.filter(v => v.status === this.filterStatus);
    
    filtered.forEach(v => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #eee';
      const zoneSelectId = `assign-${v.id}`;
      let zoneOptions = `<option value="">Unassigned</option>` + VENUE_ZONES.map(z => 
        `<option value="${z.id}" ${this.assignments[v.id] === z.id ? 'selected' : ''}>${z.name}</option>`
      ).join('');
      
      tr.innerHTML = `
        <td style="padding:10px;">${v.name}</td>
        <td>${v.category}</td>
        <td>${v.contact}</td>
        <td>${v.rating} ⭐</td>
        <td><span class="badge badge-${v.status.toLowerCase()}">${v.status}</span></td>
        <td>
          <select data-vid="${v.id}" class="zone-assign-select">
            ${zoneOptions}
          </select>
        </td>
        <td>
          <button class="btn-delete" data-id="${v.id}">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }
  
  bindEvents() {
    this.container.addEventListener('change', e => {
      if (e.target.id === 'vendor-cat-filter') {
        this.filterCategory = e.target.value;
        this.renderTable();
      }
      if (e.target.id === 'vendor-status-filter') {
        this.filterStatus = e.target.value;
        this.renderTable();
      }
      if (e.target.classList.contains('zone-assign-select')) {
        const vid = e.target.dataset.vid;
        this.assignments[vid] = e.target.value;
        localStorage.setItem('helme_events_vendor_assignments', JSON.stringify(this.assignments));
      }
    });
    
    this.container.addEventListener('click', e => {
      if (e.target.id === 'add-vendor-btn') {
        this.container.querySelector('#vendor-modal').style.display = 'block';
      }
      if (e.target.id === 'v-cancel') {
        this.container.querySelector('#vendor-modal').style.display = 'none';
      }
      if (e.target.id === 'v-save') {
         const name = this.container.querySelector('#v-name').value;
         const category = this.container.querySelector('#v-category').value;
         const contact = this.container.querySelector('#v-contact').value;
         const rating = this.container.querySelector('#v-rating').value;
         const status = this.container.querySelector('#v-status').value;
         
         if (name) {
             this.vendors.push({
                id: 'v_' + Date.now(),
                name, category, contact, rating: parseFloat(rating) || 5.0, status
             });
             this.container.querySelector('#vendor-modal').style.display = 'none';
             this.renderTable();
         }
      }
      if (e.target.classList.contains('btn-delete')) {
        const id = e.target.dataset.id;
        this.vendors = this.vendors.filter(v => v.id !== id);
        this.renderTable();
      }
    });
  }
}

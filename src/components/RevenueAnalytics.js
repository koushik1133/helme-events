export class RevenueAnalytics {
  constructor(containerElement) {
    this.container = containerElement;
  }
  
  render() {
    this.container.innerHTML = `
      <div class="analytics-wrapper" style="padding:20px; font-family:sans-serif;">
        <h2 style="margin-top:0;">📈 Revenue Analytics</h2>
        
        <div style="display:flex; gap:20px; margin-bottom:30px;">
          <div style="flex:1; background:white; padding:20px; border-radius:8px; border:1px solid #e2e8f0; text-align:center;">
            <div style="color:#64748b; font-size:14px;">Total Revenue</div>
            <div style="font-size:24px; font-weight:bold; color:#0f172a;">$124,500</div>
          </div>
          <div style="flex:1; background:white; padding:20px; border-radius:8px; border:1px solid #e2e8f0; text-align:center;">
            <div style="color:#64748b; font-size:14px;">Avg Booking Value</div>
            <div style="font-size:24px; font-weight:bold; color:#0f172a;">$3,250</div>
          </div>
          <div style="flex:1; background:white; padding:20px; border-radius:8px; border:1px solid #e2e8f0; text-align:center;">
            <div style="color:#64748b; font-size:14px;">Total Bookings</div>
            <div style="font-size:24px; font-weight:bold; color:#0f172a;">38</div>
          </div>
          <div style="flex:1; background:white; padding:20px; border-radius:8px; border:1px solid #e2e8f0; text-align:center;">
            <div style="color:#64748b; font-size:14px;">Top Item</div>
            <div style="font-size:18px; font-weight:bold; color:#0f172a; margin-top:5px;">Gold Chiavari Chair</div>
          </div>
        </div>
        
        <div style="display:flex; gap:30px;">
          <div style="flex:2; background:white; padding:20px; border-radius:8px; border:1px solid #e2e8f0;">
            <h3>Monthly Revenue (Last 12 Months)</h3>
            <canvas id="bar-chart" width="600" height="300" style="width:100%; height:auto;"></canvas>
          </div>
          <div style="flex:1; background:white; padding:20px; border-radius:8px; border:1px solid #e2e8f0;">
            <h3>Revenue by Event Type</h3>
            <canvas id="pie-chart" width="300" height="300" style="width:100%; height:auto;"></canvas>
          </div>
        </div>
      </div>
    `;
    
    // Draw charts after DOM updates
    setTimeout(() => {
      this.drawBarChart();
      this.drawPieChart();
    }, 50);
  }
  
  drawBarChart() {
    const canvas = this.container.querySelector('#bar-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const data = [5000, 7000, 12000, 15000, 22000, 25000, 18000, 14000, 28000, 32000, 20000, 18000];
    
    const width = canvas.width;
    const height = canvas.height;
    const padding = 40;
    
    const maxVal = Math.max(...data);
    const barWidth = (width - padding * 2) / data.length - 10;
    
    // Draw axes
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.strokeStyle = '#94a3b8';
    ctx.stroke();
    
    // Draw bars
    data.forEach((val, i) => {
      const barHeight = (val / maxVal) * (height - padding * 2);
      const x = padding + 10 + i * (barWidth + 10);
      const y = height - padding - barHeight;
      
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(x, y, barWidth, barHeight);
      
      // Labels
      ctx.fillStyle = '#334155';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(months[i], x + barWidth / 2, height - padding + 20);
    });
  }
  
  drawPieChart() {
    const canvas = this.container.querySelector('#pie-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const data = [
      { label: 'Weddings', value: 55, color: '#ec4899' },
      { label: 'Corporate', value: 25, color: '#3b82f6' },
      { label: 'Private', value: 15, color: '#f59e0b' },
      { label: 'Other', value: 5, color: '#10b981' }
    ];
    
    const total = data.reduce((acc, curr) => acc + curr.value, 0);
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 20;
    
    let currentAngle = -0.5 * Math.PI;
    
    data.forEach(slice => {
      const sliceAngle = (slice.value / total) * 2 * Math.PI;
      
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
      ctx.fillStyle = slice.color;
      ctx.fill();
      
      // Draw legend
      currentAngle += sliceAngle;
    });
    
    // Quick legend below
    let legendY = canvas.height - 30;
    let legendX = 10;
    data.forEach(slice => {
      ctx.fillStyle = slice.color;
      ctx.fillRect(legendX, legendY, 12, 12);
      ctx.fillStyle = '#334155';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(slice.label, legendX + 18, legendY + 10);
      legendX += 70;
    });
  }
}

import { VENUE_ZONES } from '../data/zones.js';

export class TourWatcher {
  constructor(viewer360, onComplete) {
    this.viewer360 = viewer360;
    this.onComplete = onComplete;
    this.isActive = false;
    this.currentZoneIndex = 0;
    this.timer = null;
  }

  startTour(activeSelections) {
    this.isActive = true;
    this.currentZoneIndex = 0;
    this.activeSelections = activeSelections;
    this.playNextZone();
  }

  playNextZone() {
    if (!this.isActive) return;

    if (this.currentZoneIndex >= VENUE_ZONES.length) {
      this.stopTour();
      if (this.onComplete) this.onComplete();
      return;
    }

    const zone = VENUE_ZONES[this.currentZoneIndex];
    this.viewer360.loadZone(zone, this.activeSelections);
    this.viewer360.setAutoRotate(true);

    this.timer = setTimeout(() => {
      this.currentZoneIndex++;
      this.playNextZone();
    }, 6000);
  }

  stopTour() {
    this.isActive = false;
    if (this.timer) clearTimeout(this.timer);
    this.viewer360.setAutoRotate(false);
  }
}

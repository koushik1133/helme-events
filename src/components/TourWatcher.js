import { VENUE_ZONES } from '../data/zones.js';

/** How long each zone is held before the tour advances. */
const ZONE_DWELL_MS = 6000;

/**
 * TourWatcher — plays every venue zone in sequence with auto-rotation on.
 *
 * Note: this drives `Viewer360.setAutoRotate(on)` explicitly. It must NOT use
 * `toggleAutoRotate()`: if the user had already switched rotation on, toggling
 * would turn it off and the tour would sit still.
 */
export class TourWatcher {
  constructor(viewer360, onComplete) {
    this.viewer360 = viewer360;
    this.onComplete = onComplete;
    this.isActive = false;
    this.currentZoneIndex = 0;
    this.timer = null;
    this.activeSelections = {};
    this._rotateWasOn = false;
  }

  startTour(activeSelections) {
    if (this.isActive) this.stopTour();
    this.isActive = true;
    this.currentZoneIndex = 0;
    this.activeSelections = activeSelections || {};
    this._rotateWasOn = Boolean(this.viewer360?.autoRotate);
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
    try {
      this.viewer360?.loadZone(zone, this.activeSelections);
      this.viewer360?.setAutoRotate(true);
    } catch (e) {
      // One bad zone must not kill the whole tour.
      console.error('[tour] could not play zone', zone?.id, e);
    }

    this.timer = setTimeout(() => {
      this.timer = null;
      this.currentZoneIndex++;
      this.playNextZone();
    }, ZONE_DWELL_MS);
  }

  stopTour() {
    this.isActive = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    // Restore whatever rotation state the user had before the tour started.
    try { this.viewer360?.setAutoRotate(this._rotateWasOn); } catch (e) {}
  }

  /** Zone the tour is currently showing, or null when idle. */
  currentZone() {
    return this.isActive ? (VENUE_ZONES[this.currentZoneIndex] || null) : null;
  }
}

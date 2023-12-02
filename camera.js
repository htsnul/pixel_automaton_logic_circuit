import { controlPanel } from "./controlPanel.js"

class Camera {
  position = { x: 0, y: 0 };
  zoomLevel = 4.0;
  getScale() {
    return Math.pow(2, this.zoomLevel);
  }
  update() {
    const targetZoomLevel = controlPanel.targetZoomLevel;
    this.zoomLevel += (targetZoomLevel - this.zoomLevel) / 8;
    if (Math.abs(this.zoomLevel - targetZoomLevel) < 1 / 256) {
      this.zoomLevel = targetZoomLevel;
    }
  }
}

export const camera = new Camera();

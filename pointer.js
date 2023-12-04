import { cellsTextures } from "./cellsTextures.js"
import { camera } from "./camera.js"

class Pointer {
  isOnCanvas = false;
  isDragging = false;
  positionInCanvas = { x: 0, y: 0 };
  getPositionInWorld() {
    return this.#positionInCanvasToWorld(this.positionInCanvas);
  }
  #positionInCanvasToWorld(posInCanvas) {
    const width = cellsTextures.width;
    const height = cellsTextures.height;
    const position = camera.position;
    const scale = camera.getScale();
    return {
      x: (posInCanvas.x - 0.5 * width) / scale - position.x,
      y: height - (posInCanvas.y - 0.5 * height) / scale - position.y
    };
  }
}
export const pointer = new Pointer();

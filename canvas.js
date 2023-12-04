import { cellsTextures } from "./cellsTextures.js"
import { cellTextureUtil } from "./cellTextureUtil.js"
import { clipboard } from "./clipboard.js"
import { controlPanel } from "./controlPanel.js"
import { pointer } from "./pointer.js"
import { camera } from "./camera.js"
import { selection } from "./selection.js"
import { editShader } from "./shader/editShader.js"

class Canvas {
  #canvasElement;
  webGLRenderingContext;
  initialize() {
    const width = cellsTextures.width;
    const height = cellsTextures.height;
    const canvas = document.createElement("canvas");
    this.#canvasElement = canvas;
    canvas.style.imageRendering = "pixelated";
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.style.touchAction = "none";
    canvas.style.userSelect = "none";
    canvas.style.webkitUserSelect = "none";
    canvas.onpointerenter = (event) => this.#onPointerEnter(event);
    canvas.onpointerleave = (event) => this.#onPointerLeave(event);
    canvas.onpointerdown = (event) => this.#onPointerDown(event);
    canvas.onpointermove = (event) => this.#onPointerMove(event);
    canvas.onpointerup = (event) => this.#onPointerUp(event);
    document.querySelector("main").append(canvas);
    this.webGLRenderingContext = canvas.getContext("webgl2");
  }
  #onPointerEnter(event) {
    pointer.isOnCanvas = true;
  }
  #onPointerLeave(event) {
    pointer.isOnCanvas = false;
  }
  #onPointerDown(event) {
    pointer.isDragging = true;
    this.#canvasElement.setPointerCapture(event.pointerId);
    pointer.positionInCanvas = this.#getPositionInCanvasFromPointerEvent(event);
    const pointerPosInWorld = pointer.getPositionInWorld();
    const pointerActionKind = controlPanel.getCurrentPointerActionKind();
    if (pointerActionKind === "Draw") {
      const gl = this.webGLRenderingContext;
      editShader.doEditCommand(
        gl,
        cellsTextures.nextFramebuffer,
        cellsTextures.currentTexture,
        "Draw",
        {
          position: cellTextureUtil.positionInWorldToTexture(pointerPosInWorld),
          cellValue: controlPanel.getCurrentCellValue()
        }
      );
      cellsTextures.advance();
    } else if (pointerActionKind === "Select") {
      selection.positionStartInWorld = pointerPosInWorld;
      selection.positionEndInWorld = pointerPosInWorld;
    } else if (pointerActionKind === "ToggleOrSignal") {
      const gl = this.webGLRenderingContext;
      editShader.doEditCommand(
        gl,
        cellsTextures.nextFramebuffer,
        cellsTextures.currentTexture,
        "Toggle",
        {
          position: cellTextureUtil.positionInWorldToTexture(
            pointerPosInWorld
          ),
        }
      );
      cellsTextures.advance();
    } else if (pointerActionKind === "Paste") {
      const gl = this.webGLRenderingContext;
      editShader.doEditCommand(
        gl,
        cellsTextures.nextFramebuffer,
        cellsTextures.currentTexture,
        "Paste",
        {
          position: cellTextureUtil.positionInWorldToTexture(
            pointerPosInWorld
          ),
          size: clipboard.effectiveSize,
          clipboardTexture: clipboard.texture
        }
      );
      cellsTextures.advance();
    }
    event.preventDefault();
  }
  #onPointerMove(event) {
    const pointerPosInCanvasPrev = pointer.positionInCanvas;
    pointer.positionInCanvas = this.#getPositionInCanvasFromPointerEvent(event);
    const pointerPosInWorld = pointer.getPositionInWorld();
    if (!pointer.isDragging) {
      return;
    }
    const pointerActionKind = controlPanel.getCurrentPointerActionKind();
    if (pointerActionKind === "Scroll") {
      const scale = camera.getScale();
      const delta = {
        x: pointer.positionInCanvas.x - pointerPosInCanvasPrev.x,
        y: pointer.positionInCanvas.y - pointerPosInCanvasPrev.y
      };
      camera.position.x += delta.x / scale;
      camera.position.y -= delta.y / scale;
    } else if (pointerActionKind === "Draw") {
      const gl = this.webGLRenderingContext;
      editShader.doEditCommand(
        gl,
        cellsTextures.nextFramebuffer,
        cellsTextures.currentTexture,
        "Draw",
        {
          position: cellTextureUtil.positionInWorldToTexture(pointerPosInWorld),
          cellValue: controlPanel.getCurrentCellValue()
        }
      );
      cellsTextures.advance();
    } else if (pointerActionKind === "Select") {
      selection.positionEndInWorld = pointerPosInWorld;
    }
    event.preventDefault();
  }
  #onPointerUp(event) {
    pointer.positionInCanvas = this.#getPositionInCanvasFromPointerEvent(event);
    const pointerPosInWorld = pointer.getPositionInWorld();
    if (!pointer.isDragging) {
      return;
    }
    if (controlPanel.getCurrentPointerActionKind() === "Select") {
      selection.positionEndInWorld = pointerPosInWorld;
      const rect = cellTextureUtil.getRectInTextureFromPositionStartEnd(
        selection.positionStartInWorld, selection.positionEndInWorld
      );
      const gl = this.webGLRenderingContext;
      clipboard.copyFrom(gl, cellsTextures.currentFramebuffer, rect);
    }
    pointer.isDragging = false;
    event.preventDefault();
  }
  #getPositionInCanvasFromPointerEvent(event) {
    const canvasClientRect = this.#canvasElement.getBoundingClientRect();
    return {
      x: event.clientX - canvasClientRect.x,
      y: event.clientY - canvasClientRect.y
    };
  }
}

export const canvas = new Canvas();

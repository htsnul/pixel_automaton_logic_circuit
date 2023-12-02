import { cellsTextures } from "./cellsTextures.js"
import { cellTextureUtil } from "./cellTextureUtil.js"
import { clipboard } from "./clipboard.js"
import { controlPanel } from "./controlPanel.js"
import { pointer } from "./pointer.js"
import { camera } from "./camera.js"
import { shaderProgram } from "./shaderProgram.js"
import { selection } from "./selection.js"

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
    canvas.onpointerdown = (event) => this.#onPointerDown(event);
    canvas.onpointermove = (event) => this.#onPointerMove(event);
    canvas.onpointerup = (event) => this.#onPointerUp(event);
    document.querySelector("main").append(canvas);
    this.webGLRenderingContext = canvas.getContext("webgl2");
  }
  #onPointerDown(event) {
    pointer.isDragging = true;
    this.#canvasElement.setPointerCapture(event.pointerId);
    pointer.positionInWorld = this.#positionInCanvasToWorld(
      this.#getPositionInCanvasFromPointerEvent(event)
    );
    const pointerActionKind = controlPanel.getCurrentPointerActionKind();
    if (pointerActionKind === "Draw") {
      const gl = this.webGLRenderingContext;
      shaderProgram.doEditCommand(
        gl,
        cellsTextures.nextFramebuffer,
        cellsTextures.currentTexture,
        "Draw",
        {
          position: cellTextureUtil.positionInWorldToTexture(pointer.positionInWorld),
          cellValue: controlPanel.getCurrentCellValue()
        }
      );
      cellsTextures.advance();
    } else if (pointerActionKind === "Select") {
      selection.positionStartInWorld = pointer.positionInWorld;
      selection.positionEndInWorld = pointer.positionInWorld;
    } else if (pointerActionKind === "Paste") {
      const gl = this.webGLRenderingContext;
      shaderProgram.doEditCommand(
        gl,
        cellsTextures.nextFramebuffer,
        cellsTextures.currentTexture,
        "Paste",
        {
          position: cellTextureUtil.positionInWorldToTexture(
            pointer.positionInWorld
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
    pointer.positionInWorld = this.#positionInCanvasToWorld(
      this.#getPositionInCanvasFromPointerEvent(event)
    );
    if (!pointer.isDragging) {
      return;
    }
    const pointerActionKind = controlPanel.getCurrentPointerActionKind();
    if (pointerActionKind === "Scroll") {
      const scale = camera.getScale();
      camera.position.x += event.movementX / scale;
      camera.position.y -= event.movementY / scale;
    } else if (pointerActionKind === "Draw") {
      const gl = this.webGLRenderingContext;
      shaderProgram.doEditCommand(
        gl,
        cellsTextures.nextFramebuffer,
        cellsTextures.currentTexture,
        "Draw",
        {
          position: cellTextureUtil.positionInWorldToTexture(pointer.positionInWorld),
          cellValue: controlPanel.getCurrentCellValue()
        }
      );
      cellsTextures.advance();
    } else if (pointerActionKind === "Select") {
      selection.positionEndInWorld = pointer.positionInWorld;
    }
    event.preventDefault();
  }
  #onPointerUp(event) {
    pointer.positionInWorld = this.#positionInCanvasToWorld(
      this.#getPositionInCanvasFromPointerEvent(event)
    );
    if (!pointer.isDragging) {
      return;
    }
    if (controlPanel.getCurrentPointerActionKind() === "Select") {
      selection.positionEndInWorld = pointer.positionInWorld;
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

export const canvas = new Canvas();

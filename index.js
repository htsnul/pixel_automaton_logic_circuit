import { updateShader } from "./shader/updateShader.js"
import { editShader } from "./shader/editShader.js"
import { renderShader } from "./shader/renderShader.js"
import { cellsTextures } from "./cellsTextures.js"
import { cellTextureUtil } from "./cellTextureUtil.js"
import { clipboard } from "./clipboard.js"
import { controlPanel } from "./controlPanel.js"
import { saveLoad } from "./saveLoad.js"
import { cellValueUtil } from "./cellValueUtil.js"
import { canvas } from "./canvas.js"
import { camera } from "./camera.js"
import { pointer } from "./pointer.js"
import { selection } from "./selection.js"

let restFrameCountToUpdateCells = 0;

onload = async () => {
  controlPanel.initialize();
  {
    const main = document.createElement("main");
    document.body.append(main);
  }
  canvas.initialize();
  const gl = canvas.webGLRenderingContext;
  updateShader.initialize(gl);
  editShader.initialize(gl);
  renderShader.initialize(gl);
  cellsTextures.initialize(gl);
  clipboard.initialize(gl, cellsTextures.width, cellsTextures.height);
  await saveLoad.loadSample();
  requestAnimationFrame(update);
};

function update() {
  requestAnimationFrame(update);
  const hz = Number(document.querySelector("#hz-select > option:checked").value);
  let updateCellsCount = 0;
  if (hz >= 60) {
    updateCellsCount = Math.max(1, hz / 60);
    restFrameCountToUpdateCells = 0;
  } else if (hz > 0) {
    if (restFrameCountToUpdateCells <= 0) {
      updateCellsCount = 1;
      restFrameCountToUpdateCells = 60 / hz;
    }
    restFrameCountToUpdateCells--;
  } else {
    updateCellsCount = 0;
    restFrameCountToUpdateCells = 0;
  }
  for (let i = 0; i < updateCellsCount; ++i) {
    updateCells();
  }
  camera.update();
  render();
}

function updateCells() {
  const gl = canvas.webGLRenderingContext;
  gl.bindFramebuffer(gl.FRAMEBUFFER, cellsTextures.nextFramebuffer);
  gl.useProgram(updateShader.program);
  gl.bindTexture(gl.TEXTURE_2D, cellsTextures.currentTexture);
  gl.uniform1i(gl.getUniformLocation(updateShader.program, "uSampler"), 0);
  gl.drawArrays(gl.POINTS, 0, 1);
  cellsTextures.advance();
  if (controlPanel.getCurrentPointerActionKind() === "Signal" && pointer.isDragging) {
    const gl = canvas.webGLRenderingContext;
    editShader.doEditCommand(
      gl,
      cellsTextures.nextFramebuffer,
      cellsTextures.currentTexture,
      "Signal",
      {
        position: cellTextureUtil.positionInWorldToTexture(
          pointer.positionInWorld
        )
      }
    );
    cellsTextures.advance();
  }
}

function render() {
  const gl = canvas.webGLRenderingContext;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.useProgram(renderShader.program);
  gl.bindTexture(gl.TEXTURE_2D, cellsTextures.currentTexture);
  gl.uniform1i(gl.getUniformLocation(renderShader.program, "uSampler"), 0);
  const width = cellsTextures.width;
  gl.uniform1f(gl.getUniformLocation(renderShader.program, "uWidth"), width);
  const position = camera.position;
  gl.uniform2fv(gl.getUniformLocation(renderShader.program, "uPosition"), [position.x, position.y]);
  const scale = camera.getScale();
  gl.uniform1f(gl.getUniformLocation(renderShader.program, "uScale"), scale);
  const pointerActionKind = controlPanel.getCurrentPointerActionKind();
  const isOverlayCellEnabled = (
    pointer.isOnCanvas && (
      pointerActionKind === "Draw" ||
      pointerActionKind === "Signal"
    )
  );
  gl.uniform1i(
    gl.getUniformLocation(renderShader.program, "uOverlayCellIsEnabled"),
    isOverlayCellEnabled
  );
  if (isOverlayCellEnabled) {
    const pointerPosInTexCoord = cellTextureUtil.positionInWorldToTexture(pointer.positionInWorld);
    gl.uniform2fv(
      gl.getUniformLocation(renderShader.program, "uOverlayCellPosition"),
      [pointerPosInTexCoord.x, pointerPosInTexCoord.y]
    );
    const cellValue = (() => {
      if (pointerActionKind === "Draw") {
        return controlPanel.getCurrentCellValue();
      } else if (pointerActionKind === "Signal") {
        return cellValueUtil.createCellValue("Wire", true);
      }
    })();
    gl.uniform1i(
      gl.getUniformLocation(renderShader.program, "uOverlayCellValue"),
      cellValue
    );
  }
  const isSelectionEnabled = pointerActionKind === "Select";
  gl.uniform1i(
    gl.getUniformLocation(renderShader.program, "uSelectionIsEnabled"),
    isSelectionEnabled
  );
  if (isSelectionEnabled) {
    const selectionRect = cellTextureUtil.getRectInTextureFromPositionStartEnd(
      selection.positionStartInWorld, selection.positionEndInWorld
    );
    gl.uniform2fv(
      gl.getUniformLocation(renderShader.program, "uSelectionRectPosition"),
      [selectionRect.x, selectionRect.y]
    );
    gl.uniform2fv(
      gl.getUniformLocation(renderShader.program, "uSelectionRectSize"),
      [selectionRect.width, selectionRect.height]
    );
  }
  const isOverlayPasteEnabled = pointer.isOnCanvas && pointerActionKind === "Paste";
  gl.uniform1i(
    gl.getUniformLocation(renderShader.program, "uOverlayPasteIsEnabled"),
    isOverlayPasteEnabled
  );
  if (isOverlayPasteEnabled) {
    {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, clipboard.texture);
      gl.uniform1i(gl.getUniformLocation(renderShader.program, "uClipboardSampler"), 1);
      gl.activeTexture(gl.TEXTURE0);
    }
    const pointerPosInTex = cellTextureUtil.positionInWorldToTexture(
      pointer.positionInWorld
    );
    gl.uniform2fv(
      gl.getUniformLocation(renderShader.program, "uOverlayPastePosition"),
      [pointerPosInTex.x, pointerPosInTex.y]
    );
  }
  gl.drawArrays(gl.POINTS, 0, 1);
}


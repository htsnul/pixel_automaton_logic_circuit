import { shaderProgram } from "./shaderProgram.js"

const circuitFilenames = [
  "logic_gates.json",
  "0_1_hold.json",
  "clock.json",
  "half_adder.json",
  "full_adder.json",
  "4_bit_adder.json",
  "latch.json",
  "gated_d_latch.json",
  "edge_triggered_d_flip_flop.json",
  "4_to_1_multiplexer.json",
  "2_bit_decoder.json",
  "rom.json",
  "ram.json",
  "ripple_counter.json",
  "delay.json",
  "7_segment_display.json"
];
let gl;

class CellTextures {
  #textures = [];
  #currentIndex = 0;
  #framebuffers = [];
  initialize(gl) {
    for (let i = 0; i < 2; ++i) {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      const pixels = new Uint8Array(width * height);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.R8,
        width, height,
        0,
        gl.RED,
        gl.UNSIGNED_BYTE,
        pixels
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0
      );
      this.#textures[i] = tex;
      this.#framebuffers[i] = fb;
    }
  }

  get currentTexture() {
    return this.#textures[this.#currentIndex];
  }

  get currentFramebuffer() {
    return this.#framebuffers[this.#currentIndex];
  }

  get nextFramebuffer() {
    return this.#framebuffers[1 - this.#currentIndex];
  }

  advance() {
    this.#currentIndex = 1 - this.#currentIndex;
  }
}

function initializeClipboardTexture() {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  const pixels = new Uint8Array(width * height);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.R8,
    width, height,
    0,
    gl.RED,
    gl.UNSIGNED_BYTE,
    pixels
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  clipboardTexture = tex;
}

function copyToClipboardTexture() {
  const rect = getRectInTexCoordFromPositionStartEnd(
    selectionPosStartInWorld, selectionPosEndInWorld
  );
  gl.bindFramebuffer(gl.FRAMEBUFFER, cellTextures.currentFramebuffer);
  gl.bindTexture(gl.TEXTURE_2D, clipboardTexture);
  gl.copyTexSubImage2D(
    gl.TEXTURE_2D, 0,
    0, 0,
    rect.x, rect.y,
    width - rect.x, height - rect.y
  );
  const overflow = {
    x: rect.x + rect.width - width,
    y: rect.y + rect.height - height
  };
  if (overflow.x > 0) {
    gl.copyTexSubImage2D(
      gl.TEXTURE_2D, 0,
      width - rect.x, 0,
      0, rect.y,
      overflow.x, height - rect.y
    );
  }
  if (overflow.y > 0) {
    gl.copyTexSubImage2D(
      gl.TEXTURE_2D, 0,
      0, height - rect.y,
      rect.x, 0,
      width - rect.x, overflow.y
    );
  }
  if (overflow.x > 0 && overflow.y > 0) {
    gl.copyTexSubImage2D(
      gl.TEXTURE_2D, 0,
      width - rect.x, height - rect.y,
      0, 0,
      overflow.x, overflow.y
    );
  }
  clipboardEffectiveSize = { x: rect.width, y: rect.height };
}

const cellTextures = new CellTextures();
let clipboardTexture = null;
let clipboardEffectiveSize = { x: 0, y: 0 };
let buffer;

let width = 512;
let height = width;
let cells = [];
let circuitData;
let frameIndex = 0;
let clockIsOn = false;

let position = { x: 0, y: 0 };
let zoomLevel = 4.0;
let targetZoomLevel = zoomLevel;
let pointerPosInWorld = { x: 0, y: 0 };
let selectionPosStartInWorld = { x: 0, y: 0 };
let selectionPosEndInWorld = { x: 0, y: 0 };
let isDragging = false;

let restFrameCountToUpdate = 0;

function makeCell(kind, pushingTo) {
  return { kind, pushingTo };
}

function cellIsComponent(cell) {
  return (
    cell.kind === "And" ||
    cell.kind === "Or" ||
    cell.kind === "Xor"
  );
}

function cellIsOut(cell) {
  return (
    cell.kind === "Out" ||
    cell.kind === "NotOut"
  );
}

async function loadCircuit(filename) {
  const res = await fetch("circuits/" + filename, { cache: "no-store" });
  circuitData = await res.json();
  const strs = circuitData.dataStrs;
  //height = strs.length;
  //width = strs[0].length;
  cells = [];
  for (let y = 0; y < height; ++y) {
    cells.push([]);
    const str = strs[Math.min(strs.length, y)] + " ".repeat(width);
    //const str = strs[Math.min(strs.length, y)];
    for (let x = 0; x < width; ++x) {
      cells[y].push(
        makeCell("None", { t: false, r: false, b: false, l: false })
      );
      // 1 One
      // . Wire
      // + Cross
      // A AND
      // O OR
      // X XOR
      // * Out
      // ! NOT-Out
      if (str[x] === "1") {
        cells[y][x].kind = "One";
      } else if (str[x] === ".") {
        cells[y][x].kind = "Wire";
      } else if (str[x] === "+") {
        cells[y][x].kind = "Cross";
      } else if (str[x] === "A") {
        cells[y][x].kind = "And";
      } else if (str[x] === "O") {
        cells[y][x].kind = "Or";
      } else if (str[x] === "X") {
        cells[y][x].kind = "Xor";
      } else if (str[x] === "*") {
        cells[y][x].kind = "Out";
      } else if (str[x] === "!") {
        cells[y][x].kind = "NotOut";
      } else {
        cells[y][x].kind = "None";
      }
    }
  }
  const pixels = new Uint8Array(width * height);
  for (let y = 0; y < height; ++y) {
    for (let x = 0; x < width; ++x) {
      const cell = cells[y][x];
      let kind = 0;
      let subKind = 0;
      if (cell.kind === "Wire") {
        kind = 1;
        subKind = 0;
      }
      if (cell.kind === "Cross") {
        kind = 1;
        subKind = 1;
      }
      if (cell.kind === "One") {
        kind = 1;
        subKind = 2;
      }
      if (cell.kind === "And") {
        kind = 2;
        subKind = 0;
      }
      if (cell.kind === "Or") {
        kind = 2;
        subKind = 1;
      }
      if (cell.kind === "Xor") {
        kind = 2;
        subKind = 2;
      }
      if (cell.kind === "Out") {
        kind = 3;
        subKind = 0;
      }
      if (cell.kind === "NotOut") {
        kind = 3;
        subKind = 1;
      }
      pixels[((height - y - 1) * width + x)] = (kind << 6) + (subKind << 4);
    }
  }
  gl.bindTexture(gl.TEXTURE_2D, cellTextures.currentTexture);
  gl.texSubImage2D(
    gl.TEXTURE_2D,
    0, 0, 0,
    width, height,
    gl.RED,
    gl.UNSIGNED_BYTE,
    pixels
  );
  frameIndex = 0;
}

function initGl() {
  const canvas = document.querySelector("canvas");
  gl = canvas.getContext("webgl2");
  shaderProgram.initialize(gl);
  cellTextures.initialize(gl);
  initializeClipboardTexture();
  buffer = gl.createBuffer();
}

function updateGl() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, cellTextures.nextFramebuffer);
  gl.useProgram(shaderProgram.programForUpdate);
  gl.bindTexture(gl.TEXTURE_2D, cellTextures.currentTexture);
  gl.uniform1i(gl.getUniformLocation(shaderProgram.programForUpdate, "uSampler"), 0);
  gl.drawArrays(gl.POINTS, 0, 1);
  cellTextures.advance();
}

function renderGl() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.useProgram(shaderProgram.programForRender);
  if (0) {
    gl.enableVertexAttribArray(0);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(0, 1, gl.FLOAT, false, 0, 0);
  }
  {
    gl.bindTexture(gl.TEXTURE_2D, cellTextures.currentTexture);
    gl.uniform1i(gl.getUniformLocation(shaderProgram.programForRender, "uSampler"), 0);
    gl.uniform1f(gl.getUniformLocation(shaderProgram.programForRender, "uWidth"), width);
    gl.uniform2fv(gl.getUniformLocation(shaderProgram.programForRender, "uPosition"), [position.x, position.y]);
    {
      const pointerActionKind = getCurrentPointerActionKind();
      const isOverlayCellEnabled = (
        pointerActionKind === "Draw" ||
        pointerActionKind === "Signal"
      );
      gl.uniform1i(
        gl.getUniformLocation(shaderProgram.programForRender, "uOverlayCellIsEnabled"),
        isOverlayCellEnabled
      );
      if (isOverlayCellEnabled) {
        const pointerPosInTexCoord = positionInWorldToTexCoord(pointerPosInWorld);
        gl.uniform2fv(
          gl.getUniformLocation(shaderProgram.programForRender, "uOverlayCellPosition"),
          [pointerPosInTexCoord.x, pointerPosInTexCoord.y]
        );
        const cellValue = (() => {
          if (pointerActionKind === "Draw") {
            return getCurrentCellValue();
          } else if (pointerActionKind === "Signal") {
            return cellValueFromCellSerialKind("Wire") | 0x0f;
          }
        })();
        gl.uniform1i(
          gl.getUniformLocation(shaderProgram.programForRender, "uOverlayCellValue"),
          cellValue
        );
      }
    }
    {
      const pointerActionKind = getCurrentPointerActionKind();
      const isSelectionEnabled = pointerActionKind === "Select";
      gl.uniform1i(
        gl.getUniformLocation(shaderProgram.programForRender, "uSelectionIsEnabled"),
        isSelectionEnabled
      );
      if (isSelectionEnabled) {
        const selectionRect = getRectInTexCoordFromPositionStartEnd(
          selectionPosStartInWorld, selectionPosEndInWorld
        );
        gl.uniform2fv(
          gl.getUniformLocation(shaderProgram.programForRender, "uSelectionRectPosition"),
          [selectionRect.x, selectionRect.y]
        );
        gl.uniform2fv(
          gl.getUniformLocation(shaderProgram.programForRender, "uSelectionRectSize"),
          [selectionRect.width, selectionRect.height]
        );
      }
    }
    {
      const pointerActionKind = getCurrentPointerActionKind();
      const isOverlayPasteEnabled = pointerActionKind === "Paste";
      gl.uniform1i(
        gl.getUniformLocation(shaderProgram.programForRender, "uOverlayPasteIsEnabled"),
        isOverlayPasteEnabled
      );
      if (isOverlayPasteEnabled) {
        {
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, clipboardTexture);
          gl.uniform1i(gl.getUniformLocation(shaderProgram.programForRender, "uClipboardSampler"), 1);
          gl.activeTexture(gl.TEXTURE0);
        }
        const pointerPosInTexCoord = positionInWorldToTexCoord(pointerPosInWorld);
        gl.uniform2fv(
          gl.getUniformLocation(shaderProgram.programForRender, "uOverlayPastePosition"),
          [pointerPosInTexCoord.x, pointerPosInTexCoord.y]
        );
      }
    }
    const scale = Math.pow(2, zoomLevel);
    gl.uniform1f(gl.getUniformLocation(shaderProgram.programForRender, "uScale"), scale);
  }
  gl.drawArrays(gl.POINTS, 0, 1);
}

function createCircuitButton(filename) {
  const button = document.createElement("button");
  button.innerHTML = filename;
  button.onclick = () => {
    loadCircuit(filename);
  }
  return button;
}

function prepareList() {
  const ul = document.createElement("ul");
  circuitFilenames.forEach((filename) => {
    const li = document.createElement("li");
    const button = createCircuitButton(filename);
    li.append(button);
    ul.append(li);
  });
  document.querySelector("main").append(ul);
}

function getCurrentPointerActionKind() {
  return document.querySelector("input[name='pointer-action-kind']:checked").value;
}

function getCurrentCellSerialKind() {
  return document.querySelector("input[name='cell-kind']:checked").value;
}

function cellValueFromCellSerialKind(kind) {
  switch (kind) {
    case "None": return (0 << 6) + (0 << 4);
    case "Wire": return (1 << 6) + (0 << 4);
    case "WireCross": return (1 << 6) + (1 << 4);
    case "InAnd": return (2 << 6) + (0 << 4);
    case "InOr": return (2 << 6) + (1 << 4);
    case "InXor": return (2 << 6) + (2 << 4);
    case "Out": return (3 << 6) + (0 << 4);
    case "OutNot": return (3 << 6) + (1 << 4);
  }
}

function getCurrentCellValue() {
  return cellValueFromCellSerialKind(getCurrentCellSerialKind());
}

function positionInCanvasToWorld(posInCanvas) {
  const scale = Math.pow(2, zoomLevel);
  return {
    x: (posInCanvas.x - 0.5 * width) / scale - position.x,
    y: height - (posInCanvas.y - 0.5 * height) / scale - position.y
  };
}

function positionInWorldToTexCoord(pos) {
  const mod = (x, y) => x - y * Math.floor(x / y);
  return {
    x: Math.floor(mod(pos.x, width)) + 0.5,
    y: Math.floor(mod(pos.y, height)) + 0.5
  };
}

function getRectInTexCoordFromPositionStartEnd(posS, posE) {
  const mod = (x, y) => x - y * Math.floor(x / y);
  const posMinInWorld = {
    x: Math.min(posS.x, posE.x),
    y: Math.min(posS.y, posE.y)
  };
  const posMaxInWorld = {
    x: Math.max(posS.x, posE.x),
    y: Math.max(posS.y, posE.y)
  };
  const posMinInTexCoord = positionInWorldToTexCoord(posMinInWorld);
  const posMaxInTexCoord = positionInWorldToTexCoord(posMaxInWorld);
  if (posMaxInTexCoord.x < posMinInTexCoord.x) {
    posMaxInTexCoord.x += width;
  }
  if (posMaxInTexCoord.y < posMinInTexCoord.y) {
    posMaxInTexCoord.y += height;
  }
  const beginInTexCoord = {
    x: Math.floor(posMinInTexCoord.x),
    y: Math.floor(posMinInTexCoord.y)
  };
  const endInTexCoord = {
    x: Math.ceil(posMaxInTexCoord.x),
    y: Math.ceil(posMaxInTexCoord.y)
  };
  return {
    x: beginInTexCoord.x,
    y: beginInTexCoord.y,
    width: endInTexCoord.x - beginInTexCoord.x,
    height: endInTexCoord.y - beginInTexCoord.y
  };
}

function load() {
  const input = document.createElement("input");
  input.type = "file";
  input.style.display = "none";
  input.onchange = (event) => {
    const reader = new FileReader();
    reader.onload = () => {
      const pixels = new Uint8Array(reader.result);
      gl.bindTexture(gl.TEXTURE_2D, cellTextures.currentTexture);
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0, 0, 0,
        width, height,
        gl.RED,
        gl.UNSIGNED_BYTE,
        pixels
      );
    };
    reader.readAsArrayBuffer(input.files[0]);
  };
  document.body.append(input);
  input.click();
  input.remove();
}

function save() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, cellTextures.currentFramebuffer);
  const pixels = new Uint8Array(width * height);
  gl.readPixels(0, 0, width, height, gl.RED, gl.UNSIGNED_BYTE, pixels);
  const blob = new Blob([pixels]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const dateTimeStr = (new Date).toISOString()
    .replace(/\..*$/, "")
    .replaceAll("-", "")
    .replaceAll(":", "");
  a.download = `palc_${dateTimeStr}.dat`;
  a.style.display = "none";
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

onload = async () => {
  {
    const style = document.createElement("style");
    style.innerHTML = `
      .control-panel {
        display: flex;
        align-items: center;
        & > div {
          display: flex;
          margin: 8px;
          align-items: center;
        }
      }
      .control-panel button {
        box-sizing: border-box;
        padding: 2px;
        margin: 2px;
        & img {
          display: block;
          width: 16px;
          height: 16px;
        }
      }
      .control-panel button img {
      }
      input[type="radio"] {
        display: none;
      }
      label:has(input[type="radio"]) {
        display: block;
        width: 20px;
        height: 20px;
        border: 2px solid transparent;
        border-radius: 3px;
      }
      label:has(input[type="radio"]) > img {
        display: block;
        margin: 2px;
      }
      label:has(input[type="radio"]:checked) {
        border-color: #888;
      }
    `;
    document.head.append(style);
  }
  {
    const div = document.createElement("div");
    div.innerHTML = `
      <div class="control-panel">
        <div>
          <button id="zoom-out-button"><img src="icon/minus_icon.svg"></button>
          <span id="zoom-ratio" style="display: inline-block; width: 24px; text-align: center;"></span>
          <button id="zoom-in-button"><img src="icon/plus_icon.svg"></button>
        </div>
        <div>
          <select id="hz-select">
            <option value="0">0Hz</option>
            <option value="1">1Hz</option>
            <option value="3">3Hz</option>
            <option value="6">6Hz</option>
            <option value="12">12Hz</option>
            <option value="30">30Hz</option>
            <option value="60" selected>60Hz</option>
            <option value="120">120Hz</option>
            <option value="300">300Hz</option>
            <option value="600">600Hz</option>
            <option value="1200">1.2KHz</option>
            <option value="3000">3.0KHz</option>
            <option value="6000">6.0KHz</option>
          </select>
        </div>
        <div>
          <button id="earth-button" title="Earth GND"><img src="icon/earth_icon.svg"></button>
        </div>
        <div>
          <button id="load-button">Load</button>
          <button id="save-button">Save</button>
        </div>
      </div>
      <div class="control-panel">
        <div>
          <div><label title="Scroll">
            <input name="pointer-action-kind" type="radio" value="Scroll" checked>
            <img src="icon/scroll_icon.svg">
          </label></div>
          <div><label title="Draw">
            <input name="pointer-action-kind" type="radio" value="Draw">
            <img src="icon/draw_icon.svg">
          </label></div>
          <div><label title="Select">
            <input name="pointer-action-kind" type="radio" value="Select">
            <img src="icon/select_icon.svg">
          </label></div>
          <div><label title="Paste">
            <input name="pointer-action-kind" type="radio" value="Paste">
            <img src="icon/paste_icon.svg">
          </label></div>
          <div><label title="Signal">
            <input name="pointer-action-kind" type="radio" value="Signal">
            <img src="icon/signal_icon.svg">
          </label></div>
        </div>
        <div>
          <div><label title="None">
            <input name="cell-kind" type="radio" value="None">
            <img src="icon/none_icon.svg">
          </label></div>
          <div><label title="Wire">
            <input name="cell-kind" type="radio" value="Wire" checked>
            <img src="icon/wire_icon.svg">
          </label></div>
          <div><label title="Wire-Cross">
            <input name="cell-kind" type="radio" value="WireCross">
            <img src="icon/wire_cross_icon.svg">
          </label></div>
        </div>
        <div>
          <div><label title="In-AND">
            <input name="cell-kind" type="radio" value="InAnd">
            <img src="icon/in_and_icon.svg">
          </label></div>
          <div><label title="In-OR">
            <input name="cell-kind" type="radio" value="InOr">
            <img src="icon/in_or_icon.svg">
          </label></div>
          <div><label title="In-XOR">
            <input name="cell-kind" type="radio" value="InXor">
            <img src="icon/in_xor_icon.svg">
          </label></div>
        </div>
        <div>
          <div><label title="Out">
            <input name="cell-kind" type="radio" value="Out">
            <img src="icon/out_icon.svg">
            </label></div>
          <div><label title="Out-NOT">
            <input name="cell-kind" type="radio" value="OutNot">
            <img src="icon/out_not_icon.svg">
          </label></div>
        </div>
      <div>
    `;
    div.querySelector("#earth-button").onclick = () => {
      shaderProgram.doEditCommand(
        gl,
        cellTextures.nextFramebuffer,
        cellTextures.currentTexture,
        "Earth",
        {}
      );
      cellTextures.advance();
    };
    div.querySelector("#load-button").onclick = () => load();
    div.querySelector("#save-button").onclick = () => save();
    const zoom = (sign) => {
      if (zoom !== 0) {
        targetZoomLevel = Math.min(Math.max(0, targetZoomLevel + sign), 6);
      }
      div.querySelector("#zoom-ratio").innerHTML = "x" + Math.pow(2, targetZoomLevel);
    };
    zoom(0);
    div.querySelector("#zoom-out-button").onclick = () => zoom(-1);
    div.querySelector("#zoom-in-button").onclick = () => zoom(+1);
    document.body.append(div);
  }
  {
    const main = document.createElement("main");
    document.body.append(main);
  }
  {
    const canvas = document.createElement("canvas");
    canvas.style.imageRendering = "pixelated";
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const getPositionInCanvasFromEvent = (event) => {
      const canvasClientRect = canvas.getBoundingClientRect();
      return {
        x: event.clientX - canvasClientRect.x,
        y: event.clientY - canvasClientRect.y
      };
    };
    canvas.onpointerdown = (event) => {
      isDragging = true;
      canvas.setPointerCapture(event.pointerId);
      pointerPosInWorld = positionInCanvasToWorld(getPositionInCanvasFromEvent(event));
      const pointerActionKind = getCurrentPointerActionKind();
      if (pointerActionKind === "Draw") {
        shaderProgram.doEditCommand(
          gl,
          cellTextures.nextFramebuffer,
          cellTextures.currentTexture,
          "Draw",
          {
            position: positionInWorldToTexCoord(pointerPosInWorld),
            cellValue: getCurrentCellValue()
          }
        );
        cellTextures.advance();
      } else if (pointerActionKind === "Select") {
        selectionPosStartInWorld = pointerPosInWorld;
        selectionPosEndInWorld = pointerPosInWorld;
      } else if (pointerActionKind === "Paste") {
        shaderProgram.doEditCommand(
          gl,
          cellTextures.nextFramebuffer,
          cellTextures.currentTexture,
          "Paste",
          {
            position: positionInWorldToTexCoord(pointerPosInWorld),
            size: clipboardEffectiveSize,
            clipboardTexture: clipboardTexture
          }
        );
        cellTextures.advance();
      }
      event.preventDefault();
    }
    canvas.onpointermove = (event) => {
      pointerPosInWorld = positionInCanvasToWorld(getPositionInCanvasFromEvent(event));
      if (!isDragging) {
        return;
      }
      const pointerActionKind = getCurrentPointerActionKind();
      if (pointerActionKind === "Scroll") {
        const scale = Math.pow(2, zoomLevel);
        position.x += event.movementX / scale;
        position.y -= event.movementY / scale;
      } else if (pointerActionKind === "Draw") {
        shaderProgram.doEditCommand(
          gl,
          cellTextures.nextFramebuffer,
          cellTextures.currentTexture,
          "Draw",
          {
            position: positionInWorldToTexCoord(pointerPosInWorld),
            cellValue: getCurrentCellValue()
          }
        );
        cellTextures.advance();
      } else if (pointerActionKind === "Select") {
        selectionPosEndInWorld = pointerPosInWorld;
      }
      event.preventDefault();
    }
    canvas.onpointerup = (event) => {
      pointerPosInWorld = positionInCanvasToWorld(getPositionInCanvasFromEvent(event));
      if (!isDragging) {
        return;
      }
      if (getCurrentPointerActionKind() === "Select") {
        selectionPosEndInWorld = pointerPosInWorld;
        copyToClipboardTexture();
      }
      isDragging = false;
      event.preventDefault();
    }
    document.querySelector("main").append(canvas);
    initGl();
  }
  prepareList();
  requestAnimationFrame(update);
};

function updateCell(x, y, cell, roundingCells) {
  const pushedFrom = {
    t: roundingCells.t.pushingTo.b,
    r: roundingCells.r.pushingTo.l,
    b: roundingCells.b.pushingTo.t,
    l: roundingCells.l.pushingTo.r,
  };
  if (cell.kind === "One") {
    cell.pushingTo.t = true;
    cell.pushingTo.r = true;
    cell.pushingTo.b = true;
    cell.pushingTo.l = true;
  } else if (cell.kind === "Wire") {
    const isAnyPushed = pushedFrom.t || pushedFrom.r || pushedFrom.b || pushedFrom.l;
    cell.pushingTo.t = isAnyPushed && !pushedFrom.t;
    cell.pushingTo.r = isAnyPushed && !pushedFrom.r;
    cell.pushingTo.b = isAnyPushed && !pushedFrom.b;
    cell.pushingTo.l = isAnyPushed && !pushedFrom.l;
  } else if (cell.kind === "Cross") {
    const isPushedV = pushedFrom.t || pushedFrom.b;
    const isPushedH = pushedFrom.r || pushedFrom.l;
    cell.pushingTo.t = isPushedV && !pushedFrom.t;
    cell.pushingTo.r = isPushedH && !pushedFrom.r;
    cell.pushingTo.b = isPushedV && !pushedFrom.b;
    cell.pushingTo.l = isPushedH && !pushedFrom.l;
  } else if (cell.kind === "And") {
    const signal = (
      (roundingCells.t.kind === "Wire" ? pushedFrom.t : true) &&
      (roundingCells.r.kind === "Wire" ? pushedFrom.r : true) &&
      (roundingCells.b.kind === "Wire" ? pushedFrom.b : true) &&
      (roundingCells.l.kind === "Wire" ? pushedFrom.l : true)
    );
    cell.pushingTo.t = signal && cellIsOut(roundingCells.t);
    cell.pushingTo.r = signal && cellIsOut(roundingCells.r);
    cell.pushingTo.b = signal && cellIsOut(roundingCells.b);
    cell.pushingTo.l = signal && cellIsOut(roundingCells.l);
  } else if (cell.kind === "Or") {
    const signal = (
      (roundingCells.t.kind === "Wire" && pushedFrom.t) ||
      (roundingCells.r.kind === "Wire" && pushedFrom.r) ||
      (roundingCells.b.kind === "Wire" && pushedFrom.b) ||
      (roundingCells.l.kind === "Wire" && pushedFrom.l)
    );
    cell.pushingTo.t = signal && cellIsOut(roundingCells.t);
    cell.pushingTo.r = signal && cellIsOut(roundingCells.r);
    cell.pushingTo.b = signal && cellIsOut(roundingCells.b);
    cell.pushingTo.l = signal && cellIsOut(roundingCells.l);
  } else if (cell.kind === "Xor") {
    const signal = (
      (roundingCells.t.kind === "Wire" && pushedFrom.t) +
      (roundingCells.r.kind === "Wire" && pushedFrom.r) +
      (roundingCells.b.kind === "Wire" && pushedFrom.b) +
      (roundingCells.l.kind === "Wire" && pushedFrom.l)
    ) % 2 === 1;
    cell.pushingTo.t = signal && cellIsOut(roundingCells.t);
    cell.pushingTo.r = signal && cellIsOut(roundingCells.r);
    cell.pushingTo.b = signal && cellIsOut(roundingCells.b);
    cell.pushingTo.l = signal && cellIsOut(roundingCells.l);
  } else if (cell.kind === "Out" || cell.kind === "NotOut") {
    const isSignaled = (
      (cellIsComponent(roundingCells.t) && pushedFrom.t) ||
      (cellIsComponent(roundingCells.r) && pushedFrom.r) ||
      (cellIsComponent(roundingCells.b) && pushedFrom.b) ||
      (cellIsComponent(roundingCells.l) && pushedFrom.l)
    );
    const signal = (cell.kind === "NotOut") ? !isSignaled : isSignaled;
    cell.pushingTo.t = signal && roundingCells.t.kind === "Wire";
    cell.pushingTo.r = signal && roundingCells.r.kind === "Wire";
    cell.pushingTo.b = signal && roundingCells.b.kind === "Wire";
    cell.pushingTo.l = signal && roundingCells.l.kind === "Wire";
  } else {
    cell.pushingTo.t = false;
    cell.pushingTo.r = false;
    cell.pushingTo.b = false;
    cell.pushingTo.l = false;
  }
}

function renderCell(imageData, x, y, cell) {
  let colors = [[0, 0, 0], [1, 1, 1]];
  if (cell.kind === "Wire") {
    colors = [[0.5, 0.5, 0.5], [1, 1, 1]];
  } else if (cell.kind === "Cross") {
    colors = [[0.25, 0.5, 0.25], [1, 1, 1]];
  } else if (cell.kind === "And") {
    colors = [[0.75, 0.75, 0], [1, 1, 1]];
  } else if (cell.kind === "Or") {
    colors = [[0.25, 0.75, 0.75], [1, 1, 1]];
  } else if (cell.kind === "Xor") {
    colors = [[0.5, 0.25, 0.5], [1, 1, 1]];
  } else if (cell.kind === "Out") {
    colors = [[0.25, 0.25, 1], [1, 1, 1]];
  } else if (cell.kind === "NotOut") {
    colors = [[0.75, 0.5, 0.5], [1, 1, 1]];
  }
  const intensity = (cell.pushingTo.t + cell.pushingTo.r + cell.pushingTo.b + cell.pushingTo.l) / 4;
  i = x + y * imageData.width;
  imageData.data[4 * i + 0] = 255 * (colors[0][0] + (colors[1][0] - colors[0][0]) * intensity);
  imageData.data[4 * i + 1] = 255 * (colors[0][1] + (colors[1][1] - colors[0][1]) * intensity);
  imageData.data[4 * i + 2] = 255 * (colors[0][2] + (colors[1][2] - colors[0][2]) * intensity);
  imageData.data[4 * i + 3] = 255;
}

function update() {
  requestAnimationFrame(update);
  const hz = Number(document.querySelector("#hz-select > option:checked").value);
  let updateCount = 0;
  if (hz >= 60) {
    updateCount = Math.max(1, hz / 60);
    restFrameCountToUpdate = 0;
  } else if (hz > 0) {
    if (restFrameCountToUpdate <= 0) {
      updateCount = 1;
      restFrameCountToUpdate = 60 / hz;
    }
    restFrameCountToUpdate--;
  } else {
    updateCount = 0;
    restFrameCountToUpdate = 0;
  }
  if (0) for (let i = 0; i < updateCount; ++i) {
    if (circuitData) {
      const cycleCount = circuitData.cycleCount;
      const inputCount = circuitData.inputCount;
      const values = circuitData.values;
      const valueIndex = Math.floor(frameIndex / cycleCount) % values.length;
      for (let inputIdx = 0; inputIdx < inputCount; ++inputIdx) {
        const x = circuitData.positions[inputIdx][0];
        const y = circuitData.positions[inputIdx][1];
        cells[y][x].kind = values[valueIndex][inputIdx] ? "One" : "Wire";
      }
      clockIsOn = (frameIndex % cycleCount) / cycleCount < 0.5;
      frameIndex++;
    }
    prevCells = JSON.parse(JSON.stringify(cells));
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const roundingCells = {
          t: prevCells[(y + height - 1) % height][x],
          r: prevCells[y][(x + 1) % width],
          b: prevCells[(y + 1) % height][x],
          l: prevCells[y][(x + width - 1) % width]
        };
        updateCell(x, y, cells[y][x], roundingCells);
      }
    }
  }
  for (let i = 0; i < updateCount; ++i) {
    updateGl();
    if (getCurrentPointerActionKind() === "Signal" && isDragging) {
      shaderProgram.doEditCommand(
        gl,
        cellTextures.nextFramebuffer,
        cellTextures.currentTexture,
        "Signal",
        {
          position: positionInWorldToTexCoord(pointerPosInWorld)
        }
      );
      cellTextures.advance();
    }
  }
  {
    zoomLevel += (targetZoomLevel - zoomLevel) / 8;
    if (Math.abs(zoomLevel - targetZoomLevel) < 1 / 256) {
      zoomLevel = targetZoomLevel;
    }
  }
  if (0) {
    const canvas = document.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    const imageData = ctx.createImageData(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        renderCell(imageData, x, y, cells[y][x]);
      }
    }
    ctx.putImageData(imageData, 0, 0);
  } else {
    renderGl();
  }
}

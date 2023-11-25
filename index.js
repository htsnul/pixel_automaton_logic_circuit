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
      for (let i = 0; i < pixels.length; ++i) {
        pixels[i] = 0;
      }
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

  get nextFramebuffer() {
    return this.#framebuffers[1 - this.#currentIndex];
  }

  advance() {
    this.#currentIndex = 1 - this.#currentIndex;
  }
}
const cellTextures = new CellTextures();
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
    zoomLevel += (targetZoomLevel - zoomLevel) / 8;
    if (Math.abs(zoomLevel - targetZoomLevel) < 1 / 256) {
      zoomLevel = targetZoomLevel;
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

function getCurrentCellKind() {
  return document.querySelector("input[name='cell-kind']:checked").value;
}

onload = async () => {
  {
    const div = document.createElement("div");
    div.innerHTML = `
      <div style="display: flex; align-items: end; margin: 8px;">
        <div>
          <button id="zoom-out-button">-</button>
          <span id="zoom-ratio" style="display: inline-block; width: 16px; text-align: center;"></span>
          <button id="zoom-in-button">+</button>
        </div>
        <div>
          <div><label><input name="pointer-action-kind" type="radio" value="Scroll" checked>Scroll</label></div>
          <div><label><input name="pointer-action-kind" type="radio" value="Draw">Draw</label></div>
          <div><label><input name="pointer-action-kind" type="radio" value="Signal">Signal</label></div>
          <div><button id="earth-button">Earth</button></div>
        </div>
        <div>
          <div><label><input name="cell-kind" type="radio" value="None">None</label></div>
          <div><label><input name="cell-kind" type="radio" value="Wire" checked>Wire</label></div>
          <div><label><input name="cell-kind" type="radio" value="Cross">Wire-X</label></div>
        </div>
        <div>
          <div><label><input name="cell-kind" type="radio" value="And">In-AND</label></div>
          <div><label><input name="cell-kind" type="radio" value="Or">In-OR</label></div>
          <div><label><input name="cell-kind" type="radio" value="Xor">In-XOR</label></div>
        </div>
        <div>
          <div><label><input name="cell-kind" type="radio" value="Out">Out</label></div>
          <div><label><input name="cell-kind" type="radio" value="InvOut">Out-NOT</label></div>
        </div>
      <div>
    `;
    const zoom = (sign) => {
      if (zoom !== 0) {
        targetZoomLevel = Math.min(Math.max(0, targetZoomLevel + sign), 6);
      }
      div.querySelector("#zoom-ratio").innerHTML = Math.pow(2, targetZoomLevel);
    };
    div.querySelector("#earth-button").onclick = () => {
      shaderProgram.doEditCommand(
        gl,
        cellTextures.nextFramebuffer,
        cellTextures.currentTexture,
        "Earth"
      );
      cellTextures.advance();
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
    let isDragging = false;
    const getPositionInShaderFromEvent = (event) => {
      const scale = Math.pow(2, zoomLevel);
      const canvasClientRect = canvas.getBoundingClientRect();
      const pos = {
        x: Math.round((event.clientX - canvasClientRect.x - 0.5 * width) / scale - position.x) + 0.5,
        y: -Math.round((event.clientY - canvasClientRect.y - 0.5 * height) / scale + position.y) + 0.5
      };
      if (pos.x < 0) pos.x += width;
      if (pos.y < 0) pos.y += width;
      return pos;
    };
    const drawByPointerEvent = (event) => {
      const pos = getPositionInShaderFromEvent(event);
      const cellVal = (() => {
        const cellKind = getCurrentCellKind();
        switch (cellKind) {
          case "None": return (0 << 6) + (0 << 4);
          case "Wire": return (1 << 6) + (0 << 4);
          case "Cross": return (1 << 6) + (1 << 4);
          case "One": return (1 << 6) + (2 << 4);
          case "And": return (2 << 6) + (0 << 4);
          case "Or": return (2 << 6) + (1 << 4);
          case "Xor": return (2 << 6) + (2 << 4);
          case "Out": return (3 << 6) + (0 << 4);
          case "InvOut": return (3 << 6) + (1 << 4);
        }
      })();
      shaderProgram.doEditCommand(
        gl,
        cellTextures.nextFramebuffer,
        cellTextures.currentTexture,
        "Draw",
        pos,
        cellVal
      );
      cellTextures.advance();
    };
    const signalByPointerEvent = (event) => {
      const pos = getPositionInShaderFromEvent(event);
      shaderProgram.doEditCommand(
        gl,
        cellTextures.nextFramebuffer,
        cellTextures.currentTexture,
        "Signal",
        pos,
        undefined
      );
      cellTextures.advance();
    };
    canvas.onpointerdown = (event) => {
      isDragging = true;
      canvas.setPointerCapture(event.pointerId);
      const pointerActionKind = getCurrentPointerActionKind();
      if (pointerActionKind === "Draw") {
        drawByPointerEvent(event);
      } else if (pointerActionKind === "Signal") {
        signalByPointerEvent(event);
      }
      event.preventDefault();
    }
    canvas.onpointermove = (event) => {
      if (!isDragging) {
        return;
      }
      const pointerActionKind = getCurrentPointerActionKind();
      if (pointerActionKind === "Scroll") {
        const scale = Math.pow(2, zoomLevel);
        position.x += event.movementX / scale;
        position.y -= event.movementY / scale;
      } else if (pointerActionKind === "Draw") {
        drawByPointerEvent(event);
      } else if (pointerActionKind === "Signal") {
        signalByPointerEvent(event);
      }
      event.preventDefault();
    }
    canvas.onpointerup = (event) => {
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
  //setTimeout(() => requestAnimationFrame(update), 500);
  requestAnimationFrame(update);
  for (let i = 0; i < 0; ++i) {
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
  for (let i = 0; i < 1; ++i) {
    updateGl();
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

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
let programForUpdate;
let programForRender;
let dummyTexture;
let targetTextures = [];
let targetTextureIndex = 0;
let fbs = [];
let buffer;

let width;
let height;
let cells = [];
let circuitData;
let frameIndex = 0;
let clockIsOn = false;

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
  height = 256;
  width = 256;
  cells = [];
  for (let y = 0; y < height; ++y) {
    cells.push([]);
    const str = strs[Math.min(strs.length, y)] + " ".repeat(1024);
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
  {
    const canvas = document.createElement("canvas");
    canvas.style.imageRendering = "pixelated";
    canvas.width = width;
    canvas.height = height;
    const scale = Math.min(Math.max(Math.floor(512 / Math.max(width, height)), 1), 16);
    canvas.style.width = `${scale * width}px`;
    canvas.style.height = `${scale * height}px`;
    document.querySelector("main").replaceChildren(canvas);
    initGl();
  }
  frameIndex = 0;
}

function initGl() {
  const canvas = document.querySelector("canvas");
  gl = canvas.getContext("webgl");
  programForUpdate = (() => {
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, `
      #version 100
      void main() {
        gl_Position = vec4(0.0, 0.0, 0.0, 1);
        gl_PointSize = 512.0;
      }
    `);
    gl.compileShader(vertexShader);
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, `
      #version 100
      precision mediump float;

      uniform sampler2D uSampler;

      void main() {
        float x = gl_FragCoord.x;
        float y = gl_FragCoord.y;
        vec4 c = texture2D(uSampler, vec2(x / 256.0, y / 256.0));
        int kind = int(256.0 * c[0] / 64.0 + 0.5);
        // None
        if (kind == 0) {
          c[2] = 0.0;
          c[3] = 0.0;
          gl_FragColor = c;
          return;
        }
        int subKind = int(256.0 * c[1] / 64.0 + 0.5);
        vec4 tc = texture2D(uSampler, vec2((x + 0.0) / 256.0, (y + 1.0) / 256.0));
        int tKind = int(256.0 * tc[0] / 64.0 + 0.5);
        int tSubKind = int(256.0 * tc[1] / 64.0 + 0.5);
        bool tsb = bool(mod(floor(256.0 * tc[3] + 0.5), 16.0));
        vec4 bc = texture2D(uSampler, vec2((x + 0.0) / 256.0, (y - 1.0) / 256.0));
        int bKind = int(256.0 * bc[0] / 64.0 + 0.5);
        int bSubKind = int(256.0 * bc[1] / 64.0 + 0.5);
        bool bst = bool(floor(256.0 * bc[3] / 16.0 + 0.5));
        vec4 rc = texture2D(uSampler, vec2((x + 1.0) / 256.0, (y + 0.0) / 256.0));
        int rKind = int(256.0 * rc[0] / 64.0 + 0.5);
        int rSubKind = int(256.0 * rc[1] / 64.0 + 0.5);
        bool rsl = bool(floor(256.0 * rc[2] / 16.0 + 0.5));
        vec4 lc = texture2D(uSampler, vec2((x - 1.0) / 256.0, (y + 0.0) / 256.0));
        int lKind = int(256.0 * lc[0] / 64.0 + 0.5);
        int lSubKind = int(256.0 * lc[1] / 64.0 + 0.5);
        bool lsr = bool(mod(floor(256.0 * lc[2] + 0.5), 16.0));
        // Wire
        if (kind == 1 && subKind == 0) {
          bool signal = tsb || bst || rsl || lsr;
          c[2] = (
            ((signal && !lsr) ? 16.0 : 0.0) +
            ((signal && !rsl) ? 1.0 : 0.0)
          ) / 256.0;
          c[3] = (
            ((signal && !tsb) ? 16.0 : 0.0) +
            ((signal && !bst) ? 1.0 : 0.0)
          ) / 256.0;
          gl_FragColor = c;
          return;
        }
        // Cross
        if (kind == 1 && subKind == 1) {
          bool signalV = tsb || bst;
          bool signalH = rsl || lsr;
          c[2] = (
            ((signalH && !lsr) ? 16.0 : 0.0) +
            ((signalH && !rsl) ? 1.0 : 0.0)
          ) / 256.0;
          c[3] = (
            ((signalV && !tsb) ? 16.0 : 0.0) +
            ((signalV && !bst) ? 1.0 : 0.0)
          ) / 256.0;
          gl_FragColor = c;
          return;
        }
        // One
        if (kind == 1 && subKind == 2) {
          c[2] = (16.0 + 1.0) / 256.0;
          c[3] = (16.0 + 1.0) / 256.0;
          gl_FragColor = c;
          return;
        }
        // Component
        if (kind == 2) {
          bool signal = false;
          // And
          if (subKind == 0) {
            signal = (
              (tKind == 1 ? tsb : true) &&
              (bKind == 1 ? bst : true) &&
              (rKind == 1 ? rsl : true) &&
              (lKind == 1 ? lsr : true)
            );
          }
          // Or
          if (subKind == 1) {
            signal = (
              (tKind == 1 && tsb) ||
              (bKind == 1 && bst) ||
              (rKind == 1 && rsl) ||
              (lKind == 1 && lsr)
            );
          }
          // Xor
          if (subKind == 2) {
            signal = (
              mod(
                (
                  float(tKind == 1 && tsb) +
                  float(bKind == 1 && bst) +
                  float(rKind == 1 && rsl) +
                  float(lKind == 1 && lsr)
                ),
                2.0
              ) == 1.0
            );
          }
          c[2] = (
            ((signal && lKind == 3) ? 16.0 : 0.0) +
            ((signal && rKind == 3) ? 1.0 : 0.0)
          ) / 256.0;
          c[3] = (
            ((signal && tKind == 3) ? 16.0 : 0.0) +
            ((signal && bKind == 3) ? 1.0 : 0.0)
          ) / 256.0;
          gl_FragColor = c;
          return;
        }
        // Out/NotOut
        if (kind == 3) {
          bool isSignaled = (
            (tKind == 2 && tsb) ||
            (bKind == 2 && bst) ||
            (rKind == 2 && rsl) ||
            (lKind == 2 && lsr)
          );
          bool signal = (subKind == 1) ? !isSignaled : isSignaled;
          c[2] = (
            ((signal && lKind == 1) ? 16.0 : 0.0) +
            ((signal && rKind == 1) ? 1.0 : 0.0)
          ) / 256.0;
          c[3] = (
            ((signal && tKind == 1) ? 16.0 : 0.0) +
            ((signal && bKind == 1) ? 1.0 : 0.0)
          ) / 256.0;
          gl_FragColor = c;
          return;
        }
        gl_FragColor = c;
      }
    `);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      console.log(gl.getShaderInfoLog(fragmentShader));
    }
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.detachShader(program, vertexShader);
    gl.detachShader(program, fragmentShader);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.log(gl.getProgramInfoLog(program));
    }
    return program;
  })();
  programForRender = (() => {
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, `
      #version 100

      void main() {
        gl_Position = vec4(0.0, 0.0, 0.0, 1);
        gl_PointSize = 512.0;
      }
    `);
    gl.compileShader(vertexShader);
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, `
      #version 100
      precision mediump float;

      uniform sampler2D uSampler;

      void main() {
        vec4 c = vec4(0, 0, 0, 1);
        vec4 sc = texture2D(uSampler, vec2(gl_FragCoord.x / 256.0, gl_FragCoord.y / 256.0));
        int kind = int(256.0 * sc[0] / 64.0 + 0.5);
        // None
        if (kind == 0) {
          gl_FragColor = c;
          return;
        }
        int subKind = int(256.0 * sc[1] / 64.0 + 0.5);
        bool st = bool(floor(256.0 * sc[2] / 16.0 + 0.5));
        bool sb = bool(mod(floor(256.0 * sc[2] + 0.5), 16.0));
        bool sr = bool(floor(256.0 * sc[3] / 16.0 + 0.5));
        bool sl = bool(mod(floor(256.0 * sc[3] + 0.5), 16.0));
        if (st || sb || sr || sl) {
          c[0] = 1.0;
          c[1] = 1.0;
          c[2] = 1.0;
          gl_FragColor = c;
          return;
        }
        // Wire
        if (kind == 1) {
          c[0] = 0.5;
          c[1] = 0.5;
          c[2] = 0.5;
          gl_FragColor = c;
          return;
        }
      }
    `);
    gl.compileShader(fragmentShader);
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.detachShader(program, vertexShader);
    gl.detachShader(program, fragmentShader);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const linkErrLog = gl.getProgramInfoLog(program);
      console.log(linkErrLog);
    }
    return program;
  })();
  dummyTexture = gl.createTexture();
  {
    gl.bindTexture(gl.TEXTURE_2D, dummyTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width, height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );
  }
  for (let i = 0; i < 2; ++i) {
    targetTextures[i] = gl.createTexture();
    {
      gl.bindTexture(gl.TEXTURE_2D, targetTextures[i]);
      const pixels = new Uint8Array(width * height * 4);
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
          pixels[((height - y - 1) * width + x) * 4 + 0] = kind * 64;
          pixels[((height - y - 1) * width + x) * 4 + 1] = subKind * 64;
          pixels[((height - y - 1) * width + x) * 4 + 2] = 0;
          pixels[((height - y - 1) * width + x) * 4 + 3] = 0;
        }
      }
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        width, height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      fbs[i] = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbs[i]);
      const attachmentPoint = gl.COLOR_ATTACHMENT0;
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, targetTextures[i], 0
      );
    }
  }
  buffer = gl.createBuffer();
}

function updateGl() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbs[targetTextureIndex]);
  //gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.useProgram(programForUpdate);
  gl.clearColor(0, 1, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  //gl.enableVertexAttribArray(0);
  //gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  //gl.vertexAttribPointer(0, 1, gl.FLOAT, false, 0, 0);
  gl.bindTexture(gl.TEXTURE_2D, targetTextures[targetTextureIndex == 0 ? 1 : 0]);
  gl.uniform1i(gl.getUniformLocation(programForUpdate, "uSampler"), 0);
  gl.drawArrays(gl.POINTS, 0, 1);
  targetTextureIndex = targetTextureIndex == 0 ? 1 : 0;
}

function renderGl() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.useProgram(programForRender);
  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.clearColor(1, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  if (0) {
    gl.enableVertexAttribArray(0);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(0, 1, gl.FLOAT, false, 0, 0);
  }
  {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, targetTextures[0]);
    gl.uniform1i(gl.getUniformLocation(programForRender, "uSampler"), 0);
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
  document.querySelector("main").replaceChildren(ul);
}

onload = async () => {
  {
    const header = document.createElement("header");
    {
      const button = document.createElement("button");
      button.innerHTML = "List";
      button.onclick = () => prepareList();
      header.append(button);
    }
    document.body.append(header);
  }
  {
    const main = document.createElement("main");
    document.body.append(main);
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
  if (!circuitData) {
    return;
  }
  for (let i = 0; i < 0; ++i) {
    {
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

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
  gl = canvas.getContext("webgl2");
  programForUpdate = (() => {
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, `#version 300 es
      void main() {
        gl_Position = vec4(0.0, 0.0, 0.0, 1);
        gl_PointSize = 512.0;
      }
    `);
    gl.compileShader(vertexShader);
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, `#version 300 es
      precision mediump float;

      uniform sampler2D uSampler;
      out vec4 fragColor;

      const int KindNone = 0;
      const int KindWire = 1;
      const int KindComponent = 2;
      const int KindOut = 3;
      const int WireSubKindWire = 0;
      const int WireSubKindCross = 1;
      const int WireSubKindOne = 2;
      const int ComponentSubKindAnd = 0;
      const int ComponentSubKindOr = 1;
      const int ComponentSubKindXor = 2;
      const int OutSubKindOut = 0;
      const int OutSubKindInvOut = 1;

      int cellValueFromColorComponent(float col) { return int(255.0 * col + 0.5); }
      float cellValueToColorComponent(int val) { return float(val) / 255.0; }

      int getCellKind(int val) { return val / 64; }
      int getCellSubKind(int val) { return val / 16 % 4; }
      bool getCellSignalT(int val) { return bool(val / 8 % 2); }
      bool getCellSignalR(int val) { return bool(val / 4 % 2); }
      bool getCellSignalB(int val) { return bool(val / 2 % 2); }
      bool getCellSignalL(int val) { return bool(val % 2); }

      int makeCellValue(
        int kind, int subKind,
        bool signalT, bool signalR, bool signalB, bool signalL
      ) {
        return (
          kind * 64 +
          subKind * 16 +
          (signalT ? 8 : 0) +
          (signalR ? 4 : 0) +
          (signalB ? 2 : 0) +
          (signalL ? 1 : 0)
        );
      }

      void main() {
        const float texW = 256.0f;
        vec4 col = texture(uSampler, gl_FragCoord.xy / texW);
        int cellVal = cellValueFromColorComponent(col[0]);
        int kind = getCellKind(cellVal);
        // None
        if (kind == 0) {
          fragColor[0] = 0.0;
          return;
        }
        int subKind = getCellSubKind(cellVal);
        vec4 colT = texture(uSampler, (gl_FragCoord.xy + vec2(+0.0, +1.0)) / texW);
        vec4 colR = texture(uSampler, (gl_FragCoord.xy + vec2(+1.0, +0.0)) / texW);
        vec4 colB = texture(uSampler, (gl_FragCoord.xy + vec2(+0.0, -1.0)) / texW);
        vec4 colL = texture(uSampler, (gl_FragCoord.xy + vec2(-1.0, +0.0)) / texW);
        int cellValT = cellValueFromColorComponent(colT[0]);
        int cellValR = cellValueFromColorComponent(colR[0]);
        int cellValB = cellValueFromColorComponent(colB[0]);
        int cellValL = cellValueFromColorComponent(colL[0]);
        int tKind = getCellKind(cellValT);
        int tSubKind = getCellSubKind(cellValT);
        bool tSignalB = getCellSignalB(cellValT);
        int rKind = getCellKind(cellValR);
        int rSubKind = getCellSubKind(cellValR);
        bool rSignalL = getCellSignalL(cellValR);
        int bKind = getCellKind(cellValB);
        int bSubKind = getCellSubKind(cellValB);
        bool bSignalT = getCellSignalT(cellValB);
        int lKind = getCellKind(cellValL);
        int lSubKind = getCellSubKind(cellValL);
        bool lSignalR = getCellSignalR(cellValL);
        if (kind == KindWire && subKind == WireSubKindWire) {
          bool signaled = tSignalB || bSignalT || rSignalL || lSignalR;
          fragColor[0] = cellValueToColorComponent(makeCellValue(
            kind, subKind,
            signaled && !tSignalB,
            signaled && !rSignalL,
            signaled && !bSignalT,
            signaled && !lSignalR
          ));
          return;
        }
        if (kind == KindWire && subKind == WireSubKindCross) {
          bool signaledV = tSignalB || bSignalT;
          bool signaledH = rSignalL || lSignalR;
          fragColor[0] = cellValueToColorComponent(makeCellValue(
            kind, subKind,
            signaledV && !tSignalB,
            signaledH && !rSignalL,
            signaledV && !bSignalT,
            signaledH && !lSignalR
          ));
          return;
        }
        if (kind == KindWire && subKind == WireSubKindOne) {
          fragColor[0] = cellValueToColorComponent(makeCellValue(
            kind, subKind, true, true, true, true
          ));
          return;
        }
        if (kind == KindComponent) {
          bool signaled = false;
          if (subKind == ComponentSubKindAnd) {
            signaled = (
              (tKind == KindWire ? tSignalB : true) &&
              (bKind == KindWire ? bSignalT : true) &&
              (rKind == KindWire ? rSignalL : true) &&
              (lKind == KindWire ? lSignalR : true)
            );
          }
          if (subKind == ComponentSubKindOr) {
            signaled = (
              (tKind == 1 && tSignalB) ||
              (bKind == 1 && bSignalT) ||
              (rKind == 1 && rSignalL) ||
              (lKind == 1 && lSignalR)
            );
          }
          if (subKind == ComponentSubKindXor) {
            signaled = (
              ((tKind == 1 && tSignalB) ? 1 : 0) +
              ((bKind == 1 && bSignalT) ? 1 : 0) +
              ((rKind == 1 && rSignalL) ? 1 : 0) +
              ((lKind == 1 && lSignalR) ? 1 : 0)
            ) % 2 == 1;
          }
          fragColor[0] = cellValueToColorComponent(makeCellValue(
            kind, subKind,
            signaled && tKind == KindOut,
            signaled && rKind == KindOut,
            signaled && bKind == KindOut,
            signaled && lKind == KindOut
          ));
          return;
        }
        if (kind == KindOut) {
          bool signaled = (
            (tKind == KindComponent && tSignalB) ||
            (bKind == KindComponent && bSignalT) ||
            (rKind == KindComponent && rSignalL) ||
            (lKind == KindComponent && lSignalR)
          );
          bool signal = (subKind == OutSubKindInvOut) ? !signaled : signaled;
          fragColor[0] = cellValueToColorComponent(makeCellValue(
            kind, subKind,
            signal && tKind == KindWire,
            signal && rKind == KindWire,
            signal && bKind == KindWire,
            signal && lKind == KindWire
          ));
          return;
        }
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
        int kind = int(256.0 * sc[0] / 64.0);
        // None
        if (kind == 0) {
          gl_FragColor = c;
          return;
        }
        int subKind = int(mod(256.0 * sc[0] / 16.0, 4.0));
        bool st = bool(floor(mod(256.0 * sc[0] / 8.0, 2.0)));
        bool sr = bool(floor(mod(256.0 * sc[0] / 4.0, 2.0)));
        bool sb = bool(floor(mod(256.0 * sc[0] / 2.0, 2.0)));
        bool sl = bool(floor(mod(256.0 * sc[0], 2.0)));
        // And
        if (kind == 2 && subKind == 0) {
          c[0] = 1.0;
          c[1] = 0.9;
          c[2] = 0.5;
          gl_FragColor = c;
          return;
        }
        // Or
        if (kind == 2 && subKind == 1) {
          c[0] = 0.25;
          c[1] = 1.0;
          c[2] = 0.25;
          gl_FragColor = c;
          return;
        }
        // Xor
        if (kind == 2 && subKind == 2) {
          c[0] = 1.0;
          c[1] = 0.0;
          c[2] = 1.0;
          gl_FragColor = c;
          return;
        }
        // Out
        if (kind == 3 && subKind == 0) {
          c[0] = 0.2;
          c[1] = 0.2;
          c[2] = 1.0;
          gl_FragColor = c;
          return;
        }
        // Not
        if (kind == 3 && subKind == 1) {
          c[0] = 1.0;
          c[1] = 0.5;
          c[2] = 0.5;
          gl_FragColor = c;
          return;
        }
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
        gl_FragColor = c;
      }
    `);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      alert(gl.getShaderInfoLog(fragmentShader));
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

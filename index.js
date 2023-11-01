const circuitFilenames = [
  "not.json",
  "and.json",
  "or.json",
  "nor.json",
  "xor.json",
  "half_adder.json",
  "full_adder.json",
  "latch.json",
  "delay.json",
  "2_bit_decoder.json"
];
let width;
let height;
let cells = [];
let circuitData;
let frameIndex = 0;
let clockIsOn = false;

function makeCell(kind, pushingTo) {
  return { kind, pushingTo };
}

async function loadCircuit(filename) {
  const res = await fetch("circuits/" + filename, { cache: "no-store" });
  circuitData = await res.json();
  const strs = circuitData.dataStrs;
  height = strs.length;
  width = strs[0].length;
  cells = [];
  for (let y = 0; y < height; ++y) {
    cells.push([]);
    const str = strs[y];
    for (let x = 0; x < width; ++x) {
      cells[y].push(
        makeCell("None", { t: false, r: false, b: false, l: false })
      );
      if (str[x] === "E") {
        cells[y][x].kind = "Emitter";
      } else if (str[x] === "C") {
        cells[y][x].kind = "Clock";
      } else if (str[x] === "#") {
        cells[y][x].kind = "Transmitter";
      } else if (str[x] === "+") {
        cells[y][x].kind = "Bridge";
      } else if (str[x] === "N") {
        cells[y][x].kind = "Not";
      } else if (str[x] === "A") {
        cells[y][x].kind = "And";
      } else if (str[x] === "O") {
        cells[y][x].kind = "Or";
      } else if (str[x] === "X") {
        cells[y][x].kind = "Xor";
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
  }
  frameIndex = 0;
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

function updateCell(x, y, cell, pushedFrom) {
  if (cell.kind === "Emitter") {
    cell.pushingTo.t = true;
    cell.pushingTo.r = true;
    cell.pushingTo.b = true;
    cell.pushingTo.l = true;
  } else if (cell.kind === "Clock") {
    cell.pushingTo.t = clockIsOn;
    cell.pushingTo.r = clockIsOn;
    cell.pushingTo.b = clockIsOn;
    cell.pushingTo.l = clockIsOn;
  } else if (cell.kind === "None") {
    cell.pushingTo.t = false;
    cell.pushingTo.r = false;
    cell.pushingTo.b = false;
    cell.pushingTo.l = false;
  } else if (cell.kind === "Transmitter") {
    const isAnyPushed = pushedFrom.t || pushedFrom.r || pushedFrom.b || pushedFrom.l;
    cell.pushingTo.t = isAnyPushed && !pushedFrom.t;
    cell.pushingTo.r = isAnyPushed && !pushedFrom.r;
    cell.pushingTo.b = isAnyPushed && !pushedFrom.b;
    cell.pushingTo.l = isAnyPushed && !pushedFrom.l;
  } else if (cell.kind === "Not") {
    const isPushedV = pushedFrom.t || pushedFrom.b;
    const isPushedH = pushedFrom.r || pushedFrom.l;
    const isEitherPushed = isPushedV && !isPushedH || !isPushedV && isPushedH;
    cell.pushingTo.t = isEitherPushed && isPushedV && !pushedFrom.t;
    cell.pushingTo.r = isEitherPushed && isPushedH && !pushedFrom.r;
    cell.pushingTo.b = isEitherPushed && isPushedV && !pushedFrom.b;
    cell.pushingTo.l = isEitherPushed && isPushedH && !pushedFrom.l;
  } else if (cell.kind === "And") {
    const signalCount = pushedFrom.t + pushedFrom.r + pushedFrom.b + pushedFrom.l;
    const signalCountGe2 = signalCount >= 2;
    cell.pushingTo.t = signalCountGe2 && !pushedFrom.t;
    cell.pushingTo.r = signalCountGe2 && !pushedFrom.r;
    cell.pushingTo.b = signalCountGe2 && !pushedFrom.b;
    cell.pushingTo.l = signalCountGe2 && !pushedFrom.l;
  } else if (cell.kind === "Bridge") {
    const isPushedV = pushedFrom.t || pushedFrom.b;
    const isPushedH = pushedFrom.r || pushedFrom.l;
    cell.pushingTo.t = isPushedV && !pushedFrom.t;
    cell.pushingTo.r = isPushedH && !pushedFrom.r;
    cell.pushingTo.b = isPushedV && !pushedFrom.b;
    cell.pushingTo.l = isPushedH && !pushedFrom.l;
  } else if (cell.kind === "Or") {
    const isPushedV = pushedFrom.t || pushedFrom.b;
    const isPushedH = pushedFrom.r || pushedFrom.l;
    cell.pushingTo.t = isPushedH && !pushedFrom.t;
    cell.pushingTo.r = isPushedV && !pushedFrom.r;
    cell.pushingTo.b = isPushedH && !pushedFrom.b;
    cell.pushingTo.l = isPushedV && !pushedFrom.l;
  } else if (cell.kind === "Xor") {
    const signalCountV = pushedFrom.t + pushedFrom.b;
    const signalCountH = pushedFrom.r + pushedFrom.l;
    const signalCountVEq1 = signalCountV == 1;
    const signalCountHEq1 = signalCountH == 1;
    cell.pushingTo.t = signalCountHEq1 && !pushedFrom.t;
    cell.pushingTo.r = signalCountVEq1 && !pushedFrom.r;
    cell.pushingTo.b = signalCountHEq1 && !pushedFrom.b;
    cell.pushingTo.l = signalCountVEq1 && !pushedFrom.l;
  }
}

function renderCell(imageData, x, y, cell) {
  let colors = {r: {s: 0, e: 1}, g: {s: 0, e: 1}, b: {s: 0, e: 1}};
  if (cell.kind === "Transmitter") {
    colors = {r: {s: 0.5, e: 1}, g: {s: 0.5, e: 1}, b: {s: 0.5, e: 1}};
  } else if (cell.kind === "Bridge") {
    colors = {r: {s: 0.75, e: 1}, g: {s: 0.75, e: 1}, b: {s: 0.75, e: 1}};
  } else if (cell.kind === "Not") {
    colors = {r: {s: 0.75, e: 1}, g: {s: 0.25, e: 1}, b: {s: 0.25, e: 1}};
  } else if (cell.kind === "And") {
    colors = {r: {s: 0.25, e: 1}, g: {s: 0.75, e: 1}, b: {s: 0.25, e: 1}};
  } else if (cell.kind === "Or") {
    colors = {r: {s: 0.25, e: 1}, g: {s: 0.25, e: 1}, b: {s: 0.75, e: 1}};
  } else if (cell.kind === "Xor") {
    colors = {r: {s: 0.75, e: 1}, g: {s: 0.25, e: 1}, b: {s: 0.75, e: 1}};
  }
  const intensity = (cell.pushingTo.t + cell.pushingTo.r + cell.pushingTo.b + cell.pushingTo.l) / 4;
  i = x + y * imageData.width;
  imageData.data[4 * i + 0] = 255 * (colors.r.s + (colors.r.e - colors.r.s) * intensity);
  imageData.data[4 * i + 1] = 255 * (colors.g.s + (colors.g.e - colors.g.s) * intensity);
  imageData.data[4 * i + 2] = 255 * (colors.b.s + (colors.b.e - colors.b.s) * intensity);
  imageData.data[4 * i + 3] = 255;
}

function update() {
  //setTimeout(() => requestAnimationFrame(update), 500);
  requestAnimationFrame(update);
  if (!circuitData) {
    return;
  }
  {
    const cycleCount = circuitData.cycleCount;
    const inputCount = circuitData.inputCount;
    const values = circuitData.values;
    const valueIndex = Math.floor(frameIndex / cycleCount) % values.length;
    for (let inputIdx = 0; inputIdx < inputCount; ++inputIdx) {
      const x = circuitData.positions[inputIdx][0];
      const y = circuitData.positions[inputIdx][1];
      cells[y][x].kind = values[valueIndex][inputIdx] ? "Emitter" : "Transmitter";
    }
    clockIsOn = (frameIndex % cycleCount) / cycleCount < 0.5;
    frameIndex++;
  }
  prevCells = JSON.parse(JSON.stringify(cells));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      updateCell(
        x, y,
        cells[y][x],
        {
          t: (1 <= y && prevCells[y - 1][x])?.pushingTo?.b,
          r: (x < (width - 1) && prevCells[y][x + 1])?.pushingTo?.l,
          b: (y < (height - 1) && prevCells[y + 1][x])?.pushingTo?.t,
          l: (1 <= x && prevCells[y][x - 1])?.pushingTo?.r,
        }
      );
    }
  }
  const canvas = document.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      renderCell(imageData, x, y, cells[y][x]);
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

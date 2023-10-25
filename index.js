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
  const res = await fetch("circuits/" + filename);
  circuitData = await res.json();
  const strs = circuitData.dataStrs;
  height = strs.length;
  width = strs[0].length;
  for (let y = 0; y < height; ++y) {
    cells.push([]);
    const str = strs[y];
    for (let x = 0; x < width; ++x) {
      cells[y].push(
        makeCell("None", { t: false, r: false, b: false, l: false })
      );
      if (str[x] === "E") {
        cells[y][x].kind = "Emitter";
      } else if (str[x] === "L") {
        cells[y][x].kind = "Clock";
      } else if (str[x] === "#") {
        cells[y][x].kind = "Transmitter";
      } else if (str[x] === "+") {
        cells[y][x].kind = "Bridge";
      } else if (str[x] === "C") {
        cells[y][x].kind = "Conflictor";
      } else if (str[x] === "I") {
        cells[y][x].kind = "Inductor";
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
  } else if (cell.kind === "Conflictor") {
    const isPushedV = pushedFrom.t || pushedFrom.b;
    const isPushedH = pushedFrom.r || pushedFrom.l;
    const isEitherPushed = isPushedV && !isPushedH || !isPushedV && isPushedH;
    cell.pushingTo.t = isEitherPushed && isPushedV && !pushedFrom.t;
    cell.pushingTo.r = isEitherPushed && isPushedH && !pushedFrom.r;
    cell.pushingTo.b = isEitherPushed && isPushedV && !pushedFrom.b;
    cell.pushingTo.l = isEitherPushed && isPushedH && !pushedFrom.l;
  } else if (cell.kind === "Inductor") {
    const isPushedV = pushedFrom.t || pushedFrom.b;
    const isPushedH = pushedFrom.r || pushedFrom.l;
    const isBothPushed = isPushedV && isPushedH;
    cell.pushingTo.t = isBothPushed && isPushedV && !pushedFrom.t;
    cell.pushingTo.r = isBothPushed && isPushedH && !pushedFrom.r;
    cell.pushingTo.b = isBothPushed && isPushedV && !pushedFrom.b;
    cell.pushingTo.l = isBothPushed && isPushedH && !pushedFrom.l;
  } else if (cell.kind === "Bridge") {
    const isPushedV = pushedFrom.t || pushedFrom.b;
    const isPushedH = pushedFrom.r || pushedFrom.l;
    cell.pushingTo.t = isPushedV && !pushedFrom.t;
    cell.pushingTo.r = isPushedH && !pushedFrom.r;
    cell.pushingTo.b = isPushedV && !pushedFrom.b;
    cell.pushingTo.l = isPushedH && !pushedFrom.l;
  }
}

function renderCell(imageData, x, y, cell) {
  let colors = {r: {s: 0, e: 1}, g: {s: 0, e: 1}, b: {s: 0, e: 1}};
  if (cell.kind === "Transmitter") {
    colors = {r: {s: 0.5, e: 1}, g: {s: 0.5, e: 1}, b: {s: 0.5, e: 1}};
  } else if (cell.kind === "Bridge") {
    colors = {r: {s: 0.25, e: 1}, g: {s: 0.25, e: 1}, b: {s: 0.75, e: 1}};
  } else if (cell.kind === "Conflictor") {
    colors = {r: {s: 0.75, e: 1}, g: {s: 0.25, e: 1}, b: {s: 0.25, e: 1}};
  } else if (cell.kind === "Inductor") {
    colors = {r: {s: 0.25, e: 1}, g: {s: 0.75, e: 1}, b: {s: 0.25, e: 1}};
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

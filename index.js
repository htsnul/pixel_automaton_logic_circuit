const circuitFilenames = [
  "and.json",
  "and2.json",
  "or.json",
  "nor.json",
  "latch.json",
  "latch2.json",
  "latch_failed.json",
  "2_bit_decoder.json"
];
let width;
let height;
let cells = [];
let circuitData;

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
  let canvas = document.querySelector("canvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    document.body.append(canvas);
    canvas.style.imageRendering = "pixelated";
  }
  canvas.width = width;
  canvas.height = height;
  const scale = Math.min(Math.max(Math.floor(512 / Math.max(width, height)), 1), 16);
  canvas.style.width = `${scale * width}px`;
  canvas.style.height = `${scale * height}px`;
}

function createCircuitButton(filename) {
  const button = document.createElement("button");
  button.innerHTML = filename;
  button.onclick = () => {
    loadCircuit(filename);
  }
  return button;
}

onload = async () => {
  const ul = document.createElement("ul");
  circuitFilenames.forEach((filename) => {
    const li = document.createElement("li");
    const button = createCircuitButton(filename);
    li.append(button);
    ul.append(li);
  });
  document.body.append(ul);
  requestAnimationFrame(update);
};

function updateCell(x, y, cell, pushedFrom) {
  if (cell.kind === "Emitter") {
    cell.pushingTo.t = true;
    cell.pushingTo.r = true;
    cell.pushingTo.b = true;
    cell.pushingTo.l = true;
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

let c = 0;

function update() {
  //setTimeout(() => requestAnimationFrame(update), 100);
  requestAnimationFrame(update);
  if (!circuitData) {
    return;
  }
  {
    const changes = circuitData.changes;
    const cycleCount = circuitData.cycleCount;
    const i = Math.floor(c / cycleCount) % changes.length;
    cells[1][1].kind = changes[i][0] ? "Emitter" : "Transmitter";
    cells[1][3].kind = changes[i][1] ? "Emitter" : "Transmitter";
    c++;
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

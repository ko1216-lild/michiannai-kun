const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DATA_PATH = path.join(DATA_DIR, "routes.json");
const TMP_PATH = path.join(DATA_DIR, "routes.json.tmp");

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

function createId(prefix) {
  return `${prefix}_${crypto.randomBytes(16).toString("hex")}`;
}

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_PATH);
  } catch {
    await fs.writeFile(DATA_PATH, "[]\n", "utf8");
  }
}

async function readRoutes() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_PATH, "utf8");
  return JSON.parse(raw);
}

async function writeRoutes(routes) {
  await ensureDataFile();
  const json = `${JSON.stringify(routes, null, 2)}\n`;
  await fs.writeFile(TMP_PATH, json, "utf8");
  await fs.rename(TMP_PATH, DATA_PATH);
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeChecklist(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      id: item.id || createId("check"),
      text: normalizeText(item.text),
      done: Boolean(item.done),
      optional: Boolean(item.optional)
    }))
    .filter((item) => item.text);
}

function createRealEstateTemplate() {
  return [
    {
      type: "normal",
      title: "鍵を借りる",
      checklist: ["鍵を借りた", "返却方法を確認した"]
    },
    {
      type: "parking",
      title: "駐車場に停める",
      checklist: ["駐車した", "駐車場名を控えた", "区画番号を控えた", "料金看板を確認した"]
    },
    {
      type: "normal",
      title: "物件へ行く",
      checklist: ["物件に到着した", "外観を確認した"]
    },
    {
      type: "normal",
      title: "室内を確認する",
      checklist: ["室内を確認した", "写真を撮影した", "施錠を確認した"]
    },
    {
      type: "normal",
      title: "鍵を返却する",
      checklist: ["鍵を返却した", "完了報告をした"]
    }
  ].map((point, index) => ({
    id: createId("point"),
    type: point.type,
    title: point.title,
    address: "",
    phone: "",
    memo: "",
    warning: "",
    order: index + 1,
    workerNotes: "",
    checklist: point.checklist.map((text) => ({
      id: createId("check"),
      text,
      done: false,
      optional: false
    }))
  }));
}

function normalizePoint(input, index) {
  return {
    id: input.id || createId("point"),
    type: input.type === "parking" ? "parking" : "normal",
    title: normalizeText(input.title) || `寄り道 ${index + 1}`,
    address: normalizeText(input.address),
    phone: normalizeText(input.phone),
    memo: normalizeText(input.memo),
    warning: normalizeText(input.warning),
    order: index + 1,
    workerNotes: normalizeText(input.workerNotes),
    checklist: normalizeChecklist(input.checklist)
  };
}

function normalizeRouteInput(input, existing) {
  const updatedAt = nowIso();
  const category = input.category === "real_estate_viewing" ? "real_estate_viewing" : "general";
  let points = Array.isArray(input.points) ? input.points.map(normalizePoint) : existing?.points || [];
  if (!existing && category === "real_estate_viewing" && points.length === 0) {
    points = createRealEstateTemplate();
  }

  return {
    id: existing?.id || createId("route"),
    shareId: existing?.shareId || createId("share"),
    name: normalizeText(input.name) || "未命名ルート",
    category,
    mainAddress: normalizeText(input.mainAddress),
    assigneeName: normalizeText(input.assigneeName),
    memo: normalizeText(input.memo),
    createdAt: existing?.createdAt || updatedAt,
    updatedAt,
    startedAt: existing?.startedAt || null,
    completedAt: existing?.completedAt || null,
    currentPointIndex: Number.isInteger(existing?.currentPointIndex) ? existing.currentPointIndex : 0,
    points: points.map(normalizePoint)
  };
}

function summarizeRoute(route) {
  const totalChecks = route.points.reduce((sum, point) => sum + point.checklist.length, 0);
  const doneChecks = route.points.reduce(
    (sum, point) => sum + point.checklist.filter((item) => item.done).length,
    0
  );
  const donePoints = route.points.filter((point) => point.checklist.length && point.checklist.every((item) => item.done)).length;
  let status = "未着手";
  if (route.completedAt) status = "完了";
  else if (doneChecks > 0 || route.startedAt) status = "進行中";

  return {
    id: route.id,
    shareId: route.shareId,
    name: route.name,
    category: route.category,
    mainAddress: route.mainAddress,
    assigneeName: route.assigneeName,
    createdAt: route.createdAt,
    updatedAt: route.updatedAt,
    completedAt: route.completedAt,
    pointCount: route.points.length,
    donePoints,
    totalChecks,
    doneChecks,
    status
  };
}

function findRoute(routes, id) {
  return routes.find((route) => route.id === id);
}

function findRouteByShare(routes, shareId) {
  return routes.find((route) => route.shareId === shareId);
}

app.get("/api/routes", async (req, res) => {
  try {
    const routes = await readRoutes();
    res.json(routes.map(summarizeRoute));
  } catch (error) {
    res.status(500).json({ error: "routes.json を読み込めません。" });
  }
});

app.post("/api/routes", async (req, res) => {
  try {
    const routes = await readRoutes();
    const route = normalizeRouteInput(req.body);
    routes.push(route);
    await writeRoutes(routes);
    res.status(201).json(route);
  } catch (error) {
    res.status(500).json({ error: "ルートを作成できません。" });
  }
});

app.get("/api/routes/:id", async (req, res) => {
  try {
    const route = findRoute(await readRoutes(), req.params.id);
    if (!route) return res.status(404).json({ error: "ルートが見つかりません。" });
    res.json(route);
  } catch (error) {
    res.status(500).json({ error: "ルートを読み込めません。" });
  }
});

app.put("/api/routes/:id", async (req, res) => {
  try {
    const routes = await readRoutes();
    const index = routes.findIndex((route) => route.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "ルートが見つかりません。" });
    routes[index] = normalizeRouteInput(req.body, routes[index]);
    await writeRoutes(routes);
    res.json(routes[index]);
  } catch (error) {
    res.status(500).json({ error: "ルートを保存できません。" });
  }
});

app.delete("/api/routes/:id", async (req, res) => {
  try {
    const routes = await readRoutes();
    const nextRoutes = routes.filter((route) => route.id !== req.params.id);
    if (nextRoutes.length === routes.length) return res.status(404).json({ error: "ルートが見つかりません。" });
    await writeRoutes(nextRoutes);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: "ルートを削除できません。" });
  }
});

app.post("/api/routes/:id/points", async (req, res) => {
  try {
    const routes = await readRoutes();
    const route = findRoute(routes, req.params.id);
    if (!route) return res.status(404).json({ error: "ルートが見つかりません。" });
    const point = normalizePoint(req.body, route.points.length);
    route.points.push(point);
    route.points = route.points.map(normalizePoint);
    route.updatedAt = nowIso();
    await writeRoutes(routes);
    res.status(201).json(point);
  } catch (error) {
    res.status(500).json({ error: "寄り道を追加できません。" });
  }
});

app.put("/api/routes/:id/points/:pointId", async (req, res) => {
  try {
    const routes = await readRoutes();
    const route = findRoute(routes, req.params.id);
    if (!route) return res.status(404).json({ error: "ルートが見つかりません。" });
    const pointIndex = route.points.findIndex((point) => point.id === req.params.pointId);
    if (pointIndex === -1) return res.status(404).json({ error: "寄り道が見つかりません。" });
    route.points[pointIndex] = normalizePoint({ ...req.body, id: req.params.pointId }, pointIndex);
    route.points = route.points.map(normalizePoint);
    route.updatedAt = nowIso();
    await writeRoutes(routes);
    res.json(route.points[pointIndex]);
  } catch (error) {
    res.status(500).json({ error: "寄り道を保存できません。" });
  }
});

app.delete("/api/routes/:id/points/:pointId", async (req, res) => {
  try {
    const routes = await readRoutes();
    const route = findRoute(routes, req.params.id);
    if (!route) return res.status(404).json({ error: "ルートが見つかりません。" });
    const nextPoints = route.points.filter((point) => point.id !== req.params.pointId);
    if (nextPoints.length === route.points.length) return res.status(404).json({ error: "寄り道が見つかりません。" });
    route.points = nextPoints.map(normalizePoint);
    route.currentPointIndex = Math.min(route.currentPointIndex, Math.max(route.points.length - 1, 0));
    route.updatedAt = nowIso();
    await writeRoutes(routes);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: "寄り道を削除できません。" });
  }
});

app.post("/api/routes/:id/points/reorder", async (req, res) => {
  try {
    const routes = await readRoutes();
    const route = findRoute(routes, req.params.id);
    if (!route) return res.status(404).json({ error: "ルートが見つかりません。" });
    const ids = Array.isArray(req.body.pointIds) ? req.body.pointIds : [];
    if (ids.length !== route.points.length) return res.status(400).json({ error: "並び順が不正です。" });
    const byId = new Map(route.points.map((point) => [point.id, point]));
    const points = ids.map((id) => byId.get(id));
    if (points.some((point) => !point)) return res.status(400).json({ error: "並び順が不正です。" });
    route.points = points.map(normalizePoint);
    route.updatedAt = nowIso();
    await writeRoutes(routes);
    res.json(route);
  } catch (error) {
    res.status(500).json({ error: "並び順を保存できません。" });
  }
});

app.get("/api/share/:shareId", async (req, res) => {
  try {
    const route = findRouteByShare(await readRoutes(), req.params.shareId);
    if (!route) return res.status(404).json({ error: "共有ルートが見つかりません。" });
    res.json(route);
  } catch (error) {
    res.status(500).json({ error: "共有ルートを読み込めません。" });
  }
});

app.put("/api/share/:shareId/progress", async (req, res) => {
  try {
    const routes = await readRoutes();
    const route = findRouteByShare(routes, req.params.shareId);
    if (!route) return res.status(404).json({ error: "共有ルートが見つかりません。" });
    if (!route.startedAt) route.startedAt = nowIso();
    if (Number.isInteger(req.body.currentPointIndex)) {
      route.currentPointIndex = Math.max(0, Math.min(req.body.currentPointIndex, Math.max(route.points.length - 1, 0)));
    }
    if (Array.isArray(req.body.points)) {
      route.points = req.body.points.map(normalizePoint);
    }
    route.updatedAt = nowIso();
    await writeRoutes(routes);
    res.json(route);
  } catch (error) {
    res.status(500).json({ error: "進捗を保存できません。" });
  }
});

app.post("/api/share/:shareId/complete", async (req, res) => {
  try {
    const routes = await readRoutes();
    const route = findRouteByShare(routes, req.params.shareId);
    if (!route) return res.status(404).json({ error: "共有ルートが見つかりません。" });
    route.completedAt = route.completedAt || nowIso();
    route.currentPointIndex = Math.max(route.points.length - 1, 0);
    route.memo = normalizeText(req.body.memo ?? route.memo);
    route.updatedAt = nowIso();
    await writeRoutes(routes);
    res.json(route);
  } catch (error) {
    res.status(500).json({ error: "完了を保存できません。" });
  }
});

app.get(["/", "/routes/:id", "/share/:shareId", "/complete/:shareId"], (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

ensureDataFile()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize data file:", error);
    process.exit(1);
  });

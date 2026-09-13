// 后端跨请求共享状态：当前图谱 + 当前种子节点。
// graph/generate 与 question/locate 成功后会更新这里；diagnosis/teaching 依赖它们。
let currentGraph = null;
let currentSeedNodes = [];

export function setGraph(g) { currentGraph = g; }
export function getGraph() { return currentGraph; }
export function setSeedNodes(s) { currentSeedNodes = s; }
export function getSeedNodes() { return currentSeedNodes; }
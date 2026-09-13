// 全流程冒烟测试：按演示顺序依次调用 6 个接口，校验返回结构。
// 运行：先 `npm start` 启动后端，再 `npm run smoke`。
const BASE = process.env.API_BASE || 'http://localhost:3001';

let failed = 0;
function check(name, cond, extra = '') {
  const mark = cond ? 'PASS' : 'FAIL';
  if (!cond) failed++;
  console.log(`${mark}  ${name}${extra ? '  ' + extra : ''}`);
}

async function post(path, body) {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`${path} -> HTTP ${r.status}: ${JSON.stringify(j)}`);
  return j;
}

async function main() {
  // 0. health（GET）
  const hr = await fetch(BASE + '/api/health');
  const h = await hr.json();
  check('health', hr.ok && h.ok === true);

  // 1. 生成图谱
  const g = await post('/api/graph/generate', { markdown: '# 教材名称：高等数学' });
  const graph = g.data?.graph;
  check('graph/generate', g.ok && Array.isArray(graph?.nodes) && graph.nodes.length > 0, `nodes=${graph?.nodes?.length}`);

  // 2. 识别题目
  const r = await post('/api/question/recognize', { image: 'data:image/svg+xml;base64,xxx' });
  const rq = r.data;
  check('question/recognize', r.ok && typeof rq?.problem_markdown === 'string', `md=${rq?.problem_markdown?.slice(0, 20)}…`);

  // 3. 定位节点
  const l = await post('/api/question/locate', { recognized_question: rq });
  check('question/locate', l.ok && Array.isArray(l.data?.seed_nodes) && l.data.seed_nodes.length > 0);

  // 4. 诊断（真实适配器：round=0 出首问，随后 3 次作答后收口，共 4 次调用）
  let diag, done = false;
  for (let round = 0; round < 4 && !done; round++) {
    diag = (await post('/api/diagnosis/next', { round, question: '求函数在某点的导数', answer: '不确定' })).data;
    done = diag.done === true;
  }
  check('diagnosis/next(多轮收口)', !!diag && diag.done === true && !!diag.suspected_gap?.node_id, `gap=${diag?.suspected_gap?.node_id}`);

  const gapId = diag.suspected_gap.node_id;

  // 5. 教学
  const t = await post('/api/teaching/generate', { node_id: gapId });
  check('teaching/generate', t.ok && typeof t.data?.verify_question === 'string', `node=${t.data?.node_id}`);

  // 6. 评估（正确 → 绿）
  const e1 = await post('/api/teaching/evaluate', { node_id: gapId, answer: 'lim = 4' });
  check('evaluate(对)→绿', e1.ok && e1.data?.suggested_state === 'green', `mastery=${e1.data?.mastery}`);

  // 6b. 评估（错误 → 橙）
  const e2 = await post('/api/teaching/evaluate', { node_id: gapId, answer: '我不知道' });
  check('evaluate(错)→橙', e2.ok && e2.data?.suggested_state === 'orange', `mastery=${e2.data?.mastery}`);

  // 故障演练：x-simulate-fail 应返回 500 + 错误码
  const rf = await fetch(BASE + '/api/health', { headers: { 'x-simulate-fail': '1' } });
  const jf = await rf.json();
  check('故障演练 500', rf.status === 500 && jf.ok === false && !!jf.error?.code);

  console.log(failed === 0 ? '\n✅ 全流程冒烟通过' : `\n❌ ${failed} 项失败`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('❌ 冒烟脚本异常：', e.message);
  console.error('   请确认后端已启动：cd backend && npm start');
  process.exit(1);
});

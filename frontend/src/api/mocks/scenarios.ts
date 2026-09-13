import type { DiagnosisOption, GraphData, Teaching } from '../../types';

export type DemoScenario = {
  key: 'linear' | 'calculus' | 'military';
  graphKeyword: string;
  seedName: string;
  weakName: string;
  secondaryName: string;
  recommendedQuestion: string;
  directAnswer: string;
  diagnosis: Array<{ question: string; options: DiagnosisOption[] }>;
  teaching: Omit<Teaching, 'node_id'>;
  correctAnswer: string;
  successEvidence: string;
};

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    key: 'linear', graphKeyword: '线性代数', seedName: '高斯消元法', weakName: '主元与自由变量', secondaryName: '行阶梯形与行简化阶梯形',
    recommendedQuestion: '用高斯消元法解含参数的线性方程组时，为什么会出现无穷多组解？',
    directAnswer: '高斯消元后，若方程组相容且主元个数 $r$ 小于未知数个数 $n$，就会出现 $n-r$ 个自由变量。自由变量可以任意取值，每组取值都会唯一确定主元变量，因此解有无穷多组。',
    diagnosis: [
      { question: '在行最简阶梯形中，没有对应主元的未知量称为什么？', options: [
        { text: '自由变量', signal: 'correct' }, { text: '主元变量', signal: 'fuzzy' }, { text: '常数项', signal: 'dontknow' },
      ] },
      { question: '一个相容方程组有 $n$ 个未知数、矩阵秩为 $r$，自由变量通常有几个？', options: [
        { text: '$n-r$ 个', signal: 'correct' }, { text: '$r$ 个', signal: 'fuzzy' }, { text: '$n+r$ 个', signal: 'dontknow' },
      ] },
      { question: '当至少存在一个自由变量时，它为何通常带来无穷多组解？', options: [
        { text: '自由变量可连续取不同值，并相应确定主元变量', signal: 'correct' }, { text: '因为主元可以随意删除', signal: 'fuzzy' }, { text: '因为所有方程都会变成零', signal: 'dontknow' },
      ] },
    ],
    teaching: {
      definition: '主元是阶梯形矩阵中每个非零行的首个非零元素；对应未知量称为主元变量，其余未知量称为自由变量。',
      intuition: '把主元看成“被方程约束住的位置”，自由变量则是可以先自行选择的旋钮。旋钮一改变，主元变量随之被确定。',
      relation: '识别主元和自由变量，是从高斯消元结果判断唯一解、无解或无穷多解的关键。',
      example: '若方程组有 $5$ 个未知数且 $\\operatorname{rank}(A)=3$，相容时就有 $5-3=2$ 个自由变量。',
      pitfall: '不要把“非零变量”当成主元变量；主元由阶梯形矩阵中的位置决定，与最终变量取值是否为零无关。',
      verify_question: '相容线性方程组有 $5$ 个未知数，系数矩阵的秩为 $3$。自由变量有几个？',
      verify_options: ['$0$', '$1$', '$2$', '$3$', '$5$'],
    },
    correctAnswer: '$2$', successEvidence: '正确使用了自由变量个数公式 $n-r=5-3=2$。',
  },
  {
    key: 'calculus', graphKeyword: '微积分', seedName: '函数的连续性', weakName: '连续的定义', secondaryName: '函数极限的定义',
    recommendedQuestion: '如何用连续的定义说明函数 $\\sin x$ 在 $x=0$ 处连续？',
    directAnswer: '函数在 $x=0$ 连续，需要验证 $\\lim_{x\\to0}\\sin x=\\sin0$。因为 $\\lim_{x\\to0}\\sin x=0$，且 $\\sin0=0$，极限值等于函数值，所以 $\\sin x$ 在 $x=0$ 处连续。',
    diagnosis: [
      { question: '函数 $f(x)$ 在 $x=a$ 连续，最核心的等式是什么？', options: [
        { text: '$\\lim_{x\\to a}f(x)=f(a)$', signal: 'correct' }, { text: '$f(a)=0$', signal: 'fuzzy' }, { text: '$f\u0027(a)=0$', signal: 'dontknow' },
      ] },
      { question: '判断一点连续时，除了极限存在，还必须检查什么？', options: [
        { text: '$f(a)$ 有定义且等于该极限', signal: 'correct' }, { text: '函数必须单调递增', signal: 'fuzzy' }, { text: '导数必须等于 $1$', signal: 'dontknow' },
      ] },
      { question: '$\\lim_{x\\to0}\\sin x$ 与 $\\sin0$ 分别等于多少？', options: [
        { text: '二者都等于 $0$', signal: 'correct' }, { text: '前者为 $1$，后者为 $0$', signal: 'fuzzy' }, { text: '二者都不存在', signal: 'dontknow' },
      ] },
    ],
    teaching: {
      definition: '函数 $f$ 在 $x=a$ 连续，当且仅当 $f(a)$ 有定义、$\\lim_{x\\to a}f(x)$ 存在，并且 $\\lim_{x\\to a}f(x)=f(a)$。',
      intuition: '沿着曲线走到 $x=a$ 时，既不用跳跃，也不会撞上空洞；趋近得到的高度正好就是该点实际的函数值。',
      relation: '连续性把“附近的变化趋势”与“点上的真实取值”连接起来，是中值定理、导数和积分的重要基础。',
      example: '对 $f(x)=\\sin x$，有 $\\lim_{x\\to0}\\sin x=0=f(0)$，因此它在 $0$ 处连续。',
      pitfall: '只会直接代入并不能说明连续；必须确认函数值存在、极限存在且二者相等。',
      verify_question: '若 $\\lim_{x\\to2}f(x)=3$ 且 $f(2)=3$，可以得到什么结论？',
      verify_options: ['函数在 $x=2$ 连续', '函数在 $x=2$ 可导', '函数恒等于 $3$', '函数在 $x=2$ 有极大值', '无法得到任何结论'],
    },
    correctAnswer: '函数在 $x=2$ 连续', successEvidence: '正确识别了连续的判定条件：极限存在且等于该点函数值。',
  },
  {
    key: 'military', graphKeyword: '军事理论', seedName: '信息化战争的制胜要素', weakName: '信息化战争的基本特征', secondaryName: '信息化战争',
    recommendedQuestion: '信息化战争的制胜要素包括什么？',
    directAnswer: '信息化战争的制胜关键包括信息优势、体系优势、决策优势和精确作战能力。核心是通过侦察预警、指挥控制、通信网络与火力平台的体系融合，更快获取信息、更快决策并实施精确行动。',
    diagnosis: [
      { question: '信息化战争中，争夺并保持哪一种优势通常是取得主动权的前提？', options: [
        { text: '信息优势', signal: 'correct' }, { text: '单纯数量优势', signal: 'fuzzy' }, { text: '地形面积优势', signal: 'dontknow' },
      ] },
      { question: '为什么信息化战争强调体系对抗，而不只是单件武器性能？', options: [
        { text: '作战效能来自侦察、指挥、通信和火力等系统协同', signal: 'correct' }, { text: '因为单件武器完全没有作用', signal: 'fuzzy' }, { text: '因为体系对抗不需要信息', signal: 'dontknow' },
      ] },
      { question: '缩短“发现—判断—决策—行动”链路，主要形成什么优势？', options: [
        { text: '决策与行动速度优势', signal: 'correct' }, { text: '单纯扩大兵力规模', signal: 'fuzzy' }, { text: '取消指挥系统', signal: 'dontknow' },
      ] },
    ],
    teaching: {
      definition: '信息化战争以信息资源为关键，以信息网络为基础，通过体系融合实现侦察、指挥、打击与保障的一体化。',
      intuition: '它像一支共享实时地图的团队：看得更早、传得更快、判断更准、协同更紧的一方，更容易掌握主动。',
      relation: '理解信息化战争的基本特征，才能解释为什么信息优势、体系优势和决策速度会成为制胜要素。',
      example: '预警系统发现目标后，信息立即进入指挥网络并分发给合适的平台，可显著缩短作战链路。',
      pitfall: '不能把信息化简单理解为“武器装了电脑”；关键是信息主导以及多个作战系统的网络化协同。',
      verify_question: '下列哪项最能体现信息化战争的核心制胜逻辑？',
      verify_options: ['夺取信息优势并形成体系协同', '只追求单件武器口径更大', '完全依赖兵力数量', '取消侦察与通信环节', '各作战单元互不共享信息'],
    },
    correctAnswer: '夺取信息优势并形成体系协同', successEvidence: '正确理解了信息优势与体系协同在信息化战争中的核心作用。',
  },
];

export function scenarioForGraph(graph?: GraphData | null) {
  if (!graph) return undefined;
  return DEMO_SCENARIOS.find((scenario) => graph.nodes.some((node) => node.name.includes(scenario.graphKeyword)));
}

export function nodeByName(graph: GraphData | null | undefined, name: string) {
  return graph?.nodes.find((node) => node.name === name)
    ?? graph?.nodes.find((node) => node.name.includes(name) || name.includes(node.name));
}

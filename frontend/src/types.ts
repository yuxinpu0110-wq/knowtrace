// 与 contracts/ 冻结契约一致；新增字段均为可选。

export type RelationType = 'prerequisite' | 'contains' | 'related' | 'contrast';

export interface GraphNode {
  id: string;
  name: string;
  chapter: string;
  level: number;
  summary: string;
  keywords: string[];
  source: { heading: string; start_line: number; end_line: number };
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: RelationType;
  weight: number;
  reason: string;
}

export interface GraphData {
  book_id: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface KnowledgeGraphRecord {
  id: string;
  name: string;
  textbook: string;
  graph: GraphData | null;
  masteredIds: string[];
  retainedWeakIds: string[];
}

export type NodeState =
  | 'inactive'
  | 'question_related'
  | 'suspected_gap'
  | 'mastered'
  | 'recommended';

// recognized_question.json
export interface UncertainSpan {
  text: string;
  reason: string;
}
export interface RecognizedQuestion {
  problem_markdown: string;
  subject: string;
  image_quality: string;
  confidence: number;
  uncertain_spans: UncertainSpan[];
}

export interface SeedNode {
  node_id: string;
  relevance: number;
  reason?: string;
}

export interface LocateResult {
  seed_nodes: SeedNode[];
  in_scope: boolean;
  coverage_confidence?: number;
  coverage_reason?: string;
}

export interface DirectAnswer {
  answer_markdown: string;
  confidence: number;
  source_node_ids?: string[];
}

export interface ActivatedNode {
  node_id: string;
  distance: number;
  brightness: number;
  state: NodeState;
}

// diagnosis.json（done 为可选扩展字段，表示诊断是否结束）
export type DiagnosisSignal = 'correct' | 'fuzzy' | 'dontknow';
export interface DiagnosisOption {
  text: string;
  signal: DiagnosisSignal;
}

export interface WeakPoint {
  node_id: string;
  confidence: number;
  reason?: string;
}

export interface Diagnosis {
  question?: string;
  seed_nodes?: SeedNode[];
  suspected_gap?: WeakPoint;
  weak_points?: WeakPoint[];
  activated_nodes?: ActivatedNode[];
  next_question?: string | null;
  next_options?: DiagnosisOption[] | null;
  done?: boolean;
}

export interface Teaching {
  node_id: string;
  definition: string;
  intuition: string;
  relation: string;
  example: string;
  pitfall: string;
  verify_question: string;
  verify_options: string[];
}

export interface TeachingExplanation {
  explanation_markdown: string;
}

export interface Evaluation {
  node_id: string;
  mastery: 'mastered' | 'partial' | 'not_mastered';
  score: number;
  evidence: string;
  suggested_state: 'green' | 'orange' | 'gray';
}

// 页面模式（重构后：首页 / 编辑 / 提问）
export type Mode = 'home' | 'edit' | 'ask';
export type EditPhase = 'import' | 'editor';
export type AskPhase = 'input' | 'locating' | 'diagnosis' | 'choose' | 'learning' | 'done';

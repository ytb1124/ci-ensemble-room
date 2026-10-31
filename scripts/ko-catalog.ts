// 관리자 문구 수정 화면(#/admin)이 쓰는 한국어 문구 목록을 소스에서 뽑는다.
// src 안의 모든 tx('한국어', 'English') 호출을 TypeScript 파서로 읽어 가상 모듈 'virtual:ko-catalog'로 내보낸다.
// 키 규칙은 src/i18n.ts의 ko`` 태그와 같아야 한다: 변수 자리는 {0}, {1} …
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import type { Plugin } from 'vite';

export interface Place {
  /** src 기준 경로 'screens/room/Room.tsx' */
  file: string;
  line: number;
  /** 감싼 최상위 함수·상수 이름(어느 화면인지 가르는 데 쓴다) */
  fn: string;
  /** 눈에 보이지 않는 문구: JSX 속성 이름(aria-label·title·placeholder 등) 또는 화면 낭독기 알림 'live' */
  hidden?: string;
}

export interface CatalogEntry {
  key: string;
  /** 변수 자리 개수 */
  vars: number;
  where: Place[];
}

const VIRTUAL_ID = 'virtual:ko-catalog';
const RESOLVED_ID = '\0' + VIRTUAL_ID;
// 관리자 화면 자체와 개발용 화면 문구는 목록에 넣지 않는다
const SKIP = [/^screens\/admin\//, /^components\/instruments\/InstrumentGallery\.tsx$/];

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = join(dir, d.name);
    if (d.isDirectory()) return walk(p);
    return /\.tsx?$/.test(d.name) && !d.name.endsWith('.d.ts') ? [p] : [];
  });
}

/** 문구가 화면에 글자로 보이는지. 속성 값이나 낭독기 알림이면 그 종류를 돌려준다 */
function hiddenKind(node: ts.Node): string | undefined {
  for (let p = node.parent; p && !ts.isSourceFile(p); p = p.parent) {
    if (ts.isJsxAttribute(p)) {
      // 직접 만든 부품의 label·options 같은 속성은 화면에 글자로 나온다
      const name = p.name.getText();
      return /^aria-|^(title|placeholder|alt)$/.test(name) ? name : undefined;
    }
    if (ts.isCallExpression(p) && ts.isIdentifier(p.expression) && p.expression.text === 'setLive') return 'live';
    if (ts.isJsxExpression(p) && (ts.isJsxElement(p.parent) || ts.isJsxFragment(p.parent))) return undefined;
  }
  return undefined;
}

/** 감싼 최상위 선언 이름 */
function topName(node: ts.Node): string {
  let p: ts.Node = node;
  while (p.parent && !ts.isSourceFile(p.parent)) p = p.parent;
  if ((ts.isFunctionDeclaration(p) || ts.isClassDeclaration(p)) && p.name) return p.name.text;
  if (ts.isVariableStatement(p)) {
    const d = p.declarationList.declarations[0];
    if (d && ts.isIdentifier(d.name)) return d.name.text;
  }
  return '';
}

/** 첫 인자를 키로 바꾼다. 키로 만들 수 없는 식이면 null */
function keyOf(node: ts.Expression): { key: string; vars: number } | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return { key: node.text, vars: 0 };
  if (ts.isTaggedTemplateExpression(node) && ts.isIdentifier(node.tag) && node.tag.text === 'ko') {
    const t = node.template;
    if (ts.isNoSubstitutionTemplateLiteral(t)) return { key: t.text, vars: 0 };
    let key = t.head.text;
    t.templateSpans.forEach((s, i) => {
      key += `{${i}}` + s.literal.text;
    });
    return { key, vars: t.templateSpans.length };
  }
  return null;
}

export function buildCatalog(srcDir: string): { entries: CatalogEntry[]; problems: string[] } {
  const byKey = new Map<string, CatalogEntry>();
  const problems: string[] = [];
  for (const file of walk(srcDir)) {
    const rel = relative(srcDir, file).split('\\').join('/');
    if (SKIP.some((r) => r.test(rel))) continue;
    const text = readFileSync(file, 'utf8');
    if (!text.includes('tx(')) continue;
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'tx' && node.arguments.length === 2) {
        const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
        const k = keyOf(node.arguments[0]);
        if (!k) {
          problems.push(`${rel}:${line} tx()의 한국어 문구가 글자 그대로나 ko\`\`가 아니라서 수정 목록에서 빠져요`);
        } else {
          const hidden = hiddenKind(node);
          const place: Place = { file: rel, line, fn: topName(node), ...(hidden ? { hidden } : {}) };
          const prev = byKey.get(k.key);
          if (prev) prev.where.push(place);
          else byKey.set(k.key, { key: k.key, vars: k.vars, where: [place] });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return { entries: [...byKey.values()], problems };
}

export function koCatalog(srcDir: string): Plugin {
  return {
    name: 'ko-catalog',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      const { entries, problems } = buildCatalog(srcDir);
      problems.forEach((p) => this.warn(p));
      return `export default ${JSON.stringify(entries)};`;
    },
    // 개발 서버: 소스를 고치면 목록도 다시 만든다
    handleHotUpdate({ file, server }) {
      if (!file.startsWith(srcDir)) return;
      const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
      if (mod) server.moduleGraph.invalidateModule(mod);
    },
  };
}

// 관리자 문구 수정 화면(#/admin)이 쓰는 한국어 문구 목록을 소스에서 뽑는다.
// src 안의 모든 tx('한국어', 'English') 호출을 TypeScript 파서로 읽어 가상 모듈 'virtual:ko-catalog'로 내보낸다.
// 키 규칙은 src/i18n.ts의 ko`` 태그와 같아야 한다: 변수 자리는 {0}, {1} …
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import type { Plugin } from 'vite';

export interface CatalogEntry {
  key: string;
  /** 영어 문구(참고용). 영어 쪽이 식이면 소스 그대로 */
  en: string;
  /** 변수 자리 개수 */
  vars: number;
  /** 'screens/room/Room.tsx:154' 형식 */
  where: string[];
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
        const [koArg, enArg] = node.arguments;
        const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
        const where = `${rel}:${line}`;
        const k = keyOf(koArg);
        if (!k) {
          problems.push(`${where} tx()의 한국어 문구가 글자 그대로나 ko\`\`가 아니라서 수정 목록에서 빠져요`);
        } else {
          const en = ts.isStringLiteral(enArg) || ts.isNoSubstitutionTemplateLiteral(enArg) ? enArg.text : enArg.getText(sf);
          const prev = byKey.get(k.key);
          if (prev) prev.where.push(where);
          else byKey.set(k.key, { key: k.key, en, vars: k.vars, where: [where] });
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

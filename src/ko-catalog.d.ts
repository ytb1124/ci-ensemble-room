// scripts/ko-catalog.ts가 만드는 가상 모듈
declare module 'virtual:ko-catalog' {
  const entries: {
    key: string;
    vars: number;
    where: { file: string; line: number; fn: string; hidden?: string }[];
  }[];
  export default entries;
}

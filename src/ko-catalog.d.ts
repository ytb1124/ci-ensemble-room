// scripts/ko-catalog.ts가 만드는 가상 모듈
declare module 'virtual:ko-catalog' {
  const entries: {
    key: string;
    en: string;
    vars: number;
    where: string[];
  }[];
  export default entries;
}

export interface Company {
  code: string;
  market: 'SH' | 'SZ' | 'US';
  name: string;
}

export interface Sector {
  id: string;
  name: string;
  companies: Company[];
}

export const SECTORS: Sector[] = [
  {
    id: 'ai-power',
    name: 'AI能源电力',
    companies: [
      { code: '600900', market: 'SH', name: '长江电力' },
      { code: '600011', market: 'SH', name: '华能国际' },
      { code: '300750', market: 'SZ', name: '宁德时代' },
      { code: '002594', market: 'SZ', name: '比亚迪' },
      { code: '300274', market: 'SZ', name: '阳光电源' },
      { code: '300014', market: 'SZ', name: '亿纬锂能' },
      { code: '688599', market: 'SH', name: '天合光能' },
      { code: '600438', market: 'SH', name: '通威股份' },
      { code: '600089', market: 'SH', name: '特变电工' },
      { code: '600875', market: 'SH', name: '东方电气' },
    ],
  },
  {
    id: 'chip',
    name: '芯片半导体',
    companies: [
      { code: '688981', market: 'SH', name: '中芯国际' },
      { code: '603501', market: 'SH', name: '韦尔股份' },
      { code: '002371', market: 'SZ', name: '北方华创' },
      { code: '688008', market: 'SH', name: '澜起科技' },
      { code: '688256', market: 'SH', name: '寒武纪' },
      { code: '688047', market: 'SH', name: '龙芯中科' },
      { code: '688347', market: 'SH', name: '华虹半导体' },
      { code: '300782', market: 'SZ', name: '卓胜微' },
      { code: '002049', market: 'SZ', name: '紫光国微' },
    ],
  },
  {
    id: 'optical',
    name: '光通信',
    companies: [
      { code: '300308', market: 'SZ', name: '中际旭创' },
      { code: '300502', market: 'SZ', name: '新易盛' },
      { code: '300394', market: 'SZ', name: '天孚通信' },
      { code: '688498', market: 'SH', name: '源杰科技' },
      { code: '001267', market: 'SZ', name: '汇绿生态' },
      { code: 'TSEM',  market: 'US', name: 'TOWER半导体' },
      { code: 'COHR',  market: 'US', name: 'COHERENT' },
      { code: 'CLS',   market: 'US', name: '天弘科技' },
      { code: 'ANET',  market: 'US', name: 'ARISTA网络' },
      { code: 'CRWV',  market: 'US', name: 'COREWEAVE' },
      { code: 'NBIS',  market: 'US', name: 'NEBIUS' },
      { code: 'VRT',   market: 'US', name: 'VERTIV' },
      { code: 'MRVL',  market: 'US', name: '迈威尔科技' },
    ],
  },
  {
    id: 'fiber',
    name: '光纤光缆',
    companies: [
      { code: '601869', market: 'SH', name: '长飞光纤' },
      { code: '600522', market: 'SH', name: '中天科技' },
      { code: '600487', market: 'SH', name: '亨通光电' },
      { code: '600498', market: 'SH', name: '烽火通信' },
    ],
  },
  {
    id: 'semieq',
    name: '半导体封装设备',
    companies: [
      { code: '688012', market: 'SH', name: '中微公司' },
      { code: '688082', market: 'SH', name: '盛美上海' },
      { code: '688037', market: 'SH', name: '芯源微' },
      { code: '688120', market: 'SH', name: '华海清科' },
      { code: '688072', market: 'SH', name: '拓荆科技' },
      { code: '688396', market: 'SH', name: '华润微' },
    ],
  },
  {
    id: 'sic',
    name: '碳化硅',
    companies: [
      { code: '688291', market: 'SH', name: '天科合达' },
      { code: '600703', market: 'SH', name: '三安光电' },
    ],
  },
  {
    id: 'storage',
    name: '存储HDD',
    companies: [
      { code: '301308', market: 'SZ', name: '江波龙' },
      { code: '300042', market: 'SZ', name: '朗科科技' },
      { code: '001309', market: 'SZ', name: '德明利' },
      { code: '603986', market: 'SH', name: '兆易创新' },
      { code: '688766', market: 'SH', name: '普冉股份' },
      { code: 'WDC',   market: 'US', name: '西部数据' },
      { code: 'STX',   market: 'US', name: '希捷科技' },
    ],
  },
  {
    id: 'internet',
    name: '互联网应用',
    companies: [
      { code: 'BIDU',  market: 'US', name: '百度' },
      { code: 'PDD',   market: 'US', name: '拼多多' },
      { code: 'JD',    market: 'US', name: '京东' },
    ],
  },
  {
    id: 'software',
    name: '软件',
    companies: [
      { code: '688111', market: 'SH', name: '金山办公' },
      { code: '600588', market: 'SH', name: '用友网络' },
      { code: '300033', market: 'SZ', name: '同花顺' },
    ],
  },
  {
    id: 'pcb',
    name: 'PCB',
    companies: [
      { code: '002463', market: 'SZ', name: '沪电股份' },
      { code: '002916', market: 'SZ', name: '深南电路' },
      { code: '600183', market: 'SH', name: '生益科技' },
      { code: '002938', market: 'SZ', name: '鹏鼎控股' },
    ],
  },
  {
    id: 'server',
    name: '服务器交换机',
    companies: [
      { code: '000977', market: 'SZ', name: '浪潮信息' },
      { code: '603019', market: 'SH', name: '中科曙光' },
    ],
  },
  {
    id: 'mlcc',
    name: 'MLCC',
    companies: [
      { code: '300408', market: 'SZ', name: '三环集团' },
      { code: '000636', market: 'SZ', name: '风华高科' },
      { code: '002138', market: 'SZ', name: '顺络电子' },
      { code: '603678', market: 'SH', name: '火炬电子' },
    ],
  },
];

export function secid(c: Company): string {
  if (c.market === 'US') return '';
  const prefix = c.market === 'SH' ? '1' : '0';
  return `${prefix}.${c.code}`;
}

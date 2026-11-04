/* Explicit local QA seed. Run manually against a local server; requires local approval afterwards. */
const apiKey = process.env.APPAI_API_KEY;
const base = process.env.APPAI_BASE_URL;
const imageBase = process.env.QA_IMAGE_BASE;
if (!apiKey || !base || !imageBase) throw new Error('Set APPAI_API_KEY, APPAI_BASE_URL and QA_IMAGE_BASE');
const server = new URL(base);
if (!['localhost', '127.0.0.1', '[::1]'].includes(server.hostname)) throw new Error('QA seed requires a local server');
const imageUrl = new URL(imageBase);
if (!(imageUrl.protocol === 'https:' || (imageUrl.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(imageUrl.hostname)))) {
  throw new Error('QA_IMAGE_BASE must use HTTPS or local HTTP (localhost/127.0.0.1)');
}
const image = name => `${imageBase.replace(/\/$/, '')}/${name}`;
const links = [{ label: 'Example project site', url: 'https://example.org/' }];
const copy = {
  en: { tagline: 'A fictional portfolio for platform QA', intro: 'Alex Rivera is a **fictional person** used only for QA.\n\nAll projects and experience below are invented test fixtures.', projects: 'Selected projects', experience: 'Experience', contact: 'Contact', description: 'Fictional demonstration project for layout testing.', entry: 'Fictional design practice', note: 'Invented experience for QA only; no real credentials or contact details.' },
  'zh-TW': { tagline: '虛構人物的測試作品集', intro: 'Alex Rivera 是專供 QA 使用的**虛構人物**。\n\n以下專案與經驗皆為測試資料。', projects: '精選專案', experience: '經驗', contact: '聯絡', description: '用於版面測試的虛構展示專案。', entry: '虛構設計練習', note: '僅供 QA 使用的虛構經驗，沒有真實資歷或聯絡資料。' },
  'zh-CN': { tagline: '虚构人物的测试作品集', intro: 'Alex Rivera 是专供 QA 使用的**虚构人物**。\n\n以下项目与经验皆为测试数据。', projects: '精选项目', experience: '经验', contact: '联系', description: '用于版面测试的虚构展示项目。', entry: '虚构设计练习', note: '仅供 QA 使用的虚构经验，没有真实资历或联系资料。' },
};
(async () => {
  for (const [locale, t] of Object.entries(copy)) {
    const sections = [
      { type: 'profile-header', data: { name: 'Alex Rivera (QA)', eyebrow: 'Fictional QA fixture', tagline: t.tagline, intro: t.intro, nav: ['projects', 'experience', 'contact'].map(id => ({ label: t[id], href: `#${id}` })), links } },
      { type: 'project-cards', data: { id: 'projects', heading: t.projects, eyebrow: '01 / QA', items: [
        { name: 'Pocket Garden (QA)', category: 'Fictional mobile app', description: t.description, icon: { url: image('icon.png'), alt: '' }, screenshot: { url: image('phone.png'), alt: 'Fictional mobile app preview', kind: 'phone', width: 390, height: 844 }, links },
        { name: 'Open Canvas (QA)', category: 'Fictional web app', description: t.description, monogram: 'OC', screenshot: { url: image('web.png'), alt: 'Fictional web app preview', kind: 'web', width: 1440, height: 900 }, links: [{ label: 'Portfolio', url: '/p/qa-person' }] },
        { name: 'Quiet Notes (QA)', category: 'Fictional concept', description: t.description, monogram: 'QN', links: [] },
      ] } },
      { type: 'entries', data: { id: 'experience', heading: t.experience, eyebrow: '02 / QA', intro: t.note, items: [{ title: t.entry, description: t.note }] } },
      { type: 'entries', data: { id: 'contact', heading: t.contact, intro: t.note, links } },
    ].map((section, order) => ({ ...section, order }));
    const response = await fetch(`${server.origin}/api/v1/pages?upsert=true`, {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'qa-person', locale, template: 'PERSON', title: 'Alex Rivera (QA)', tagline: t.tagline, themeColor: '#b0461f', isPublished: true, content: { sections } }),
    });
    if (!response.ok) throw new Error(`Seed ${locale} failed (${response.status})`);
    console.log(`Seeded qa-person (${locale})`);
  }
  const response = await fetch(`${server.origin}/api/v1/pages?upsert=true`, {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug: 'qa-person-unlisted', locale: 'en', template: 'PERSON', title: 'Morgan Lane (QA)', isPublished: true, content: { sections: [
      { type: 'profile-header', order: 0, data: { name: 'Morgan Lane (QA)', tagline: 'Fictional unreviewed QA person', intro: 'Invented QA fixture awaiting AppAI review.' } },
    ] } }),
  });
  if (!response.ok) throw new Error(`Seed qa-person-unlisted failed (${response.status})`);
  console.log('Seeded qa-person-unlisted (en); leave its App unapproved');
})().catch(error => { console.error(error.message); process.exitCode = 1; });

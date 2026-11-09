import { translations } from '../puzzles/river/strings.ts';
const params = new URLSearchParams(location.search);
export const locale = (params.get('locale') || navigator.language).toLowerCase().startsWith('zh') ? 'zh-TW' : 'en';
export const strings = translations[locale];
export const shareStrings = locale === 'zh-TW' ? {
 share: '分享成績', nickname: '你的名字（選填）', leaderboard: '我的排行榜', friend: '一位朋友', challenge: '挑戰', target: '目標', beat: '你贏了！', tie: '平手！', missed: '差一點！', cta: '你能用更少趟嗎？', preview: '分享預覽', hint: '長按或右鍵存圖', download: '下載圖片', copy: '複製挑戰連結', copied: '已複製連結', manual: '請複製下方連結', close: '關閉', start: '接受挑戰', banner: '過了這一關，換你挑戰！', error: '無法分享，請再試一次。'
} : {
 share: 'Share result', nickname: 'Your name (optional)', leaderboard: 'My best runs', friend: 'A friend', challenge: 'Challenge', target: 'Target', beat: 'You won!', tie: "It's a tie!", missed: 'So close!', cta: 'Can you cross in fewer trips?', preview: 'Share preview', hint: 'Long press or right-click to save', download: 'Download image', copy: 'Copy challenge link', copied: 'Link copied', manual: 'Copy the link below', close: 'Close', start: 'Accept challenge', banner: 'cleared this level. Your turn!', error: 'Could not share. Please try again.'
};
export const collectionStrings=locale==='zh-TW'?{homeTitle:'選一個謎題',homeIntro:'三個經典邏輯謎題，全家都能玩。',allPuzzles:'← 所有謎題',levelsCount:'3 關',starsTotal:'{n} / 9 顆星',comingSoon:'即將推出',minutes:'分',steps:'步',crossings:'趟',totalStars:'全部星星',loading:'場景準備中…'}:{homeTitle:'Pick a puzzle',homeIntro:'Three classic logic puzzles the whole family can play.',allPuzzles:'← All puzzles',levelsCount:'3 levels',starsTotal:'{n} / 9 stars',comingSoon:'Coming soon',minutes:'min',steps:'steps',crossings:'crossings',totalStars:'All stars',loading:'Preparing the scene…'};

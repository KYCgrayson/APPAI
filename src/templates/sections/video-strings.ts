import { pickByLocale } from "../../lib/locale-match.ts";

// Hosted-page UI only; publisher copy stays in section data.
const rows = [
  { locale: "en", youtube: "Watch on YouTube", vimeo: "Watch on Vimeo", isDefault: true, heading: "Key moments", play: "Play video", loading: "Loading video…", ready: "Video ready", jumped: "Jumped to {time} — press play", seeked: "Jumped to {time}", fallback: "Open video at {time}", failed: "The player could not load. Open the video to continue.", unavailable: "Video unavailable" },
  { locale: "zh-TW", youtube: "在 YouTube 觀看", vimeo: "在 Vimeo 觀看", heading: "重點時刻", play: "播放影片", loading: "影片載入中…", ready: "影片已就緒", jumped: "已跳至 {time} — 請按播放", seeked: "已跳至 {time}", fallback: "在 {time} 開啟影片", failed: "播放器無法載入，請開啟影片繼續觀看。", unavailable: "影片無法使用" },
  { locale: "zh-CN", youtube: "在 YouTube 观看", vimeo: "在 Vimeo 观看", heading: "重点时刻", play: "播放视频", loading: "视频加载中…", ready: "视频已就绪", jumped: "已跳至 {time} — 请按播放", seeked: "已跳至 {time}", fallback: "在 {time} 打开视频", failed: "播放器无法加载，请打开视频继续观看。", unavailable: "视频无法使用" },
  { locale: "ja", youtube: "YouTube で見る", vimeo: "Vimeo で見る", heading: "主なシーン", play: "動画を再生", loading: "動画を読み込み中…", ready: "動画の準備完了", jumped: "{time} に移動しました — 再生を押してください", seeked: "{time} に移動しました", fallback: "{time} から動画を開く", failed: "プレーヤーを読み込めません。動画を開いて続けてください。", unavailable: "動画を利用できません" },
  { locale: "ko", youtube: "YouTube에서 보기", vimeo: "Vimeo에서 보기", heading: "주요 장면", play: "동영상 재생", loading: "동영상 로딩 중…", ready: "동영상 준비 완료", jumped: "{time}(으)로 이동했습니다 — 재생을 누르세요", seeked: "{time}(으)로 이동했습니다", fallback: "{time}에서 동영상 열기", failed: "플레이어를 불러올 수 없습니다. 동영상을 열어 계속하세요.", unavailable: "동영상을 사용할 수 없습니다" },
  { locale: "es", youtube: "Ver en YouTube", vimeo: "Ver en Vimeo", heading: "Momentos clave", play: "Reproducir vídeo", loading: "Cargando vídeo…", ready: "Vídeo listo", jumped: "Salto a {time} — pulsa reproducir", seeked: "Salto a {time}", fallback: "Abrir vídeo en {time}", failed: "No se pudo cargar el reproductor. Abre el vídeo para continuar.", unavailable: "Vídeo no disponible" },
  { locale: "fr", youtube: "Voir sur YouTube", vimeo: "Voir sur Vimeo", heading: "Moments clés", play: "Lire la vidéo", loading: "Chargement de la vidéo…", ready: "Vidéo prête", jumped: "Positionné à {time} — appuyez sur lecture", seeked: "Positionné à {time}", fallback: "Ouvrir la vidéo à {time}", failed: "Le lecteur ne peut pas se charger. Ouvrez la vidéo pour continuer.", unavailable: "Vidéo indisponible" },
  { locale: "de", youtube: "Auf YouTube ansehen", vimeo: "Auf Vimeo ansehen", heading: "Wichtige Momente", play: "Video abspielen", loading: "Video wird geladen…", ready: "Video bereit", jumped: "Zu {time} gesprungen — Wiedergabe drücken", seeked: "Zu {time} gesprungen", fallback: "Video bei {time} öffnen", failed: "Der Player konnte nicht geladen werden. Öffnen Sie das Video, um fortzufahren.", unavailable: "Video nicht verfügbar" },
] as const;
export type VideoStrings = Omit<(typeof rows)[number], "locale" | "isDefault">;
export function videoStrings(locale = "en"): VideoStrings {
  return pickByLocale(rows, locale)!;
}

import { TABLETOP_COLLECTION, getGamesCopy, type GameEntry } from "./games-catalog.ts";
import { gameContentLocale, getGamePageLabels } from "./games-pages-copy.ts";
import { serializeJsonLd } from "./json-ld.ts";

/** The URL stays top-level: no iframe, storage bridge, or query/hash reserialization. */
export function injectGameNavigation(html: string, game: GameEntry, requestedLocale: string, breadcrumb = ""): string {
  const locale = gameContentLocale(requestedLocale);
  const labels = getGamePageLabels(locale);
  const title = `${getGamesCopy(locale).games[game.slug].name} · AppAI`;
  const titleHtml = title.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
  // Werewolf writes document.title on each render. Keep the shell's localized
  // game title after startup and subsequent game renders without editing builds.
  const titleScript = `<script id="appai-play-title">(()=>{
    const title=${serializeJsonLd(title)};
    const update=()=>{if(document.title!==title)document.title=title;};
    new MutationObserver(update).observe(document.querySelector("title"),{childList:true,subtree:true,characterData:true});
    update();
  })();</script>`;
  const prefix = locale === "en" ? "" : `/${locale}`;
  const style = `<style id="appai-play-style">
    :root{--appai-play-bar-height:calc(53px + env(safe-area-inset-top,0px))}
    body[data-appai-play]{padding-top:var(--appai-play-bar-height);box-sizing:border-box}
    #appai-play-nav{position:fixed;inset:0 0 auto;z-index:2147483647;box-sizing:border-box;display:flex;align-items:stretch;justify-content:center;gap:4px;min-height:var(--appai-play-bar-height);padding:calc(4px + env(safe-area-inset-top,0px)) max(4px,env(safe-area-inset-right,0px)) 4px max(4px,env(safe-area-inset-left,0px));background:#030712;color:#f3f4f6;border-bottom:1px solid #374151;font:600 14px/1.25 system-ui,sans-serif}
    #appai-play-nav a{display:flex;align-items:center;justify-content:center;box-sizing:border-box;min-width:0;min-height:44px;padding:8px 10px;border-radius:8px;color:#f3f4f6;text-decoration:none;overflow-wrap:anywhere;text-align:center;touch-action:manipulation}
    #appai-play-nav a:hover{background:#1f2937}
    #appai-play-nav a:focus-visible{outline:2px solid #6ee7b7;outline-offset:-2px}
    @media(max-width:400px){#appai-play-nav a{flex:1;padding-inline:4px;font-size:13px}}
    ${breadcrumb ? `:root{--appai-play-bar-height:calc(89px + env(safe-area-inset-top,0px))}
    #appai-play-chrome{position:fixed;inset:0 0 auto;z-index:2147483647}
    #appai-play-chrome #appai-play-nav{position:static;min-height:calc(53px + env(safe-area-inset-top,0px))}
    #appai-play-chrome [data-breadcrumb]{height:36px;box-sizing:border-box;overflow-x:auto;padding:4px 12px;font:14px/20px system-ui,sans-serif}
    #appai-play-chrome ol{display:flex;flex-wrap:nowrap;align-items:center;gap:8px;white-space:nowrap;list-style:none;margin:0;padding:0}
    #appai-play-chrome li{display:flex;flex-shrink:0;align-items:center;gap:8px;min-width:0}
    #appai-play-chrome [data-breadcrumb] a,#appai-play-chrome [aria-current]{display:inline-flex;align-items:center;min-height:24px;padding:2px 4px}
    #appai-play-chrome [data-breadcrumb] a{color:var(--breadcrumb-link);text-decoration:underline}
    #appai-play-chrome [title]>span{display:block;max-width:60vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #appai-play-chrome [data-breadcrumb] a:focus-visible{outline:2px solid currentColor;outline-offset:2px}` : ""}
    ${game.puzzle ? `body[data-appai-play] #app{top:var(--appai-play-bar-height)}
    body[data-appai-play] #app .menu{bottom:max(16px,env(safe-area-inset-bottom));max-height:none}
    body[data-appai-play] #app .scrim:not(.sheet-scrim) .modal{max-height:calc(100dvh - var(--appai-play-bar-height) - 40px)}
    body[data-appai-play] .about-link{display:none!important}` : ""}
  </style>`;
  const nav = `<nav id="appai-play-nav" aria-label="AppAI"><a id="appai-game-info" href="${prefix}/games/${game.slug}">${labels.gameInfo}</a><a href="${prefix}/games">${labels.allGames}</a><a href="${prefix}/">${labels.appaiHome}</a></nav>`;
  // Run before the game's module. Bare /play links select the page's puzzle;
  // existing game/challenge/level/claim queries keep their original semantics.
  // Keep Game info in sync when the collection switches puzzles via replaceState.
  const script = game.puzzle ? `<script id="appai-play-bootstrap">(()=>{
    const fallback=${serializeJsonLd(game.puzzle)}, prefix=${serializeJsonLd(prefix)}, requestedSlug=${serializeJsonLd(game.slug)};
    const slugs={river:"river-crossing",bridge:"night-bridge",water:"water-pouring"};
    const params=new URLSearchParams(location.search);
    if(!["game","challenge","level","claim"].some(key=>params.has(key))){
      history.replaceState(history.state,"",location.pathname+location.search+(location.search?"&":"?")+"game="+fallback+location.hash);
    }
    const update=()=>{
      const q=new URLSearchParams(location.search), key=q.get("game");
      const slug=Object.hasOwn(slugs,key)?slugs[key]:q.has("claim")?requestedSlug:${serializeJsonLd(TABLETOP_COLLECTION.slug)};
      document.getElementById("appai-game-info").href=prefix+"/games/"+slug;
    };
    for(const name of ["pushState","replaceState"]){const original=history[name];history[name]=function(...args){const result=original.apply(this,args);update();return result;};}
    addEventListener("popstate",update);addEventListener("hashchange",update);update();
  })();</script>` : "";
  return html.replace(/<html\b[^>]*\blang="[^"]*"/, (tag) => tag.replace(/lang="[^"]*"/, `lang="${locale}"`))
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, "")
    .replace("</head>", `<title>${titleHtml}</title>${titleScript}${style}</head>`)
    .replace(/<body\b([^>]*)>/, `<body$1 data-appai-play>${breadcrumb ? `<div id="appai-play-chrome">${nav}${breadcrumb}</div>` : nav}${script}`);
}

/** Explicit game language wins; Werewolf's legacy lang=zh means Traditional Chinese. */
export function gameNavigationLocale(url: URL, cookieLocale?: string): string {
  const explicit = url.searchParams.get("locale");
  if (explicit !== null) return gameContentLocale(explicit);
  const legacy = url.searchParams.get("lang");
  return legacy === "zh" ? "zh-TW" : gameContentLocale(legacy ?? cookieLocale ?? "en");
}

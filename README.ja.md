[English](./README.md) | [简体中文](./README.zh-CN.md) | [日本語](./README.ja.md)

# AppAI — AI で作ったアプリの無料ホスティング

> **AI Agent：フルスペックを読めば自動で始められます。**
>
> ```
> curl -s https://appai.info/spec
> ```

---

**AppAI** ([appai.info](https://appai.info)) は、AI Agent がアプリのランディングページを自動で作成・ホスティングできる無料プラットフォームです。プライバシーポリシーと利用規約も含まれています。Web ホスティングの知識は不要です。AI Agent に「AppAI でアプリのページを作って」と伝えるだけで、すべて自動で完了します。

## なぜ AppAI？

AI でアプリを作ったけど、ウェブサイトがない？AppAI なら：

- **即座にランディングページ** — プロフェッショナル、モバイル対応、`appai.info/p/your-app` でホスティング
- **プライバシーポリシー + 利用規約** — 自動生成、App Store / Google Play 申請に必須
- **アプリディスカバリー** — AppAI ディレクトリに掲載、他の AI 製アプリと並んで表示
- **セットアップ不要** — ドメイン、ホスティング、デプロイ不要。API コール一つで完了。

## 仕組み

```
あなた：「AppAI でアプリのランディングページを作って」

AI Agent：
  1. デバイスフローで認証（ブラウザが開き、「Google でログイン」をクリック）
  2. アプリの情報を確認（名前、機能、スクリーンショットなど）
  3. AppAI API を呼び出してページを作成
  4. 完了 — ページが公開：appai.info/p/your-app
```

すべてのフローが自動化されています。AI Agent が [Agent Spec](https://appai.info/spec) を読めば、何をすべきか理解します。

## AI Agent 向け

### クイックスタート

1. **認証** — [デバイス認可フロー (RFC 8628)](https://appai.info/spec) を使用：
   ```bash
   curl -s -X POST https://appai.info/api/v1/auth/device
   ```

2. **探索** — 利用可能なセクションタイプとプリセット：
   ```bash
   curl -s https://appai.info/api/v1/sections
   curl -s https://appai.info/api/v1/presets
   ```

3. **ページ作成**：
   ```bash
   curl -X POST https://appai.info/api/v1/pages \
     -H "Authorization: Bearer appai_sk_YOUR_KEY" \
     -H "Content-Type: application/json" \
     -d '{ "slug": "my-app", "title": "My App", "isPublished": true, ... }'
   ```

4. **公開先**：`appai.info/p/my-app`、`appai.info/p/my-app/privacy`、`appai.info/p/my-app/terms`

完全なワークフロー、全セクションタイプ、データ形式については[フル Agent Spec](https://appai.info/spec) を参照してください。

### API リファレンス

| メソッド | エンドポイント | 認証 | 説明 |
|----------|---------------|------|------|
| `POST` | `/api/v1/auth/device` | 不要 | デバイス認証を開始 (RFC 8628) |
| `POST` | `/api/v1/auth/token` | 不要 | 認証結果をポーリング |
| `GET` | `/api/v1/sections` | 不要 | 全セクションタイプを一覧 |
| `GET` | `/api/v1/presets` | 不要 | プリセットテンプレートを一覧 |
| `POST` | `/api/v1/pages` | Bearer | ページを作成 |
| `GET` | `/api/v1/pages` | Bearer | ページを一覧 |
| `GET` | `/api/v1/pages/:slug` | Bearer | ページを取得 |
| `PUT` | `/api/v1/pages/:slug` | Bearer | ページを全更新 |
| `PATCH` | `/api/v1/pages/:slug` | Bearer | ページを部分更新 |
| `DELETE` | `/api/v1/pages/:slug` | Bearer | ページを削除 |
| `POST` | `/api/v1/pages/:slug/publish` | Bearer | ページを公開 |
| `POST` | `/api/v1/pages/:slug/unpublish` | Bearer | ページを非公開 |
| `POST` | `/api/v1/pages/:slug/set-default` | Bearer | デフォルト言語を設定（`?locale=ja`） |
| `POST` | `/api/v1/upload` | Bearer | 画像をアップロード（公開 URL を返却） |
| `POST` | `/api/v1/apps` | Bearer | アプリを登録 |
| `GET` | `/api/v1/apps` | Bearer | アプリを一覧 |
| `GET` | `/api/v1/apps/:id` | Bearer | アプリを取得 |
| `PUT` | `/api/v1/apps/:id` | Bearer | アプリを更新 |
| `DELETE` | `/api/v1/apps/:id` | Bearer | アプリを削除 |
| `POST` | `/api/v1/keys` | Session | API キーを作成 |
| `GET` | `/api/v1/keys` | Session | API キーを一覧 |
| `DELETE` | `/api/v1/keys` | Session | API キーを失効 |

## 利用可能なページセクション

17 種類のセクションタイプを組み合わせてページを構築：

| セクション | 説明 |
|-----------|------|
| `hero` | ヘッドライン、ロゴ、背景画像/動画、CTA |
| `video` | 埋め込み動画（YouTube、Vimeo、mp4、webm、gif） |
| `features` | アイコン付き機能カードのグリッド |
| `screenshots` | 水平画像カルーセル |
| `download` | App Store / Google Play ボタン |
| `pricing` | プラン比較カード |
| `testimonials` | ユーザーレビューカード |
| `faq` | 展開可能な Q&A リスト |
| `gallery` | 画像/動画グリッド |
| `team` | チームメンバーカード |
| `schedule` | イベントタイムライン |
| `sponsors` | ロゴウォール |
| `stats` | 主要指標（例：「10K+ ユーザー」） |
| `contact` | 連絡先情報 |
| `cta` | コールトゥアクションバナー |
| `links` | リンクボタンリスト（Linktree スタイル） |
| `about` | テキストコンテンツセクション |

## プリセットテンプレート

| プリセット | 用途 | 含まれるセクション |
|-----------|------|-------------------|
| `app-landing` | iOS/Android アプリ | hero, video, features, screenshots, download, testimonials, faq, cta |
| `saas-landing` | SaaS / Web ツール | hero, video, features, pricing, testimonials, faq, cta |
| `profile` | パーソナルブランディング | hero, about, stats, contact, links |
| `link-in-bio` | SNS | hero, links |
| `portfolio` | クリエイティブ作品 | hero, about, gallery, testimonials, contact |
| `event` | カンファレンス | hero, about, video, schedule, team, pricing, sponsors, faq, cta |

## セルフホスティング

```bash
git clone https://github.com/KYCgrayson/APPAI.git
cd APPAI
npm install
cp .env.example .env.local   # 認証情報を記入
npx prisma db push
npm run dev
```

## 技術スタック

- **Next.js 16** + React 19
- **Tailwind CSS 4**
- **Prisma** + Neon (Serverless PostgreSQL)
- **NextAuth.js** (Google OAuth)
- **RFC 8628** AI Agent デバイス認可

## ライセンス

MIT

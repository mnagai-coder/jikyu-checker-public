# 時給チェッカー

給与明細PDFを読み取って、実質時給を確認するための React アプリです。

## 公開版の仕様

- PDF のみ対応
- データは `localStorage` に保存
- 公開版では外部 AI API は使わず、ブラウザ内で完結

## ローカル起動

```bash
npm install
npm run dev
```

## ビルド

```bash
npm run build
```

## GitHub で公開する手順

```bash
git init
git add .
git commit -m "Initial public release"
git branch -M main
git remote add origin <GitHubのリポジトリURL>
git push -u origin main
```

## GitHub Pages

このリポジトリには GitHub Pages 用の workflow を追加済みです。

- 公開URL: `https://mnagai-coder.github.io/jikyu-checker-public/`
- GitHub の `Settings -> Pages` で `Source` を `GitHub Actions` に設定
- `main` に push すると自動で `dist/` が配信されます

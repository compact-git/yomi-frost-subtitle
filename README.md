# Yomi Frost 字幕(補助exe) v2.7.1

Yomi Frost Web の字幕を、**自分の画面に「枠なし・背景透明・最前面」**で重ねて表示する Windows 用の補助アプリです。
クリックは後ろの窓に通り抜けるので、ゲームや作業のじゃまになりません。

## 使い方
1. `YomiFrostSubtitle_v2.7.1.exe` をダブルクリックで起動(インストール不要)
   - 初回は Windows の「PC を保護しました」が出ることがあります(署名なしのため)。「詳細情報」→「実行」で起動できます
   - 起動するとタスクトレイ(画面右下)に Yomi Frost のアイコンが出ます
2. Yomi Frost Web の「🪟 字幕」タブ →「🧩 補助exe」で **補助exeに字幕を送る** をオン
   - 初回は Chrome が「このデバイス上のアプリへのアクセス」の許可を求めるので「許可」
   - 「🧩 補助exeと接続中(v2.7.0)」と出ればOK
3. 出したい字幕の「出し先」で **🧩 補助exe** にチェック(初期値でオン)

## 位置と大きさ
- 初期は**メインのモニター全体**に、アプリの字幕プレビューと同じ配置で表示します(縦横比を保って拡大)
- **位置とサイズを調整する**:トレイのアイコン → 「位置とサイズを調整する」、または **Ctrl+Alt+Y**
  - 窓に枠と半透明の背景が出るので、ドラッグで移動・端をつかんでサイズ変更 → 「✔ 調整おわり」
  - 調整した位置と大きさは次回も使います。「画面いっぱいに戻す」で元に戻ります
- **表示するモニター**:トレイ → 「表示するモニター」で切り替え
- **字幕を表示する**:トレイのチェックで一時的に隠せます
- 終了はトレイ → 「終了」

## 安全のための制限
- 受け付けるのは **このPCの中(127.0.0.1)からの接続だけ**です
- さらに、接続してよいページを限定しています(初期値:`https://yomi.rider.tokyo`、`https://*.pages.dev`、`http://localhost:*`、`http://127.0.0.1:*`)。
  ほかのサイトからは字幕を出せません
- ポート番号(初期値 50210)と許可するページは、トレイ → 「設定ファイルを開く」の `config.json` で変えられます(変えたら補助exeを起動し直してね。ポートを変えたらアプリ側のポートも同じに)

## GitHub で exe を作る(自分でビルドする場合)
このフォルダの中身を GitHub のリポジトリに置くと、GitHub Actions が Windows 用の exe を自動で作ります。

1. GitHub で新しいリポジトリを作る(例: `yomi-frost-subtitle`。Private でもOK)
2. リポジトリのページで「Add file → Upload files」を開き、**このzipを展開した中身を全部**ドラッグ&ドロップ → 「Commit changes」
   - `.github` フォルダ(中の `workflows/build.yml`)も必ず入れてください。エクスプローラーで見えない時は「表示 → 隠しファイル」をオン
   - アップロード画面でフォルダごとドロップすると、フォルダ構成のまま入ります
3. 「Actions」タブで `build-exe` が動き始めます(5〜10分)。緑のチェックになったら、その実行結果を開いて下の **Artifacts → YomiFrostSubtitle** をダウンロード(zip の中に exe があります)
4. 公開したい時は、「Releases → Create a new release」でタグを `v2.7.1` などにして公開すると、もう一度ビルドが動いて、exe がそのリリースに自動で添付されます。
   Yomi Frost Web の `config.js` の `exeRepo`(初期値 `compact-git/yomi-frost-subtitle`)にこのリポジトリを指定しておくと、字幕タブの「⬇ 補助exeをダウンロード」ボタンが最新リリースの exe を直接ダウンロードします(リポジトリは Public にしてね)
- `subrender.js` は Yomi Frost Web と同じファイルです。アプリ側で字幕の描き方を変えた時は、これも差し替えてビルドし直してください

## ファイル
- `main.js` 本体(透明・最前面の窓、トレイ、127.0.0.1 の WebSocket サーバー、Ctrl+Alt+Y)
- `preload.js` 窓とのやりとり
- `overlay.html` / `overlay.js` 字幕の表示
- `subrender.js` 字幕の描画(Yomi Frost Web と共通)
- `package.json` 設定(Electron / electron-builder、portable exe)
- `.github/workflows/build.yml` GitHub Actions のビルド手順
- `build/icon.ico`・`build/icon.png`・`tray.png` アイコン

## 仕組みとライセンス
Electron(MIT)と ws(MIT)を使っています。

## 更新履歴
- v2.7.1 ビルド手順を Node.js 24 対応の actions に更新(checkout v5 / setup-node v5 / upload-artifact v6)、.gitignore を追加
- v2.7.0 初版

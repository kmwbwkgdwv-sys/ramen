// ===== Firebase の設定 =====
// このゲーム専用の Firebase プロジェクト（card-shop-d54b1）を使う設定です。
// データはデータベースの ramen/ の下に保存されます（カードショップの tcg/ とは別の場所なので、同じプロジェクトで両方動きます）。
// ※ README.md の「Firebase の設定」にある database.rules.json をデータベースのルールに貼って公開し、
//    Authentication の「匿名」ログインを有効にしてください。
// ウェブ用の apiKey は公開される前提の値です。データを守るのは「データベースのルール」と「匿名ログイン」です。
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCk8X7zjwzlxWP7N8eykqRpYgOu1s81smg',
  authDomain: 'card-shop-d54b1.firebaseapp.com',
  databaseURL: 'https://card-shop-d54b1-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'card-shop-d54b1',
};

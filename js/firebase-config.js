// ===== Firebase の設定 =====
// このゲーム専用の Firebase プロジェクト（ramen-f90aa）を使う設定です。データはデータベースの ramen/ の下に保存されます。
// ※ README.md の「Firebase の設定」にある database.rules.json をデータベースのルールに貼って公開し、
//    Authentication の「匿名」ログインを有効にしてください。
// ウェブ用の apiKey は公開される前提の値です。データを守るのは「データベースのルール」と「匿名ログイン」です。
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBypPjs7p70V5Jk0cRn4LVMr41mAvhtTwc',
  authDomain: 'ramen-f90aa.firebaseapp.com',
  databaseURL: 'https://ramen-f90aa-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'ramen-f90aa',
};

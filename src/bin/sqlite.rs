use indicatif::{ProgressBar, ProgressStyle};
use rusqlite::{Connection, params};
use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::time::Instant;

fn main() {
    let start_time = Instant::now();

    let db_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("resources")
        .join("wo.db");

    let txt_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("resources")
        .join("wo.txt");

    println!("データベースに接続しています...");
    let mut conn = Connection::open(&db_path).expect("データベースを開けませんでした");

    // 高速化のためのPRAGMA設定 (インメモリーキャッシュなどを拡張して爆速化)
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA cache_size = -256000;
         PRAGMA temp_store = MEMORY;",
    )
    .expect("PRAGMAの設定に失敗しました");

    // 毎回テーブルを初期化して完全上書きにする
    println!("テーブルを初期化しています...");
    conn.execute_batch(
        "DROP TABLE IF EXISTS wo;
         DROP TABLE IF EXISTS noun;
         DROP TABLE IF EXISTS verb;
         DROP TABLE IF EXISTS sentence;
         CREATE TABLE wo (noun TEXT, verb TEXT, count INTEGER DEFAULT 1, PRIMARY KEY(noun, verb)) WITHOUT ROWID;
         CREATE INDEX idx_wo_verb ON wo(verb);
         CREATE TABLE noun (word TEXT PRIMARY KEY);
         CREATE TABLE verb (word TEXT PRIMARY KEY);
         CREATE TABLE sentence (noun TEXT, verb TEXT, PRIMARY KEY(noun, verb));",
    )
    .expect("テーブルの初期化に失敗しました");

    let metadata =
        fs::metadata(&txt_path).expect("wo.txtが見つかりません。先に抽出処理を実行してください。");
    let file = File::open(&txt_path).expect("wo.txtが開けませんでした");
    let mut reader = BufReader::new(file);

    // 今回はファイルサイズ（バイト数）ベースで進捗バーを表示します
    let pb = ProgressBar::new(metadata.len());
    pb.set_style(
        ProgressStyle::default_bar()
            .template("[{elapsed_precise}] [{bar:40.cyan/blue}] {bytes}/{total_bytes} ({percent}%) ETA: {eta}")
            .unwrap()
            .progress_chars("#>-"),
    );

    let mut total_processed = 0;
    let mut bytes_since_last_update = 0;

    println!("データのインポートを開始します...");

    // SQLiteのトランザクションを開始 (957万件を一括で処理)
    let mut tx = conn
        .transaction()
        .expect("トランザクションの開始に失敗しました");

    {
        // テスト・開発用のダミーデータをお気に入りテーブルに挿入
        println!("ダミーデータを挿入しています...");

        let dummy_nouns = ["太陽", "ギターソロ", "パラパラ漫画"];
        for noun in dummy_nouns.iter() {
            tx.execute("INSERT INTO noun (word) VALUES (?)", params![noun])
                .expect("名詞のダミーデータ挿入に失敗しました");
        }

        let dummy_verbs = ["くぐる", "聴く", "張り込む"];
        for verb in dummy_verbs.iter() {
            tx.execute("INSERT INTO verb (word) VALUES (?)", params![verb])
                .expect("動詞のダミーデータ挿入に失敗しました");
        }

        let dummy_sentences = [
            ("太陽", "張り込む"),
            ("ギターソロ", "くぐる"),
            ("パラパラ漫画", "聴く"),
        ];
        for (noun, verb) in dummy_sentences.iter() {
            tx.execute(
                "INSERT INTO sentence (noun, verb) VALUES (?, ?)",
                params![noun, verb],
            )
            .expect("例文のダミーデータ挿入に失敗しました");
        }

        // UPSERT用のプリペアドステートメント
        // すでに存在する組み合わせなら count を +1 する
        let mut stmt = tx.prepare_cached(
            "INSERT INTO wo (noun, verb, count) VALUES (?1, ?2, 1) ON CONFLICT(noun, verb) DO UPDATE SET count = count + 1"
        ).expect("ステートメントの準備に失敗しました");

        let mut line = String::new();
        loop {
            line.clear();
            let bytes_read = reader
                .read_line(&mut line)
                .expect("行の読み込みに失敗しました");
            if bytes_read == 0 {
                break; // EOF
            }

            bytes_since_last_update += bytes_read;

            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }

            // "名詞, 動詞" で分割
            if let Some((noun, verb)) = trimmed.split_once(", ") {
                stmt.execute(params![noun, verb])
                    .expect("データの挿入に失敗しました");
                total_processed += 1;

                // 1万行ごとに進捗バーを更新してオーバーヘッドを減らす
                if total_processed % 10000 == 0 {
                    pb.inc(bytes_since_last_update as u64);
                    bytes_since_last_update = 0;
                }
            }
        }

        // 残りのバイト数を進捗に反映
        if bytes_since_last_update > 0 {
            pb.inc(bytes_since_last_update as u64);
        }
    }

    pb.finish_with_message("データの読み込みが完了しました！");

    println!("データベースに書き込み(コミット)しています... (少し時間がかかります)");
    tx.commit().expect("コミットに失敗しました");

    // WALファイルをメインのDBファイルに統合して削除し、単一のファイルにする
    println!("WALファイルをクリーンアップしています...");
    conn.execute_batch(
        "PRAGMA wal_checkpoint(TRUNCATE);
         PRAGMA journal_mode = DELETE;",
    )
    .expect("WALのクリーンアップに失敗しました");

    // 明示的に接続を閉じる
    conn.close().expect("データベースのクローズに失敗しました");

    // -shm などの残骸ファイルが残ることがあるため、明示的に削除する
    let shm_path = db_path.with_extension("db-shm");
    let wal_path = db_path.with_extension("db-wal");
    let _ = fs::remove_file(shm_path);
    let _ = fs::remove_file(wal_path);

    println!("すべての処理が完了しました！");
    println!("合計処理行数: {} 行", total_processed);
    println!("合計処理時間: {:?}", start_time.elapsed());
}

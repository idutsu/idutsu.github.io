use std::env;
use std::fs::File;
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};

use indicatif::{ProgressBar, ProgressStyle};
use memmap2::Mmap;
use rayon::prelude::*;
use sudachi::analysis::stateful_tokenizer::StatefulTokenizer as Tokenizer;
use sudachi::config::Config;
use sudachi::dic::dictionary::JapaneseDictionary;
use sudachi::prelude::*;

struct ThreadState<'a> {
    tokenizer: Tokenizer<&'a JapaneseDictionary>,
    morphemes: MorphemeList<&'a JapaneseDictionary>,
    local_buffer: String,
    sender: std::sync::mpsc::SyncSender<String>,
    processed_lines: u64,
    pb: ProgressBar,
}

impl<'a> Drop for ThreadState<'a> {
    fn drop(&mut self) {
        if !self.local_buffer.is_empty() {
            let buf_to_send = std::mem::take(&mut self.local_buffer);
            let _ = self.sender.send(buf_to_send);
        }
        if self.processed_lines > 0 {
            self.pb.inc(self.processed_lines);
        }
    }
}

fn main() {
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let file_path = PathBuf::from(manifest_dir)
        .join("resources")
        .join("wiki.txt");

    println!("辞書を読み込んでいます...");
    let dict_path = PathBuf::from(manifest_dir)
        .join("resources")
        .join("system_full.dic");
    let config = Config::new(None, None, Some(dict_path)).expect("Configの作成に失敗しました");
    let dictionary = JapaneseDictionary::from_cfg(&config).expect("辞書の読み込みに失敗しました");

    println!("ファイルを読み込んでいます: {}", file_path.display());
    let file = File::open(&file_path).expect("ファイルが開けませんでした");
    let mmap = unsafe { Mmap::map(&file).expect("メモリマップに失敗しました") };
    let content = std::str::from_utf8(&mmap).expect("ファイルが正しいUTF-8ではありません");

    // 全体の行数を高速にカウントする
    println!("全体の行数を計算しています... (超高速)");
    let total_lines = memchr::memchr_iter(b'\n', content.as_bytes()).count() as u64;

    let finder_wo = memchr::memmem::Finder::new("を".as_bytes());

    println!("全 {} 行の解析を開始します...", total_lines);
    let start_time = std::time::Instant::now();

    // 進捗バーの設定
    let pb = ProgressBar::new(total_lines);
    pb.set_style(
        ProgressStyle::default_bar()
            .template(
                "[{elapsed_precise}] [{bar:40.cyan/blue}] {pos}/{len} 行 ({percent}%) ETA: {eta}",
            )
            .unwrap()
            .progress_chars("#>-"),
    );

    // 1スレッドあたり約64KBのバッファでテキストを転送
    let (tx, rx) = std::sync::mpsc::sync_channel::<String>(100);

    let out_path = PathBuf::from(manifest_dir).join("resources").join("wo.txt");
    let writer_thread = std::thread::spawn(move || {
        let out_file = File::create(&out_path).expect("出力ファイルを作成できませんでした");
        let mut writer = BufWriter::new(out_file);
        for chunk in rx {
            writer.write_all(chunk.as_bytes()).unwrap();
        }
        writer.flush().unwrap();
    });

    content.par_lines().for_each_init(
        || ThreadState {
            tokenizer: Tokenizer::new(&dictionary, Mode::C),
            morphemes: MorphemeList::empty(&dictionary),
            local_buffer: String::with_capacity(65536),
            sender: tx.clone(),
            processed_lines: 0,
            pb: pb.clone(),
        },
        |state, line| {
            state.processed_lines += 1;

            // 1万行ごとに進捗バーを更新 (頻繁な更新による排他ロックの渋滞を防ぐため)
            if state.processed_lines >= 10000 {
                state.pb.inc(state.processed_lines);
                state.processed_lines = 0;
            }

            if finder_wo.find(line.as_bytes()).is_none() {
                return;
            }

            state.tokenizer.reset().push_str(line);
            if state.tokenizer.do_tokenize().is_ok()
                && state
                    .morphemes
                    .collect_results(&mut state.tokenizer)
                    .is_ok()
            {
                let len = state.morphemes.len();

                for i in 0..len.saturating_sub(2) {
                    let m1 = state.morphemes.get(i);
                    let m2 = state.morphemes.get(i + 1);
                    let m3 = state.morphemes.get(i + 2);

                    if &*m2.surface() == "を" && m2.part_of_speech()[0] == "助詞" {
                        let p1 = m1.part_of_speech();
                        let p3 = m3.part_of_speech();

                        let is_sahen = p3.iter().any(|s| s == "サ変可能");

                        if p1[0] == "名詞" && (p3[0] == "動詞" || is_sahen) {
                            let surface_str = &*m1.surface();
                            let is_koto = surface_str == "こと" || surface_str == "事";
                            let has_number = surface_str
                                .chars()
                                .any(|c| c.is_ascii_digit() || ('０'..='９').contains(&c));
                            let is_only_alphabets = surface_str.chars().all(|c| {
                                let is_japanese = ('\u{3040}'..='\u{309F}').contains(&c) // Hiragana
                                    || ('\u{30A0}'..='\u{30FF}').contains(&c) // Katakana
                                    || ('\u{4E00}'..='\u{9FFF}').contains(&c) // Kanji
                                    || ('\u{3400}'..='\u{4DBF}').contains(&c) // Kanji Ext A
                                    || ('\u{20000}'..='\u{2A6DF}').contains(&c); // Kanji Ext B-F

                                (c.is_alphabetic() && !is_japanese)
                                    || c.is_whitespace()
                                    || c.is_ascii_punctuation()
                            });
                            let is_only_symbols = surface_str.chars().all(|c| !c.is_alphanumeric());
                            let is_valid_noun =
                                !is_koto && !has_number && !is_only_alphabets && !is_only_symbols;

                            if is_valid_noun {
                                let verb_dict_form = &*m3.dictionary_form();
                                let is_suru = verb_dict_form == "する";

                                if !is_suru {
                                    let norm_noun = m1.normalized_form();
                                    let norm_verb = m3.normalized_form();

                                    state.local_buffer.push_str(norm_noun);
                                    state.local_buffer.push_str(", ");
                                    state.local_buffer.push_str(norm_verb);
                                    if p3[0] != "動詞" && is_sahen {
                                        state.local_buffer.push_str("する");
                                    }
                                    state.local_buffer.push('\n');
                                }
                            }
                        }
                    }
                }
            }

            // バッファが一定サイズになったら非同期で送信
            if state.local_buffer.len() >= 60000 {
                let buf_to_send = std::mem::take(&mut state.local_buffer);
                state.sender.send(buf_to_send).unwrap();
                state.local_buffer.reserve(65536); // 再びメモリを確保
            }
        },
    );

    drop(tx); // 全ての送信機を閉じる
    writer_thread.join().unwrap(); // 書き込み完了を待つ

    pb.finish_with_message("完了しました！");

    println!("すべての処理が完了しました！ wo.txt を確認してください。");
    println!("合計処理時間: {:?}", start_time.elapsed());
}

import sqlite3InitModule from "@sqlite.org/sqlite-wasm";

const dbExecute = {
    init: (db, { limit, nounValue, verbValue } = {}) => {
        if (nounValue && verbValue) {
            dbExecute.saveSentence(db, { noun: nounValue, verb: verbValue });
        } else if (nounValue) {
            dbExecute.saveWord(db, { type: "noun", word: nounValue });
        } else if (verbValue) {
            dbExecute.saveWord(db, { type: "verb", word: verbValue });
        }
        return {
            sentencesExample: dbExecute.getItems(db, { type: "sentence_example", limit }),
            nounsFavorite: dbExecute.getItems(db, { type: "noun_favorite" }),
            verbsFavorite: dbExecute.getItems(db, { type: "verb_favorite" }),
            sentencesFavorite: dbExecute.getItems(db, { type: "sentence_favorite" }),
            generateSentences: dbExecute.generateSentences(db, { limit }),
        };
    },
    getItems: (db, { type, limit } = {}) => {
        let items;
        switch (type) {
            case "sentence_example":
                items = db.selectArrays("SELECT noun, verb FROM wo ORDER BY RANDOM() LIMIT " + limit);
                break;
            case "noun_favorite":
                items = db.selectArrays("SELECT word FROM noun ORDER BY ROWID DESC");
                break;
            case "verb_favorite":
                items = db.selectArrays("SELECT word FROM verb ORDER BY ROWID DESC");
                break;
            case "sentence_favorite":
                items = db.selectArrays("SELECT noun, verb FROM sentence ORDER BY ROWID DESC");
                break;
            default:
                throw new Error(`不正なテーブルです： ${type}`);
        }
        return { type, items };
    },
    saveSentence: (db, { noun, verb }) => {
        db.exec("INSERT OR IGNORE INTO sentence (noun, verb) VALUES (?, ?)", {
            bind: [noun, verb],
        });
        return { type: "sentence_favorite", noun, verb };
    },
    saveWord: (db, { type, word }) => {
        db.exec(`INSERT OR IGNORE INTO ${type} (word) VALUES (?)`, {
            bind: [word],
        });
        return { type: `${type}_favorite`, word };
    },
    deleteSentence: (db, { noun, verb }) => {
        db.exec("DELETE FROM sentence WHERE noun = ? AND verb = ?", {
            bind: [noun, verb],
        });
        return { type: "sentence_favorite", noun, verb };
    },
    deleteWord: (db, { type, word }) => {
        db.exec(`DELETE FROM ${type} WHERE word = ?`, {
            bind: [word],
        });
        return { type: `${type}_favorite`, word };
    },
    generateSentences: (db, { limit } = {}) => {
        const items = db.selectArrays(
            "SELECT n.word, v.word FROM noun n CROSS JOIN verb v ORDER BY RANDOM() LIMIT " + limit,
        );
        return { items };
    },
    generateSentencesWithWord: (db, { fixedTable, targetTable, fixedWord } = {}) => {
        const isFixedNoun = fixedTable === "noun";
        const rotateColumn = "word";
        const rotateQuery = targetTable === "verb" ? "SELECT word FROM verb" : "SELECT word FROM noun";
        const items = db.selectArrays(
            `SELECT ${isFixedNoun ? `?, ${rotateColumn}` : `${rotateColumn}, ?`} FROM (${rotateQuery})`,
            [fixedWord],
        );
        return { items, fixedTable, targetTable, fixedWord };
    },
};

const start = async (sqlite3) => {
    const filename = "wo.db";
    try {
        const root = await navigator.storage.getDirectory();

        let needsDownload = true;

        console.log("データベースの存在を確認します");
        try {
            const fileHandle = await root.getFileHandle(filename);
            const file = await fileHandle.getFile();
            if (file.size > 0) {
                console.log("データベースは存在しました");
                needsDownload = false;
            }
        } catch (e) {
            if (e.name !== "NotFoundError") {
                console.warn("データベースの確認中にエラーが発生しました：", e);
            }
        }

        const DB_URL = "https://github.com/idutsu/idutsu.github.io/releases/download/v1.0.0/wo.db";

        if (needsDownload) {
            console.log("データベースは存在しませんでした");
            console.log("データベースをダウンロードします");
            const response = await fetch(DB_URL);
            if (!response.ok) throw new Error("データベースのダウンロードに失敗しました");
            const buffer = await response.arrayBuffer();
            const fileHandle = await root.getFileHandle(filename, { create: true });
            const accessHandle = await fileHandle.createSyncAccessHandle();
            accessHandle.truncate(0);
            accessHandle.write(new Uint8Array(buffer));
            accessHandle.flush();
            accessHandle.close();
        }
        const db = new sqlite3.oo1.OpfsDb("/" + filename);
        console.log("データベースに接続しました");

        postMessage({ type: "ready" });

        self.onmessage = async (e) => {
            const { action, payload } = e.data;
            const method = dbExecute[action];
            if (method) {
                try {
                    const result = method(db, payload);
                    postMessage({ type: `${action}_result`, result });
                } catch (err) {
                    postMessage({ type: "error", error: err.message });
                }
            }
        };
    } catch (err) {
        console.error("Workerにエラーが発生しました：", err.message);
        postMessage({ type: "error", error: err.message });
    }
};

const initializeSQLite = async () => {
    const sqlite3 = await sqlite3InitModule({
        print: console.log,
        printErr: console.error,
    });
    await start(sqlite3);
};

initializeSQLite();

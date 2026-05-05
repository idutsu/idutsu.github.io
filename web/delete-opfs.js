(async () => {
    const root = await navigator.storage.getDirectory();

    // OPFSのルートディレクトリの中身を順番に全て削除する
    for await (const name of root.keys()) {
        await root.removeEntry(name, { recursive: true });
        console.log(`削除完了: ${name}`);
    }

    console.log("OPFSのデータをすべて削除しました！ページをリロードしてください。");
})();

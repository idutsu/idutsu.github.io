(async () => {
    const root = await navigator.storage.getDirectory();
    for await (const name of root.keys()) {
        await root.removeEntry(name, { recursive: true });
        console.log(`OPFSの ${name}　を削除しました`);
    }
    console.log("OPFSのデータをすべて削除しました");
})();

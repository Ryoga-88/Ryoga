const SAVE_BATCH_SIZE = 60;

// Only acknowledged batches leave the selection; a later failure can be retried.
export async function saveSelection(ids, status, { request = fetch, onSaved, onProgress } = {}) {
  let completedCount = 0;

  try {
    for (let offset = 0; offset < ids.length; offset += SAVE_BATCH_SIZE) {
      const batch = ids.slice(offset, offset + SAVE_BATCH_SIZE);
      await onProgress?.(completedCount, ids.length);
      const response = await request("/api/photo-curation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: batch, status }),
      });
      let result;
      try {
        result = await response.json();
      } catch {
        throw new Error("保存結果を受信できませんでした。再読み込みして状態を確認してください。");
      }
      if (!response.ok || result?.ok !== true) {
        throw new Error(result?.error || "保存できませんでした。もう一度お試しください。");
      }
      if (!result.statuses || typeof result.statuses !== "object" || Array.isArray(result.statuses) || batch.some((id) => result.statuses[id] !== status)) {
        throw new Error("保存結果を確認できませんでした。再読み込みして状態を確認してください。");
      }

      completedCount += batch.length;
      await onSaved?.(result, batch);
    }
    return { completedCount };
  } catch (cause) {
    const error = new Error(cause?.message || "通信できませんでした。もう一度お試しください。", { cause });
    error.completedCount = completedCount;
    throw error;
  }
}

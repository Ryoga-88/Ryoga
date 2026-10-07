"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readSelection, SELECTION_KEY, updateSelection } from "./selectionStorage.mjs";

export default function usePhotoSelection(photos) {
  const validIds = useMemo(() => new Set(photos.map((photo) => photo.id)), [photos]);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const currentRef = useRef(new Set());
  const storageFailed = useRef(false);

  const reportError = useCallback(() => {
    storageFailed.current = true;
    setError("チェックをブラウザに保存できません。この画面内では保持されますが、再読み込み前に「掲載」「見送り」で確定してください。");
  }, []);

  useEffect(() => {
    function restore() {
      // Keep unsaved in-memory checks if browser storage has failed.
      if (storageFailed.current) return;
      try {
        const saved = readSelection(window.localStorage, validIds);
        currentRef.current = saved;
        setSelectedIds(saved);
      } catch { reportError(); }
    }
    function onStorage(event) {
      if (event.key === SELECTION_KEY || event.key === null) restore();
    }
    restore();
    setReady(true);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", restore);
    window.addEventListener("pageshow", restore);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", restore);
      window.removeEventListener("pageshow", restore);
    };
  }, [validIds, reportError]);

  const changeSelection = useCallback((updater) => {
    let next = updater(new Set(currentRef.current));
    try {
      if (storageFailed.current) {
        window.localStorage.setItem(SELECTION_KEY, JSON.stringify([...next]));
      } else {
        // Read the latest selection so an inactive tab cannot erase newer checks.
        next = updateSelection(window.localStorage, validIds, updater);
      }
      storageFailed.current = false;
      setError(null);
    } catch { reportError(); }
    currentRef.current = next;
    setSelectedIds(next);
  }, [validIds, reportError]);

  return { selectedIds, changeSelection, selectionReady: ready, selectionError: error };
}

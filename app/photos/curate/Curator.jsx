"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import CountryFlag from "app/components/country-flag";
import { FiArrowLeft, FiArrowRight, FiCheck, FiCheckCircle, FiChevronLeft, FiChevronRight, FiExternalLink, FiImage, FiLoader, FiRotateCcw, FiSearch, FiStar, FiX } from "react-icons/fi";
import usePhotoSelection from "./usePhotoSelection";
import { saveSelection } from "./saveSelection.mjs";
import "./curator.css";

const PAGE_SIZE = 60;
const STATUS_LABELS = { unreviewed: "未選別", included: "掲載対象", excluded: "見送り" };
const number = (value) => Number(value || 0).toLocaleString("ja-JP");

function photoDate(photo) {
  const value = photo.date || photo.capturedAt;
  if (!value) return "撮影日不明";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}/${match[2]}/${match[3]}` : "撮影日不明";
}

function PhotoImage({ photo, preview = false, eager = false }) {
  const [failed, setFailed] = useState(false);
  const source = preview ? photo.previewUrl : photo.thumbnailUrl;
  useEffect(() => setFailed(false), [source]);

  if (photo.available === false || !source || failed) {
    return (
      <span className="curator-image-missing">
        <FiImage aria-hidden="true" />
        <span>{failed ? "プレビューを読み込めません" : "この Mac に写真がありません"}</span>
        <span className="curator-image-missing-note">写真アプリでダウンロードしてから、再読み込みしてください。</span>
      </span>
    );
  }

  return (
    // Local image endpoints serve already-sized previews.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={source}
      alt={`${photo.title}で撮影した写真（${photoDate(photo)}）`}
      loading={preview || eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
      className={preview ? "curator-preview-image" : "curator-card-image"}
    />
  );
}

function StatusBadge({ status = "unreviewed" }) {
  return <span className={`curator-status curator-status--${status}`}>{status === "included" && <FiCheck aria-hidden="true" />}{STATUS_LABELS[status]}</span>;
}

function QualityBadge({ photo }) {
  return photo.status === "included" && photo.highResolutionPending
    ? <span className="curator-status curator-status--quality-pending">高解像度版の取得待ち</span> : null;
}

function PhotoActions({ photo, saving, onSave, compact = false }) {
  const unavailable = photo.available === false;
  return (
    <div className={`curator-photo-actions${compact ? " curator-photo-actions--compact" : ""}`}>
      {photo.status === "included" ? <span className="curator-saved-label"><FiCheckCircle aria-hidden="true" />掲載対象・保存済み</span> : <button type="button" className="curator-action curator-action--include" disabled={saving || unavailable} onClick={() => onSave([photo.id], "included")} title={unavailable ? "写真をダウンロードしてから掲載できます" : undefined}>
        <FiCheck aria-hidden="true" />掲載に決定
      </button>}
      <button type="button" className="curator-action" disabled={saving || photo.status === "excluded"} onClick={() => onSave([photo.id], "excluded")}>
        <FiX aria-hidden="true" />見送り
      </button>
      {photo.status !== "unreviewed" && <button type="button" className="curator-action curator-action--undo" disabled={saving} onClick={() => onSave([photo.id], "unreviewed")} aria-label="未選別に戻す" title="未選別に戻す"><FiRotateCcw aria-hidden="true" /></button>}
    </div>
  );
}

function PhotoPreview({ photos, initialId, saving, notice, onSave, onClose }) {
  // Keep the preview sequence stable even when a decision removes a photo from a filter.
  const [sequence] = useState(() => photos.map((photo) => photo.id));
  const [index, setIndex] = useState(() => Math.max(0, photos.findIndex((photo) => photo.id === initialId)));
  const closeRef = useRef(null);
  const dialogRef = useRef(null);
  const photoMap = useMemo(() => new Map(photos.map((photo) => [photo.id, photo])), [photos]);
  const photo = photoMap.get(sequence[index]);
  const previous = useCallback(() => setIndex((value) => Math.max(0, value - 1)), []);
  const next = useCallback(() => setIndex((value) => Math.min(sequence.length - 1, value + 1)), [sequence.length]);

  useEffect(() => {
    const focusedElement = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (focusedElement?.isConnected) focusedElement.focus();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") { event.preventDefault(); previous(); }
      if (event.key === "ArrowRight") { event.preventDefault(); next(); }
      if (event.key === "Tab") {
        const focusable = [...(dialogRef.current?.querySelectorAll("button:not(:disabled), a[href], [tabindex='0']") || [])];
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [next, onClose, previous]);

  if (!photo) return null;

  return (
    <div className="curator-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="curator-modal" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="curator-preview-title">
        <header className="curator-modal-header">
          <div><h2 id="curator-preview-title">{photo.title}<span>{photoDate(photo)}</span></h2><p>{number(index + 1)} / {number(sequence.length)}</p></div>
          <button type="button" className="curator-icon-button" onClick={onClose} aria-label="プレビューを閉じる" ref={closeRef}><FiX aria-hidden="true" /></button>
        </header>
        <div className="curator-preview-stage">
          <PhotoImage key={photo.id} photo={photo} preview />
          <button type="button" className="curator-preview-arrow curator-preview-arrow--previous" disabled={index === 0} onClick={previous} aria-label="前の写真"><FiChevronLeft aria-hidden="true" /></button>
          <button type="button" className="curator-preview-arrow curator-preview-arrow--next" disabled={index === sequence.length - 1} onClick={next} aria-label="次の写真"><FiChevronRight aria-hidden="true" /></button>
        </div>
        <footer className="curator-modal-footer"><StatusBadge status={photo.status} /><QualityBadge photo={photo} /><PhotoActions photo={photo} saving={saving} onSave={onSave} /><span className="curator-keyboard-hint">← → で移動 · Esc で閉じる</span>{notice && <div className={`curator-notice curator-notice--${notice.type}`} role={notice.type === "error" ? "alert" : "status"} aria-live="polite">{notice.type === "saving" && <FiLoader className="curator-spinner" aria-hidden="true" />}<span>{notice.message}</span></div>}</footer>
      </section>
    </div>
  );
}

export default function Curator({ initialData }) {
  const [photos, setPhotos] = useState(() => (initialData.photos || []).map((photo) => ({ ...photo, status: photo.status || "unreviewed" })));
  const [publishedCount, setPublishedCount] = useState(initialData.publishedCount || 0);
  const [country, setCountry] = useState("all");
  const [status, setStatus] = useState("unreviewed");
  const [sort, setSort] = useState("newest");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { selectedIds, changeSelection, selectionReady, selectionError } = usePhotoSelection(initialData.photos);
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const [notice, setNotice] = useState(null);
  const [preview, setPreview] = useState(null);
  const savingRef = useRef(false);
  const saving = pendingIds.size > 0;

  const countries = useMemo(() => {
    const counts = new Map();
    for (const photo of photos) {
      const code = photo.countryCode || photo.category;
      const current = counts.get(code) || { code, label: photo.title || code, count: 0 };
      current.count += 1;
      counts.set(code, current);
    }
    return [...counts.values()].sort((a, b) => b.count - a.count);
  }, [photos]);

  const countryPhotos = useMemo(() => photos.filter((photo) => country === "all" || (photo.countryCode || photo.category) === country), [photos, country]);
  const statusCounts = useMemo(() => countryPhotos.reduce((counts, photo) => { counts[photo.status] += 1; return counts; }, { unreviewed: 0, included: 0, excluded: 0 }), [countryPhotos]);
  const includedCount = useMemo(() => photos.filter((photo) => photo.status === "included").length, [photos]);
  const filteredPhotos = useMemo(() => {
    const query = search.trim().toLowerCase().replaceAll("/", "-");
    return countryPhotos.filter((photo) => (status === "all" || (status === "selected" ? selectedIds.has(photo.id) : photo.status === status)) && (!query || `${photo.title} ${photo.category} ${photo.date || ""} ${photo.capturedAt || ""}`.toLowerCase().includes(query)))
      .sort((a, b) => {
        const dateA = a.capturedAt || a.date || "";
        const dateB = b.capturedAt || b.date || "";
        const result = dateA.localeCompare(dateB) || a.id.localeCompare(b.id);
        return sort === "newest" ? -result : result;
      });
  }, [countryPhotos, status, search, sort, selectedIds]);

  const totalPages = Math.max(1, Math.ceil(filteredPhotos.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visiblePhotos = filteredPhotos.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const allPageSelected = visiblePhotos.length > 0 && visiblePhotos.every((photo) => selectedIds.has(photo.id));
  const hiddenSelectedCount = selectedIds.size - visiblePhotos.filter((photo) => selectedIds.has(photo.id)).length;
  const selectedPhotos = photos.filter((photo) => selectedIds.has(photo.id));
  const canPublishSelected = selectedPhotos.length > 0 && selectedPhotos.every((photo) => photo.available !== false);
  const previewPhotos = useMemo(() => {
    if (!preview) return [];
    const lookup = new Map(photos.map((photo) => [photo.id, photo]));
    return preview.ids.map((id) => lookup.get(id)).filter(Boolean);
  }, [photos, preview]);
  const closePreview = useCallback(() => setPreview(null), []);

  useEffect(() => { setPage(1); }, [country, status, search, sort]);
  useEffect(() => { setPage((value) => Math.min(value, totalPages)); }, [totalPages]);

  const save = useCallback(async (ids, nextStatus) => {
    if (!ids.length || savingRef.current) return;
    savingRef.current = true;
    setPendingIds(new Set(ids));
    try {
      await saveSelection(ids, nextStatus, {
        onProgress: (completed, total) => setNotice({ type: "saving", message: `${number(total)}枚の選別結果を保存しています…（${number(completed)}枚保存済み）` }),
        onSaved: (result, batch) => {
          const savedIds = new Set(batch);
          setPhotos((current) => current.map((photo) => savedIds.has(photo.id) ? {
            ...photo, status: result.statuses[photo.id], highResolutionPending: Boolean(result.highResolutionPending?.[photo.id]),
          } : photo));
          if (typeof result.publishedCount === "number") setPublishedCount(result.publishedCount);
          changeSelection((current) => new Set([...current].filter((id) => !savedIds.has(id))));
          setPendingIds((current) => new Set([...current].filter((id) => !savedIds.has(id))));
        },
      });
      setNotice({ type: "success", message: `${number(ids.length)}枚を「${STATUS_LABELS[nextStatus]}」にしました。保存済みです。`, showIncluded: nextStatus === "included" });
    } catch (error) {
      const partial = error.completedCount ? `${number(error.completedCount)}枚は保存済みです。残り${number(ids.length - error.completedCount)}枚のチェックは保持しています。` : "";
      setNotice({ type: "error", message: `${partial}${error.message || "通信できませんでした。もう一度お試しください。"}` });
    } finally {
      savingRef.current = false;
      setPendingIds(new Set());
    }
  }, [changeSelection]);

  function toggleSelected(id) {
    changeSelection((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  function togglePageSelected() {
    changeSelection((current) => {
      const next = new Set(current);
      for (const photo of visiblePhotos) { if (allPageSelected) next.delete(photo.id); else next.add(photo.id); }
      return next;
    });
  }

  function changePage(nextPage) {
    setPage(nextPage);
    document.getElementById("curator-results")?.scrollIntoView({ block: "start", behavior: "instant" });
  }

  function showPhotos(nextStatus) {
    setCountry("all");
    setStatus(nextStatus);
    setSearch("");
    setPage(1);
  }

  return (
    <div className="curator">
      <header className="curator-header">
        <div><Link href="/photos" className="curator-back"><FiArrowLeft aria-hidden="true" />Photos</Link><h1>掲載する写真を選ぶ</h1><p>載せたい写真にチェックして「掲載に決定」を押してください。</p><p>チェックも確定した選別結果も保存され、ページ移動や再読み込み後も残ります。</p></div>
        <a href="/photos" target="_blank" rel="noreferrer" className="curator-preview-link">掲載プレビュー<FiExternalLink aria-hidden="true" /></a>
      </header>

      <div className="curator-overview">
        <span>候補 <strong>{number(photos.length)}</strong> 枚</span>
        <button type="button" className="curator-overview-action" onClick={() => showPhotos("selected")} aria-label={`チェック中の${number(selectedIds.size)}枚を見る`}>チェック中 <strong>{number(selectedIds.size)}</strong> 枚<FiArrowRight aria-hidden="true" /></button>
        <button type="button" className="curator-overview-action curator-overview-action--included" onClick={() => showPhotos("included")} aria-label={`掲載対象の${number(includedCount)}枚を見る`}><FiCheckCircle aria-hidden="true" />掲載対象 <strong>{number(includedCount)}</strong> 枚を見る<FiArrowRight aria-hidden="true" /></button>
        <span>プレビュー合計 <strong>{number(publishedCount)}</strong> 枚</span>
      </div>
      <p className="curator-flow-note">「掲載対象」は掲載すると決めて保存した写真です。公開ブログへの反映はデプロイ後です。掲載対象だけの一覧を「掲載プレビュー」で確認できます。</p>

      <section className="curator-filters" aria-label="写真の絞り込み">
        <div className="curator-filter-heading">国<span>中国・スペイン・アルバニアを除く</span></div>
        <div className="curator-countries" aria-label="国" role="group">
          <button type="button" aria-pressed={country === "all"} onClick={() => setCountry("all")}>すべて<span>{number(photos.length)}</span></button>
          {countries.map((item) => <button type="button" key={item.code} aria-pressed={country === item.code} onClick={() => setCountry(item.code)}><CountryFlag category={item.code} />{item.label}<span>{number(item.count)}</span></button>)}
        </div>
        <div className="curator-filter-bottom">
          <div className="curator-status-filters" role="group" aria-label="選別状態">
            {["unreviewed", "selected", "included", "excluded", "all"].map((value) => <button type="button" key={value} aria-pressed={status === value} onClick={() => setStatus(value)}>{value === "all" ? "すべて" : value === "selected" ? "チェック中" : STATUS_LABELS[value]}<span>{number(value === "all" ? countryPhotos.length : value === "selected" ? countryPhotos.filter((photo) => selectedIds.has(photo.id)).length : statusCounts[value])}</span></button>)}
          </div>
          <div className="curator-search-sort"><label className="curator-search"><FiSearch aria-hidden="true" /><span className="sr-only">国名・撮影日で検索</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="国名・撮影日で検索" /></label><label><span className="sr-only">並び順</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">新しい順</option><option value="oldest">古い順</option></select></label></div>
        </div>
      </section>

      <div className={`curator-notice${notice ? ` curator-notice--${notice.type}` : ""}`} role={notice?.type === "error" ? "alert" : "status"} aria-live="polite">
        {notice ? <>{notice.type === "saving" ? <FiLoader className="curator-spinner" aria-hidden="true" /> : notice.type === "success" ? <FiCheckCircle aria-hidden="true" /> : <FiImage aria-hidden="true" />}<span>{notice.message}</span></> : <><FiCheckCircle aria-hidden="true" /><span>写真を開いて確認するか、このページの写真にチェックを付けてまとめて選別できます。</span></>}
        {notice?.showIncluded && <button type="button" className="curator-notice-link" onClick={() => showPhotos("included")}>掲載対象を見る<FiArrowRight aria-hidden="true" /></button>}
      </div>

      {selectionError && <p className="curator-notice curator-notice--error" role="alert">{selectionError}</p>}

      <div id="curator-results" className="curator-results-bar">
        <label className="curator-page-check"><input type="checkbox" checked={allPageSelected} onChange={togglePageSelected} disabled={!selectionReady || !visiblePhotos.length || saving} /><span>このページを選択</span></label>
        <span>{filteredPhotos.length ? `${number((currentPage - 1) * PAGE_SIZE + 1)}–${number(Math.min(currentPage * PAGE_SIZE, filteredPhotos.length))} / ${number(filteredPhotos.length)}枚` : "0枚"}</span>
      </div>

      {selectedIds.size > 0 && <div className="curator-bulk-bar" aria-label="選択した写真への操作">
        <div className="curator-bulk-summary"><strong>チェック中 {number(selectedIds.size)}枚</strong><small>{hiddenSelectedCount > 0 ? `うち${number(hiddenSelectedCount)}枚は現在の一覧の外にあります` : "チェックした写真をまとめて確定"}</small></div>
        <button type="button" className="curator-action curator-action--include curator-publish-selected" disabled={saving || !canPublishSelected} onClick={() => save([...selectedIds], "included")}><FiCheckCircle aria-hidden="true" />{saving ? "保存中…" : `選んだ${number(selectedIds.size)}枚を掲載に決定`}</button>
        <div className="curator-bulk-secondary">
          <button type="button" className="curator-action" disabled={saving} onClick={() => save([...selectedIds], "excluded")}><FiX aria-hidden="true" />見送り</button>
          <button type="button" className="curator-action" disabled={saving} onClick={() => save([...selectedIds], "unreviewed")}><FiRotateCcw aria-hidden="true" />未選別に戻す</button>
          <button type="button" className="curator-selection-clear" onClick={() => changeSelection(() => new Set())} disabled={saving}>チェックを全解除</button>
        </div>
        <span className="curator-bulk-note">全ページのチェックが対象です。「掲載に決定」で保存した写真は「掲載対象」から確認できます。</span>
        {!canPublishSelected && <span className="curator-bulk-note">この Mac にない写真が含まれています</span>}
      </div>}

      {visiblePhotos.length ? <div className="curator-grid" aria-busy={saving}>
        {visiblePhotos.map((photo, index) => <article key={photo.id} className={`curator-card curator-card--${photo.status}${selectedIds.has(photo.id) ? " curator-card--selected" : ""}`}>
          <div className="curator-card-visual">
            <button type="button" className="curator-open-photo" onClick={() => setPreview({ initialId: photo.id, ids: filteredPhotos.map((item) => item.id) })} aria-label={`${photo.title}、${photoDate(photo)}の写真を開く`}><PhotoImage photo={photo} eager={index < 8} /></button>
            <label className="curator-card-check"><input type="checkbox" checked={selectedIds.has(photo.id)} onChange={() => toggleSelected(photo.id)} disabled={!selectionReady || saving} aria-label={`${photo.title}、${photoDate(photo)}の写真を選択`} /></label>
            {photo.favorite && <span className="curator-favorite" title="写真アプリのお気に入り"><FiStar aria-hidden="true" /><span className="sr-only">お気に入り</span></span>}
            <div className="curator-card-labels">
              {photo.status === "included" && <span className="curator-status curator-status--included"><FiCheckCircle aria-hidden="true" />掲載対象・保存済み</span>}
              {selectedIds.has(photo.id) && <span className="curator-status curator-status--selected"><FiCheck aria-hidden="true" />チェック中</span>}
            </div>
            {pendingIds.has(photo.id) && <span className="curator-card-saving"><FiLoader className="curator-spinner" aria-hidden="true" />保存中</span>}
          </div>
          <div className="curator-card-details"><div className="curator-card-meta"><div><h2>{photo.title}</h2><p>{photoDate(photo)}</p></div><StatusBadge status={photo.status} /></div><QualityBadge photo={photo} /><PhotoActions photo={photo} saving={saving} onSave={save} compact /></div>
        </article>)}
      </div> : <div className="curator-empty"><FiImage aria-hidden="true" /><h2>{status === "selected" ? "この条件でチェック中の写真はありません" : status === "included" ? "この条件の掲載対象はありません" : status === "unreviewed" && !search ? "この条件の写真は選別済みです" : "条件に合う写真がありません"}</h2><p>国や選別状態を切り替えて、ほかの写真を確認できます。</p><button type="button" className="curator-action" onClick={() => showPhotos("all")}>すべての候補を見る</button></div>}

      {totalPages > 1 && <nav className="curator-pagination" aria-label="写真一覧のページ"><button type="button" disabled={currentPage === 1} onClick={() => changePage(currentPage - 1)}><FiArrowLeft aria-hidden="true" />前へ</button><label><span className="sr-only">ページ</span><select value={currentPage} onChange={(event) => changePage(Number(event.target.value))}>{Array.from({ length: totalPages }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} / {totalPages} ページ</option>)}</select></label><button type="button" disabled={currentPage === totalPages} onClick={() => changePage(currentPage + 1)}>次へ<FiArrowRight aria-hidden="true" /></button></nav>}

      {preview && <PhotoPreview key={preview.initialId} photos={previewPhotos} initialId={preview.initialId} saving={saving} notice={notice} onSave={save} onClose={closePreview} />}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";

const MIN_SCALE = 0.6;
const MAX_SCALE = 2.4;
const SCALE_STEP = 0.15;
const PDFJS_SRC = "/ide/pdf.mjs";
const WORKER_SRC = "/ide/pdf.worker.min.mjs";

async function loadPdfjs() {
  const pdfjs = await import(PDFJS_SRC);
  pdfjs.GlobalWorkerOptions.workerSrc = WORKER_SRC;
  return pdfjs;
}

function loadDocument(pdfjs, data, disableWorker = false) {
  return pdfjs.getDocument({ data, disableWorker }).promise;
}

async function readPdfBytes(src) {
  const response = await fetch(src);
  if (!response.ok && !String(src).startsWith("blob:")) {
    throw new Error(`PDF fetch failed (${response.status})`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

function clampScale(value) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(value.toFixed(2))));
}

function blobUrl(url) {
  return String(url || "").split("#")[0];
}

export default function DesktopPdfPreview({
  url,
  version = 0,
  stale = false,
  syncTarget = null,
  onInverseSync,
  onHide,
  onClose,
}) {
  const [doc, setDoc] = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(url));

  useEffect(() => {
    let cancelled = false;
    let loaded = null;
    const src = blobUrl(url);
    setError("");
    setDoc(null);
    setPageCount(0);
    setPageNumber(1);
    setLoading(Boolean(src));
    if (!src) {
      setLoading(false);
      return undefined;
    }
    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        // Bytes are read on the main thread: pdf.js workers cannot fetch
        // blob: URLs (they surface "Unexpected server response (0)").
        const data = await readPdfBytes(src);
        loaded = await loadDocument(pdfjs, data, true);
        if (cancelled) {
          loaded.destroy();
          return;
        }
        setDoc(loaded);
        setPageCount(loaded.numPages);
        setPageNumber(1);
      } catch (cause) {
        if (!cancelled) setError(cause?.message || "PDF 加载失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (loaded) loaded.destroy();
    };
  }, [url, version]);

  useEffect(() => {
    if (!syncTarget?.page || !pageCount) return;
    const next = Math.min(pageCount, Math.max(1, syncTarget.page));
    setPageNumber(next);
  }, [syncTarget, pageCount]);

  return (
    <div className="pdf-preview" data-testid="pdf-preview">
      <div className="pdf-toolbar" data-testid="pdf-toolbar">
        <span>PDF 预览</span>
        <span className="badge">v{version}</span>
        {stale ? (
          <span className="badge stale" data-testid="pdf-stale-badge" title="这是上次成功编译的 PDF，不是本次运行的产物">
            过期
          </span>
        ) : (
          <span className="badge" data-testid="pdf-fresh-badge" title="本次编译写出的 PDF">
            最新
          </span>
        )}
        <button type="button" title="上一页" disabled={pageNumber <= 1} onClick={() => setPageNumber((n) => Math.max(1, n - 1))}>‹</button>
        <span data-testid="pdf-page-label">{pageCount ? `${pageNumber} / ${pageCount}` : "—"}</span>
        <button type="button" title="下一页" disabled={!pageCount || pageNumber >= pageCount} onClick={() => setPageNumber((n) => Math.min(pageCount, n + 1))}>›</button>
        <button type="button" title="缩小" onClick={() => setScale((s) => clampScale(s - SCALE_STEP))}>−</button>
        <span data-testid="pdf-zoom-label">{Math.round(scale * 100)}%</span>
        <button type="button" title="放大" onClick={() => setScale((s) => clampScale(s + SCALE_STEP))}>＋</button>
        <span className="pdf-toolbar-hint">双击 → 源码 · Ctrl+Alt+J 源码 → PDF</span>
        <button type="button" onClick={onHide} title="隐藏预览">–</button>
        <button type="button" onClick={onClose} title="关闭预览">×</button>
      </div>
      {error ? (
        <div className="pdf-preview-status" data-testid="pdf-error">{error}</div>
      ) : loading || !doc ? (
        <div className="pdf-preview-status">{url ? "PDF 渲染中…" : "尚无编译产物"}</div>
      ) : (
        <PdfPage
          doc={doc}
          pageNumber={pageNumber}
          scale={scale}
          syncTarget={syncTarget && syncTarget.page === pageNumber ? syncTarget : null}
          onInverseSync={onInverseSync}
        />
      )}
    </div>
  );
}

function PdfPage({ doc, pageNumber, scale, syncTarget, onInverseSync }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const pageSizeRef = useRef({ wPt: 400, hPt: 200 });

  useEffect(() => {
    if (!syncTarget || !wrapRef.current) return;
    const box = wrapRef.current;
    const yPx = ((syncTarget.y || 0) / pageSizeRef.current.hPt) * box.clientHeight;
    const scroller = box.closest(".pdf-preview-scroll") || box.parentElement;
    if (scroller) {
      const top = box.offsetTop + yPx - scroller.clientHeight / 2;
      scroller.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }
  }, [syncTarget]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;
        const viewport = page.getViewport({ scale });
        const base = page.getViewport({ scale: 1 });
        pageSizeRef.current = { wPt: base.width, hPt: base.height };
        const canvas = canvasRef.current;
        const wrap = wrapRef.current;
        if (!canvas) return;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        if (wrap) {
          wrap.style.width = `${Math.floor(viewport.width)}px`;
          wrap.style.height = `${Math.floor(viewport.height)}px`;
        }
        await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      } catch {
        // A stale page after unmount is non-fatal.
      }
    })();
    return () => { cancelled = true; };
  }, [doc, pageNumber, scale]);

  function onDoubleClick(event) {
    if (!onInverseSync || !wrapRef.current) return;
    const box = wrapRef.current.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * pageSizeRef.current.wPt;
    const y = ((event.clientY - box.top) / box.height) * pageSizeRef.current.hPt;
    onInverseSync({ page: pageNumber, x, y });
  }

  const markerTop = syncTarget?.y != null
    ? `${(syncTarget.y / pageSizeRef.current.hPt) * 100}%`
    : null;

  return (
    <div className="pdf-preview-scroll">
      <div
        ref={wrapRef}
        className="pdf-page"
        data-testid="pdf-page"
        onDoubleClick={onDoubleClick}
      >
        <canvas ref={canvasRef} />
        {markerTop != null ? <div className="pdf-sync-mark" style={{ top: markerTop }} /> : null}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// pdf.js 渲染层（09-integrations 3c/1d 基础）：canvas 逐页渲染 + 文本层
// （可划词）+ 区域标注模式（拖框 → 归一化矩形回调）。SSR 安全：pdfjs-dist
// 仅在浏览器内动态加载，服务端/加载中渲染占位。
export default function PdfViewer({ url, regions = [], onAskSelection, onRegionAnnotate, onInverseSync, syncTarget }) {
  const [doc, setDoc] = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [scale, setScale] = useState(1.1);
  const [error, setError] = useState("");
  const [regionMode, setRegionMode] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let loaded = null;
    (async () => {
      setError("");
      setDoc(null);
      setPageCount(0);
      if (!url || typeof window === "undefined") return;
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        loaded = await pdfjs.getDocument(url).promise;
        if (cancelled) { loaded.destroy(); return; }
        setDoc(loaded);
        setPageCount(loaded.numPages);
      } catch (e) {
        if (!cancelled) setError(e?.message || "PDF 加载失败");
      }
    })();
    return () => {
      cancelled = true;
      if (loaded) loaded.destroy();
    };
  }, [url]);

  function askSelection() {
    const text = String(window.getSelection?.()?.toString() || "").trim();
    if (!text) return;
    onAskSelection?.(text.slice(0, 1200));
  }

  return (
    <div className="pdfv" ref={containerRef}>
      <div className="pdfv-toolbar">
        <span className="pdfv-pages">{pageCount ? `${pageCount} 页` : "—"}</span>
        <button type="button" className="pdfv-btn" title="缩小" onClick={() => setScale((s) => Math.max(0.6, Number((s - 0.15).toFixed(2))))}>−</button>
        <span className="pdfv-zoom">{Math.round(scale * 100)}%</span>
        <button type="button" className="pdfv-btn" title="放大" onClick={() => setScale((s) => Math.min(2.4, Number((s + 0.15).toFixed(2))))}>＋</button>
        <button
          type="button"
          className={`pdfv-btn ${regionMode ? "on" : ""}`}
          title="在 PDF 上拖出一个矩形，作为区域标注"
          onClick={() => setRegionMode((v) => !v)}
        >
          ▣ 标注区域
        </button>
        <button type="button" className="pdfv-btn" title="把 PDF 中选中的文本发给 AI" onClick={askSelection}>
          ↗ 问 AI（选中文本）
        </button>
        {onInverseSync && <span className="pdfv-hint">双击页面 → 源码行 · Ctrl+Alt+J 源码 → PDF</span>}
      </div>
      {error ? (
        <div className="pdfv-error">{error}</div>
      ) : !doc ? (
        <div className="pdfv-loading">{url ? "PDF 渲染中…" : "尚无编译产物"}</div>
      ) : (
        <div className="pdfv-pages-scroll">
          {Array.from({ length: pageCount }, (_, i) => (
            <PdfPage
              key={`${i + 1}@${scale}`}
              doc={doc}
              pageNumber={i + 1}
              scale={scale}
              regionMode={regionMode}
              regions={regions.filter((r) => r.page === i + 1)}
              syncTarget={syncTarget && syncTarget.page === i + 1 ? syncTarget : null}
              onRegion={(rect) => {
                setRegionMode(false);
                onRegionAnnotate?.({ page: i + 1, rect });
              }}
              onInverseSync={onInverseSync}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PdfPage({ doc, pageNumber, scale, regionMode, regions = [], syncTarget, onRegion, onInverseSync }) {
  const canvasRef = useRef(null);
  const textRef = useRef(null);
  const wrapRef = useRef(null);
  const [drag, setDrag] = useState(null); // { x0, y0, x1, y1 } in page px
  // Page size in PDF points (from the viewport) so clicks can be converted
  // into SyncTeX's point-based coordinate system regardless of zoom.
  const pageSizeRef = useRef({ wPt: 612, hPt: 792 });

  // Forward sync: scroll the highlighted position into view.
  useEffect(() => {
    if (!syncTarget || !wrapRef.current) return;
    const box = wrapRef.current;
    const yPx = (syncTarget.y / pageSizeRef.current.hPt) * box.clientHeight;
    box.scrollIntoView?.({ block: "nearest" });
    const scroller = box.closest(".pdfv-pages-scroll");
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
        const textEl = textRef.current;
        if (!canvas || !textEl) return;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const wrap = wrapRef.current;
        if (wrap) {
          wrap.style.width = `${Math.floor(viewport.width)}px`;
          wrap.style.height = `${Math.floor(viewport.height)}px`;
        }
        await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
        if (cancelled) return;
        // Text layer: pdf.js v4 requires --scale-factor on the container.
        textEl.innerHTML = "";
        textEl.style.setProperty("--scale-factor", String(viewport.scale));
        const pdfjs = await import("pdfjs-dist");
        const textContent = await page.getTextContent();
        if (cancelled) return;
        const layer = new pdfjs.TextLayer({
          textContentSource: textContent,
          container: textEl,
          viewport,
        });
        await layer.render();
      } catch {
        // Rendering a stale/destroyed page is non-fatal; the next effect wins.
      }
    })();
    return () => { cancelled = true; };
  }, [doc, pageNumber, scale]);

  function pos(e) {
    const box = wrapRef.current.getBoundingClientRect();
    return {
      x: Math.min(Math.max(e.clientX - box.left, 0), box.width),
      y: Math.min(Math.max(e.clientY - box.top, 0), box.height),
      w: box.width,
      h: box.height,
    };
  }

  function onMouseDown(e) {
    if (!regionMode) return;
    e.preventDefault();
    const p = pos(e);
    setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  }
  function onMouseMove(e) {
    if (!regionMode || !drag) return;
    const p = pos(e);
    setDrag((d) => (d ? { ...d, x1: p.x, y1: p.y } : d));
  }
  function onMouseUp() {
    if (!regionMode || !drag) return;
    const box = wrapRef.current.getBoundingClientRect();
    const x = Math.min(drag.x0, drag.x1) / box.width;
    const y = Math.min(drag.y0, drag.y1) / box.height;
    const w = Math.abs(drag.x1 - drag.x0) / box.width;
    const h = Math.abs(drag.y1 - drag.y0) / box.height;
    setDrag(null);
    // Ignore accidental clicks; a real region needs some area.
    if (w > 0.01 && h > 0.01) onRegion({ x, y, w, h });
  }

  const marquee = drag
    ? {
        left: Math.min(drag.x0, drag.x1),
        top: Math.min(drag.y0, drag.y1),
        width: Math.abs(drag.x1 - drag.x0),
        height: Math.abs(drag.y1 - drag.y0),
      }
    : null;

  return (
    <div
      ref={wrapRef}
      className={`pdfv-page ${regionMode ? "region-mode" : ""}`}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={() => { if (drag) setDrag(null); }}
      onDoubleClick={(e) => {
        // Inverse sync (LaTeX Editor lesson): double-click a spot -> source line.
        if (regionMode || !onInverseSync) return;
        const box = wrapRef.current.getBoundingClientRect();
        const xPt = ((e.clientX - box.left) / box.width) * pageSizeRef.current.wPt;
        const yPt = ((e.clientY - box.top) / box.height) * pageSizeRef.current.hPt;
        onInverseSync({ page: pageNumber, x: xPt, y: yPt });
      }}
      title={onInverseSync ? "双击定位到源码（SyncTeX）" : undefined}
    >
      <canvas ref={canvasRef} />
      <div ref={textRef} className="pdfjs-text-layer" />
      {syncTarget && (
        <div
          className="pdfv-sync-marker"
          style={{ top: `${(syncTarget.y / pageSizeRef.current.hPt) * 100}%` }}
          aria-label="源码对应位置"
        />
      )}
      {regions.map((r) => (
        <div
          key={r.id}
          className={`pdfv-region ${r.status === "resolved" ? "resolved" : ""}`}
          title={`p.${r.page} · ${r.note || ""}`}
          style={{
            left: `${r.rect.x * 100}%`,
            top: `${r.rect.y * 100}%`,
            width: `${r.rect.w * 100}%`,
            height: `${r.rect.h * 100}%`,
          }}
        />
      ))}
      {marquee && <div className="pdfv-marquee" style={marquee} />}
      <span className="pdfv-pageno">{pageNumber}</span>
    </div>
  );
}

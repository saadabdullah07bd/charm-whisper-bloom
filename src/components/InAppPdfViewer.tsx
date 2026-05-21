import React, { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Use the bundled worker from pdfjs-dist via ESM ?url import so it works on web & Capacitor.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - vite resolves ?url
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

interface Props {
  url: string;
  fileName?: string;
}

const InAppPdfViewer: React.FC<Props> = ({ url, fileName }) => {
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    setContainerWidth(node.clientWidth);
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setContainerWidth(e.contentRect.width);
    });
    ro.observe(node);
  }, []);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-center gap-1.5 px-3 py-2 border-b border-border/20 bg-background/40 shrink-0 text-xs">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-foreground/5 disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="tabular-nums min-w-[60px] text-center text-muted-foreground">
          {numPages ? `${page} / ${numPages}` : '—'}
        </span>
        <button
          onClick={() => setPage(p => Math.min(numPages || 1, p + 1))}
          disabled={page >= numPages}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-foreground/5 disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight size={14} />
        </button>
        <div className="w-px h-4 bg-border/40 mx-1" />
        <button
          onClick={() => setScale(s => Math.max(0.5, +(s - 0.2).toFixed(2)))}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-foreground/5"
          aria-label="Zoom out"
        >
          <ZoomOut size={14} />
        </button>
        <span className="tabular-nums min-w-[42px] text-center text-muted-foreground">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={() => setScale(s => Math.min(3, +(s + 0.2).toFixed(2)))}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-foreground/5"
          aria-label="Zoom in"
        >
          <ZoomIn size={14} />
        </button>
      </div>

      <div ref={containerRef} className="flex-1 min-h-0 overflow-auto bg-muted/20 flex items-start justify-center p-3">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
            <p className="text-sm text-destructive mb-2">Unable to display PDF</p>
            <p className="text-xs text-muted-foreground mb-4">{error}</p>
            <a
              href={url}
              download={fileName}
              className="text-xs font-medium px-3 py-2 rounded-lg border border-border/40 hover:bg-foreground/5"
            >
              Download instead
            </a>
          </div>
        ) : (
          <Document
            file={url}
            onLoadSuccess={({ numPages: n }) => { setNumPages(n); setError(null); }}
            onLoadError={err => setError(err?.message || 'Failed to load PDF')}
            loading={
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-12">
                <Loader2 size={14} className="animate-spin" /> Loading PDF…
              </div>
            }
          >
            {containerWidth > 0 && (
              <Page
                pageNumber={page}
                width={Math.max(280, containerWidth - 24) * scale}
                renderTextLayer
                renderAnnotationLayer
                className="shadow-lg rounded-md overflow-hidden bg-white"
              />
            )}
          </Document>
        )}
      </div>
    </div>
  );
};

export default InAppPdfViewer;

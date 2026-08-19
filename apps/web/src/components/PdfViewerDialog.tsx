import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

// Served as a static file (public/pdf.worker.min.mjs, copied from
// pdfjs-dist@5.4.296) instead of an import — this Vite setup's bundler
// can't resolve a `?url` import of a package file inside node_modules.
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface PdfViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileUrl: string | null;
  fileName: string;
}

export const PdfViewerDialog = ({ open, onOpenChange, fileUrl, fileName }: PdfViewerDialogProps) => {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setPageNumber(1);
        onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton
        className="flex h-[90vh] max-w-[90vw] flex-col gap-0 p-0 sm:max-w-[90vw]"
      >
        <DialogTitle className="border-b border-border px-4 py-3 text-row-secondary font-semibold text-foreground">
          {fileName}
        </DialogTitle>
        <div className="flex flex-1 items-center justify-center overflow-auto bg-muted/40 p-4">
          {fileUrl ? (
            <Document
              file={fileUrl}
              onLoadSuccess={({ numPages: total }) => setNumPages(total)}
              loading={<p className="text-sm text-muted-foreground">Loading PDF…</p>}
              error={<p className="text-sm text-destructive">Failed to load PDF.</p>}
            >
              <Page pageNumber={pageNumber} height={window.innerHeight * 0.75} />
            </Document>
          ) : null}
        </div>
        {numPages > 1 ? (
          <div className="flex items-center justify-center gap-3 border-t border-border px-4 py-2.5">
            <button
              type="button"
              disabled={pageNumber <= 1}
              onClick={() => setPageNumber((p) => p - 1)}
              className="grid size-7 cursor-pointer place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-modal-caption tabular-nums text-muted-foreground">
              Page {pageNumber} of {numPages}
            </span>
            <button
              type="button"
              disabled={pageNumber >= numPages}
              onClick={() => setPageNumber((p) => p + 1)}
              className="grid size-7 cursor-pointer place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

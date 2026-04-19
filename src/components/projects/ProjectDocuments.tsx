import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ALLOWED_MIME, MAX_BYTES, deleteProjectDocument, getDocumentSignedUrl,
  listProjectDocuments, uploadProjectDocument, type ProjectDocument,
} from "@/services/documents";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Image as ImageIcon, FileSpreadsheet, Download, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

const iconFor = (mime: string) => {
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime.includes("sheet") || mime.includes("excel")) return FileSpreadsheet;
  return FileText;
};

const formatSize = (b: number) => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

export function ProjectDocuments({ projectId, isAdmin }: { projectId: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const docsQ = useQuery({
    queryKey: ["project-documents", projectId],
    queryFn: () => listProjectDocuments(projectId),
  });

  const uploadMut = useMutation({
    mutationFn: (file: File) => uploadProjectDocument(projectId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-documents", projectId] });
      toast.success("Document uploaded");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: deleteProjectDocument,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-documents", projectId] });
      toast.success("Document deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => uploadMut.mutate(f));
  };

  const handleDownload = async (doc: ProjectDocument) => {
    try {
      const url = await getDocumentSignedUrl(doc.storage_path);
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const docs = docsQ.data ?? [];

  return (
    <div className="space-y-4 animate-fade-in">
      {isAdmin && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={`card-glass p-8 border-2 border-dashed transition-all ${
            dragOver ? "border-primary glow-primary" : "border-border/60 hover:border-primary/50"
          } cursor-pointer text-center`}
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={ALLOWED_MIME.join(",")}
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <div className="flex flex-col items-center gap-2">
            <div className="h-12 w-12 rounded-full bg-gradient-primary flex items-center justify-center glow-primary">
              {uploadMut.isPending
                ? <Loader2 className="h-5 w-5 text-primary-foreground animate-spin" />
                : <Upload className="h-5 w-5 text-primary-foreground" />}
            </div>
            <div className="text-sm font-medium">
              {uploadMut.isPending ? "Uploading…" : "Drop files here or click to upload"}
            </div>
            <div className="text-xs text-muted-foreground">
              PDF · DOCX · XLSX · PNG · JPG · max {formatSize(MAX_BYTES)}
            </div>
          </div>
        </div>
      )}

      {docsQ.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading documents…</div>
      ) : docs.length === 0 ? (
        <div className="card-glass p-12 text-center">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {docs.map((doc) => {
            const Icon = iconFor(doc.mime_type);
            return (
              <div
                key={doc.id}
                className="card-glass p-4 group hover:border-primary/40 transition-colors flex items-start gap-3"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate" title={doc.name}>{doc.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatSize(doc.size_bytes)} · {new Date(doc.created_at).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => handleDownload(doc)}>
                      <Download className="h-3.5 w-3.5 mr-1" /> Open
                    </Button>
                    {isAdmin && (
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 px-2 text-destructive hover:text-destructive"
                        onClick={() => confirm(`Delete "${doc.name}"?`) && deleteMut.mutate(doc)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

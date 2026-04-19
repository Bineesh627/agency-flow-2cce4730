import { supabase } from "@/integrations/supabase/client";

export interface ProjectDocument {
  id: string;
  project_id: string;
  uploaded_by: string;
  name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export const ALLOWED_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
];
export const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function listProjectDocuments(projectId: string): Promise<ProjectDocument[]> {
  const { data, error } = await supabase
    .from("project_documents")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as ProjectDocument[];
}

export async function uploadProjectDocument(projectId: string, file: File) {
  if (!ALLOWED_MIME.includes(file.type)) {
    throw new Error("Unsupported file type. Allowed: PDF, DOCX, XLSX, PNG, JPG.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("File too large. Max 10 MB.");
  }
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not authenticated");

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${projectId}/${Date.now()}_${safeName}`;

  const { error: upErr } = await supabase.storage
    .from("project-documents")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from("project_documents")
    .insert({
      project_id: projectId,
      uploaded_by: auth.user.id,
      name: file.name,
      storage_path: path,
      mime_type: file.type,
      size_bytes: file.size,
    })
    .select()
    .single();
  if (error) {
    // best-effort cleanup
    await supabase.storage.from("project-documents").remove([path]);
    throw error;
  }
  return data as ProjectDocument;
}

export async function getDocumentSignedUrl(storagePath: string) {
  const { data, error } = await supabase.storage
    .from("project-documents")
    .createSignedUrl(storagePath, 60 * 10); // 10 min
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteProjectDocument(doc: ProjectDocument) {
  await supabase.storage.from("project-documents").remove([doc.storage_path]);
  const { error } = await supabase.from("project_documents").delete().eq("id", doc.id);
  if (error) throw error;
}

import supabase from "./supabase.mjs";

const BUCKET = "my-personal-blog";

export async function uploadBlogFile(filePath, file) {
  const { data, error } = await supabase.storage.from(BUCKET).upload(
    filePath,
    file.buffer,
    {
      contentType: file.mimetype,
      upsert: false,
    }
  );
  if (error) throw error;
  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return publicUrl;
}

export function useUploadPdf() {
  const supabase = useSupabase()

  async function uploadPdf(file: File, path: string): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Non connecté')

    // Get presigned URL from server
    const { uploadUrl, publicUrl } = await $fetch<{ uploadUrl: string; publicUrl: string }>('/api/upload-pdf-url', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: { path, contentType: 'application/pdf' },
    })

    // Upload directly to R2
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/pdf',
      },
      body: file,
    })

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`)
    }

    return publicUrl
  }

  return { uploadPdf }
}

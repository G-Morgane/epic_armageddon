export function useUploadPdf() {
  const supabase = useSupabase()

  async function uploadPdf(file: File, path: string): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Non connecté')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('path', path)

    const response = await $fetch<{ url: string }>('/api/upload-pdf', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: formData,
    })

    return response.url
  }

  return { uploadPdf }
}

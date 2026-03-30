import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export default defineEventHandler(async (event) => {
  // Auth check
  const authHeader = getHeader(event, 'authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, message: 'Non autorisé' })
  }

  const supabase = useSupabaseServer()
  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (authError || !user) {
    throw createError({ statusCode: 401, message: 'Non autorisé' })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    throw createError({ statusCode: 403, message: 'Accès interdit' })
  }

  // Get path from body
  const body = await readBody(event)
  const { path, contentType } = body

  if (!path) {
    throw createError({ statusCode: 400, message: 'path is required' })
  }

  const { client, bucket, publicUrl } = useR2()

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: path,
    ContentType: contentType || 'application/pdf',
  })

  const signedUrl = await getSignedUrl(client, command, { expiresIn: 600 })

  return {
    uploadUrl: signedUrl,
    publicUrl: `${publicUrl}/${path}`,
  }
})

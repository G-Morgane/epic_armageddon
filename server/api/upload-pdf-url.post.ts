import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export default defineEventHandler(async (event) => {
  await exigerAdmin(event)

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

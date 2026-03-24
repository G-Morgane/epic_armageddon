import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

let _client: S3Client | null = null

export function useR2() {
  const config = useRuntimeConfig()

  if (!_client) {
    _client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.r2AccountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.r2AccessKeyId,
        secretAccessKey: config.r2SecretAccessKey,
      },
    })
  }

  return {
    client: _client,
    bucket: config.r2BucketName,
    publicUrl: config.public.r2PublicUrl,
  }
}

export async function uploadToR2(key: string, body: Buffer, contentType: string) {
  const { client, bucket, publicUrl } = useR2()

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  }))

  return `${publicUrl}/${key}`
}

import { BagOfRoutes, Route } from '@t-rest/core'
import { Readable, Stream } from 'stream'
import { z } from 'zod'

type Attachment = { name: string }

export default BagOfRoutes.withoutVersioning()
  .addRoute(Route.get('/files/:fileId').response<Buffer>())
  .addRoute(
    Route.post('/built-ins')
      .validate(
        z.object({
          body: z.object({
            amount: z.bigint(),
            tags: z.set(z.string()),
            counts: z.map(z.string(), z.number()),
            payload: z.unknown(),
            anything: z.any(),
          }),
        })
      )
      .response<{
        content: Buffer
        bytes: Uint8Array
        raw: ArrayBuffer
        maybeContent: Buffer | null
        createdAt: Date
        boxedAmount: BigInt
        token: Symbol
        uniqueToken: symbol
        amount: bigint
        exactAmount: 10n
        readable: Readable
        lookup: Map<string, Attachment>
        attachments: Set<Attachment>
        ids: Set<number>
        pattern: RegExp
        stream: Stream
        metadata: unknown
        extra: any
      }>()
  )
  .build()

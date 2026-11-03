import { BagOfRoutes, json, Route } from '@t-rest/core'
import { buildOpenAPI } from '@t-rest/open-api-generator'
import { z } from 'zod'

const Settings = z
  .object({ theme: z.enum(['light', 'dark']).default('light') })
  .meta({ id: 'Settings' })

const Profile = z
  .object({ name: z.string(), settings: Settings })
  .meta({ id: 'Profile' })

export const bag = BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.put('/me')
      .validate(z.object({ body: Profile }))
      .responses({ 200: json(Profile) })
  )
  .build()

// components Profile, ProfileWrite, Settings and SettingsWrite
export const build = buildOpenAPI({
  bag,
  info: { title: 'Profile API' },
  naming: { inputSuffix: 'Write' },
  specs: [{ target: '3.1', output: 'openapi/profile.yaml' }],
})

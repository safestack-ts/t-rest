import { OpenAPIMetaData } from '../types/open-api-meta-data'
import { OpenAPIPathsSchema, OpenAPISchema } from '../types/open-api-schema'
import { promises as fs } from 'fs'
import * as path from 'path'
import YAML from 'yaml'
import { OpenAPISpecWithMetaData } from './open-api-spec-with-meta-data'
import {
  BagOfRoutes,
  HashMap,
  HTTPMethod,
  isDefined,
  resolveDateVersion,
  resolveVersion,
  Versioning,
} from '@t-rest/core'
import {
  parseBagOfRoutes,
  RouteTypeInfo,
  transformToOpenAPI3,
} from '../utils/parse-bag-of-routes'
import { groupBy, merge } from 'lodash'

type GenerateSpec = {
  spec: OpenAPISpecWithMetaData<any>
  outputFile: string
  outputDir: string
  entry: string
}

export abstract class OpenAPIGenerator {
  public static async generate(args: GenerateSpec[]) {
    for (const arg of args) {
      await this.generateSpec(arg)
    }
  }

  private static async generateSpec({
    spec,
    outputFile,
    outputDir,
    entry,
  }: GenerateSpec) {
    this.validateOutputFile(outputFile)
    await this.ensureOutputDir(outputDir)

    const schema = this.metaDataToSchema(spec.metaData)
    const paths = this.bagOfRoutesToSchema(
      spec.bagOfRoutes,
      entry,
      spec.metaData
    )
    await this.writeFile(
      path.join(outputDir, outputFile),
      YAML.stringify({ ...schema, paths }, null, 2)
    )
  }

  private static bagOfRoutesToSchema(
    bagOfRoutes: BagOfRoutes<any, any, any>,
    entryPath: string,
    metaData: OpenAPIMetaData
  ): OpenAPIPathsSchema {
    const routes = parseBagOfRoutes(entryPath)
    const routesUnfolded = Array.from(routes.entries()).reduce(
      (acc, [[method, path, version], typeInfo]) => {
        if (acc.has([method, path])) {
          acc.get([method, path])?.push({ version, typeInfo })
        } else {
          acc.set([method, path], [{ version, typeInfo }])
        }

        return acc
      },
      new HashMap<
        [string, string],
        { version: string; typeInfo: RouteTypeInfo }[]
      >((key) => key.join('-'))
    )

    const finalRoutes = Array.from(routesUnfolded.entries())
      .map(([[method, path], values]) => {
        const resolvedRoute = (() => {
          if (bagOfRoutes.versioning === Versioning.NO_VERSIONING) {
            return values.at(0)
          } else {
            const resolvedVersion =
              bagOfRoutes.versioning === Versioning.DATE
                ? resolveDateVersion(
                    bagOfRoutes.versionHistory,
                    values.map(({ version }) => version),
                    metaData.version,
                    (version) => new Date(version)
                  )
                : resolveVersion(
                    bagOfRoutes.versionHistory,
                    values.map(({ version }) => version),
                    metaData.version
                  )

            if (resolvedVersion === null) {
              throw new Error(
                `No compatible route version found for requested version ${metaData.version} of route ${method} ${path}`
              )
            }

            return values.find(({ version }) => version === resolvedVersion)
          }
        })()

        if (!resolvedRoute) {
          return null
        }

        return {
          method,
          path,
          route: resolvedRoute,
        }
      })
      .filter(isDefined)

    const routesByPath = groupBy(finalRoutes, (route) => route.path)

    const paths = Object.entries(routesByPath).map(([path, routes]) => {
      const sortedRoutes = routes.sort(
        (a, b) =>
          httpMethodOrder[a.method as HTTPMethod] -
          httpMethodOrder[b.method as HTTPMethod]
      )

      return {
        [path]: sortedRoutes.reduce(
          (acc, { method, route }) => ({
            ...acc,
            [method.toLowerCase()]: {
              //summary: route.summary,
              //description: route.description,
              //tags: route.tags,
              //operationId: route.operationId,
              parameters: [
                ...(route.typeInfo?.input?.kind === 'object' &&
                route.typeInfo.input.properties.params?.kind === 'object' &&
                route.typeInfo.input.properties.params.properties
                  ? Object.entries(
                      route.typeInfo.input.properties.params.properties
                    ).map(([name, schema]) => ({
                      name,
                      in: 'path',
                      required:
                        (route.typeInfo.input?.kind === 'object' &&
                          route.typeInfo.input.properties.params?.kind ===
                            'object' &&
                          route.typeInfo.input.properties.params.required?.includes(
                            name
                          )) ??
                        false,
                      schema: transformToOpenAPI3(schema),
                    }))
                  : []),
                ...(route.typeInfo?.input?.kind === 'object' &&
                route.typeInfo.input.properties.query?.kind === 'object' &&
                route.typeInfo.input.properties.query.properties
                  ? Object.entries(
                      route.typeInfo.input.properties.query.properties
                    ).map(([name, schema]) => ({
                      name,
                      in: 'query',
                      required:
                        (route.typeInfo.input?.kind === 'object' &&
                          route.typeInfo.input.properties.query?.kind ===
                            'object' &&
                          route.typeInfo.input.properties.query.required?.includes(
                            name
                          )) ??
                        false,
                      schema: transformToOpenAPI3(schema),
                    }))
                  : []),
              ],
              requestBody:
                route.typeInfo.input?.kind === 'object' &&
                route.typeInfo.input.properties.body
                  ? {
                      content: {
                        'application/json': {
                          schema: transformToOpenAPI3(
                            route.typeInfo.input.properties.body
                          ),
                        },
                      },
                    }
                  : undefined,
              responses: {
                '200': {
                  description: 'Successful response',
                  content: {
                    'application/json': {
                      schema: route.typeInfo.output
                        ? transformToOpenAPI3(route.typeInfo.output)
                        : undefined,
                    },
                  },
                },
              },
            },
          }),
          {}
        ),
      }
    })

    return merge({}, ...paths)
  }

  private static metaDataToSchema(metaData: OpenAPIMetaData): OpenAPISchema {
    return {
      openapi: '3.0.0',
      info: {
        title: metaData.title,
        version: metaData.version,
      },
      servers: metaData.servers ?? [],
      tags: metaData.tags ?? [],
      paths: {},
    }
  }

  private static async ensureOutputDir(outputDir: string) {
    await fs.mkdir(outputDir, { recursive: true })
  }

  private static validateOutputFile(outputFile: string) {
    if (!outputFile.endsWith('.yaml')) {
      throw new Error('Output file must end with .yaml')
    }
  }

  private static async writeFile(outputFile: string, content: string) {
    await fs.writeFile(outputFile, content)
  }
}

const httpMethodOrder: Record<HTTPMethod, number> = {
  GET: 0,
  POST: 1,
  PUT: 2,
  PATCH: 3,
  DELETE: 4,
}

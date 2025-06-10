import { OpenAPIMetaData } from '../types/open-api-meta-data'
import { OpenAPISchema } from '../types/open-api-schema'
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
  getOpenAPI3Spec,
} from '../utils/parse-bag-of-routes'
import { groupBy, merge, uniqBy } from 'lodash'
import { validateRouteMeta } from '../schema/route-meta'

type SpecFilterRoute = {
  method: HTTPMethod
  path: string
  version?: string
  metaData?: unknown
}

type SpecFilter = (route: SpecFilterRoute) => boolean

type GenerateSpec = {
  spec: OpenAPISpecWithMetaData<any>
  outputFile: string
  outputDir: string
  entry: string
  tsConfigPath: string
  filter?: SpecFilter
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
    tsConfigPath,
    filter = () => true,
  }: GenerateSpec) {
    this.validateOutputFile(outputFile)
    await this.ensureOutputDir(outputDir)

    const schema = this.metaDataToSchema(spec.metaData)
    const { paths, components } = this.bagOfRoutesToSchema(
      spec.bagOfRoutes,
      entry,
      tsConfigPath,
      spec.metaData,
      filter
    )
    await this.writeFile(
      path.join(outputDir, outputFile),
      YAML.stringify(
        {
          ...schema,
          paths,
          components: {
            schemas: Object.fromEntries(
              Object.keys(components)
                .sort()
                .map((key) => [key, components[key]])
            ),
          },
        },
        null,
        2
      )
    )
  }

  private static bagOfRoutesToSchema(
    bagOfRoutes: BagOfRoutes<any, any, any>,
    entryPath: string,
    tsConfigPath: string,
    metaData: OpenAPIMetaData,
    filter: SpecFilter
  ) {
    const routes = parseBagOfRoutes(entryPath, tsConfigPath)
    const routesUnfolded = Array.from(routes.entries()).reduce(
      (acc, [[method, path, version], typeInfo]) => {
        const routeDef = bagOfRoutes.routes.get([
          method as HTTPMethod,
          typeInfo.routeMeta.originalPath,
          version,
        ])
        if (
          !filter({
            method: method as HTTPMethod,
            path: typeInfo.routeMeta.originalPath,
            version,
            metaData: routeDef?.metaData,
          })
        )
          return acc

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
      .map(([[method], values]) => {
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
              // ignore routes that are not compatible with the requested version
              return null
            }

            return values.find(({ version }) => version === resolvedVersion)
          }
        })()

        if (!resolvedRoute) {
          return null
        }

        return {
          method,
          path: resolvedRoute.typeInfo.routeMeta.originalPath,
          route: resolvedRoute,
        }
      })
      .filter(isDefined)

    const routesByPath = groupBy(finalRoutes, (route) => route.path)

    const allComponents: Record<string, any> = {}

    const paths = Object.entries(routesByPath).map(([path, routes]) => {
      const sortedRoutes = routes.sort(
        (a, b) =>
          httpMethodOrder[a.method as HTTPMethod] -
          httpMethodOrder[b.method as HTTPMethod]
      )

      const pathWithParamPlaceholders = path.replace(/:(\w+)/g, '{$1}')

      return {
        [pathWithParamPlaceholders]: sortedRoutes.reduce(
          (acc, { method, route }) => {
            const routeDefinition = bagOfRoutes.routes.get([
              method as HTTPMethod,
              path,
              route.version,
            ])
            const routeMetaParsed = validateRouteMeta.safeParse(
              routeDefinition?.metaData
            )

            if (
              !routeMetaParsed.success &&
              isDefined(routeDefinition?.metaData)
            ) {
              console.warn(
                `Route ${method} ${path} revision ${route.version} has invalid meta data`
              )
            }

            const { headers: localHeaders, ...routeMeta } =
              routeMetaParsed.data ?? {}
            //  local headers of the route definition have precedence over the global headers, which is enforced by array order using lodashs uniqBy
            const mergedHeaders = uniqBy(
              [...(localHeaders ?? []), ...(metaData.headers ?? [])],
              (header) => header.name
            )

            const querySchema =
              route.typeInfo.input?.kind === 'object' &&
              route.typeInfo.input.properties.query?.kind === 'object' &&
              route.typeInfo.input.properties.query.properties
                ? getOpenAPI3Spec(route.typeInfo.input.properties.query, true)
                : undefined

            const bodySchema =
              route.typeInfo.input?.kind === 'object' &&
              route.typeInfo.input.properties.body
                ? getOpenAPI3Spec(route.typeInfo.input.properties.body, true)
                : undefined

            const responseSchema = route.typeInfo.output
              ? getOpenAPI3Spec(route.typeInfo.output, true)
              : undefined

            const components = {
              ...(bodySchema?.components ?? {}),
              ...(responseSchema?.components ?? {}),
              ...(querySchema?.components ?? {}),
            }

            Object.entries(components).forEach(([key, value]) => {
              allComponents[key] = value
            })

            return {
              ...acc,
              [method.toLowerCase()]: {
                ...routeMeta,
                parameters: [
                  ...(mergedHeaders?.map((header) => ({
                    name: header.name,
                    in: 'header',
                    description: header.description,
                    required: header.required ?? false,
                    schema: getOpenAPI3Spec(header.type, false).spec,
                  })) ?? []),
                  ...(route.typeInfo?.input?.kind === 'object' &&
                  route.typeInfo.input.properties.params?.kind === 'object' &&
                  route.typeInfo.input.properties.params.properties
                    ? Object.entries(
                        route.typeInfo.input.properties.params.properties
                      ).map(([name, schema]) => ({
                        name,
                        in: 'path',
                        required: true,
                        schema: getOpenAPI3Spec(schema, false).spec,
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
                        schema: getOpenAPI3Spec(schema, true).spec,
                      }))
                    : []),
                ],
                requestBody: bodySchema
                  ? {
                      content: {
                        'application/json': {
                          schema: bodySchema.spec,
                        },
                      },
                    }
                  : undefined,
                responses: {
                  '200': {
                    description: 'Successful response',
                    content: {
                      'application/json': {
                        schema: responseSchema?.spec,
                      },
                    },
                  },
                },
              },
            }
          },
          {}
        ),
      }
    })

    return {
      paths: merge({}, ...paths),
      components: allComponents,
    }
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

import { OpenAPIMetaData } from '../types/open-api-meta-data'
import { OpenAPISchema } from '../types/open-api-schema'
import { OpenAPISpecWithBagOfRoutes } from './open-api-spec-with-bag-of-routes'
import { promises as fs } from 'fs'
import * as path from 'path'
import YAML from 'yaml'
import { OpenAPISpecWithMetaData } from './open-api-spec-with-meta-data'

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
    await this.writeFile(
      path.join(outputDir, outputFile),
      YAML.stringify(schema, null, 2)
    )
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

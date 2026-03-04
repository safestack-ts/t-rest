import {
  TypedExpressApplicationWithoutVersioning,
  TypedExpressApplicationWithVersioning,
} from '@t-rest/express-server'
import { SupertestAdapterWithoutVersioning } from './supertest-adapter-without-versioning.js'
import { VersionInjector } from './version-injector.js'
import { SupertestAdapterWithVersioning } from './supertest-adapter-with-versioning.js'
import { DefaultSupertestAdapterConfig } from '../types/default-supertest-adapter-config.js'

export abstract class SupertestAdapter {
  public static withoutVersioning<
    TApp extends TypedExpressApplicationWithoutVersioning<any, any, any>
  >(
    app: TApp,
    defaultConfig: DefaultSupertestAdapterConfig = {}
  ): SupertestAdapterWithoutVersioning<TApp> {
    return new SupertestAdapterWithoutVersioning(app, defaultConfig)
  }

  public static withVersioning<
    TApp extends TypedExpressApplicationWithVersioning<any, any, any, any>
  >(
    app: TApp,
    versionInjector: VersionInjector,
    defaultConfig: DefaultSupertestAdapterConfig = {}
  ): SupertestAdapterWithVersioning<TApp> {
    return new SupertestAdapterWithVersioning(app, versionInjector, defaultConfig)
  }
}

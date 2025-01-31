import {
  TypedExpressApplicationWithoutVersioning,
  TypedExpressApplicationWithVersioning,
} from '@t-rest/express-server'
import { SupertestAdapterWithoutVersioning } from './supertest-adapter-without-versioning'
import { VersionInjector } from './version-injector'
import { SupertestAdapterWithVersioning } from './supertest-adapter-with-versioning'

export abstract class SupertestAdapter {
  public static withoutVersioning<
    TApp extends TypedExpressApplicationWithoutVersioning<any, any, any>
  >(app: TApp): SupertestAdapterWithoutVersioning<TApp> {
    return new SupertestAdapterWithoutVersioning(app)
  }

  public static withVersioning<
    TApp extends TypedExpressApplicationWithVersioning<any, any, any, any>
  >(
    app: TApp,
    versionInjector: VersionInjector
  ): SupertestAdapterWithVersioning<TApp> {
    return new SupertestAdapterWithVersioning(app, versionInjector)
  }
}

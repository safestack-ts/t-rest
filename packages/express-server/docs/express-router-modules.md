# Express Router Modules

Typed Express router modules let you define reusable route installers for a
subtree of a `BagOfRoutes`. They are an additive API in `@t-rest/express-server`
and can be used next to the existing `branch().use().get().handle()` style.

They are useful when an application has a larger routing tree and you want each
feature router to declare:

- which route subtree it owns
- which request context it requires from middleware
- whether it belongs to a versioned or unversioned bag

## Basic Usage

Create a module by passing the full bag of routes to `defineRouterModule`.
The `.at(...)` path is absolute and must match at least one route in the bag.

```ts
import { defineRouterModule } from '@t-rest/express-server'

const PaymentDetailsRouterAdmin = defineRouterModule(paymentsBagOfRoutes)
  .at('/api/payments/admin/payment-details')
  .withContext<RequestWithAdminAuth & RequestWithPoolAndClientIds>()
  .configure((router) => {
    router.get('/').handle((request, _validation, response) => {
      response.status(200).json({
        adminId: request.admin.id,
        poolId: request.poolId,
        clientId: request.clientId,
      })
    })
  })
```

Mount the module on a matching typed branch:

```ts
paymentsApp
  .branch('/admin')
  .use(withAdminAuthentication)
  .use(withAdminPoolAndClientIds(args.accessManagementStore))
  .branch('/payment-details')
  .mount(PaymentDetailsRouterAdmin)
```

The branch path must match the module path exactly after joining it with the
application mount path.

## Context Requirements

Use `.withContext<TContext>()` when a module depends on middleware-enriched
request fields.

```ts
type RequestWithClientId = {
  clientId: string
}

const withClientId = defineMiddleware<ExpressRequest, RequestWithClientId>(
  (request, _response, next) => {
    ;(request as ExpressRequest & RequestWithClientId).clientId = 'client-1'
    next()
  }
)

const UsersModule = defineRouterModule(bagOfRoutes)
  .at('/api/users')
  .withContext<RequestWithClientId>()
  .configure((router) => {
    router.get('/me').handle((request, _validation, response) => {
      response.status(200).json({
        id: 1,
        email: `${request.clientId}@example.com`,
      })
    })
  })

app.branch('/users').use(withClientId).mount(UsersModule)
```

If the branch has not applied middleware that provides the required context,
`mount(...)` is rejected by TypeScript.

## Route Narrowing

Inside `.configure(...)`, the router is narrowed to routes below the module
path. A module declared at `/api/users` can handle `/`, `/me`, or `/:userId`
depending on the matching routes in the bag, but it cannot handle sibling
subtrees such as `/admin/accounts`.

```ts
const UsersModule = defineRouterModule(bagOfRoutes)
  .at('/api/users')
  .configure((router) => {
    router.get('/me').handle(...)

    // Type error if this route belongs to /api/admin, not /api/users.
    router.get('/accounts')
  })
```

This keeps feature routers from accidentally implementing routes outside their
declared subtree.

## Middleware Isolation

Router modules preserve the existing `branch()` isolation behavior. Middleware
mounted on one branch affects that branch and its children only.

```ts
app.branch('/users').use(withClientId).mount(UsersModule)
app.branch('/admin').mount(AdminModule)
```

In this example, `withClientId` is available to `UsersModule`, but it does not
affect `AdminModule`.

## Versioned Routes

`defineRouterModule` also supports versioned bags. Versioned modules receive a
versioned typed router and use the existing `.version(...)` API.

```ts
const VersionedUsersModule = defineRouterModule(versionedBagOfRoutes)
  .at('/api/users')
  .configure((router) => {
    router
      .get('/')
      .version('2024-01-01')
      .handle(({ version }, _validation, response) => {
        response.status(200).json({
          version: version.resolved,
          data: [],
        })
      })
  })

versionedApp.branch('/users').mount(VersionedUsersModule)
```

Versioned modules can only be mounted on compatible versioned routers.
Unversioned modules can only be mounted on unversioned routers.

## Compatibility

This API is non-breaking. Existing typed router setup code continues to work:

```ts
const usersRouter = app.branch('/users').use(withClientId)

usersRouter.get('/me').handle((request, _validation, response) => {
  response.status(200).json(...)
})
```

Router modules are only a new composition option for larger applications.


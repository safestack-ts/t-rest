// Detection is syntactic on purpose: the rule never imports zod or @t-rest/core,
// it recognizes `defineModels` imported from '@t-rest/core/zod' and call chains
// rooted at bindings imported from 'zod'. Whatever it cannot resolve is not reported.

type Node = any

export type MessageId = 'missingId' | 'derivedWithoutId' | 'idMismatch'

export interface RequireModelIdOptions {
  /**
   * `src/models/v2024_01_01/shared/checkout.ts` under root `src/models` expects ids
   * starting with `V2024_01_01_Shared_Checkout`: path segments joined by `_`.
   */
  readonly idFromPath?: {
    readonly root: string
    /** `pascal` (default) capitalizes each `-` or `.` separated word of a segment, `preserve` keeps the segment. */
    readonly case?: 'pascal' | 'preserve'
  }
}

export interface RuleContext {
  readonly filename: string
  readonly cwd: string
  readonly options: readonly unknown[]
  report(descriptor: {
    node: unknown
    messageId: MessageId
    data?: Record<string, string>
  }): void
}

export interface RuleModule {
  readonly meta: {
    readonly type: 'problem'
    readonly docs: { readonly description: string }
    readonly messages: Readonly<Record<MessageId, string>>
    readonly schema: readonly unknown[]
  }
  create(context: RuleContext): Record<string, (node: any) => void>
}

const ZOD_SOURCES = new Set(['zod', 'zod/v4', 'zod/mini', 'zod/v4-mini'])
const MODELS_SOURCE = '@t-rest/core/zod'

const DERIVING = new Set([
  'extend',
  'safeExtend',
  'pick',
  'omit',
  'partial',
  'required',
  'merge',
])
const KEEPS_ID = new Set(['describe', 'meta', 'readonly'])
/** Schema methods that return something other than a schema. */
const INSTANCE_NOT_A_SCHEMA = new Set([
  'parse',
  'parseAsync',
  'safeParse',
  'safeParseAsync',
  'spa',
  'encode',
  'decode',
  'encodeAsync',
  'decodeAsync',
  'safeEncode',
  'safeDecode',
  'safeEncodeAsync',
  'safeDecodeAsync',
  'isOptional',
  'isNullable',
  'toJSONSchema',
])
/** Zod exports that are not schema constructors. */
const NAMESPACE_NOT_A_SCHEMA = new Set([
  ...INSTANCE_NOT_A_SCHEMA,
  'registry',
  'config',
  'treeifyError',
  'prettifyError',
  'flattenError',
  'formatError',
  'function',
  'setErrorMap',
  'check',
  'locales',
])
const TRANSPARENT = new Set([
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
  'ChainExpression',
  'ParenthesizedExpression',
])

const unwrap = (node: Node): Node => {
  let current = node
  while (current && TRANSPARENT.has(current.type)) current = current.expression
  return current
}

const stringValue = (node: Node): string | undefined => {
  const value = unwrap(node)
  if (value?.type === 'Literal' && typeof value.value === 'string')
    return value.value
  if (value?.type === 'TemplateLiteral' && value.expressions.length === 0)
    return value.quasis[0].value.cooked
  return undefined
}

interface Call {
  readonly name: string
  readonly node: Node
}

interface Chain {
  readonly root: Node
  readonly rootCall: Node | null
  readonly viaMember: boolean
  readonly calls: readonly Call[]
}

const isNamespacePath = (node: Node): boolean =>
  node.type === 'Identifier' ||
  (node.type === 'MemberExpression' &&
    !node.computed &&
    node.property.type === 'Identifier' &&
    isNamespacePath(unwrap(node.object)))

/** Splits `a.b(...).c(...)` into its root identifier and the method calls, inner call first. */
const readChain = (expression: Node): Chain | null => {
  const calls: Call[] = []
  let node = unwrap(expression)
  let viaMember = false

  for (;;) {
    if (node.type === 'CallExpression') {
      const callee = unwrap(node.callee)
      if (callee.type === 'Identifier')
        return {
          root: callee,
          rootCall: node,
          viaMember,
          calls: calls.reverse(),
        }
      if (
        callee.type !== 'MemberExpression' ||
        callee.computed ||
        callee.property.type !== 'Identifier'
      )
        return null
      calls.push({ name: callee.property.name, node })
      node = unwrap(callee.object)
    } else if (node.type === 'MemberExpression') {
      if (!isNamespacePath(node)) return null
      viaMember = true
      while (node.type === 'MemberExpression') {
        if (NAMESPACE_NOT_A_SCHEMA.has(node.property.name)) return null
        node = unwrap(node.object)
      }
    } else if (node.type === 'Identifier') {
      return { root: node, rootCall: null, viaMember, calls: calls.reverse() }
    } else {
      return null
    }
  }
}

interface Resolved {
  /** the chain starts at a `defineModels` model, which carries an id */
  readonly fromModels: boolean
  /** method calls after the schema constructor, inner call first, local initializers included */
  readonly calls: readonly Call[]
}

const schemaCalls = (
  calls: readonly Call[],
  fromModels = false
): Resolved | null =>
  calls.some((call) => INSTANCE_NOT_A_SCHEMA.has(call.name))
    ? null
    : { fromModels, calls }

/** A local binding of a zod import: the namespace, or one export under its imported name. */
type ZodBinding =
  | { readonly kind: 'namespace' }
  | { readonly kind: 'export'; readonly imported: string }

const idProperty = (object: Node): Node | 'unknown' | undefined => {
  if (object?.type !== 'ObjectExpression') return 'unknown'
  let found: Node | 'unknown' | undefined
  for (const property of object.properties) {
    if (property.type !== 'Property') return 'unknown'
    const key = property.computed
      ? undefined
      : property.key.name ?? property.key.value
    if (key === 'id') found = property
  }
  return found
}

/** `.meta({ id })` or `.register(registry, { id })`. `unknown` when the options are not an object literal. */
const idOf = (call: Call): Node | 'unknown' | undefined => {
  const args = call.node.arguments
  if (call.name === 'meta')
    return args.length === 0 ? undefined : idProperty(args[0])
  if (call.name === 'register') return idProperty(args[1])
  return undefined
}

const WORD_SEPARATOR = /[-.]/

const segmentName = (segment: string, mode: 'pascal' | 'preserve') =>
  mode === 'preserve'
    ? segment
    : segment
        .split(WORD_SEPARATOR)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join('')

/** Id prefix for a file under the configured root, or undefined when the file is outside of it. */
const expectedIdPrefix = (
  filename: string,
  cwd: string,
  {
    root,
    case: mode = 'pascal',
  }: NonNullable<RequireModelIdOptions['idFromPath']>
): string | undefined => {
  const normalize = (path: string) =>
    path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '')
  const file = normalize(filename)
  const base = `${normalize(cwd)}/`
  const relative = file.startsWith(base) ? file.slice(base.length) : file
  const rootPath = `${normalize(root)}/`
  const rootIndex = relative.startsWith(rootPath)
    ? 0
    : relative.indexOf(`/${rootPath}`) + 1
  if (rootIndex === 0 && !relative.startsWith(rootPath)) return undefined

  const segments: string[] = relative
    .slice(rootIndex + rootPath.length)
    .replace(/\.[cm]?[jt]sx?$/, '')
    .split('/')
    .filter(Boolean)
  if (segments[segments.length - 1] === 'index') segments.pop()
  if (segments.length === 0) return undefined

  return segments.map((segment) => segmentName(segment, mode)).join('_')
}

export const requireModelId: RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require an id on every exported zod schema so OpenAPI generation names it',
    },
    messages: {
      missingId:
        "Exported zod schema '{{name}}' has no id. Pass it to defineModels(...) or end its chain with .meta({ id }).",
      derivedWithoutId:
        "'{{name}}' is derived with .{{method}}() and zod does not carry ids over, so it is inlined silently. Give it its own id with .meta({ id }) or defineModels(...).",
      idMismatch:
        "Id '{{actual}}' of '{{name}}' does not start with '{{expected}}', the prefix of this file's path.",
    },
    schema: [
      {
        type: 'object',
        properties: {
          idFromPath: {
            type: 'object',
            properties: {
              root: { type: 'string' },
              case: { enum: ['pascal', 'preserve'] },
            },
            required: ['root'],
            additionalProperties: false,
          },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const options = (context.options[0] ?? {}) as RequireModelIdOptions
    const prefix = options.idFromPath
      ? expectedIdPrefix(context.filename, context.cwd, options.idFromPath)
      : undefined

    const zodBindings = new Map<string, ZodBinding>()
    const defineModelsNames = new Set<string>()
    const modelBindings = new Set<string>()
    const localInits = new Map<string, Node>()

    const isDefineModels = (node: Node) =>
      node?.type === 'CallExpression' &&
      unwrap(node.callee).type === 'Identifier' &&
      defineModelsNames.has(unwrap(node.callee).name)

    const collect = (program: Node) => {
      for (const statement of program.body) {
        if (statement.type === 'ImportDeclaration') {
          const source = statement.source.value
          for (const specifier of statement.specifiers) {
            if (ZOD_SOURCES.has(source)) {
              const imported: string | undefined =
                specifier.type === 'ImportSpecifier'
                  ? specifier.imported.name ?? specifier.imported.value
                  : undefined
              zodBindings.set(
                specifier.local.name,
                imported === undefined ||
                  imported === 'z' ||
                  imported === 'default'
                  ? { kind: 'namespace' }
                  : { kind: 'export', imported }
              )
            } else if (
              source === MODELS_SOURCE &&
              specifier.type === 'ImportSpecifier' &&
              specifier.imported.name === 'defineModels'
            ) {
              defineModelsNames.add(specifier.local.name)
            }
          }
          continue
        }

        const declaration =
          statement.type === 'ExportNamedDeclaration'
            ? statement.declaration
            : statement
        if (declaration?.type !== 'VariableDeclaration') continue

        for (const declarator of declaration.declarations) {
          if (!declarator.init) continue
          if (declarator.id.type === 'Identifier') {
            localInits.set(declarator.id.name, declarator.init)
          } else if (
            declarator.id.type === 'ObjectPattern' &&
            isDefineModels(unwrap(declarator.init))
          ) {
            for (const property of declarator.id.properties) {
              if (
                property.type === 'Property' &&
                property.value.type === 'Identifier'
              )
                modelBindings.add(property.value.name)
            }
          }
        }
      }
    }

    const resolve = (
      expression: Node,
      seen: Set<string> = new Set()
    ): Resolved | null => {
      const chain = readChain(expression)
      if (!chain) return null
      const { root, rootCall, viaMember, calls } = chain

      const zodBinding = zodBindings.get(root.name)
      if (zodBinding?.kind === 'namespace') {
        if (rootCall || calls.length === 0) return null
        const [constructor, ...methods] = calls
        if (NAMESPACE_NOT_A_SCHEMA.has(constructor.name)) return null
        return schemaCalls(methods)
      }
      if (zodBinding?.kind === 'export') {
        if (!rootCall || NAMESPACE_NOT_A_SCHEMA.has(zodBinding.imported))
          return null
        return schemaCalls(calls)
      }

      if (rootCall || viaMember || calls.length === 0 || seen.has(root.name))
        return null
      if (modelBindings.has(root.name)) return schemaCalls(calls, true)

      const init = localInits.get(root.name)
      if (!init) return null
      seen.add(root.name)
      const base = resolve(init, seen)
      return base && schemaCalls([...base.calls, ...calls], base.fromModels)
    }

    const checkId = (name: string, id: string, node: Node) => {
      if (prefix === undefined || id.startsWith(prefix)) return
      context.report({
        node,
        messageId: 'idMismatch',
        data: { name, actual: id, expected: prefix },
      })
    }

    const checkModels = (init: Node) => {
      const namespace = stringValue(init.arguments[0])
      if (namespace !== undefined)
        checkId(
          'defineModels',
          namespace.replace(/\./g, '_'),
          init.arguments[0]
        )
    }

    const checkSchema = (name: string, declarator: Node) => {
      const resolved = resolve(declarator.init)
      if (!resolved) return

      const { fromModels, calls } = resolved
      let keepsModelId = fromModels
      for (let index = calls.length - 1; index >= 0; index--) {
        const call = calls[index]
        const id = idOf(call)
        if (id !== undefined) {
          const literal = id === 'unknown' ? undefined : stringValue(id.value)
          if (literal !== undefined) checkId(name, literal, id.value)
          return
        }
        if (!KEEPS_ID.has(call.name)) {
          keepsModelId = false
          break
        }
      }
      if (keepsModelId) return

      const derived = calls.find((call) => DERIVING.has(call.name))
      context.report(
        derived
          ? {
              node: declarator,
              messageId: 'derivedWithoutId',
              data: { name, method: derived.name },
            }
          : { node: declarator, messageId: 'missingId', data: { name } }
      )
    }

    return {
      Program: collect,
      ExportNamedDeclaration(node) {
        if (node.declaration?.type !== 'VariableDeclaration') return
        for (const declarator of node.declaration.declarations) {
          if (!declarator.init) continue
          const init = unwrap(declarator.init)
          if (isDefineModels(init)) checkModels(init)
          else if (declarator.id.type === 'Identifier')
            checkSchema(declarator.id.name, declarator)
        }
      },
    }
  },
}

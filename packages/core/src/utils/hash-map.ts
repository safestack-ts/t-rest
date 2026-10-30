type HashFunction<TKey> = (input: TKey) => string

/** @deprecated Internal helper, will be removed from the public API in a future major. */
export class HashMap<TKey, TValue> {
  // internal map representing the hash map
  private readonly _map = new Map<string, TValue>()
  // remember original key values
  private readonly _keys = new Map<string, TKey>()

  private readonly hashFunc: HashFunction<TKey>

  constructor(
    hashFunc: HashFunction<TKey>,
    entries: readonly (readonly [TKey, TValue])[]
  )
  constructor(hashFunc: HashFunction<TKey>)
  constructor(
    hashFunc: HashFunction<TKey>,
    entries?: readonly (readonly [TKey, TValue])[]
  ) {
    this.hashFunc = hashFunc

    Array.from(entries ?? []).forEach(([key, value]) => this.set(key, value))
  }

  set(key: TKey, value: TValue) {
    this._map.set(this.hashFunc(key), value)
    this._keys.set(this.hashFunc(key), key)

    return this
  }

  get(key: TKey): TValue | undefined {
    return this._map.get(this.hashFunc(key))
  }

  has(key: TKey): boolean {
    return this._map.has(this.hashFunc(key))
  }

  delete(key: TKey): boolean {
    if (this.has(key)) {
      this._map.delete(this.hashFunc(key))
      this._keys.delete(this.hashFunc(key))

      return true
    } else {
      return false
    }
  }

  clear(): void {
    this._map.clear()
    this._keys.clear()
  }

  keys(): IterableIterator<TKey> {
    return this._keys.values()
  }

  values(): IterableIterator<TValue> {
    return this._map.values()
  }

  get size(): number {
    return this._map.size
  }

  entries(): IterableIterator<[TKey, TValue]> {
    // snapshot at call time, so mutations while iterating do not affect it
    const entries = Array.from(this._map.entries())
    const keys = this._keys

    return (function* (): Generator<[TKey, TValue], undefined> {
      for (const [stringKey, value] of entries) {
        yield [keys.get(stringKey) as TKey, value]
      }
    })()
  }

  toJSON() {
    return Array.from(this.entries())
  }

  toString() {
    return JSON.stringify(this.toJSON())
  }
}

import { BagOfRoutes, Route } from '@t-rest/core'

type Tree = { value: string; child: Tree } | null

type NestedArray = NestedArray[] | null

interface LinkedNode {
  value: string
  next: LinkedList
}

type LinkedList = LinkedNode | null

export default BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.get('/nullable-recursive-aliases').response<{
      tree: Tree
      array: NestedArray
      list: LinkedList
    }>()
  )
  .build()

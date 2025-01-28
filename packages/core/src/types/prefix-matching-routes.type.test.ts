import { AssertTrue } from 'conditional-type-checks'
import { Route } from '../classes/core/route'
import { PrefixMatchingRoutes } from './prefix-matching-routes'

const routeGetUsers =
  Route.get('/api/users/:userId').response<{ id: number; name: string }[]>()

type RouteGetUsers = typeof routeGetUsers

const routeGetPosts =
  Route.get('/api/posts/:postId').response<{ id: number; title: string }[]>()

type RouteGetPosts = typeof routeGetPosts

type Routes = RouteGetUsers | RouteGetPosts

type UsersRoutes = PrefixMatchingRoutes<Routes, '/api/users'>
type PostsRoutes = PrefixMatchingRoutes<Routes, '/api/posts'>

type PostsRoutesNotInUsersRoutes = RouteGetPosts extends UsersRoutes
  ? false
  : true
type UsersRoutesNotInPostsRoutes = RouteGetUsers extends PostsRoutes
  ? false
  : true

type _test =
  | AssertTrue<PostsRoutesNotInUsersRoutes>
  | AssertTrue<UsersRoutesNotInPostsRoutes>

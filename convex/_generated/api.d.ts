/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activities from "../activities.js";
import type * as activityLogs from "../activityLogs.js";
import type * as agents from "../agents.js";
import type * as chat from "../chat.js";
import type * as documents from "../documents.js";
import type * as http from "../http.js";
import type * as internal_ from "../internal.js";
import type * as messages from "../messages.js";
import type * as notifications from "../notifications.js";
import type * as policies from "../policies.js";
import type * as projects from "../projects.js";
import type * as router from "../router.js";
import type * as tasks from "../tasks.js";
import type * as telegram from "../telegram.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activities: typeof activities;
  activityLogs: typeof activityLogs;
  agents: typeof agents;
  chat: typeof chat;
  documents: typeof documents;
  http: typeof http;
  internal: typeof internal_;
  messages: typeof messages;
  notifications: typeof notifications;
  policies: typeof policies;
  projects: typeof projects;
  router: typeof router;
  tasks: typeof tasks;
  telegram: typeof telegram;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};

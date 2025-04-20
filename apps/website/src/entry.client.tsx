import { createRoot } from "react-dom/client";
import {
  createBrowserRouter,
  createHashRouter,
  RouterProvider,
  useRouteError,
  type ErrorResponse,
  type RouteObject,
} from "react-router";
import * as appRoot from "./root";
import { routes } from "./routes";

const resolveErrorBoundaries = (routes: RouteObject[] = []): RouteObject[] =>
  routes.map(({ ErrorBoundary, children, ...route }) => {
    const modifiedRoute: RouteObject = { ...route };

    if (ErrorBoundary) {
      modifiedRoute.ErrorBoundary = (props: any) => {
        const error = useRouteError();
        let errorInstance: Error;

        if (error instanceof Error) {
          // If it's already an Error instance, use directly
          errorInstance = error;
        } else if (
          // Check for ErrorResponse structure
          typeof error === "object" &&
          error !== null &&
          "status" in error &&
          "data" in error
        ) {
          // Handle React Router ErrorResponse
          const { status, statusText, data } = error as ErrorResponse;
          errorInstance = new Error(
            `[${status}] ${statusText || "An error occurred"}`,
          );
          // Preserve response data on error instance
          (errorInstance as any).data = data;
        } else if (error !== null && typeof error === "object") {
          // Handle plain error objects
          errorInstance = new Error(JSON.stringify(error));
        } else {
          // Handle primitives and null/undefined
          errorInstance = new Error(
            error !== undefined && error !== null
              ? String(error)
              : "Unknown error",
          );
        }

        return <ErrorBoundary {...props} error={errorInstance} />;
      };
    }

    if (children) {
      modifiedRoute.children = resolveErrorBoundaries(children);
    }

    return modifiedRoute;
  });

const appRoutes: RouteObject[] = [
  {
    path: "/",
    element: <appRoot.default />,
    children: [
      ...routes,
      {
        path: "*",
        loader: () => {
          throw new Response(null, { status: 404 });
        },
      },
    ],
  },
];

const isGHPages = window.location.hostname.includes("github.io");
const isElectron = navigator.userAgent.toLowerCase().includes("electron");
const useHashRouter = isGHPages || isElectron;
const createRouter = (useHashRouter && createHashRouter) || createBrowserRouter;
const router = createRouter(resolveErrorBoundaries(appRoutes));

const root = document.querySelector("#root");
if (root) createRoot(root).render(<RouterProvider router={router} />);

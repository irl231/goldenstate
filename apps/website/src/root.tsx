import { isRouteErrorResponse, Outlet } from "react-router";

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }) {
  let message = "Oopsssssdsdsd!";
  let details = "An unexpected error occurred.";

  if (isRouteErrorResponse(error)) {
    switch (error.status) {
      case 404:
        message = "Not Found";
        details = "The requested page could not be found.";
        break;
      default:
        message = "Internal Server Error";
        details = error.statusText || details;
    }
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {error?.stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{error.stack}</code>
        </pre>
      )}
    </main>
  );
}

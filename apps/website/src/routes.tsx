import { type RouteObject } from "react-router";

import Home from "./pages/index";

export const routes: RouteObject[] = [
  {
    path: "/",
    children: [
      {
        index: true,
        element: <Home />,
      },
    ],
  },
];

import React from "react";
import { Link } from "react-router";

export const Page: React.FC = () => {
  return (
    <main>
      <h1>Hello wossssrld!</h1>
      <Link to="/posts">posts</Link>
      <Link to="/lorem">lorem</Link>
    </main>
  );
};

export default Page;
